const createTypes = require('./createTypes');
const createQueries = require('./createQueries');
const createMutations = require('./createMutations');
const graphql = require('graphql');

/**
 * Generate GraphQLSchema for provided sails.models
 * @param {object} sailsModels sails.models object
 */
function generateSchema(sailsModels) {
    let types = createTypes(sailsModels);
    let queries = createQueries(sailsModels, types);
    let mutations = createMutations(sailsModels, types);

    return new graphql.GraphQLSchema({
        query: new graphql.GraphQLObjectType({
            name: 'RootQueryType',
            fields: () => queries
        }),
        mutation: new graphql.GraphQLObjectType({
            name: 'RootMutationType',
            fields: () => mutations
        })
    });
}

module.exports = generateSchema;
