Sails-GraphQL-Bolts
======================

GraphQL controllers, policies, utilities and generators for Sails v0.12+

For information on how to query a GraphQL enabled endpoint, check out [GraphQL.org](http://graphql.org/)

This package makes use of some ideas originally developed, but not fully implemented in this library: [Sails-GraphQL](https://github.com/zhukmj/sails-graphql)

[Sails](http://www.sailsjs.org/) 1.0+ is moving away from blueprints that override the default sails CRUD blueprints. Therefore the controllers created by this library must be created and extended in an object-oriented way. This will allow them to be used with sails 1.0+ applications.

# What's Included

This package ships as a standard node module that will export all of its assets if a user simply uses `require('sails-graphql-bolts');`.

From this require statement the following classes/objects will be available:

**controller**

(TO BE MORE FULLY DOCUMENTED, WORK COMPLETED)

The master controller that should be your primary exposed endpoint. This class will ingest user requests and then virtualize them over the `resource` controllers identified below.

The controller supports all of the normal graphQL queries and mutations. The best way to fully take advantage of graphQL is through POST requests. The following query formats are supported:

### Exposed actions:

* index - The action you should mount to your actual GraphQL route. Something like `/graph`
* introspect - The action you should mount if you want to allow users to discover your complete schema
* getSchemaModels - The action you should mount if you want users to have access to your sails model config objects

### Index Verbs Supported

### GET

Supported Query Parameters:

`ql` - The string version of your GraphQL query. Something like: 

```{
  product {
    id,
    title,
    description
  }
}
```

`where` - The variables hash to apply against your query. This can be a JSON stringified object, or a serialized object. Something like:

```
where[title]=Omakase
```
or
```
where={"title":"Omakase"}
```

### POST

The POST action expects a JSON object. This object can have the following attributes:

`query` - The string version of your GraphQL query. Something like: 

```{
  product {
    id,
    title,
    description
  }
}
```

`variables` - The variables hash to apply against your query. This should still be in object form. Something like:

```javascript
{
    "title": "Omakase"
}
```

Putting it all together, you could have something like this as a complete POST body:

```javascript
{
    "query": "query Hero($episode: Episode, $withFriends: Boolean!) {"+
        "hero(episode: $episode) {"+
            "name,"+
            "friends @include(if: $withFriends) {"+
            "name"+
            "}"+
        "}"+
    "}",
    "variables": {
        "episode": "JEDI",
        "withFriends": false
    }
}
```

- Additionally, each level of a graphql query that is referencing a plural resource like a collection or a many relationship can specify a `where` parameter that can be a `JSON.stringified` where object, just like a normal sails.js where object.  

Responses are formatted as per the graphQL specification, thanks to the node.js `graphql` library.

**resource**

(TO BE MORE FULLY DOCUMENTED, WORK COMPLETED)

The slave controllers to the `controller` class above. These controllers are designed to resolve each resource type for the master graphql controller, and also enable things like many<->many queries and safely virtualized deep creates/updates. You could use this resource controller as your default CRUD handler outside of GraphQL, but it may not be an ideal data exchange format. 

**policies**

(TO BE MORE FULLY DOCUMENTED, WORK COMPLETED)

A set of header detection policies that will divert virtualized resource requests from the master controller AWAY FROM your normal controllers. If you have an existing server it is unlikely you can immediately move all your clients to graphQL, and you may want to serve graphQL IN ADDITION TO your current data format, NOT INSTEAD OF. Each of these policies will allow graphQL resource resolutions to run within a virtualized sails controller object so that you can keep using your normal data format without issues. As a recommendation, these policies should always be placed AT THE END OF your policy chain as a last-minute diversion. This will allow you to uniformly enforce security for normal CRUD and GraphQL simultaneously.

**util**

(TO BE MORE FULLY DOCUMENTED, WORK COMPLETED)

A utility object used for general request parsing and response formatting.

# Generators

sails-graphql-bolts will also install 3 sails generators to make scaffolding out your application easier:

`sails generate graphql-bolts controller <name of controller>`

`sails generate graphql-bolts resource <name of controller>`

and

`sails generate graphql-bolts policies`

# Architecture 

The `controller` generator creates a singleton instance of the MASTER graphql controller.  This master controller is designed to span all of your `resources` generated with the resource generator.

The `resource` generator creates a controller object as well (in your api/controllers directory), but it is a single controller designed to govern a single model. 

You should create one `resource` for every model in your model directory, but you should have NO MODELS that match your primary GraphQL `controller`.

The `policies` generator creates a set of helper policies that can allow a sails application to run "virtual" controllers on top of specific actions when conditions needed.  This allows an application to have a set of default base application controllers (like Ember-Data controllers, or JSON API controllers), but still run an GraphQL resource compatible controller when policies determine this is what a client needs.  Think of it as a way to layer several controllers over an identical route, giving your server the ability to serve several frontend client adapters at the same URL. You can serve normal CRUD data using your default controllers, but still resolve your graphQL virtualized requests with the included policies.

The `controller` and `resource` classes are designed to work together in the following ways:

1. The `controller` is the single REST endpoint that users should query to access and mutate all of your data. 

2. The `resource` controllers act as individual model resolvers on behalf of the `controller`.

3. The `controller` virtualizes all graphql requests into internal Sails.js HTTP requests that then run through your complete action/policy pipeline before hitting your `resource` controllers. This means that even though users can query all of your `resources` through a single endpoint, each resource still governs what a user has access to. 

Because of the architecture described above, you do not lose any security over your data by exposing a graphQL endpoint.

# Features

* Full GraphQL Support
* Automatic sails model inspection and GraphQL schema generation
* One<->One, One->Many, Many<->Many, Many<-Through->Many relationships supported
* `json`,`array`(of strings), `string`, `email`, `text`, `integer`, `float`, `date`, `datetime`, `boolean`,  and `objectid` data types are supported out of the box on all of your models
* Safe deep create/update mutations supported. All deep creates/updates are individually virtualized over your `resource` controllers
* Built in relationship queries and limits thanks to the graphQL query language
* Infinite relational recursion depth, provided your server doesn't run out of memory

# Getting started

* Install the library and generators into your (new) Sails project `npm install sails-graphql-bolts`
* Run the generator: 
* `sails generate graphql-bolts controller <name>` for your master endpoint
* `sails generate graphql-bolts resource <name>` for each model you want to resolve through graphQL
* `sails generate graphql-bolts policies` if you plan on diverting existing controllers to graphQL resolvers only for virtualized requests (you must then add these policies to the end of all of your action policy chains)
* Go through ALL configuration steps below, and then...
* Generate some models for your `resource` controllers, e.g. `sails generate model user`
* Start your app with `sails lift`

Now you should be up and running and your server should be able fully server graphQL data.

### Configuration

* Configure sails to use **pluralized** blueprint routes.

The default graphQL `resource` controllers assume you are using pluralized routes

In `myproject/config/blueprints.js` set `pluralize: true`

```javascript
module.exports.blueprints = {
    // ...
    pluralize: true
};
```

### Troubleshooting

If the generator exits with
`Something else already exists at ... ` you can try running it with the `--force` option (at your own risk!)

Some records from relations/associations are missing? Sails has a default limit of 30 records per relation when populating. Try increasing the limit as a work-around until a pagination solution exists.


### More access control

If you need more control over inclusion and exclusion of records in the blueprints or you want to do other funny things, quite often a Policy can help you achieve this without a need for modifying the blueprints. Here's an example of a Policy that adds *beforeFind*, *beforeDestroy*, etc... hooks to a model: [beforeBlueprint policy](https://gist.github.com/mphasize/e9ed62f9d139d2152445)


### Accessing the GraphQL interface without a client

If you want to access the REST routes with your own client or a tool like [Postman](http://www.getpostman.com/) you may have to set the correct HTTP headers:

    Accept: application/json
    Content-Type: application/json


# Todo

### Refactor into ES6

- Because it's 2017!

### Generator: Improve installation

- setup configuration while running the generator

### Testing: Make all the things testable

I am still working out how to make this repo more maintainable and testable.

# Scope

The controllers and policies in this repository should provide a starting point for a Sails backend that is fully GraphQL capable. However, there are a lot of things missing that would be needed for a full blown app (like authentication and access control) but these things don't really fit into the scope of this sails add-on.

# Questions, Comments, Concerns?

Open an issue! I'd love to get some help maintaining this library.

- Michael Conaway (2017)