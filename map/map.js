
module.exports = require("can-map");

var mapHelpers = require("can-map/map-helpers");

var addComputedAttr = mapHelpers.addComputedAttr;

mapHelpers.addComputedAttr = function(map, attrName, compute){
	if(Object.getPrototypeOf(map)[attrName] === compute) {
		compute = compute.clone(map)
	}
	map[attrName] = compute;
	return addComputedAttr.apply(this, arguments);
}
