var can = require("can-23");
var QUnit = require("steal-qunit");
var Observation = require("can-observation");
var canReflect = require("can-reflect");
var canDomMutate = require("can-dom-mutate");
var eventQueue = require("can-event-queue/map/map");

require("./control");

require("../util/before-remove");

require("./noop-event-handlers-on-destroyed");



/* jshint asi:true*/
(function () {
	/*global WeirdBind*/
	function skip(test){
		console.log("skip", test);
	}
	QUnit.module('can/control');

	test('basics', 1, function () {
		var clickCount = 0;
		var Things = can.Control.extend({
			'{foo} bar': function () {

				QUnit.ok(false, "this should not be called");
			}
		});

		var foo = new can.Map({bar: "ted"});
		foo.bind("bar", function(){
			QUnit.ok(true, "foo event called");
			can.remove(can.$('#things'));
			canDomMutate.flushRecords();
		})

		can.append(can.$('#qunit-fixture'), '<div id=\'things\'>div<span>span</span></div>');
		var things = new Things('#things', {
			foo: foo
		});

		foo.attr("bar","zed");

	});




})();
