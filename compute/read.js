var can = require("../can-core");
var compute = require("can-compute");

	// there are things that you need to evaluate when you get them back as a property read
	// for example a compute or a function you might need to call to get the next value to
	// actually check
	// - isArgument - should be renamed to something like "onLastPropertyReadReturnFunctionInsteadOfCallingIt".
	//   This is used to make a compute out of that function if necessary.
	// - readCompute - can be set to `false` to prevent reading an ending compute.  This is used by component to get a
	//   compute as a delegate.  In 3.0, this should be removed and force people to write "{@prop} change"
	// - callMethodsOnObservables - this is an overwrite ... so normal methods won't be called, but observable ones will.
	// - executeAnonymousFunctions - call a function if it's found, defaults to true
	// - proxyMethods - if the last read is a method, return a function so `this` will be correct.
	// - args - arguments to call functions with.
	//
	// Callbacks
	// - earlyExit - called if a value could not be found
	// - foundObservable - called when an observable value is found
	var read = function (parent, reads, options) {

		options = options || {};
		var state = {
			foundObservable: false
		};

		// `cur` is the current value.
		var cur = readValue(parent, 0, reads, options, state),
			type,
			// `prev` is the object we are reading from.
			prev,
			// `foundObs` did we find an observable.
			readLength = reads.length,
			i = 0;


		while( i < readLength ) {
			prev = cur;
			// try to read the property
			for(var r=0, readersLength = read.propertyReaders.length; r < readersLength; r++) {
				var reader = read.propertyReaders[r];
				if(reader.test(cur)) {
					cur = reader.read(cur, reads[i], i, options, state);
					break; // there can be only one reading of a property
				}
			}
			i = i+1;
			// read the value if it is a compute or function
			cur = readValue(cur, i, reads, options, state, prev);
			type = typeof cur;
			// early exit if need be
			if (i < reads.length && (cur === null || type !== 'function' && type !== 'object')) {
				if (options.earlyExit) {
					options.earlyExit(prev, i - 1, cur);
				}
				// return undefined so we know this isn't the right value
				return {
					value: undefined,
					parent: prev
				};
			}

		}
		// if we don't have a value, exit early.
		if (cur === undefined) {
			if (options.earlyExit) {
				options.earlyExit(prev, i - 1);
			}
		}
		return {
			value: cur,
			parent: prev
		};
	};


	var isAt = function(index, reads) {
		var prevRead = reads[index-1];
		return prevRead && prevRead.at;
	};

	var readValue = function(value, index, reads, options, state, prev){
		// if the previous read is AT false ... we shouldn't be doing this;
		var usedValueReader;
		do {

			usedValueReader = false;
			for(var i =0, len = read.valueReaders.length; i < len; i++){
				if( read.valueReaders[i].test(value, index, reads, options) ) {
					value = read.valueReaders[i].read(value, index, reads, options, state, prev);
					//usedValueReader = true;
				}
			}
		} while(usedValueReader);

		return value;
	};

	// value readers check the current value
	// and get a new value from it
	// ideally they would keep calling until
	// none of these passed
	read.valueReaders = [{
		name: "compute",
		// compute value reader
		test: function(value, i, reads, options){

			return value && value.isComputed && !isAt(i, reads);
		},
		read: function(value, i, reads, options, state){
			if(options.readCompute === false && i === reads.length ) {
				return value;
			}

			if (!state.foundObservable && options.foundObservable) {
				options.foundObservable(value, i);
				state.foundObservable = true;
			}
			return value instanceof can.Compute ? value.get() : value();
		}
	},{
		name: "function",
		// if this is a function before the last read and its not a constructor function
		test: function(value, i, reads, options){
			var type = typeof value;
			// i = reads.length if this is the last iteration of the read for-loop.
			return type === 'function' && !value.isComputed &&
				!(can.Construct && value.prototype instanceof can.Construct) &&
				!(can.route && value === can.route);
		},
		read: function(value, i, reads, options, state, prev){
			if( isAt(i, reads) ) {
				return i === reads.length ? can.proxy(value, prev) : value;
			}
			else if(options.callMethodsOnObservables && can.isMapLike(prev)) {
				return value.apply(prev, options.args || []);
			}
			else if ( options.isArgument && i === reads.length ) {
				return options.proxyMethods !== false ? can.proxy(value, prev) : value;
			}
			return value.apply(prev, options.args || []);
		}
	}];

	// propertyReaders actually read a property value
	read.propertyReaders = [
		// read a can.Map or can.route
		{
			name: "map",
			test: can.isMapLike,
			read: function(value, prop, index, options, state){
				if (!state.foundObservable && options.foundObservable) {
					options.foundObservable(value, index);
					state.foundObservable = true;
				}
				var res = value.attr(prop.key);
				if(res !== undefined) {
					return res;
				} else {
					return value[prop.key];
				}
			}
		},
		// read a promise
		{
			name: "promise",
			test: function(value){
				return can.isPromise(value);
			},
			read: function(value, prop, index, options, state){
				if (!state.foundObservable && options.foundObservable) {
					options.foundObservable(value, index);
					state.foundObservable = true;
				}
				var observeData = value.__observeData;
				if(!value.__observeData) {
					observeData = value.__observeData = {
						isPending: true,
						state: "pending",
						isResolved: false,
						isRejected: false,
						value: undefined,
						reason: undefined
					};
					can.cid(observeData);
					// proto based would be faster
					can.simpleExtend(observeData, can.event);
					value.then(function(value){
						observeData.isPending = false;
						observeData.isResolved = true;
						observeData.value = value;
						observeData.state = "resolved";
						observeData.dispatch("state",["resolved","pending"]);
					}, function(reason){
						observeData.isPending = false;
						observeData.isRejected = true;
						observeData.reason = reason;
						observeData.state = "rejected";
						observeData.dispatch("state",["rejected","pending"]);
					});
				}
				can.__observe(observeData,"state");
				return prop.key in observeData ? observeData[prop.key] : value[prop.key];
			}
		},

		// read a normal object
		{
			name: "object",
			// this is the default
			test: function(){return true;},
			read: function(value, prop){
				var valueType = typeof value;
				if(value == null || (valueType !== 'object' && valueType !== 'function')) {
					return undefined;
				} else {
					if(prop.key in value) {
						return value[prop.key];
					}
					// TODO: remove in 3.0.  This is for backwards compat with @key and @index.
					else if( prop.at && specialRead[prop.key] && ( ("@"+prop.key) in value)) {
						//!steal-remove-start
						can.dev.warn("Use %"+prop.key+" in place of @"+prop.key+".");

						//!steal-remove-end

						prop.at = false;
						return value["@"+prop.key];
					}

				}
			}
		}
	];

	var specialRead = {index: true, key: true, event: true, element: true, viewModel: true};

	// This should be able to set a property similar to how read works.
	read.write = function(parent, key, value, options) {
		options = options || {};
		if(can.isMapLike(parent)) {
			// HACK! ... check if the attr is a comptue, if it is, set it.
			if(!options.isArgument && parent._data && parent._data[key] && parent._data[key].isComputed) {
				return parent._data[key](value);
			} else {
				return parent.attr(key, value);
			}
		}

		if(parent[key] && parent[key].isComputed) {
			return parent[key](value);
		}

		if(typeof parent === 'object') {
			parent[key] = value;
		}
	};


	read.reads = function(key) {
		var keys = [];
		var last = 0;
		var at = false;
		if( key.charAt(0) === "@" ) {
			last = 1;
			at = true;
		}
		var keyToAdd = "";
		for(var i = last; i < key.length; i++) {
			var character = key.charAt(i);
			if(character === "." || character === "@") {
				if( key.charAt(i -1) !== "\\" ) {
					keys.push({
						key: keyToAdd,
						at: at
					});
					at = character === "@";
					keyToAdd = "";
				} else {
					keyToAdd = keyToAdd.substr(0,keyToAdd.length - 1) + ".";
				}
			} else {
				keyToAdd += character;
			}
		}
		keys.push({
			key: keyToAdd,
			at: at
		});

		return keys;
	};

	compute.read = read;
