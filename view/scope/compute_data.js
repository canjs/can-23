"use strict";

var ScopeKeyData = require('can-view-scope/scope-key-data');
var assign = require("can-assign")

module.exports = function(scope, key, options){
	return new ScopeKeyData(scope, key, assign({can23Compatibility: true}, options || {
		args: []
	}));
};
