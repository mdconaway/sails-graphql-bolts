const _ = require('lodash');
const pluralize = require('pluralize');
const helpers = require('./helpers');

function defineProperty(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true });
    } else {
        obj[key] = value;
    }
    return obj;
}

function resolveGetRange(model, parentFieldName) {
    let modelIdentity = model.identity;
    parentFieldName = parentFieldName ? parentFieldName : '';

    return function(rootValue, query, req) {
        let where = query.where === undefined ? '{}' : query.where;
        let limit = query.limit === undefined ? 100 : query.limit;
        let skip = query.skip === undefined ? 0 : query.skip;
        let sort = query.sort === undefined ? '' : query.sort;
        let request = req.request;
        let reqData = req.reqData === undefined ? {} : req.reqData;
        return new Promise(function(resolve, reject) {
            let whereWithParentId;
            if (rootValue && rootValue.id) {
                let tmp;
                try {
                    tmp = JSON.parse(where);
                } catch (e) {
                    tmp = {};
                }
                whereWithParentId = JSON.stringify(
                    Object.assign(tmp, defineProperty({}, parentFieldName, rootValue.id))
                );
            }

            request(
                Object.assign(
                    {
                        method: 'GET',
                        url: '/' + pluralize(modelIdentity)
                    },
                    reqData
                ),
                {
                    where: whereWithParentId || where,
                    limit: limit,
                    skip: skip,
                    sort: sort
                },
                function(err1, res) {
                    if (err1) {
                        return reject(err1);
                    }
                    let count = res.body.meta.total;
                    resolve({
                        page: skip / limit + 1,
                        pages: Math.ceil(count / limit),
                        perPage: limit,
                        total: count,
                        edges: res.body.data
                    });
                }
            );
        });
    };
}

function resolveGetNestedSingle(fieldName, model) {
    let modelIdentity = model.identity;

    return function(rootValue, query, req) {
        let request = req.request;
        let reqData = req.reqData === undefined ? {} : req.reqData;
        let currentVal = rootValue[fieldName];
        if (_.isPlainObject(currentVal)) {
            return currentVal;
        } else if (typeof currentVal !== 'undefined' && currentVal !== null) {
            query = {
                id: currentVal
            };
            return new Promise(function(resolve, reject) {
                request(
                    Object.assign(
                        {
                            method: 'GET',
                            url: '/' + pluralize(modelIdentity)
                        },
                        reqData
                    ),
                    query,
                    function(err, res) {
                        if (err) {
                            return reject(err);
                        }
                        if (res.body && Array.isArray(res.body.data)) {
                            if (res.body.data.length > 0) {
                                res.body = res.body.data;
                            } else {
                                return reject({
                                    message: 'The query ' + JSON.stringify(query) + ' returned no results.'
                                });
                            }
                        }
                        if (res.body instanceof Array) {
                            res.body = res.body[0];
                        }
                        resolve(res.body);
                    }
                );
            });
        } else {
            return null;
        }
    };
}

function resolveGetSingle(model) {
    let modelIdentity = model.identity;

    return function(rootValue, query, req) {
        let request = req.request;
        let reqData = req.reqData === undefined ? {} : req.reqData;
        return new Promise(function(resolve, reject) {
            request(
                Object.assign(
                    {
                        method: 'GET',
                        url: '/' + pluralize(modelIdentity)
                    },
                    reqData
                ),
                query,
                function(err, res) {
                    if (err) {
                        return reject(err);
                    }
                    if (res.body && Array.isArray(res.body.data)) {
                        if (res.body.data.length > 0) {
                            res.body = res.body.data;
                        } else {
                            return reject({ message: 'The query ' + JSON.stringify(query) + ' returned no results.' });
                        }
                    }
                    if (res.body instanceof Array) {
                        res.body = res.body[0];
                    }
                    resolve(res.body);
                }
            );
        });
    };
}

function resolveCreate(model) {
    let modelIdentity = model.identity;
    let queryName = helpers.getName(model).queryName;

    return function(rootValue, params, req) {
        let request = req.request;
        let reqData = req.reqData === undefined ? {} : req.reqData;
        return new Promise(function(resolve, reject) {
            request(
                Object.assign(
                    {
                        method: 'POST',
                        url: '/' + pluralize(modelIdentity)
                    },
                    reqData
                ),
                params[queryName],
                function(err, res) {
                    if (err) {
                        return reject(err);
                    }
                    resolve(res.body);
                }
            );
        });
    };
}

function resolveDelete(model) {
    let modelIdentity = model.identity;

    return function(rootValue, params, req) {
        let id = params.id;
        let request = req.request;
        let reqData = req.reqData === undefined ? {} : req.reqData;
        return new Promise(function(resolve, reject) {
            request(
                Object.assign(
                    {
                        method: 'DELETE',
                        url: '/' + pluralize(modelIdentity) + '/' + id
                    },
                    reqData
                ),
                function(err, res) {
                    if (err) {
                        return reject(err);
                    }
                    resolve(res.body);
                }
            );
        });
    };
}

function resolveUpdate(model) {
    let modelIdentity = model.identity;
    let queryName = helpers.getName(model).queryName;

    return function(rootValue, params, req) {
        let request = req.request;
        let reqData = req.reqData === undefined ? {} : req.reqData;
        return new Promise(function(resolve, reject) {
            request(
                Object.assign(
                    {
                        method: 'PUT',
                        url: '/' + pluralize(modelIdentity) + '/' + params.id
                    },
                    reqData
                ),
                params[queryName],
                function(err, res) {
                    if (err) {
                        return reject(err);
                    }
                    resolve(res.body);
                }
            );
        });
    };
}

module.exports = {
    resolveGetRange,
    resolveGetNestedSingle,
    resolveGetSingle,
    resolveCreate,
    resolveDelete,
    resolveUpdate
};
