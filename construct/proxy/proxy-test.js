/* global Car */
// require('can/construct/construct');
require('./proxy');
require('../../control/control');
QUnit = require('steal-qunit');

QUnit.module('can/construct/proxy');

test('static proxy if control is loaded first', function () {
	var curVal = 0;
	expect(2);
	can.Control('Car', {
		show: function (value) {
			equal(curVal, value);
		}
	}, {});
	var cb = Car.proxy('show');
	curVal = 1;
	cb(1);
	curVal = 2;
	var cb2 = Car.proxy('show', 2);
	cb2();
});
test('proxy', function () {
	var curVal = 0;
	expect(2);
	can.Construct('Car', {
		show: function (value) {
			equal(curVal, value);
		}
	}, {});
	var cb = Car.proxy('show');
	curVal = 1;
	cb(1);
	curVal = 2;
	var cb2 = Car.proxy('show', 2);
	cb2();
});
