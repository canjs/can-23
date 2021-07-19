"use strict";

var ScopeKeyData = require('can-view-scope/scope-key-data');
var assign = require("can-assign");
var canReflect = require("can-reflect");

var oldDeps = ScopeKeyData.prototype.hasDependencies;

function hasDependencies(){
	var res = oldDeps.apply(this, arguments);
	return (res || this.fastPath) === true;
}

module.exports = function(scope, key, options){
	var scopeKeyData = new ScopeKeyData(scope, key, assign({can23Compatibility: true}, options || {
		args: []
	}));

	if(scope.constructor._legacyCan22FindingAnObservableOnTheScopeReturnsComputes) {
		canReflect.assignSymbols(scopeKeyData, {
			"can.valueHasDependencies": hasDependencies
		});
		scopeKeyData.hasDependencies = hasDependencies;
	}
	return scopeKeyData;
};
