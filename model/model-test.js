var can = require("../can-core");
var QUnit = require("steal-qunit");
require("./model");
var jQuery = require("jquery");

test("supports multiple arguments", function(){
	can.Model.ajax = jQuery.ajax;
	var Person = can.Model.extend({
		findOne: __dirname +"/person.json"
	},{});
	QUnit.stop();
	Person.findOne({}, function callback(instance, status, xhr){
		var args = arguments;
		QUnit.ok(instance, "instance");
		QUnit.ok(status, "status");
		QUnit.ok(xhr, "xhr");
		QUnit.start();
	});
	can.Model.ajax = undefined;
})
