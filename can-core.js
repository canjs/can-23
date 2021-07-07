var Map = require("./map/map");
var compute = require("can-compute");
var canReflect = require("can-reflect");
var Construct = require("can-construct");
var stacheKey = require("can-stache-key");
var List = require("can-list");
var TemplateContext = require("can-view-scope/template-context");
var domEvents = require("can-dom-events");
var mutateNode = require("can-dom-mutate/node");
var fragment = require("can-fragment");
var domData = require("can-dom-data");
var viewModel = require("can-view-model");
var queues = require("can-queues");
var jQuery = require("jquery");
var assign = require("can-assign");
var keyWalk = require("can-key/walk/walk");
var keyUtils = require("can-key/utils");

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
	extend: assign,
	Map: Map,
	compute: compute,
	each: function (object, callback, context) {
		var args = [
			object,
			function(val, key, obj) {
				// preserve legacy behavior of each on Maps
				if (!(obj instanceof Map) || canReflect.hasOwnKey(obj, key)) {
					callback.call(context || obj, val, key, obj);
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
	$: function(selector) {
		if(typeof selector === "string") {
			return document.querySelectorAll(selector);
		}
		if(canReflect.isListLike(selector) && selector !== window) {
			return [].slice.call(selector)
		}
		return [selector];
	},
	isFunction: canReflect.isFunctionLike,
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
		target.forEach(function(targetNode, i){
			if(typeof targetNode.dispatch === "function") {
				targetNode.dispatch(event);
			} else {
				domEvents.dispatch(targetNode, { type: event, data: data });
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
	Deferred: $.Deferred,
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
	view: function(id, data) {
		var stache = require("./view/stache/stache");
		var tmpl = typeof id === "string" ? stache.from(id) : id;
		return tmpl(data);
	},
	ajax: jQuery.ajax
};

jQuery.fn.viewModel = function(attr, value){
	var args = [this[0]].concat( [].slice.call(arguments, 0 ));
	return can23.viewModel.apply(can23, args);
}
jQuery.fn.trigger = function(event, args) {
	this.each(function(_, el) {
		can23.trigger(el, event, args);
	});
	return this;
}
var $data = jQuery.fn.data;
jQuery.fn.data = function() {
	var ret = can23.data.apply(can23, [this].concat([].slice.call(arguments, 0)))
	return $data.apply(this, arguments) || ret;
}

window.can = can23;
can23.scope = can23.viewModel;

module.exports = can23;
