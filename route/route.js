var can23 = require("../can-core");
var assign = require("can-assign");
var route = require("can-route");
var RouteData = require("can-route/src/routedata");
route.ready = route.start;
RouteData.prototype.attr = function(key) {
  if(typeof key === "object") {
    assign(this, key);
  } else if(arguments.length > 1) {
    return this.set.apply(this, arguments);
  } else if(arguments.length > 0) {
    return this.get(key);
  } else {
    return this.serialize();
  }
}

module.exports = can23.route = route;
