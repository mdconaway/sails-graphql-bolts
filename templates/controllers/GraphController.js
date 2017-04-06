/**
 * GraphController
 *
 * @description :: Server-side logic for managing graphQL queries
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */
var graphQL = require('graphql').graphql;
var printSchema = require('graphql').printSchema;
var sailsGraphql = require('./../index');
var introspectionQuery = require('graphql/utilities').introspectionQuery;
var schema;

module.exports = {
    getSchemaModels: function(){  //override this function to selectively return only some of your model data
        var models = sails.models;
        var graphable = {};
        Object.keys(models).forEach(function(key){  //we need this filter to eliminate shadow collections which arent directly query-able
            if(models[key].globalId)
            {
                graphable[key] = models[key];
            }
        });
        return graphable;
    },
    index: function(req, res){
        var sails = req._sails;
        var headers = Object.assign({}, req.headers, {graphql: true});
        var query = req.method === 'GET' ? req.query.ql : req.body.query;
        var variables = req.method === 'GET' ? req.query.where : req.body.variables;
        query = (query ? query : '') + '';
        variables = (variables === Object(variables) ? variables : null);
        if(typeof schema === 'undefined')
        {
            schema = sailsGraphql.generateSchema(this.getSchemaModels.call(this));
        }
        graphQL(
            schema,
            query,
            null,
            {
                request: sails.request,
                reqData: {
                    headers: headers
                }
            },
            variables
        ).then(function(result){
            res.ok(result);
        }).catch(function(e){
            res.badRequest(e);
        });
    },
    introspect: function(req, res){
        var sails = req._sails;
        var headers = Object.assign({}, req.headers, {graphql: true});
        if(typeof schema === 'undefined')
        {
            schema = sailsGraphql.generateSchema(this.getSchemaModels.call(this));
        }
        graphQL(
            schema,
            introspectionQuery,
            null,
            {
                request: sails.request,
                reqData: {
                    headers: headers
                }
            }
        ).then(function(result){
            res.ok(result);
        }).catch(function(e){
            res.badRequest(e);
        });
    }
};
