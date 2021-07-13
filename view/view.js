var can23 = require("../can-core");
var assign = require("can-assign");
var stacheKey = require("can-stache-key");
var viewCallbacks = require("can-view-callbacks");
var stache = require("./stache/stache");
var canReflect = require("can-reflect");
var Scope = require("./scope/scope");

function isAt(index, reads) {
  var prevRead = reads[index-1];
  return prevRead && prevRead.at;
}
var view = can23.view = function(id, data) {
  var tmpl = typeof id === "string" ? stache.from(id) : id;
  if(arguments.length > 1) {
    return tmpl(data);
  } else {
    return tmpl;
  }
};

assign(view, {
  tag: function(){
    return viewCallbacks.tag.apply(viewCallbacks, arguments);
  },
  attr: function(){
    return viewCallbacks.attr.apply(viewCallbacks, arguments);
  }
});
// The following overwrites function reading to behave like 2.3 value reading if `can23Compatibility` is set
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
    //  return value.bind(prev);
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
view.Scope = Scope;
view.Options = Scope.Options;
view.preload = view.registerView = stache.registerPartial;

module.exports = view;
