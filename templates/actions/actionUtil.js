/**
 * Module dependencies
 */

const util = require('util');
const isString = require('lodash.isstring');
const isArray = require('lodash.isarray');
const isObject = require('lodash.isobject');
const isUndefined = require('lodash.isundefined');
const _ = require('lodash'); // TODO: replace lodash with individual per-method packages
const mergeDefaults = require('merge-defaults');

// Parameter used for jsonp callback is constant, as far as
// blueprints are concerned (for now.)
const JSONP_CALLBACK_PARAM = 'callback';

// TODO:
//
// Replace the following helper with the version in sails.util:

// Attempt to parse JSON
// If the parse fails, return the error object
// If JSON is falsey, return null
// (this is so that it will be ignored if not specified)
function tryToParseJSON(json) {
    if (!isString(json)) return null;
    try {
        return JSON.parse(json);
    } catch (e) {
        return e;
    }
}

/**
 * Utility methods used in built-in blueprint actions.
 *
 * @type {Object}
 */

module.exports = {
    /**
   * Given a Waterline query and an express request, populate
   * the appropriate/specified association attributes and
   * return it so it can be chained further ( i.e. so you can
   * .exec() it )
   *
   * @param  {Query} query         [waterline query object]
   * @param  {Request} req
   * @return {Query}
   */
    populateRequest: function(query, req) {
        let DEFAULT_POPULATE_LIMIT = req._sails.config.blueprints.defaultLimit || 30;
        let _options = req.options;
        let aliasFilter = req.param('populate');
        let shouldPopulate = _options.populate;

        // Convert the string representation of the filter list to an Array. We
        // need this to provide flexibility in the request param. This way both
        // list string representations are supported:
        //   /model?populate=alias1,alias2,alias3
        //   /model?populate=[alias1,alias2,alias3]
        if (typeof aliasFilter === 'string') {
            aliasFilter = aliasFilter.replace(/\[|\]/g, '');
            aliasFilter = aliasFilter ? aliasFilter.split(',') : [];
        }

        let associations = [];

        _.each(_options.associations, function(association) {
            // If an alias filter was provided, override the blueprint config.
            if (aliasFilter) {
                shouldPopulate = _.contains(aliasFilter, association.alias);
            }

            // Only populate associations if a population filter has been supplied
            // with the request or if `populate` is set within the blueprint config.
            // Population filters will override any value stored in the config.
            //
            // Additionally, allow an object to be specified, where the key is the
            // name of the association attribute, and value is true/false
            // (true to populate, false to not)
            if (shouldPopulate) {
                let populationLimit =
                    _options['populate_' + association.alias + '_limit'] ||
                    _options.populate_limit ||
                    _options.limit ||
                    DEFAULT_POPULATE_LIMIT;

                associations.push({
                    alias: association.alias,
                    limit: populationLimit
                });
            }
        });

        return module.exports.populateQuery(query, associations, req._sails);
    },

    /**
   * Given a Waterline query and Waterline model, populate the
   * appropriate/specified association attributes and return it
   * so it can be chained further ( i.e. so you can .exec() it )
   *
   * @param  {Query} query         [waterline query object]
   * @param  {Model} model         [waterline model object]
   * @return {Query}
   */
    populateModel: (query, model) => module.exports.populateQuery(query, model.associations),

    /**
  * Given a Waterline query, populate the appropriate/specified
  * association attributes and return it so it can be chained
  * further ( i.e. so you can .exec() it )
  *
  * @param  {Query} query         [waterline query object]
  * @param  {Array} associations  [array of objects with an alias
  *                                and (optional) limit key]
  * @return {Query}
  */
    populateQuery: function(query, associations, sails) {
        let DEFAULT_POPULATE_LIMIT = (sails && sails.config.blueprints.defaultLimit) || 30;

        return _.reduce(
            associations,
            (query, association) =>
                query.populate(association.alias, {
                    limit: association.limit || DEFAULT_POPULATE_LIMIT
                }),
            query
        );
    },

    /**
   * Subscribe deep (associations)
   *
   * @param  {[type]} associations [description]
   * @param  {[type]} record       [description]
   * @return {[type]}              [description]
   */
    subscribeDeep: function(req, record) {
        _.each(req.options.associations, function(assoc) {
            // Look up identity of associated model
            let ident = assoc[assoc.type];
            let AssociatedModel = req._sails.models[ident];

            if (req.options.autoWatch) {
                AssociatedModel.watch(req);
            }

            // Subscribe to each associated model instance in a collection
            if (assoc.type === 'collection') {
                _.each(record[assoc.alias], function(associatedInstance) {
                    AssociatedModel.subscribe(req, associatedInstance);
                });
            } else if (assoc.type === 'model' && record[assoc.alias]) {
                // If there is an associated to-one model instance, subscribe to it
                AssociatedModel.subscribe(req, record[assoc.alias]);
            }
        });
    },

    /**
   * Parse primary key value for use in a Waterline criteria
   * (e.g. for `find`, `update`, or `destroy`)
   *
   * @param  {Request} req
   * @return {Integer|String}
   */
    parsePk: function(req) {
        let pk = req.options.id || (req.options.where && req.options.where.id) || req.param('id');

        // TODO: make this smarter...
        // (e.g. look for actual primary key of model and look for it
        //  in the absence of `id`.)
        // See coercePK for reference (although be aware it is not currently in use)

        // exclude criteria on id field
        pk = _.isPlainObject(pk) ? undefined : pk;
        return pk;
    },

    /**
   * Parse primary key value from parameters.
   * Throw an error if it cannot be retrieved.
   *
   * @param  {Request} req
   * @return {Integer|String}
   */
    requirePk: function(req) {
        let pk = module.exports.parsePk(req);

        // Validate the required `id` parameter
        if (!pk) {
            let err = new Error(
                'No `id` parameter provided.' +
                    "(Note: even if the model's primary key is not named `id`- " +
                    '`id` should be used as the name of the parameter- it will be ' +
                    'mapped to the proper primary key name)'
            );
            err.status = 400;
            throw err;
        }

        return pk;
    },

    /**
   * Parse `criteria` for a Waterline `find` or `update` from all
   * request parameters.
   *
   * @param  {Request} req
   * @return {Object}            the WHERE criteria object
   */
    parseCriteria: function(req) {
        // Allow customizable blacklist for params NOT to include as criteria.
        req.options.criteria = req.options.criteria || {};
        req.options.criteria.blacklist = req.options.criteria.blacklist || ['limit', 'skip', 'sort', 'populate'];

        // Validate blacklist to provide a more helpful error msg.
        let blacklist = req.options.criteria && req.options.criteria.blacklist;
        if (blacklist && !isArray(blacklist)) {
            throw new Error(
                'Invalid `req.options.criteria.blacklist`. Should be an array of strings (parameter names.)'
            );
        }

        // Look for explicitly specified `where` parameter.
        let where = req.params.all().where;

        // If `where` parameter is a string, try to interpret it as JSON
        if (isString(where)) {
            where = tryToParseJSON(where);
        }

        // If `where` has not been specified, but other unbound parameter variables
        // **ARE** specified, build the `where` option using them.
        if (!where) {
            // Prune params which aren't fit to be used as `where` criteria
            // to build a proper where query
            where = req.params.all();

            // Omit built-in runtime config (like query modifiers)
            where = _.omit(where, blacklist || ['limit', 'skip', 'sort']);

            // Omit any params w/ undefined values
            where = _.omit(where, function(p) {
                if (isUndefined(p)) {
                    return true;
                }
            });

            // Omit jsonp callback param (but only if jsonp is enabled)
            let jsonpOpts = req.options.jsonp && !req.isSocket;
            jsonpOpts = isObject(jsonpOpts) ? jsonpOpts : { callback: JSONP_CALLBACK_PARAM };
            if (jsonpOpts) {
                where = _.omit(where, [jsonpOpts.callback]);
            }
        }

        // Merge w/ req.options.where and return
        where = _.merge({}, req.options.where || {}, where) || undefined;

        return where;
    },

    /**
   * Parse `values` for a Waterline `create` or `update` from all
   * request parameters.
   *
   * @param  {Request} req
   * @return {Object}
   */
    parseValues: function(req) {
        // Allow customizable blacklist for params NOT to include as values.
        req.options.values = req.options.values || {};
        req.options.values.blacklist = req.options.values.blacklist;

        // Validate blacklist to provide a more helpful error msg.
        let blacklist = req.options.values.blacklist;
        if (blacklist && !isArray(blacklist)) {
            throw new Error('Invalid `req.options.values.blacklist`. Should be an array of strings (parameter names.)');
        }

        // Start an array to hold values
        let values;

        // Make an array out of the request body data if it wasn't one already;
        // this allows us to process multiple entities (e.g. for use with a "create" blueprint) the same way
        // that we process singular entities.
        let bodyData = isArray(req.body) ? req.body : [req.allParams()];

        // Process each item in the bodyData array, merging with req.options, omitting blacklisted properties, etc.
        let valuesArray = _.map(bodyData, function(element) {
            let values;
            // Merge properties of the element into req.options.value, omitting the blacklist
            values = mergeDefaults(element, _.omit(req.options.values, 'blacklist'));
            // Omit properties that are in the blacklist (like query modifiers)
            values = _.omit(values, blacklist || []);
            // Omit any properties w/ undefined values
            values = _.omit(values, function(p) {
                if (isUndefined(p)) {
                    return true;
                }
            });

            return values;
        });

        // If req.body is an array, simply return our array of processed values
        if (isArray(req.body)) {
            return valuesArray;
        }

        // Otherwaise grab the first (and only) value from valuesArray
        values = valuesArray[0];

        // Omit jsonp callback param (but only if jsonp is enabled)
        let jsonpOpts = req.options.jsonp && !req.isSocket;
        jsonpOpts = isObject(jsonpOpts) ? jsonpOpts : { callback: JSONP_CALLBACK_PARAM };
        if (jsonpOpts) {
            values = _.omit(values, [jsonpOpts.callback]);
        }

        return values;
    },

    /**
   * Determine the model class to use w/ this blueprint action.
   * @param  {Request} req
   * @return {WLCollection}
   */
    parseModel: function(req) {
        // Ensure a model can be deduced from the request options.
        let model = req.options.model || req.options.controller;
        if (!model) throw new Error(util.format('No "model" specified in route options.'));

        let Model = req._sails.models[model];
        if (!Model)
            throw new Error(
                util.format('Invalid route option, "model".\nI don\'t know about any models named: `%s`', model)
            );

        return Model;
    },

    /**
   * @param  {Request} req
   */
    parseSort: function(req) {
        let sort = req.param('sort') || req.options.sort;
        if (isUndefined(sort)) {
            return undefined;
        }

        // If `sort` is a string, attempt to JSON.parse() it.
        // (e.g. `{"name": 1}`)
        if (isString(sort)) {
            try {
                sort = JSON.parse(sort);
            } catch (e) {
                // If it is not valid JSON, then fall back to interpreting it as-is.
                // (e.g. "name ASC")
            }
        }
        return sort;
    },

    /**
   * @param  {Request} req
   */
    parseLimit: function(req) {
        let DEFAULT_LIMIT = req._sails.config.blueprints.defaultLimit || 30;
        let limit =
            req.param('limit') || (typeof req.options.limit !== 'undefined' ? req.options.limit : DEFAULT_LIMIT);
        if (limit) {
            limit = +limit;
        }
        return limit;
    },

    /**
   * @param  {Request} req
   */
    parseSkip: function(req) {
        let DEFAULT_SKIP = 0;
        let skip = req.param('skip') || (typeof req.options.skip !== 'undefined' ? req.options.skip : DEFAULT_SKIP);
        if (skip) {
            skip = +skip;
        }
        return skip;
    }
};
