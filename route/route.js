var can23 = require("../can-core");
var assign = require("can-assign");
var route = require("can-route");
route.ready = route.start;
route.attr = function(key) {
  if(typeof key === "object") {
    assign(this.data, key);
  } else if(arguments.length > 1) {
    return this.data.set.apply(this.data, arguments);
  } else if(arguments.length > 0) {
    return this.data.get(key);
  } else {
    return this.data.serialize();
  }
}

module.exports = can23.route = route;
