var Map = require("can-map");
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
var viewCallbacks = require("can-view-callbacks");
var assign = require("can-assign");

require("can-map-define");

canReflect.assignSymbols(TemplateContext,{
	"can.new": function(){
		var instance = Object.create(this, TemplateContext.prototype);
		return TemplateContext.apply(instance , arguments);
	}
});

//var each = require("can-util/js/each/each");

List.prototype.each = List.prototype.forEach;

// The following overwrites function reading to behave like 2.3 value reading if `can23Compatibility` is set
compute.read = stacheKey;
compute.set = stacheKey.set;
var sixRead = stacheKey.valueReadersMap.function.read;
stacheKey.valueReadersMap.function.read = function compatabilityRead(value, i, reads, options, state, prev){
  if(options.can23Compatibility ) {
    if( isAt(i, reads) ) {
      return i === reads.length ? value.bind(prev) : value;
    }
    else if(options.callMethodsOnObservables && canReflect.isObservableLike(prev)) {
      return value.apply(prev, options.args || []);
    }
    else if ( options.isArgument && i === reads.length ) {
      return options.proxyMethods !== false ? value.bind(prev) : value;
    }
	else if ( options.doNotExecute ) {
		//if(reads.length > 1) {
		//	return value.bind(prev);
		//} else {
			return sixRead.apply(this, arguments);
		//}

	} else {
		return value.apply(prev, options.args || []);
	}
  } else {
    return sixRead.apply(this, arguments);
  }
}
function isAt(index, reads) {
  var prevRead = reads[index-1];
  return prevRead && prevRead.at;
}
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
}


var can23 = {
  extend: assign,
  Map: Map,
  compute: compute,
  each: canReflect.each,
  inArray: function(item, array, fromIndex) {
    return array.indexOf(item, fromIndex);
  },
  last: function(arr){
    return arr && arr[arr.length - 1];
  },
  Construct: Construct,
  view: {},
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
	trigger: function(target, event){
		target = can23.$(target);
		target.forEach(function(targetNode, i){
			if(typeof targetNode.dispatch === "function") {
				targetNode.dispatch(event);
			} else {
				domEvents.dispatch(targetNode, event);
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
	view: {
		tag: function(){
			return viewCallbacks.tag.apply(viewCallbacks, arguments);
		},
		attr: function(){
			return viewCallbacks.attr.apply(viewCallbacks, arguments);
		}
	}
};

can23.scope = can23.viewModel;

module.exports = can23;
