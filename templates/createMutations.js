var graphql = require('graphql');
var helpers = require('./helpers');
var resolvers = require('./resolvers');
var mutations = {};
var objectTypes = void 0;

function defineProperty(obj, key, value) {
	if(key in obj)
	{
		Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true });
	}
	else
	{
		obj[key] = value;
	}
	return obj;
}

/**
 * Create 'create' mutation type
 * @param {object} model sails model
 */
function createCreateMutation(model) {
	var temp = helpers.getName(model);
	var mutationCreateName = temp.mutationCreateName;
	var mutationCreateTypeName = temp.mutationCreateTypeName;
	var typeName = temp.typeName;
	var inputTypeName = temp.inputTypeName;
	var queryName = temp.queryName;

	mutations[mutationCreateName] = {
		name: mutationCreateTypeName,
		type: objectTypes[typeName],
		args: defineProperty({}, queryName, {
			type: new graphql.GraphQLNonNull(objectTypes[inputTypeName])
		}),
		resolve: resolvers.resolveCreate(model)
	};
}

/**
 * Create 'delete' mutation type
 * @param {object} model sails model
 */
function createDeleteMutation(model) {
	var temp = helpers.getName(model);
	var mutationDeleteName = temp.mutationDeleteName;
	var mutationDeleteTypeName = temp.mutationDeleteTypeName;
	var typeName = temp.typeName;

	mutations[mutationDeleteName] = {
		name: mutationDeleteTypeName,
		type: objectTypes[typeName],
		args: {
			id: {
				type: new graphql.GraphQLNonNull(helpers.dataTypes[model._attributes.id.type])
			}
		},
		resolve: resolvers.resolveDelete(model)
	};
}

/**
 * Create 'update' mutation type
 * @param {object} model sails model
 */
function createUpdateMutation(model) {
	var temp = helpers.getName(model);
	var mutationUpdateName = temp.mutationUpdateName;
	var mutationUpdateTypeName = temp.mutationUpdateTypeName;
	var typeName = temp.typeName;
	var inputTypeName = temp.inputTypeName;
	var queryName = temp.queryName;


	mutations[mutationUpdateName] = {
		name: mutationUpdateTypeName,
		type: objectTypes[typeName],
		args: defineProperty({
			id: {
				type: new graphql.GraphQLNonNull(helpers.dataTypes[model._attributes.id.type])
			}
		}, queryName, {
			type: new graphql.GraphQLNonNull(objectTypes[inputTypeName])
		}),
		resolve: resolvers.resolveUpdate(model)
	};
}

/**
 * Create fields for root mutation type
 * @param {object} models sails.models
 * @param {object} types predefined GraphQL object types
 * @returns {object} fields for root mutation type
 */
function createMutation(models, types) {
	objectTypes = types;
	Object.keys(models).forEach(function (modelName) {
		createCreateMutation(models[modelName]);
		createDeleteMutation(models[modelName]);
		createUpdateMutation(models[modelName]);
	});

	return mutations;
}

module.exports = createMutation;