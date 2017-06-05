/**
 * Module dependencies
 */
const actionUtil = require('./actionUtil');

/**
 * Find One Record
 *
 * get /:modelIdentity/:id
 *
 * An API call to find and return a single model instance from the data adapter
 * using the specified id.
 *
 * Required:
 * @param {Integer|String} id  - the unique id of the particular instance you'd like to look up *
 *
 * Optional:
 * @param {String} callback - default jsonp callback param (i.e. the name of the js function returned)
 */
module.exports = function(interrupts) {
    return function(req, res) {
        let Model = actionUtil.parseModel(req);
        let pk = actionUtil.requirePk(req);
        let query = Model.findOne(pk);

        query = actionUtil.populateRequest(query, req);
        query.exec((err, matchingRecord) => {
            if (err) return res.serverError(err);
            if (!matchingRecord) return res.notFound('No record found with the specified `id`.');
            interrupts.findone.call(
                this,
                req,
                res,
                () => {
                    if (req._sails.hooks.pubsub && req.isSocket) {
                        Model.subscribe(req, matchingRecord);
                        actionUtil.subscribeDeep(req, matchingRecord);
                    }
                    res.ok(matchingRecord);
                },
                Model,
                matchingRecord
            );
        });
    };
};
