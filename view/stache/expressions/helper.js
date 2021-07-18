"use strict";
var Literal = require('./literal');
var Hashes = require('./hashes');
var assign = require('can-assign');
var dev = require("can-log/dev/dev");
var expressionHelpers = require("../src/expression-helpers");
var canReflect = require('can-reflect');

var Helper = function(methodExpression, argExpressions, hashExpressions){
	this.methodExpr = methodExpression;
	this.argExprs = argExpressions;
	this.hashExprs = hashExpressions;
	this.mode = null;
};
Helper.prototype.args = function(scope, readOptions, helperOptions){
	var readOptions = assign( {
		doNotExecute: true,
		callMethodsOnObservables: true,
		isArgument: true
	}, readOptions || {} );

	var args = [];
	for(var i = 0, len = this.argExprs.length; i < len; i++) {
		var arg = this.argExprs[i];
		// TODO: once we know the helper, we should be able to avoid compute conversion
		var value = arg.value(scope, readOptions , helperOptions );
		args.push( expressionHelpers.toComputeOrValue( value ) );
	}
	return args;
};

var simpleConvert = function(){
	if(canReflect.isObservableLike(value)) {
		// we only want to do this for things that `should` have dependencies, but dont.
		//if(canReflect.isValueLike(value) && canReflect.valueHasDependencies(value) === false) {
		//	return canReflect.getValue(value);
		//}
		// if compute data
		if(value.compute) {
			return value.compute;
		} else {
			return expressionHelpers.makeComputeLike(value);
		}
	}
	return value;
}

Helper.prototype.hash = function(scope){
	var hash = {};
	for(var prop in this.hashExprs) {
		var val = this.hashExprs[prop];
		// TODO: once we know the helper, we should be able to avoid compute conversion
		hash[prop] = expressionHelpers.toComputeOrValue( val.value.apply(val, arguments) );
	}
	return hash;
};

Helper.prototype.value = function(scope, helperOptions){
	// If a literal, this means it should be treated as a key. But helpers work this way for some reason.
	// TODO: fix parsing so numbers will also be assumed to be keys.
	var methodKey = this.methodExpr instanceof Literal ?
		"" + this.methodExpr._value :
		this.methodExpr.key,
		helperInstance = this,
		// proxyMethods must be false so that the `requiresOptionsArgument` and any
		// other flags stored on the function are preserved
		helperScopeKeyData = scope.computeData(methodKey,  { proxyMethods: false, doNotExecute: true, prioritizeHelpers: true }),
		initialValue = helperScopeKeyData && helperScopeKeyData.initialValue,
		thisArg = helperScopeKeyData && helperScopeKeyData.thisArg,
		helperValueFn;

	if(methodKey === "%index") {
		helperValueFn = function indexScopeValueFn(){
			var incrementArgs = helperInstance.args(scope)
			return canReflect.getValue( helperScopeKeyData ) + (
				incrementArgs.length ? canReflect.getValue(incrementArgs[0]) : 0 );
		};
	}
	else if (typeof initialValue === "function") {
		helperValueFn = function helperValueFn() {
			var args = helperInstance.args(scope),
				helperOptionArg = assign(assign({}, helperOptions), {
					hash: helperInstance.hash(scope),
					exprData: helperInstance
				});


			// helper functions should NOT be part of some other object.
			// so we don't add extra args if it looks like it's part of some other object.
			if(initialValue.requiresOptionsArgument || !helperScopeKeyData.parentHasKey  ) {
				args.push(helperOptionArg);
			}

			return initialValue.apply(thisArg || scope.peek("this"), args);
		};
		//!steal-remove-start
		if (process.env.NODE_ENV !== 'production') {
			Object.defineProperty(helperValueFn, "name", {
				configurable: true,
				value: canReflect.getName(this)
			});
		}
		//!steal-remove-end
	}
	//!steal-remove-start
	else if (process.env.NODE_ENV !== 'production') {
		var filename = scope.peek('scope.filename');
			var lineNumber = scope.peek('scope.lineNumber');
			dev.warn(
				(filename ? filename + ':' : '') +
				(lineNumber ? lineNumber + ': ' : '') +
				'Unable to find helper "' + methodKey + '".');
	}
	//!steal-remove-end

	return  helperValueFn;
};

Helper.prototype.closingTag = function() {
	return this.methodExpr.key;
};

//!steal-remove-start
if (process.env.NODE_ENV !== 'production') {
	Helper.prototype.sourceText = function(){
		var text = [this.methodExpr.sourceText()];
		if(this.argExprs.length) {
			text.push( this.argExprs.map(function(arg){
				return arg.sourceText();
			}).join(" ") );
		}
		if(canReflect.size(this.hashExprs) > 0){
			text.push( Hashes.prototype.sourceText.call(this) );
		}
		return text.join(" ");
	};

	canReflect.assignSymbols(Helper.prototype,{
		"can.getName": function() {
			return canReflect.getName(this.constructor) + "{{" + (this.sourceText()) + "}}";
		}
	});
}
//!steal-remove-end

module.exports = Helper;
