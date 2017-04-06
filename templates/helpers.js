var pluralize = require('pluralize');
var graphql = require('graphql');
var GraphQLJSON = require('graphql-type-json');

// Sails to GraphQL types conversion
var dataTypes = {
	json: GraphQLJSON,
	array: new graphql.GraphQLList(graphql.GraphQLString),
	string: graphql.GraphQLString,
    email: graphql.GraphQLString,
	text: graphql.GraphQLString,
	integer: graphql.GraphQLInt,
	float: graphql.GraphQLFloat,
	date: graphql.GraphQLString,
	datetime: graphql.GraphQLString,
	boolean: graphql.GraphQLBoolean,
	objectid: graphql.GraphQLID
};

var supportedTypes = Object.keys(dataTypes);

var singleResolverArgs = {
    id: { type: graphql.GraphQLID }
};
// Defining query args
// Disabling max-len rule due to long docs link
/* eslint-disable max-len */
var connectionArgs = {
	// `where` is JSON-like string
	// used for filtering data
	// where: "{
	//   \"someProp\": \"someValue\",
	//   \"otherProp\": {
	//     \"contains\": \"a\"
	//   }
	// }"
	// For full reference see
	// https://github.com/balderdashy/waterline-docs/blob/master/queries/query-language.md
	where: { type: graphql.GraphQLString },
	limit: { type: graphql.GraphQLInt },
	skip: { type: graphql.GraphQLInt },
	sort: { type: graphql.GraphQLString }
};

/**
 * Make the first letter of the `string` upper cased
 * @param {string} string
 * @returns {string}
 */
function firstLetterToUpperCase(string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Make the first letter of the `string` lower cased
 * @param {string} string
 * @returns {string}
 */
function firstLetterToLowerCase(string) {
	return string.charAt(0).toLowerCase() + string.slice(1);
}

/**
 * Generate Type and Query names from a model name
 * @param {object} model Sails model object
 * @param {string} [fieldKey]
 * @returns {object}
 */
function getName(model) {
	var fieldKey = arguments.length <= 1 || arguments[1] === undefined ? '' : arguments[1];
	// Get model globalId to have original modal name (with correct case)
	// Basically it should start with upper cased letter
	var modelTypeName = model.globalId;
	// Make sure the first letter of field name is upper cased
	var fieldName = firstLetterToUpperCase(fieldKey);
	// Will be used as GraphQL query field identifier
	// Basically it should start with lower cased letter
	var modelName = firstLetterToLowerCase(modelTypeName);

	// TODO make an ability to customize this names
	// (for example from model definition file)
	return {
		typeName: modelTypeName + 'Type',
		inputTypeName: modelTypeName + 'InputType',
		connectionTypeName: modelTypeName + 'ConnectionType',
		fieldConnectionTypeName: '' + modelTypeName + fieldName + 'ConnectionType',
		fieldUnionTypeName: '' + modelTypeName + fieldName + 'UnionType',
		queryName: '' + modelName,
		queryPluralName: '' + pluralize(modelName),
		queryTypeName: modelTypeName + 'Query',
		queryPluralTypeName: modelTypeName + 'RangeQuery',
		mutationCreateName: 'create' + modelTypeName,
		mutationCreateTypeName: 'Create' + modelTypeName + 'Mutation',
		mutationDeleteName: 'delete' + modelTypeName,
		mutationDeleteTypeName: 'Delete' + modelTypeName + 'Mutation',
		mutationUpdateName: 'update' + modelTypeName,
		mutationUpdateTypeName: 'Update' + modelTypeName + 'Mutation'
	};
}

/**
 * Create connection type with predefined field
 * @param {string} name
 * @param {GraphQLObjectType} edgesType
 */
function getConnectionType(name, edgesType) {
	return new graphql.GraphQLObjectType({
		name: name,
		fields: function fields() {
			return {
				page: { type: graphql.GraphQLInt },
				pages: { type: graphql.GraphQLInt },
				perPage: { type: graphql.GraphQLInt },
				total: { type: graphql.GraphQLInt },
				edges: { type: new graphql.GraphQLList(edgesType) }
			};
		}
	});
}

/**
 * Return an array of model unique fields' names
 * @param attributes
 * @returns {Array.<T>}
 */
function getUniqueFields(attributes) {
	return Object.keys(attributes).filter(function (fieldName) {
		return attributes[fieldName].unique === true;
	});
}

/**
 * Create an args object for sinqle query
 * @param attributes
 */
function getSingleQueryArgs(attributes) {
	var uniqueFields = getUniqueFields(attributes);
	return uniqueFields.reduce(function (args, fieldName) {
		args[fieldName] = {
			type: dataTypes[attributes[fieldName].type]
		};
		return args;
	}, {});
}

module.exports = {
	firstLetterToUpperCase: firstLetterToUpperCase,
	firstLetterToLowerCase: firstLetterToLowerCase,
	getName: getName,
	getConnectionType: getConnectionType,
	getUniqueFields: getUniqueFields,
	getSingleQueryArgs: getSingleQueryArgs,
	dataTypes: dataTypes,
	supportedTypes: supportedTypes,
	connectionArgs: connectionArgs,
    singleResolverArgs: singleResolverArgs
};