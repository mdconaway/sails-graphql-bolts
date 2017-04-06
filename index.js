/**
 * Module dependencies
 */

var fs = require('fs');
var util = require('util');
var _ = require('lodash');
_.defaults = require('merge-defaults');
var acceptedCommands = ['controller', 'resource', 'policies'];

/**
 * INVALID_SCOPE_VARIABLE()
 *
 * Helper method to put together a nice error about a missing or invalid
 * scope variable. We should always validate any required scope variables
 * to avoid inadvertently smashing someone's filesystem.
 *
 * @param {String} varname [the name of the missing/invalid scope variable]
 * @param {String} details [optional - additional details to display on the console]
 * @param {String} message [optional - override for the default message]
 * @return {Error}
 * @api private
 */

function INVALID_SCOPE_VARIABLE (varname, details, message) {
  var DEFAULT_MESSAGE =
  'Issue encountered in generator "graphql-bolts":\n'+
  'Missing required scope variable: `%s`"\n' +
  'If you are the author of `sails-graphql-bolts`, please resolve this '+
  'issue and publish a new patch release.';

  message = (message || DEFAULT_MESSAGE) + (details ? '\n'+details : '');
  message = util.inspect(message, varname);

  return new Error(message);
}
/**
 * sails-graphql-bolts
 *
 * Usage:
 * `sails generate graphql-bolts`
 *
 * @description Generates an graphql-bolts entity
 * @help See http://links.sailsjs.org/docs/generators
 */

module.exports = {
    /**
     * `before()` is run before executing any of the `targets`
     * defined below.
     *
     * This is where we can validate user input, configure default
     * scope variables, get extra dependencies, and so on.
     *
     * @param  {Object} scope
     * @param  {Function} cb    [callback]
     */

    before: function (scope, cb) {
        if (!scope.args[0]) 
        {
            return cb(new Error('Please provide a type for graphql-bolts to generate.'));
        }
        else if (acceptedCommands.indexOf(scope.args[0]) === -1)
        {
            return cb(new Error('Please enter a valid command. Supported commands: ' + acceptedCommands.join()))
        }
        scope.generatorName = scope.args[0];
        
        if (!scope.rootPath) 
        {
            return cb(INVALID_SCOPE_VARIABLE('rootPath') );
        }

        _.defaults(scope, {
            createdAt: new Date()
        });

        if(scope.args[0] === 'controller' || scope.args[0] === 'resource')
        {
            if(typeof scope.args[1] === 'string' && scope.args[1].trim().length > 0)
            {
                scope.filename = scope.args[1].trim().replace(/(^| )(\w)/g, function(x) {
                    return x.toUpperCase();
                }) + 'Controller';
            }
            else
            {
                return cb(new Error('Please enter a valid name for your new ' + scope.args[0]));
            }
        }
        else
        {
            scope.filename = scope.args[0];
        }

        cb();
    },

    /**
     * The files/folders to generate.
     * @type {Object}
     */
    targets: {
        './': {
            exec: function ( scope, cb ) {
                if(!fs.existsSync(scope.rootPath + '/api')) 
                {
                    fs.mkdirSync(scope.rootPath + '/api');
                }
                if(scope.generatorName === 'controller')
                {
                    if(!scope.force && fs.existsSync( scope.rootPath + '/api/controllers/' + scope.filename + '.js' )) 
                    {
                        return cb( new Error( 'Graph controller detected at specified path, not overwriting. To overwrite use --force.' ) );
                    }
                    else
                    {
                        if(!fs.existsSync(scope.rootPath + '/api/controllers')) 
                        {
                            fs.mkdirSync(scope.rootPath + '/api/controllers');
                        }
                        fs.writeFileSync(scope.rootPath + '/api/controllers/' + scope.filename + '.js', 'module.exports = require(\'sails-graphql-bolts\').controller;\n');
                        console.info('Created controller: ' + scope.rootPath + '/api/controllers/' + scope.filename + '.js');
                    }
                }
                else if(scope.generatorName === 'resource')
                {
                    if(!scope.force && fs.existsSync( scope.rootPath + '/api/controllers/' + scope.filename + '.js' )) 
                    {
                        return cb( new Error( 'Graph resource detected at specified path, not overwriting. To overwrite use --force.' ) );
                    }
                    else
                    {
                        if(!fs.existsSync(scope.rootPath + '/api/controllers')) 
                        {
                            fs.mkdirSync(scope.rootPath + '/api/controllers');
                        }
                        fs.writeFileSync(scope.rootPath + '/api/controllers/' + scope.filename + '.js', 'var GraphQLBolts = require(\'sails-graphql-bolts\');\nmodule.exports = new GraphQLBolts.resource();\n');
                        console.info('Created controller: ' + scope.rootPath + '/api/controllers/' + scope.filename + '.js');
                    }
                }
                else
                {
                    if(!fs.existsSync(scope.rootPath + '/api/policies')) 
                    {
                        fs.mkdirSync(scope.rootPath + '/api/policies');
                    }
                    ['Create', 'Destroy', 'Find', 'FindOne', 'Populate', 'Update'].forEach(function(file){
                        if(!scope.force && fs.existsSync(scope.rootPath + '/api/policies/graph' + file + '.js'))
                        {
                            console.info('Policy graph' + file + ' detected, skipping. To overwrite use --force.');
                        }
                        else
                        {
                            fs.writeFileSync(scope.rootPath + '/api/policies/graph' + file + '.js', 'var GraphQLBolts = require(\'sails-graphql-bolts\');\nmodule.exports = new GraphQLBolts.policies.graph' + file + '();\n');
                            console.info('Created policy: ' + scope.rootPath + '/api/controllers/policies/graph' + file + '.js');
                        }
                    });
                }
                cb();
            }
        }
    },


    /**
     * The absolute path to the `templates` for this generator
     * (for use with the `template` helper)
     *
     * @type {String}
     */
    templatesDirectory: require('path').resolve(__dirname, './templates')
};

module.exports.controller = require('./templates/controllers/GraphController');
module.exports.resource = require('./templates/controllers/ResourceController');
module.exports.policies = {
    graphCreate: require('./templates/policies/graphCreate'),
    graphDestroy: require('./templates/policies/graphDestroy'),
    graphFind: require('./templates/policies/graphFind'),
    graphFindOne: require('./templates/policies/graphFindOne'),
    graphPopulate: require('./templates/policies/graphPopulate'),
    graphUpdate: require('./templates/policies/graphUpdate')
};
module.exports.util = require('./templates/actions/actionUtil');