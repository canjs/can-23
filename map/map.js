
module.exports = require("can-map");


var mapHelpers = require("can-map/map-helpers");

var addComputedAttr = mapHelpers.addComputedAttr;

mapHelpers.addComputedAttr = function(map, attrName, compute){
	map[attrName] = compute;
	return addComputedAttr.apply(this, arguments);
}
