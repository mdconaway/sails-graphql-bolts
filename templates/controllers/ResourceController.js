/**
 * ResourceController
 *
 * @description :: Server-side logic for managing a resource if it will always be handled by the graph engine
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

function baseController(interrupts) {
    return {
        create: require('./../actions/create')(interrupts),
        destroy: require('./../actions/destroy')(interrupts),
        find: require('./../actions/find')(interrupts),
        findone: require('./../actions/findone')(interrupts),
        populate: require('./../actions/populate')(interrupts),
        update: require('./../actions/update')(interrupts)
    };
}

function defaultInterrupt(req, res, next, Model, record) {
    next();
}

module.exports = function(instanceOverrides = {}) {
    const interrupts = {
        create: defaultInterrupt,
        destroy: defaultInterrupt,
        find: defaultInterrupt,
        findone: defaultInterrupt,
        populate: defaultInterrupt,
        beforeUpdate: defaultInterrupt,
        afterUpdate: defaultInterrupt
    };
    const instance = Object.assign(new baseController(interrupts), instanceOverrides);
    Object.defineProperty(instance, 'setServiceInterrupt', {
        value: function(name, fn) {
            if (interrupts.hasOwnProperty(name) && typeof fn === 'function') {
                interrupts[name] = fn;
            }
            return this;
        },
        enumerable: false
    });
    Object.defineProperty(instance, 'getInterrupts', {
        value: () => interrupts,
        enumerable: false
    });
    return instance;
};
