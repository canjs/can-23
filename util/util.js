var can23 = require("../can-core");
var assign = require("can-assign");
var canString = require("can-string");
var canReflect = require("can-reflect");
var deparam = require("can-deparam");
var param = require("can-param");
var js = require("can-util/js/js");

assign(can23, {
  param: param,
  deparam: deparam,
  makeArray: canReflect.toArray,
  camelize: canString.camelize,
  hyphenate: canString.hyphenate,
  capitalize: canString.capitalize,
  underscore: canString.underscore,
  sub: js.string.sub,
  isEmptyObject: js.isEmptyObject,
  isArray: js.isArray,
  proxy: function() {
    return Function.prototype.bind.apply(arguments[0], [].slice.call(arguments, 1));
  },
  dev: js.dev,
  getObject: function(key, obj) {
    var path = key.split(".");
    var current = obj;
    path.forEach(function(pathEl) {
      current = current == null ? undefined : current[pathEl];
    });
    return current;
  }
});

module.exports = can23;