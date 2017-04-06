var createTypes = require('./createTypes');
var createQueries = require('./createQueries');
var createMutations = require('./createMutations');
var graphql = require('graphql');

/**
 * Generate GraphQLSchema for provided sails.models
 * @param {object} sailsModels sails.models object
 */
function generateSchema(sailsModels) {
	var types = createTypes(sailsModels);
	var queries = createQueries(sailsModels, types);
	var mutations = createMutations(sailsModels, types);

	return new graphql.GraphQLSchema({
		query: new graphql.GraphQLObjectType({
			name: 'RootQueryType',
			fields: function fields() {
				return queries;
			}
		}),
		mutation: new graphql.GraphQLObjectType({
			name: 'RootMutationType',
			fields: function fields() {
				return mutations;
			}
		})
	});
}

module.exports = generateSchema;