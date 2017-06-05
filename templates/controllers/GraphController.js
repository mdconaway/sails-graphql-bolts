/**
 * GraphController
 *
 * @description :: Server-side logic for managing graphQL queries
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */
const { graphql, printSchema } = require('graphql');
const { introspectionQuery } = require('graphql/utilities');
const sailsGraphql = require('./../index');
const formatErrors = require('./../formatErrors');
let schema;

function getSchemaModels(sails) {
    //override this function to selectively return only some of your model data
    const models = sails.models;
    const graphable = {};
    Object.keys(models).forEach(key => {
        //we need this filter to eliminate shadow collections which arent directly query-able
        if (models[key].globalId) {
            graphable[key] = models[key];
        }
    });
    return graphable;
}

module.exports = {
    index(req, res) {
        const sails = req._sails;
        const headers = Object.assign({}, req.headers, { graphql: true });
        let query = req.method === 'GET' ? req.query.ql : req.body.query;
        let variables = req.method === 'GET' ? req.query.where : req.body.variables;
        query = (query ? query : '') + '';
        variables = variables === Object(variables) ? variables : null;
        if (typeof schema === 'undefined') {
            schema = sailsGraphql.generateSchema(getSchemaModels(sails));
        }
        graphql(
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
        )
            .then(result => {
                if (Array.isArray(result.errors)) {
                    result.errors = formatErrors(result.errors);
                }
                res.ok(result);
            })
            .catch(e => {
                res.badRequest(e);
            });
    },
    introspect(req, res) {
        const sails = req._sails;
        const headers = Object.assign({}, req.headers, { graphql: true });
        if (typeof schema === 'undefined') {
            schema = sailsGraphql.generateSchema(getSchemaModels(sails));
        }
        graphql(schema, introspectionQuery, null, {
            request: sails.request,
            reqData: {
                headers: headers
            }
        })
            .then(result => {
                res.ok(result);
            })
            .catch(e => {
                res.badRequest(e);
            });
    }
};
