/**
 * Module dependencies
 */

let sailsgen = require('sails-generate'),
    path = require('path');

//
// This script exists so we can run our generator
// directly from the command-line for convenience
// during development.
//

let args = Array.prototype.slice.call(process.argv, 2);
let scope = {
    generatorType: 'graphql-bolts',
    rootPath: process.cwd(),
    modules: {
        'graphql-bolts': path.resolve(__dirname, '../')
    },
    args: args
};

sailsgen(scope, function(err) {
    if (err) {
        throw err;
    }

    // It worked.
    console.log('Done.');
});
