const graphql = require('graphql');
const helpers = require('./helpers');
const resolvers = require('./resolvers');
// Cache of generated Object Types
const objectTypes = {};
let models = void 0;

/**
 * Generate fields for GraphQLObjectType or GraphQLInputObjectType
 * for provided sails model's attributes
 * @param {object} modelObject Sails model
 * @param {boolean} isInputType
 * for GraphQLInputType or not
 */
function getObjectFields(modelObject, isInputType) {
    let attributes = modelObject._attributes;
    let queryName = helpers.getName(modelObject).queryName;
    isInputType = isInputType === undefined ? false : isInputType;
    // Go through all fields and return object of
    // converted sails types to GraphQL types

    return () =>
        Object.keys(attributes).reduce(function(fields, fieldName) {
            let temp = attributes[fieldName];
            let type = temp.type;
            let collection = temp.collection;
            let model = temp.model;
            // Field type must be either `type`, `collection` or `model`
            let attrType = type || collection || model;
            let throughModel = temp.through;
            let fieldTypeName = void 0;
            let childModel = void 0;
            let fieldType;
            let fieldConnectionTypeName;

            // Check whether fieldType was provided
            if (!attrType) {
                console.error(
                    "\n\t\t\t\tEach field must have either 'type', 'collection' or 'model' \n\t\t\t\tproperty defined. Field '" +
                        fieldName +
                        "' was omitted.\n\t\t\t"
                );
                return fields;
            }

            if (model || collection) {
                childModel = throughModel ? models[throughModel.toLowerCase()] : models[attrType.toLowerCase()];
                fieldTypeName = isInputType
                    ? helpers.getName(childModel).inputTypeName
                    : helpers.getName(childModel).typeName;
            }

            // Check whether field has supported type
            if (helpers.supportedTypes.indexOf(attrType) === -1 && !objectTypes[fieldTypeName]) {
                console.error(
                    "\n\t\t\t\tField '" +
                        fieldName +
                        "' has unsupported type \n\t\t\t\t'" +
                        attrType +
                        "' and was omitted.\n\t\t\t"
                );
                return fields;
            }

            fieldType = helpers.dataTypes[attrType] || objectTypes[fieldTypeName];
            fields[fieldName] = {};

            if (type) {
                fields[fieldName] = {
                    type: fieldType
                };
                return fields;
            }
            if (isInputType && model) {
                fields[fieldName] = {
                    type: fieldType
                };
                return fields;
            }
            if (model) {
                fields[fieldName] = {
                    type: fieldType,
                    args: helpers.singleResolverArgs,
                    resolve: resolvers.resolveGetNestedSingle(fieldName, childModel)
                };
                return fields;
            }
            if (isInputType && collection) {
                fields[fieldName].type = new graphql.GraphQLList(fieldType);
                return fields;
            }

            //Only collections make it this far, and all collection associations should have a "via" key
            fieldConnectionTypeName = helpers.getName(modelObject, fieldName).fieldConnectionTypeName;
            fields[fieldName] = {
                type: helpers.getConnectionType(fieldConnectionTypeName, fieldType),
                args: helpers.connectionArgs,
                // Getting the field's model
                resolve: resolvers.resolveGetRange(childModel, temp.via ? temp.via : queryName)
            };

            return fields;
        }, {});
}

/**
 * Create a GraphQLObjectType for provided sails model
 * @param {object} model sails model
 */
function createOutputType(model) {
    // Define output type name
    let typeName = helpers.getName(model).typeName;

    objectTypes[typeName] = new graphql.GraphQLObjectType({
        name: typeName,
        fields: getObjectFields(model)
    });
}

/**
 * Create a GraphQLInputObjectType for sails model
 * @param {object} model sails model
 */
function createInputType(model) {
    // Define output type name
    let inputTypeName = helpers.getName(model).inputTypeName;

    objectTypes[inputTypeName] = new graphql.GraphQLInputObjectType({
        name: inputTypeName,
        fields: getObjectFields(model, true)
    });
}

/**
 * Return an object of GraphQLObjectType and GraphQLInputObjectType
 * for each given sails model
 * @param {object} sailsModels sails.models
 * @returns {object} Output and Input object types
 */
function createTypes(sailsModels) {
    models = sailsModels;
    Object.keys(models).forEach(function(modelName) {
        createOutputType(models[modelName]);
        createInputType(models[modelName]);
    });

    return objectTypes;
}

module.exports = createTypes;
