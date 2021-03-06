/* jshint asi:true*/
var QUnit = require("steal-qunit");
var can = require("can-23");
  function skip(name) {
    console.log("skipping", name)
  }

	QUnit.module('can/map');

	test("Basic Map", 6, function () {

		var state = new can.Map({
			category: 5,
			productType: 4
		});

		equal(state.category, 5, "can read properties directly");
		equal(state.attr("productType"), 4, "can read properties from attr");

		state.bind("change", function (ev, attr, how, val, old) {
			equal(attr, "category", "correct change name");
			equal(how, "set");
			equal(val, 6, "correct");
			equal(old, 5, "correct");
		});

		state.attr("category", 6);

		state.unbind("change");

	});

	test("Nested Map", 5, function () {
		var me = new can.Map({
			name: {
				first: "Justin",
				last: "Meyer"
			}
		});

		ok(me.attr("name") instanceof can.Map);

		me.bind("change", function (ev, attr, how, val, old) {
			equal(attr, "name.first", "correct change name")
			equal(how, "set")
			equal(val, "Brian", "correct")
			equal(old, "Justin", "correct")
		})

		me.attr("name.first", "Brian");

		me.unbind("change")

	})

	test("remove attr", function () {
		var state = new can.Map({
			category: 5,
			productType: 4
		});
		state.removeAttr("category");
		deepEqual(can.Map.keys(state), ["productType"], "one property");
	});

	test("remove attr on key with dot", function () {
		var state = new can.Map({
			"key.with.dots": 12,
			productType: 4
		});
		var state2 = new can.Map({
			"key.with.dots": 4,
			key: {
				"with": {
					someValue: 20
				}
			}
		});
		state.removeAttr("key.with.dots");
		state2.removeAttr("key.with.someValue");
		deepEqual( can.Map.keys(state), ["productType"], "one property");
		deepEqual( can.Map.keys(state2), ["key.with.dots", "key"], "two properties");
		deepEqual( can.Map.keys( state2.key["with"] ) , [], "zero properties");
	});

	test("nested event handlers are not run by changing the parent property (#280)", function () {

		var person = new can.Map({
			name: {
				first: "Justin"
			}
		})
		person.bind("name.first", function (ev, newName) {
			ok(false, "name.first should never be called")
			//equal(newName, "hank", "name.first handler called back with correct new name")
		});
		person.bind("name", function () {
			ok(true, "name event triggered")
		})

		person.attr("name", {
			first: "Hank"
		});

	});

	test("cyclical objects (#521)", function () {

		var foo = {};
		foo.foo = foo;

		var fooed = new can.Map(foo);

		ok(true, "did not cause infinate recursion");

		ok(fooed.attr('foo') === fooed, "map points to itself")

		var me = {
			name: "Justin"
		}
		var references = {
			husband: me,
			friend: me
		}
		var ref = new can.Map(references)

		ok(ref.attr('husband') === ref.attr('friend'), "multiple properties point to the same thing")

	})

	test('Getting attribute that is a can.compute should return the compute and not the value of the compute (#530)', function () {
		var compute = can.compute('before');
		var map = new can.Map({
			time: compute
		});

		equal(map.time, compute, 'dot notation call of time is compute');
		equal(map.attr('time'), compute, '.attr() call of time is compute');
	})

	test('_cid add to original object', function () {
		var map = new can.Map(),
			obj = {
				'name': 'thecountofzero'
			};

		map.attr('myObj', obj);
		ok(!obj._cid, '_cid not added to original object');
	})

	test("can.each used with maps", function () {
		can.each(new can.Map({
			foo: "bar"
		}), function (val, attr) {

			if (attr === "foo") {
				equal(val, "bar")
			} else {
				ok(false, "no properties other should be called " + attr)
			}

		})
	})


	test("Test top level attributes", 7, function () {
		var test = new can.Map({
			'my.enable': false,
			'my.item': true,
			'my.count': 0,
			'my.newCount': 1,
			'my': {
				'value': true,
				'nested': {
					'value': 100
				}
			}
		});

		equal(test.attr('my.value'), true, 'correct');
		equal(test.attr('my.nested.value'), 100, 'correct');
		ok(test.attr("my.nested") instanceof can.Map);

		equal(test.attr('my.enable'), false, 'falsey (false) value accessed correctly');
		equal(test.attr('my.item'), true, 'truthey (true) value accessed correctly');
		equal(test.attr('my.count'), 0, 'falsey (0) value accessed correctly');
		equal(test.attr('my.newCount'), 1, 'falsey (1) value accessed correctly');
	});



	skip("computed properties don't cause memory leaks", function () {
		var computeMap = can.Map.extend({
			'name': can.compute(function(){
				return this.attr('first') + this.attr('last')
			})
		}),
			handler = function(){},
			map = new computeMap({
				first: 'Mickey',
				last: 'Mouse'
			});
		map.bind('name', handler);
		map.bind('name', handler);
		equal(map._computedAttrs.name.count, 2, '2 handlers listening to computed property');
		map.unbind('name', handler);
		map.unbind('name', handler);
		equal(map._computedAttrs.name.count, 0, '0 handlers listening to computed property');

	});

	test("computed properties work", function(){
		var ComputeMap = can.Map.extend({
			'name': can.compute(function(){
				return this.attr('first') + this.attr('last')
			})
		})

		var a = new ComputeMap({first: "j", last: "m"});
		equal(a.attr("name"), "jm");
		var b = new ComputeMap({first: "b", last: "m"});
		equal(b.attr("name"), "bm");
	})

	test("serializing cycles", function(){
		var map1 = new can.Map({name: "map1"});
		var map2 = new can.Map({name: "map2"});

		map1.attr("map2", map2);
		map2.attr("map1", map1);

		var res = map1.serialize();
		equal(res.name, "map1");
		equal(res.map2.name, "map2");
	});

	test("Unbinding from a map with no bindings doesn't throw an error (#1015)", function() {
		expect(0);

		var test = new can.Map({});

		try {
			test.unbind('change');
		} catch(e) {
			ok(false, 'No error should be thrown');
		}
	});

	test("Fast dispatch event still has target and type (#1082)", 4, function() {
		var data = new can.Map({
			name: 'CanJS'
		});

		data.bind('change', function(ev){
			equal(ev.type, 'change');
			equal(ev.target, data);
		});

		data.bind('name', function(ev){
			equal(ev.type, 'name');
			equal(ev.target, data);
		});

		data.attr('name', 'David');
	});

	test("map passed to Map constructor (#1166)", function(){
		var map = new can.Map({x: 1});
		var res = new can.Map(map);
		deepEqual(res.attr(), {
			x: 1
		}, "has the same properties");
	});

	test("constructor passed to scope is threated as a property (#1261)", function(){
		var Constructor = can.Construct.extend({});

		var Map = can.Map.extend({
		  Todo: Constructor
		});

		var m = new Map();

		equal(m.attr("Todo"), Constructor);
	});

	skip('_bindings count maintained after calling .off() on undefined property (#1490) ', function () {

		var map = new can.Map({
			test: 1
		});

		map.on('test', can.noop);

		equal(map._bindings, 1, 'The number of bindings is correct');

		map.off('undefined_property');

		equal(map._bindings, 1, 'The number of bindings is still correct');
	});

	test("Should be able to get and set attribute named 'watch' on can.Map in Firefox", function() {
		var map = new can.Map({});
		map.attr("watch");
		ok(true, "can have attribute named 'watch' on a can.Map instance");
	});

	test("Should be able to get and set attribute named 'unwatch' on can.Map in Firefox", function() {
		var map = new can.Map({});
		map.attr("unwatch");
		ok(true, "can have attribute named 'unwatch' on a can.Map instance");
	});

	skip('Creating map in compute dispatches all events properly', function() {
		expect(2);

		var source = can.compute(0);

		var c = can.compute(function() {
			var map = new can.Map();
			source();
			map.bind("foo", function(){
				ok(true);
			});
			map.attr({foo: "bar"}); //DISPATCH

			return map;
		});

		c.bind("change",function(){});

		can.batch.start();
		source(1);
		can.batch.stop();
	});

	test('should get an empty string property value correctly', function() {
		var map = new can.Map({
			foo: 'foo',
			'': 'empty string'
		});

		equal(map.attr(''), 'empty string');
	});


	test("can.Map::attr setting is observable", function() {
		expect(0);
		var c = can.compute(function() {
			return new can.Map();
		});

		c.bind('change', function() {
			ok(false, "the compute should not be updated");
		});

		var map = c();

		// recomputes c
		map.attr('foo', 'bar');
	});
