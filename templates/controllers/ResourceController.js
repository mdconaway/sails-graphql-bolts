/**
 * ResourceController
 *
 * @description :: Server-side logic for managing a resource if it will always be handled by the graph engine
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */
const create = require('./../actions/create');
const destroy = require('./../actions/destroy');
const find = require('./../actions/find');
const findone = require('./../actions/findone');
const populate = require('./../actions/populate');
const update = require('./../actions/update');

function baseController(interrupts) {
    return {
        create: create(interrupts),
        destroy: destroy(interrupts),
        find: find(interrupts),
        findone: findone(interrupts),
        populate: populate(interrupts),
        update: update(interrupts)
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
