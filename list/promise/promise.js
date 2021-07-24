var can = require("../../can-core");
require("../list");

	var oldSetup = can.List.prototype.setup;
	can.List.prototype.setup = function(instances, options){
		if(can.isPromise(instances)) {
			oldSetup.call(this, [], options);
			this.replace(instances);
		} else {
			return oldSetup.apply(this, arguments);
		}
	}

	var oldReplace = can.List.prototype.replace;

	// can-list.replace only understands real promises
	can.List.prototype.replace = function (data) {
		// First call the old replace so its
		// deferred callbacks will be called first
		var result;
		// If there is a promise:
		if (can.isPromise(data)) {
			// start code in underlying replace
			if(this._promise) {
				this._promise.__isCurrentPromise = false;
			}
			var promise = this._promise = data;
			promise.__isCurrentPromise = true;
			var self = this;
			data.then(function(newList){
				if(promise.__isCurrentPromise) {
					self.replace(newList);
				}
			});


			if(this._deferred) {
				this._deferred.__cancelState = true;
			}

			// Set up its state.  Must call this way
			// because we are working on an array.
			can.batch.start();
			this.attr("state", data.state());
			this.removeAttr("reason");
			can.batch.stop();

			var self = this;
			// update its state when it changes
			var deferred = this._deferred = new can.Deferred();
			deferred.__cancelState = false;

			data.then(function(){

				if(!deferred.__cancelState) {
					self.attr("state", data.state());
					// The deferred methods will always return this object
					deferred.resolve(self);
				}
			},function(reason){
				if(!deferred.__cancelState) {
					can.batch.start();
					self.attr("state", data.state());
					self.attr("reason", reason);
					can.batch.stop();
					deferred.reject(reason);
				}
			});
		} else {
			oldReplace.apply(this, arguments);
		}
		return this;
	};

	can.each({
		isResolved: "resolved",
		isPending: "pending",
		isRejected: "rejected"
	}, function (value, method) {
		can.List.prototype[method] = function () {
			return this.attr("state") === value;
		};
	});


	can.each([
		"then",
		"done",
		"fail",
		"always",
		"promise"
	], function (name) {
		can.List.prototype[name] = function () {
			// it's possible a list is created manually and returned as the result
			// of .then.  It should not break.
			if(!this._deferred) {
				this._deferred = new can.Deferred();
				this._deferred.resolve(this);
			}

			return this._deferred[name].apply(this._deferred, arguments);
		};
	});
