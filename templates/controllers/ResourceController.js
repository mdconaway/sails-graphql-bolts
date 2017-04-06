/**
 * ResourceController
 *
 * @description :: Server-side logic for managing a resource if it will always be handled by the graph engine
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */
 var baseController = {
    setServiceInterrupt: function(name, fn){
        if(this.interrupts.hasOwnProperty(name) && typeof fn === 'function')
        {
            this.interrupts[name] = fn;
        }
        return this;
    },
    create: require('./../actions/create'),
    destroy: require('./../actions/destroy'),
    find: require('./../actions/find'),
    findone: require('./../actions/findone'),
    populate: require('./../actions/populate'),
    update: require('./../actions/update')
};

function defaultInterrupt(req, res, next, Model, record){
    next();
}

module.exports = function(instanceOverrides){
    instanceOverrides = instanceOverrides ? instanceOverrides : {};
    return Object.assign({}, baseController, instanceOverrides, {
        interrupts: {
            create: defaultInterrupt,
            destroy: defaultInterrupt,
            find: defaultInterrupt,
            findone: defaultInterrupt,
            populate: defaultInterrupt,
            beforeUpdate: defaultInterrupt,
            afterUpdate: defaultInterrupt
        }
    });
};