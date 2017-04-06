var helpers = require('./helpers');
var resolvers = require('./resolvers');
var queries = {};
var objectTypes = void 0;

/**
 * Create a query object type
 * @param model
 */
function createSingleQuery(model) {
	var temp = helpers.getName(model);
	var queryName = temp.queryName;
	var queryTypeName = temp.queryTypeName;
	var typeName = temp.typeName;
	var args = helpers.getSingleQueryArgs(model._attributes);

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
function createRangeQuery(model) {
	var temp = helpers.getName(model);
	var queryPluralName = temp.queryPluralName;
	var queryPluralTypeName = temp.queryPluralTypeName;
	var typeName = temp.typeName;
	var connectionTypeName = temp.connectionTypeName;

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
	queries = {};
	objectTypes = types;
	Object.keys(models).forEach(function (modelName) {
		createSingleQuery(models[modelName]);
		createRangeQuery(models[modelName]);
	});

	return queries;
}

module.exports = createQueries;