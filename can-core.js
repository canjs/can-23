var Map = require("can-map");
var compute = require("can-compute");
var canReflect = require("can-reflect");
var Construct = require("can-construct");
var stacheKey = require("can-stache-key");
var List = require("can-list");
var TemplateContext = require("can-view-scope/template-context");

canReflect.assignSymbols(TemplateContext,{
	"can.new": function(){
		var instance = Object.create(this, TemplateContext.prototype);
		return TemplateContext.apply(instance , arguments);
	}
})

TemplateContext

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
		return sixRead.apply(this, arguments);
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



module.exports = {
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
    return document.querySelectorAll(selector);
  },
  isFunction: canReflect.isFunctionLike
};
