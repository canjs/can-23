var Construct = require("can-construct");
require("./construct/proxy/proxy");
var Map = require("./map/map");
var compute = require("can-compute");
var canReflect = require("can-reflect");

var stacheKey = require("can-stache-key");
var List = require("can-list");
var TemplateContext = require("can-view-scope/template-context");
var domEvents = require("can-dom-events");
var mutateNode = require("can-dom-mutate/node");
var domMutateEvents = require("can-dom-mutate/events/events");
var fragment = require("can-fragment");
var domData = require("can-dom-data");
var viewModel = require("can-view-model");
var queues = require("can-queues");
var jQuery = require("jquery");
var assign = require("can-assign");
var keyWalk = require("can-key/walk/walk");
var keyUtils = require("can-key/utils");
var debug = require("can-debug");

require("can-map-define");

canReflect.assignSymbols(TemplateContext,{
	"can.new": function(){
		var instance = Object.create(this, TemplateContext.prototype);
		return TemplateContext.apply(instance , arguments);
	}
});
compute.read = stacheKey;
compute.set = stacheKey.set;

//var each = require("can-util/js/each/each");

List.prototype.each = List.prototype.forEach;

var specialRead = {index: true, key: true, event: true, element: true, viewModel: true};
var baseObjectRead = stacheKey.propertyReadersMap.object.read;
stacheKey.propertyReadersMap.object.read = function compatabilityObjectRead(value, prop, reads, options, state, prev){
	if(options.can23Compatibility ) {
		var valueType = typeof value;
		if(value == null || (valueType !== 'object' && valueType !== 'function')) {
			return undefined;
		} else {
			if(prop.key in value) {
				return value[prop.key];
			}
			// TODO: remove in 3.0.  This is for backwards compat with @key and @index.
			else if( prop.at && specialRead[prop.key] && ( ("@"+prop.key) in value)) {
				prop.at = false;
				return value["@"+prop.key];
			}

		}
	} else {
		return baseObjectRead.apply(this, arguments);
	}
};

var CanJSNames = {Control: 1, LetContext: 1, DefineList: 1};
var constrctorCreated = Construct._created;
Construct._created = function(className, Constructor){


	if(className && !CanJSNames[className]) {
		var parts = keyUtils.parts(className)
		keyWalk(window, parts , function(keyInfo, i){
			if(i === parts.length - 1) {
				canReflect.setKeyValue(keyInfo.parent, keyInfo.key, Constructor)
			}
			else if(!canReflect.isMapLike(keyInfo.value)) {
				var newVal = {}
				canReflect.setKeyValue(keyInfo.parent, keyInfo.key, newVal)
				return newVal;
			}
		});
		Constructor.shortName = parts[parts.length - 1];
		Constructor.fullName = className;
	}

}

var can23 = {
	debug: debug,
	extend: function(dest) {
		var sources = [].slice.call(arguments, 1);
		sources.forEach(function(source) {
			assign(dest, source);
		});
		return dest;
	},
	Map: Map,
	compute: compute,
	each: function (object, callback, context) {
		var args = [
			object,
			function(val, key, obj) {
				// preserve legacy behavior of each on Maps, including setting "this" to the item if no context is set
				if (!(obj instanceof Map) || canReflect.hasOwnKey(obj, key)) {
					callback.call(context || val, val, key, obj);
				}
			},
			context
		];
		return canReflect.each.apply(this, args);
	},
	inArray: function(item, array, fromIndex) {
		return array.indexOf(item, fromIndex);
	},
	last: function(arr){
		return arr && arr[arr.length - 1];
	},
	Construct: Construct,
	List: List,
	global: window,
	makeArray: canReflect.toArray,
	isArray: Array.isArray,
	$: function(selector) {
		if(typeof selector === "string") {
			return document.querySelectorAll(selector);
		}
		if(canReflect.isListLike(selector) && selector !== window) {
			return [].slice.call(selector)
		}
		return [selector];
	},
	isFunction: function(obj) {
		return (!!obj && obj.isComputed) || canReflect.isFunctionLike(obj);
	},
	append: function(target, content){
		if(typeof content === "string") {
			content = fragment(content, target[0].ownerDocument);
		}
		var clone;
		if(target.length > 1) {
			clone = content.cloneNode(true);
		}
		target.forEach(function(targetNode, i){
			if(i === 0) {
				mutateNode.appendChild.call(targetNode, content);
			} else {
				var nextClone = clone.cloneNode(true);
				mutateNode.appendChild.call(targetNode, nextClone);
			}
		});

		return content;
	},
	trigger: function(target, event, data){
		target = can23.$(target);
		var dispatchEvent = typeof event === "string" ? { type: event } : event;
		if (data) {
			dispatchEvent.data = Array.isArray(data) ? data : [].slice.call(arguments, 2);
		}
		target.forEach(function(targetNode, i){
			if(typeof targetNode.dispatch === "function") {
				targetNode.dispatch(dispatchEvent);
			} else {
				domEvents.dispatch(targetNode, dispatchEvent);
			}
		});
		return target;
	},
	remove: function(target) {
		target = can23.$(target);
		target.forEach(function(targetNode, i){
			mutateNode.removeChild.call(targetNode.parentNode, targetNode)
		});
		return target;
	},
	data: function(target, prop, data){
		target = can23.$(target);
		if(arguments.length > 2) {
			target.forEach(function(targetNode, i){
				domData.set(targetNode, prop, data)
			});
			return target;
		} else {
			return domData.get(target[0], prop)
		}
	},
	removeData: function(target, prop, data){
		target = can23.$(target);
		if(arguments.length > 1) {
			target.forEach(function(targetNode, i){
				domData.clean(targetNode, prop)
			});
		} else {
			target.forEach(function(targetNode, i){
				domData.delete(targetNode);
			})
		}
		return target;
	},
	trim: function(str) {
		return str.trim();
	},
	viewModel: function(target, attr, value) {
		var args = Array.prototype.slice.call(arguments, 0);
		args[0] = can23.$(target)[0];
		return viewModel.apply(this, args);
	},
	addClass: function(target, className){
		target = can23.$(target);
		target.forEach(function(targetNode, i){
			targetNode.classList.add(className)
		});
		return target;
	},
	batch: queues.batch,
	Deferred: jQuery.Deferred,
	isPromise: function(obj){
		return !!obj && (
			(window.Promise && (obj instanceof Promise)) ||
			(canReflect.isFunctionLike(obj.then) && (can23.List === undefined || !(obj instanceof can23.List)))
		);
	},
	attr: {
		set: function(target, attr, value){
			target = can23.$(target);
			target.forEach(function(targetNode, i){
				mutateNode.setAttribute.call(targetNode, attr, value);
			});
			return target;

		}
	},
	ajax: jQuery.ajax,
	when: jQuery.when
};


// can/util/jquery/jquery.js implemented this special event on attributes
domEvents.addEvent(domMutateEvents.attributes);

window.can = can23;
can23.scope = can23.viewModel;

module.exports = can23;
