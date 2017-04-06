var _ = require('lodash');
var pluralize = require( 'pluralize' );
var helpers = require('./helpers');

function defineProperty(obj, key, value)
{
	if (key in obj)
	{
		Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true });
	}
	else
	{
		obj[key] = value;
	}
	return obj;
}

function resolveGetRange(model, parentFieldName) {
	var modelIdentity = model.identity;
    parentFieldName = parentFieldName ? parentFieldName : '';

	return function (rootValue, query, req) {
		var where = query.where === undefined ? '{}' : query.where;
		var limit = query.limit === undefined ? 100 : query.limit;
		var skip = query.skip === undefined ? 0 : query.skip;
		var sort = query.sort === undefined ? '' : query.sort;
		var request = req.request;
		var reqData = req.reqData === undefined ? {} : req.reqData;
		return new Promise(function (resolve, reject) {
			var whereWithParentId;
			if (rootValue && rootValue.id) {
				var tmp;
				try {
					tmp = JSON.parse(where);
				}
				catch(e)
				{
					tmp = {};
				}
				whereWithParentId = JSON.stringify(Object.assign(tmp, defineProperty({}, parentFieldName, rootValue.id)));
			}

			request(Object.assign({
				method: 'GET',
				url: '/' + pluralize(modelIdentity)
			}, reqData), {
				where: whereWithParentId || where,
				limit: limit,
				skip: skip,
				sort: sort
			}, function (err1, res) {
				if (err1) {
					return reject(err1);
				}
				var count = res.body.meta.total;
				resolve({
					page: skip / limit + 1,
					pages: Math.ceil(count / limit),
					perPage: limit,
					total: count,
					edges: res.body.data
				});
			});
		});
	};
}


function resolveGetNestedSingle(fieldName, model) {
	var modelIdentity = model.identity;

	return function (rootValue, query, req) {
		var request = req.request;
		var reqData = req.reqData === undefined ? {} : req.reqData;
        var currentVal = rootValue[fieldName];
        if(_.isPlainObject(currentVal))
        {
            return currentVal;
        }
        else if(typeof currentVal !== 'undefined' && currentVal !== null)
        {
            query = {
                id: currentVal
            };
            return new Promise(function (resolve, reject) {
                request(Object.assign({
                    method: 'GET',
                    url: '/' + pluralize(modelIdentity)
                }, reqData), query, function (err, res) {
                    if (err) {
                        return reject(err);
                    }
                    if (res.body instanceof Array) {
                        res.body = res.body[0];
                    }
                    resolve(res.body);
                });
            });
        }
		else
        {
            return null;
        }
	};
}

function resolveGetSingle(model) {
	var modelIdentity = model.identity;

	return function (rootValue, query, req) {
		var request = req.request;
		var reqData = req.reqData === undefined ? {} : req.reqData;
		return new Promise(function (resolve, reject) {
			request(Object.assign({
				method: 'GET',
				url: '/' + pluralize(modelIdentity)
			}, reqData), query, function (err, res) {
				if (err) {
					return reject(err);
				}
				if (res.body instanceof Array) {
					res.body = res.body[0];
				}
				resolve(res.body);
			});
		});
	};
}

function resolveCreate(model) {
	var modelIdentity = model.identity;
	var queryName = helpers.getName(model).queryName;

	return function (rootValue, params, req) {
		var request = req.request;
		var reqData = req.reqData === undefined ? {} : req.reqData;
		return new Promise(function (resolve, reject) {
			request(Object.assign({
				method: 'POST',
				url: '/' + pluralize(modelIdentity)
			}, reqData), params[queryName], function (err, res) {
				if (err) {
					return reject(err);
				}
				resolve(res.body);
			});
		});
	};
}

function resolveDelete(model) {
	var modelIdentity = model.identity;

	return function (rootValue, params, req) {
		var id = params.id;
		var request = req.request;
		var reqData = req.reqData === undefined ? {} : req.reqData;
		return new Promise(function (resolve, reject) {
			request(Object.assign({
				method: 'DELETE',
				url: '/' + pluralize(modelIdentity) + '/' + id
			}, reqData), function (err, res) {
				if (err) {
					return reject(err);
				}
				resolve(res.body);
			});
		});
	};
}

function resolveUpdate(model) {
	var modelIdentity = model.identity;
	var queryName = helpers.getName(model).queryName;

	return function (rootValue, params, req) {
		var request = req.request;
		var reqData = req.reqData === undefined ? {} : req.reqData;
		return new Promise(function (resolve, reject) {
			request(Object.assign({
				method: 'PUT',
				url: '/' + pluralize(modelIdentity) + '/' + params.id
			}, reqData), params[queryName], function (err, res) {
				if (err) {
					return reject(err);
				}
				resolve(res.body);
			});
		});
	};
}

module.exports = {
	resolveGetRange: resolveGetRange,
    resolveGetNestedSingle: resolveGetNestedSingle,
	resolveGetSingle: resolveGetSingle,
	resolveCreate: resolveCreate,
	resolveDelete: resolveDelete,
	resolveUpdate: resolveUpdate
};