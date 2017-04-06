/**
 * Module dependencies
 */
var actionUtil = require('./actionUtil');
var _ = require('lodash');
var findOne = require('./findone');
var hasManyMap = void 0;
/**
 * Find Records
 *
 *  get   /:modelIdentity
 *   *    /:modelIdentity/find
 *
 * An API call to find and return model instances from the data adapter
 * using the specified criteria.  If an id was specified, just the instance
 * with that unique id will be returned.
 *
 * Optional:
 * @param {Object} where       - the find criteria (passed directly to the ORM)
 * @param {Integer} limit      - the maximum number of records to send back (useful for pagination)
 * @param {Integer} skip       - the number of records to skip (useful for pagination)
 * @param {String} sort        - the order of returned records, e.g. `name ASC` or `age DESC`
 * @param {String} callback - default jsonp callback param (i.e. the name of the js function returned)
 */
var arrayBranches = {
  $and: true,
  $or: true,
  and: true,
  or: true
};

function whereReduce(where, map, hash){
  var whereKeys = Object.keys(where);
  whereKeys.forEach(function(key){
    if(arrayBranches.hasOwnProperty(key) && Array.isArray(where[key]))
    {
      where[key] = arrayReduce(where[key], map, hash);
      if(where[key].length === 0)
      {
        delete where[key];
      }
    }
    else if(map[key])
    {
      if(hash[key])
      {
        hash[key] = hash[key].concat(Array.isArray(where[key]) ? where[key] : [where[key]]);
      }
      else
      {
        hash[key] = Array.isArray(where[key]) ? where[key] : [where[key]];
      }
      delete where[key];
    }
  });
  return where;
}

function arrayReduce(arr, map, hash){
  var tmp = [];
  arr.forEach(function(el){
    if(el === Object(el))
    {
      el = whereReduce(el, map, hash);
      if(Object.keys(el).length > 0)
      {
        tmp.push(el);
      }
    }
  });
  return tmp;
}

function findRecordsShim(req, res, where){
  var Model = actionUtil.parseModel(req);
  var limit = actionUtil.parseLimit(req);
  // Lookup for records that match the specified criteria
  async.parallel({
    count: function(done){
      Model.count(where).exec(done);
    },
    records: function(done){
      var query = Model.find()
      .where( where )
      .skip( actionUtil.parseSkip(req) )
      .sort( actionUtil.parseSort(req) )
      .limit( limit );
      query = actionUtil.populateRequest(query, req);
      query.exec(done);
    }
  },
  function(err, results){
    if (err) return res.serverError(err);
    this.interrupts.find.call(this, req, res, function(){
      if (req._sails.hooks.pubsub && req.isSocket) {
        Model.subscribe(req, results.records);
        if (req.options.autoWatch) { Model.watch(req); }
        // Also subscribe to instances of all associated models
        _.each(results.records, function (record) {
          actionUtil.subscribeDeep(req, record);
        });
      }
      res.ok({data: results.records, meta:{total: results.count}});
    }.bind(this), Model, results.records);
  }.bind(this));
}

module.exports = function(req, res) {
  // Look up the model
  var Model = actionUtil.parseModel(req);
  var modelName = Model.identity;
  var sails = req._sails;
  var where = actionUtil.parseCriteria(req);
  var whereKeys = Object.keys(where);
  var associations = req.options.associations;
  var DEFAULT_LIMIT = sails.config.blueprints.defaultLimit || 100;
  var manyToSomething = {};
  var parallels = {};
  var hasParallels = false;
  var matchingKeys = {};
  // If an `id` param was specified, use the findOne blueprint action
  // to grab the particular instance with its primary key === the value
  // of the `id` param.   (mainly here for compatibility for 0.9, where
  // there was no separate `findOne` action)
  if (actionUtil.parsePk(req)) {
    return findOne.call(this, req, res);
  }
  //--------------------------------------------------------------------------
  //this is all graphql specific to resolving many-to-many relationships------
  if(!hasManyMap)
  {
    hasManyMap = {};
    Object.keys(sails.models).forEach(function(k){
      var model = sails.models[k];
      if(model.globalId) //only user-defined models have a global-id
      {
        var name = model.identity;
        hasManyMap[name] = {};
        model.associations.forEach(function(assoc){
          if(assoc.type === 'collection')
          {
            var tgt = assoc.through ? assoc.through : assoc.collection;
            sails.models[tgt].associations.forEach(function(inverse){
              if(inverse.alias === assoc.via && inverse.type === 'collection')
              {
                hasManyMap[name][assoc.alias] = {type: 'many', collection: tgt, alias: inverse.alias}; //point the aliases at each other
              }
            });
          }
        });
      }
    });
  }
  //--------------------------------------------------------------------------
  manyToSomething = hasManyMap[modelName] ? hasManyMap[modelName] : {};
  where = whereReduce(where, manyToSomething, matchingKeys); //where reduce will alter the where object recursively and return a flat hash of all many-many relationships in the third argument
  Object.keys(matchingKeys).forEach(function(key){
    var q = {id: matchingKeys[key]};
    parallels[key] = function(done){
      sails.models[manyToSomething[key].collection].find().where(q).populate(manyToSomething[key].alias, {limit: DEFAULT_LIMIT}).exec(function(err, matchingRecords){
        if(err)return done(err);
        var ids = [];
        matchingRecords.forEach(function(record){
          ids = ids.concat(record[manyToSomething[key].alias].map(function(sublet){
            return sublet.id;
          }));
        });
        done(null, ids);
      });
    };
  });
  hasParallels = Object.keys(parallels).length > 0;
  //end this is all graphql specific to resolving many-to-many relationships--
  //--------------------------------------------------------------------------
  if(hasParallels)
  {
    async.parallel(parallels,
    function(err, results){
      var ids = [];
      var idFilter = {};
      if (err) return res.serverError(err);
      Object.keys(results).forEach(function(k){
        ids = ids.concat(results[k]);   //taking an intersection may be desireable, right now searching several MANY<->MANY relationships will act like an OR query
      });
      where.id = ids;
      findRecordsShim.call(this, req, res, where);
    }.bind(this));
  }
  else
  {
    findRecordsShim.call(this, req, res, where);
  }
};