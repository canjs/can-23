var can23 = require("../../can-core");
var define = module.exports = require("can-map-define");

var getPropDefineBehavior = function(behavior, attr, define) {
  var prop, defaultProp;

  if(define) {
    prop = define[attr];
    defaultProp = define['*'];

    if(prop && prop[behavior] !== undefined) {
      return prop[behavior];
    }
    else if(defaultProp && defaultProp[behavior] !== undefined) {
      return defaultProp[behavior];
    }
  }
};

// Restore questionable legacy behavior where nullish values get
//   type coerced into new objects.
var oldType = can23.Map.prototype.__type;
can23.Map.prototype.__type = function (value, prop) {
  var type = getPropDefineBehavior("type", prop, this.define),
    Type = getPropDefineBehavior("Type", prop, this.define),
    newValue = value;

  if (typeof type === "string") {
    type = define.types[type];
  }

  if (type || Type) {
    // If there's a type, convert it.
    if (type) {
      newValue = type.call(this, newValue, prop);
    }
    // If there's a Type create a new instance of it
    if (Type && !(newValue instanceof Type)) {
      newValue = new Type(newValue);
    }
    // If the newValue is a Map, we need to hook it up
    return newValue;

  }
  // If we pass in a object with define
  else if(can23.isPlainObject(newValue) && newValue.define) {
    newValue = can23.Map.extend(newValue);
    newValue = new newValue();
  }
  else if(can23.isArray(newValue) && !newValue._cid) {
    newValue = new can23.List(newValue);
  }
  else if(can23.isPlainObject(newValue) && !newValue._cid) {
    if (this.constructor.Map) {
      newValue = new this.constructor.Map(newValue);
    } else {
      newValue = new can23.Map(newValue);
    }
  }
  return oldType.call(this, newValue, prop);
};