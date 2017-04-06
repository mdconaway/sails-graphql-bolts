var ResourceController = require('./../controllers/ResourceController');
module.exports = function(controller){
    controller = controller ? controller : new ResourceController();
    return function(req, res, next){
        if(req.headers.graphql)
        {
            return controller.destroy(req, res);
        }
        next();
    };
};