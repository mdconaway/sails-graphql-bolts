/**
 * Module dependencies
 */
const actionUtil = require('./actionUtil');
const _ = require('lodash');
const async = require('async');
const pluralize = require('pluralize');

/**
 * Create Record
 *
 * post /:modelIdentity
 *
 * An API call to find and return a single model instance from the data adapter
 * using the specified criteria.  If an id was specified, just the instance with
 * that unique id will be returned.
 *
 * Optional:
 * @param {String} callback - default jsonp callback param (i.e. the name of the js function returned)
 * @param {*} * - other params will be used as `values` in the create
 */

function resolveCreate(req, model, values, cb) {
    let modelIdentity = model.identity;
    req._sails.request(
        {
            method: 'POST',
            url: '/' + pluralize(modelIdentity),
            headers: req.headers
        },
        values,
        (err, res) => {
            if (err) {
                return cb(err);
            }
            cb(null, res.body[model.primaryKey]);
        }
    );
}

function resolveUpdate(req, model, values, cb) {
    let modelIdentity = model.identity;
    req._sails.request(
        {
            method: 'PUT',
            url: '/' + pluralize(modelIdentity) + '/' + values.id,
            headers: req.headers
        },
        values,
        (err, res) => {
            if (err) {
                return cb(err);
            }
            cb(null, res.body[model.primaryKey]);
        }
    );
}

function createOrUpdateResolve(req, model, values) {
    return done => {
        if (values && values[model.primaryKey]) {
            resolveUpdate(req, model, values, done);
        } else {
            resolveCreate(req, model, values, done);
        }
    };
}

function deShimRelations(sails, Model, data) {
    let container = {};
    _.each(Model.attributes, (value, key) => {
        let obj = data[key];
        let isObject = _.isPlainObject(obj);
        if (
            value.model &&
            isObject &&
            Object.keys(obj).length === 1 &&
            typeof obj[sails.models[value.model].primaryKey] !== 'undefined'
        ) {
            data[key] = obj[sails.models[value.model].primaryKey];
        } else if ((value.model && isObject) || (value.collection && Array.isArray(obj))) {
            container[key] = obj;
            delete data[key];
        }
    });
    return container;
}

function generateRelations(req, Model, data) {
    let sails = req._sails;
    let associations = {};
    _.each(Model.attributes, (value, key) => {
        if (value.model && _.isPlainObject(data[key])) {
            let obj = data[key];
            if (Object.keys(obj).length === 1 && typeof obj[sails.models[value.model].primaryKey] !== 'undefined') {
                associations[key] = done => {
                    process.nextTick(() => {
                        done(null, obj[sails.models[value.model].primaryKey]);
                    });
                }; /* Resolver to return id, graphQL requires at least an object with id for embedded docs */
            } else {
                associations[key] = createOrUpdateResolve(req, sails.models[value.model], obj);
            }
        } else if (value.collection && value.via && Array.isArray(data[key])) {
            associations[key] = [];
            data[key].forEach(obj => {
                let isObject = _.isPlainObject(obj);
                let tgt = value.through ? value.through : value.collection;
                if (
                    isObject &&
                    Object.keys(obj).length === 1 &&
                    typeof obj[sails.models[tgt].primaryKey] !== 'undefined'
                ) {
                    associations[key].push(
                        done => {
                            process.nextTick(() => {
                                done(null, obj[sails.models[tgt].primaryKey]);
                            });
                        } /* Resolver to return id, graphQL requires at least an object with id for embedded docs */
                    );
                } else if (isObject) {
                    obj[value.via] = sails.models[tgt].attributes[value.via].model
                        ? data[Model.primaryKey]
                        : [data[Model.primaryKey]];
                    associations[key].push(
                        createOrUpdateResolve(req, sails.models[tgt], obj) /* Resolver to create/update and return id*/
                    );
                } else {
                    associations[key].push(
                        done => {
                            process.nextTick(() => {
                                done(null, obj);
                            });
                        } /* Resolver to return id */
                    );
                }
            });
        }
    });
    return associations;
}

function asyncMatrix(obj, done) {
    let newHash = {};
    Object.keys(obj).forEach(key => {
        if (Array.isArray(obj[key])) {
            newHash[key] = done => {
                async.parallel(obj[key], done);
            };
        } else {
            newHash[key] = obj[key];
        }
    });
    if (Object.keys(newHash).length) {
        return async.parallel(newHash, done);
    }
    done(null, {});
}

function reShimRelations(sails, Model, relationships) {
    let newValues = {};
    //DONT PROPAGATE RELATIONAL ARRAYS FOR Many->1
    Object.keys(relationships).forEach(key => {
        let attr = Model.attributes[key];
        if (attr.model) {
            newValues[key] = relationships[key];
        } else {
            let tgt = Model.attributes[key].through ? Model.attributes[key].through : Model.attributes[key].collection;
            if (!sails.models[tgt].attributes[attr.via].model) {
                newValues[key] = relationships[key];
            }
        }
    });
    return newValues;
}

function finalize(interrupts, req, res, Model, newInstance) {
    interrupts.create.call(
        this,
        req,
        res,
        () => {
            // If we have the pubsub hook, use the model class's publish method
            // to notify all subscribers about the created item
            if (req._sails.hooks.pubsub) {
                if (req.isSocket) {
                    Model.subscribe(req, newInstance);
                    Model.introduce(newInstance);
                }

                // Make sure data is JSON-serializable before publishing
                let publishData = _.isArray(newInstance)
                    ? _.map(newInstance, instance => instance.toJSON())
                    : newInstance.toJSON();
                Model.publishCreate(publishData, !req.options.mirror && req);
            }
            // Send JSONP-friendly response if it's supported
            res.ok(newInstance);
        },
        Model,
        newInstance
    );
}

module.exports = function(interrupts) {
    return function(req, res) {
        let sails = req._sails;
        let Model = actionUtil.parseModel(req);
        // Create data object (monolithic combination of all parameters)
        // Omit the blacklisted params (like JSONP callback param, etc.)
        let values = actionUtil.parseValues(req);
        //strips nested relationships out of the base model
        let shimmedOut = deShimRelations(sails, Model, values);
        // Create new instance of model using data from params
        Model.create(values).exec((err, newInstance) => {
            // Differentiate between waterline-originated validation errors
            // and serious underlying issues. Respond with badRequest if a
            // validation error is encountered, w/ validation info.
            if (err) return res.negotiate(err);
            shimmedOut[Model.primaryKey] = newInstance[Model.primaryKey];
            let postOp = generateRelations(req, Model, shimmedOut);
            asyncMatrix(postOp, (err, results) => {
                if (err || Object.keys(results).length === 0) {
                    return finalize.call(this, interrupts, req, res, Model, newInstance);
                }
                Model.findOne(newInstance[Model.primaryKey]).exec((err, foundRecord) => {
                    if (err) return res.serverError(err);
                    if (!foundRecord) return res.serverError('Could not find record after creating!');

                    let newValues = Object.assign({}, foundRecord.toJSON(), reShimRelations(sails, Model, results));

                    Model.update(newInstance[Model.primaryKey], newValues).exec((err, updatedRecords) => {
                        let Q = Model.findOne(newInstance[Model.primaryKey]);
                        Q = actionUtil.populateRequest(Q, req);
                        Q.exec((err, populatedRecord) => {
                            if (err) return res.serverError(err);
                            if (!populatedRecord) return res.serverError('Could not find record after updating!');
                            return finalize.call(this, interrupts, req, res, Model, populatedRecord);
                        }); // </foundAgain>
                    });
                }); // </foundAgain>
            });
        });
    };
};
