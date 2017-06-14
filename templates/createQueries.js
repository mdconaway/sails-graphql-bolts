const helpers = require('./helpers');
const resolvers = require('./resolvers');

/**
 * Create a query object type
 * @param model
 */
function createSingleQuery(model, queries, objectTypes) {
    let temp = helpers.getName(model);
    let queryName = temp.queryName;
    let queryTypeName = temp.queryTypeName;
    let typeName = temp.typeName;
    let args = helpers.getSingleQueryArgs(model._attributes);

    queries[queryName] = {
        name: queryTypeName,
        args: args,
        type: objectTypes[typeName],
        resolve: resolvers.resolveGetSingle(model)
    };
}

/**
 * Create a query object type for multiple instances
 * @param model
 */
function createRangeQuery(model, queries, objectTypes) {
    let temp = helpers.getName(model);
    let queryPluralName = temp.queryPluralName;
    let queryPluralTypeName = temp.queryPluralTypeName;
    let typeName = temp.typeName;
    let connectionTypeName = temp.connectionTypeName;

    queries[queryPluralName] = {
        name: queryPluralTypeName,
        type: helpers.getConnectionType(connectionTypeName, objectTypes[typeName]),
        args: helpers.connectionArgs,
        resolve: resolvers.resolveGetRange(model)
    };
}

/**
 * Populate 'queries' object and return it
 * @param models
 * @param types
 * @returns {object}
 */
function createQueries(models, types) {
    const queries = {};
    Object.keys(models).forEach((modelName) => {
        createSingleQuery(models[modelName], queries, types);
        createRangeQuery(models[modelName], queries, types);
    });

    return queries;
}

module.exports = createQueries;
