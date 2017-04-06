/**
 * Module dependencies
 */

var actionUtil = require('./actionUtil');
var util = require('util');
var _ = require('lodash');
var async = require('async');
var pluralize = require('pluralize');

/**
 * Update One Record
 *
 * An API call to update a model instance with the specified `id`,
 * treating the other unbound parameters as attributes.
 *
 * @param {Integer|String} id  - the unique id of the particular record you'd like to update  (Note: this param should be specified even if primary key is not `id`!!)
 * @param *                    - values to set on the record
 *
 */
 function resolveCreate(req, model, values, cb) {
  var modelIdentity = model.identity;
  req._sails.request({
    method: 'POST',
    url: '/' + pluralize(modelIdentity),
    headers: req.headers
  }, values, function (err, res) {
    if (err) {
      return cb(err);
    }
    cb(null, res.body[model.primaryKey]);
  });
}

function resolveUpdate(req, model, values, cb) {
  var modelIdentity = model.identity;
  req._sails.request({
    method: 'PUT',
    url: '/' + pluralize(modelIdentity) + '/' + values.id,
    headers: req.headers
  }, values, function (err, res) {
    if (err) {
      return cb(err);
    }
    cb(null, res.body[model.primaryKey]);
  });
}

function createOrUpdateResolve(req, model, values){
  return function(done){
    if(values && values[model.primaryKey])
    {
      resolveUpdate(req, model, values, done);
    }
    else
    {
      resolveCreate(req, model, values, done);
    }
  };
}

function deShimRelations(sails, Model, data){
  var container = {};
  _.each(Model.attributes, function(value, key){
    var obj = data[key];
    var isObject = _.isPlainObject(obj);
    if(value.model && isObject && Object.keys(obj).length === 1 && typeof obj[sails.models[value.model].primaryKey] !== 'undefined')
    {
      data[key] = obj[sails.models[value.model].primaryKey];
    }
    else if((value.model && isObject) || (value.collection && Array.isArray(obj)))
    {
      container[key] = obj;
      delete data[key];
    }
  });
  return container;
}

function generateRelations(req, Model, data){
  var sails = req._sails;
  var associations = {};
  _.each(Model.attributes, function(value, key){
    if(value.model && _.isPlainObject(data[key]))
    {
      var obj = data[key];
      if(Object.keys(obj).length === 1 && typeof obj[sails.models[value.model].primaryKey] !== 'undefined')
      {
        associations[key] = function(done){
          process.nextTick(function(){
            done(null, obj[sails.models[value.model].primaryKey]);
          });
        };/* Resolver to return id, graphQL requires at least an object with id for embedded docs */
      }
      else
      {
        associations[key] = createOrUpdateResolve(req, sails.models[value.model], obj);
      }
    }
    else if(value.collection && value.via && Array.isArray(data[key]))
    {
      associations[key] = [];
      data[key].forEach(function(obj){
        var isObject = _.isPlainObject(obj);
        var tgt = value.through ? value.through : value.collection;
        if(isObject && Object.keys(obj).length === 1 && typeof obj[sails.models[tgt].primaryKey] !== 'undefined')
        {
          associations[key].push(function(done){
            process.nextTick(function(){
              done(null, obj[sails.models[tgt].primaryKey]);
            });
          }/* Resolver to return id, graphQL requires at least an object with id for embedded docs */);
        }
        else if(isObject)
        {
          obj[value.via] = sails.models[tgt].attributes[value.via].model ? data[Model.primaryKey] : [data[Model.primaryKey]];
          associations[key].push(createOrUpdateResolve(req, sails.models[tgt], obj)/* Resolver to create/update and return id*/);
        }
        else
        {
          associations[key].push(function(done){
            process.nextTick(function(){
              done(null, obj);
            });
          }/* Resolver to return id */);
        }
      });
    }
  });
  return associations;
}

function asyncMatrix(obj, done){
  var newHash = {};
  Object.keys(obj).forEach(function(key){
    if(Array.isArray(obj[key]))
    {
      newHash[key] = function(done){
        async.parallel(obj[key], done);
      };
    }
    else
    {
      newHash[key] = obj[key];
    }
  });
  if(Object.keys(newHash).length)
  {
    return async.parallel(newHash, done);
  }
  done(null, {});
}

function reShimRelations(sails, Model, relationships){
  var newValues = {};
  //DONT PROPAGATE RELATIONAL ARRAYS FOR Many->1
  Object.keys(relationships).forEach(function(key){
    var attr = Model.attributes[key];
    if(attr.model)
    {
      newValues[key] = relationships[key];
    }
    else
    {
      var tgt = Model.attributes[key].through ? Model.attributes[key].through : Model.attributes[key].collection;
      if(!sails.models[tgt].attributes[attr.via].model)
      {
        newValues[key] = relationships[key];
      }
    }
  });
  return newValues;
}

function finalize(req, res, Model, records){
  var pk = actionUtil.requirePk(req);
  this.interrupts.afterUpdate.call(this, req, res, function(){
      // If we have the pubsub hook, use the Model's publish method
      // to notify all subscribers about the update.
      if (req._sails.hooks.pubsub) {
        if (req.isSocket) { Model.subscribe(req, [records.after]); }
        Model.publishUpdate(pk, _.cloneDeep(records.values), !req.options.mirror && req, {
          previous: _.cloneDeep(records.before.toJSON())
        });
      }
      // Do a final query to populate the associations of the record.
      //
      // (Note: again, this extra query could be eliminated, but it is
      //  included by default to provide a better interface for integrating
      //  front-end developers.)
      var Q = Model.findOne(records.after[Model.primaryKey]);
      Q = actionUtil.populateRequest(Q, req);
      Q.exec(function (err, populatedRecord) {
        if (err) return res.serverError(err);
        if (!populatedRecord) return res.serverError('Could not find record after updating!');
        res.ok(populatedRecord);
      }.bind(this)); // </foundAgain>
  }.bind(this), Model, records);
}

module.exports = function(req, res) {
  // Look up the model
  var Model = actionUtil.parseModel(req);
  // Locate and validate the required `id` parameter.
  var pk = actionUtil.requirePk(req);
  // Default the value blacklist to just "id", so that models that have an
  // "id" field that is _not_ the primary key don't have the id field
  // updated mistakenly.  See https://github.com/balderdashy/sails/issues/3625
  req.options.values = req.options.values || {};
  req.options.values.blacklist = req.options.values.blacklist || ['id'];
  // Create `values` object (monolithic combination of all parameters)
  // But omit the blacklisted params (like JSONP callback param, etc.)
  var values = actionUtil.parseValues(req);
  // No matter what, don't allow changing the PK via the update blueprint
  // (you should just drop and re-add the record if that's what you really want)
  if (typeof values[Model.primaryKey] !== 'undefined' && values[Model.primaryKey] != pk)
  {
    req._sails.log.warn('Cannot change primary key via update blueprint; ignoring value sent for `' + Model.primaryKey + '`');
  }
  // Make sure the primary key is unchanged
  values[Model.primaryKey] = pk;

  // Find and update the targeted record.
  //
  // (Note: this could be achieved in a single query, but a separate `findOne`
  //  is used first to provide a better experience for front-end developers
  //  integrating with the blueprint API.)
  var query = Model.findOne(pk);
  // Populate the record according to the current "populate" settings
  //query = actionUtil.populateRequest(query, req);
  query.exec(function (err, matchingRecord) {
    if (err) return res.serverError(err);
    if (!matchingRecord) return res.notFound();
    var shimmedOut = deShimRelations(sails, Model, values);
    this.interrupts.beforeUpdate.call(this, req, res, function(){
      Model.update(pk, values).exec(function (err, records) {
        // Differentiate between waterline-originated validation errors
        // and serious underlying issues. Respond with badRequest if a
        // validation error is encountered, w/ validation info.
        if (err) return res.negotiate(err);
        // Because this should only update a single record and update
        // returns an array, just use the first item.  If more than one
        // record was returned, something is amiss.
        if (!records || !records.length || records.length > 1) {
          req._sails.log.warn(
          util.format('Unexpected output from `%s.update`.', Model.globalId)
          );
        }
        shimmedOut[Model.primaryKey] = pk;
        var updatedRecord = records[0];
        var postOp = generateRelations(req, Model, shimmedOut);
        asyncMatrix(postOp, function(err, results){
          if(err || Object.keys(results).length === 0)
          {
            return finalize.call(this, req, res, Model, {before: matchingRecord, after: updatedRecord, values: values});
          }
          Model.findOne(pk).exec(function(err, foundRecord){
            var newValues = Object.assign({}, foundRecord.toJSON(), reShimRelations(sails, Model, results));
            Model.update(pk, newValues).exec(function(err, finalUpdates){
              if (err) return res.negotiate(err);
              // Because this should only update a single record and update
              // returns an array, just use the first item.  If more than one
              // record was returned, something is amiss.
              if (!finalUpdates || !finalUpdates.length || finalUpdates.length > 1)
              {
                req._sails.log.warn(util.format('Unexpected output from `%s.update`.', Model.globalId));
              }
              return finalize.call(this, req, res, Model, {before: matchingRecord, after: finalUpdates[0], values: values});
            }.bind(this));
          }.bind(this));
        }.bind(this));
      }.bind(this));// </updated>
    }.bind(this), Model, values);
  }.bind(this)); // </found>
};
