var CanList = require("can-list");
var bubble = require("can-map/bubble");
var assign = require("can-assign");
var canReflect = require("can-reflect");
var canEventQueueMap = require("can-event-queue/map/map");
var makeArray = canReflect.toArray;
var diffList = require("can-diff/list/list");

// BUBBLE RULE
// 1. list.bind("change") -> bubbling
//    list.unbind("change") -> no bubbling

// 2. list.attr("comparator","id") -> nothing
//    list.bind("length") -> bubbling
//    list.removeAttr("comparator") -> nothing

// 3. list.bind("change") -> bubbling
//    list.attr("comparator","id") -> bubbling
//    list.unbind("change") -> no bubbling

// 4. list.bind("length") -> nothing
//    list.attr("comparator","id") -> bubbling
//    list.removeAttr("comparator") -> nothing

// 5. list.bind("length") -> nothing
//    list.attr("comparator","id") -> bubbling
//    list.unbind("length") -> nothing

// Change bubble rule to bubble on change if there is a comparator.
var oldBubbleRule = CanList._bubbleRule;
CanList._bubbleRule = function(eventName, list) {
	var oldBubble = oldBubbleRule.apply(this, arguments);

	if (list.comparator && oldBubble.indexOf('change') === -1) {
		oldBubble.push('change');
	}

	return oldBubble;
};

var makeMoveFromPatch = function(list, patch){
	if(patch.length === 2) {
		var deleted,
			inserted,
			deletedIndex,
			insertedIndex;
		if(patch[0].deleteCount === 1) {
			deleted = list[patch[0].index];
			deletedIndex = patch[0].index;
		} else if(patch[0].insert.length === 1) {
			inserted = patch[0].insert[0];
			insertedIndex = patch[0].index;
		}
		if(patch[1].deleteCount === 1) {
			deletedIndex = insertedIndex <= patch[1].index ? patch[1].index - 1 : patch[1].index;
			deleted = list[deletedIndex];
		} else if(patch[1].insert.length === 1) {
			inserted = patch[1].insert[0];
			insertedIndex = patch[1].index;
		}
		if(deleted === inserted) {
			list._swapItems(deletedIndex, insertedIndex);
			return true;
		}
	}
};

var proto = CanList.prototype,
	_changes = proto._changes || function(){},
	setup = proto.setup,
	unbind = proto.unbind;

assign(proto, {
	setup: function () {
		setup.apply(this, arguments);
		this.bind('change', this._changes.bind(this));
		this._comparatorBound = false;

		this.bind('comparator', this._comparatorUpdated.bind(this));
		delete this._init;

		if (this.comparator) {
			this.sort();
		}
	},
	_comparatorUpdated: function(ev, newValue){
		if( newValue || newValue === 0 ) {
			this.sort();

			if((this.__bindEvents && this.__bindEvents._lifecycleBindings > 0) && ! this._comparatorBound) {
				this.bind("change", this._comparatorBound = function(){});
			}
		} else if(this._comparatorBound){
			unbind.call(this, "change", this._comparatorBound);
			this._comparatorBound = false;

		}
	},
	unbind: function(){
		var res = unbind.apply(this, arguments);

		if(this._comparatorBound && (this.__bindEvents && this.__bindEvents._lifecycleBindings === 1 )) {
			unbind.call(this,"change", this._comparatorBound);
			this._comparatorBound = false;
		}

		return res;
	},
	_comparator: function (a, b) {

		var comparator = this.comparator;

		// If the user has defined a comparator, use it
		if (comparator && typeof comparator === 'function') {
			return comparator(a, b);
		}

		// Compare strings correctly in all languages
		if (typeof a === 'string' && typeof b === 'string' &&
				''.localeCompare) {
			return a.localeCompare(b);
		}

		return (a === b) ? 0 : (a < b) ? -1 : 1;
	},
	_changes: function (ev, attr) {

		var dotIndex = ("" + attr).indexOf('.');

		// If a comparator is defined and the change was to a
		// list item, consider moving the item.
		if (this.comparator && dotIndex !== -1) {
			if (ev.batchNum) {
				if (ev.batchNum === this._lastProcessedBatchNum) {
					return;
				} else {
					this.sort();
					this._lastProcessedBatchNum = ev.batchNum;
					return;
				}
			}

			var currentIndex = +attr.substr(0, dotIndex);
			var item = this[currentIndex];
			var changedAttr = attr.substr(dotIndex + 1);

			// Don't waste time evaluating items in ways that aren't
			// relevant or have changed in ways that aren't relevant.
			if (typeof item !== 'undefined' &&
				(typeof this.comparator !== 'string' ||
					this.comparator.indexOf(changedAttr) === 0)) {

				// Determine where this item should reside as a result
				// of the change
				var newIndex =
					this._getRelativeInsertIndex(item, currentIndex);

				if (newIndex !== currentIndex) {
					this._swapItems(currentIndex, newIndex, true);

					// Trigger length change so that {{#block}} helper
					// can re-render
					canEventQueueMap.dispatch.call(this, 'length', [
						this.length
					]);
				}

			}
		}
		_changes.apply(this, arguments);
	},

	_getInsertIndex: function (item, lowerBound, upperBound) {

		var insertIndex = 0;
		var a = this._getComparatorValue(item);
		var b, dir, comparedItem, testIndex;

		lowerBound = (typeof lowerBound === 'number' ?
			lowerBound : 0);
		upperBound = (typeof upperBound === 'number' ?
			upperBound : this.length - 1);

		while (lowerBound <= upperBound) {
			testIndex = (lowerBound + upperBound) / 2 | 0;
			comparedItem = this[testIndex];
			b = this._getComparatorValue(comparedItem);
			dir = this._comparator(a, b); // -1 === a < b; 1 === a > b


			if (dir < 0) { // Compared item > our item
				upperBound = testIndex - 1;
			} else if (dir >= 0) { // Compared item <= our item
				lowerBound = testIndex + 1;
				insertIndex = lowerBound;
			}
		}

		return insertIndex;
	},

	_getRelativeInsertIndex: function (item, currentIndex) {
		var naiveInsertIndex = this._getInsertIndex(item);
		var nextItemIndex = currentIndex + 1;
		var a = this._getComparatorValue(item);
		var b;

		// Don't count the item being moved itself - which would
		// cause something like this:
		//   [1(a, b), 2, 3] // i = 0; a === b; Don't swap;
		//   [1(a), 2(b), 3] // i = 1; a < b; Do swap (a) from 0 to 1;
		//   .splice(0, 1) // [2, 3]
		//   .splice(1, 0, a) // [2, 1, 3]
		if (naiveInsertIndex >= currentIndex) {
			naiveInsertIndex -= 1;
		}

		// If a forward swap is suggested by _getInsertIndex, inspect
		// the next item for the same value. Otherwise, we may be
		// needlessly leapfroging over same value items to be naively
		// positioned before an item with a greater value. Otherwise,
		// the naiveInsertIndex is totally valid.
		if (currentIndex < naiveInsertIndex && nextItemIndex < this.length) {
			b = this._getComparatorValue(this[nextItemIndex]);

			if (this._comparator(a, b) === 0) {
				return currentIndex;
			}
		}

		return naiveInsertIndex;
	},

	/**
	 * @returns {number} The value that should be passed to the comparator
	 **/
	_getComparatorValue: function (item, singleUseComparator) {

		// Use the value passed to .sort() as the comparator value
		var comparator = singleUseComparator || this.comparator;

		// If the comparator is a string, use it to get the value of that
		// property on the item. Example:
		//   list.comparator = 'prop'; // -> item.attr('prop');
		//   list.comparator = 'method'; // -> item['method']();
		// If the comparator is a method, don't do anything.
		if (item && comparator && typeof comparator === 'string') {
			item = typeof item[comparator] === 'function' ?
				item[comparator]() :
				item.attr(comparator);
		}

		return item;
	},

	_getComparatorValues: function () {
		var self = this;
		var a = [];
		this.each(function (item) {
			a.push(self._getComparatorValue(item));
		});
		return a;
	},

	sort: function (singleUseComparator) {
		var a, b, c, isSorted;

		// Use the value passed to .sort() as the comparator function
		// if it is a function
		var comparatorFn = typeof singleUseComparator === "function"?
			singleUseComparator :
			this._comparator,
			self = this;

		var now = makeArray(this),
			sorted = now.slice(0).sort(function(a, b){
				var aVal = self._getComparatorValue(a, singleUseComparator);
				var bVal = self._getComparatorValue(b, singleUseComparator);
				var comparison =  comparatorFn.call(self, aVal, bVal);
				return comparison;
			});

		var patches = diffList(now, sorted);

		var finalize = function() {
			if(patches.length) {
				[].splice.apply(this,[ 0, sorted.length, ...sorted]);
				canEventQueueMap.dispatch.call(this, 'can.patches', [patches]);
				// Trigger length change so that {{#block}} helper can re-render
				canEventQueueMap.dispatch.call(this, 'length', [this.length]);
			}
			return this;
		}.bind(this);

		if(makeMoveFromPatch(this, patches)) {
			return finalize();
		}

		for (var i, iMin, j = 0, n = this.length; j < n-1; j++) {
			iMin = j;

			isSorted = true;
			c = undefined;

			for (i = j+1; i < n; i++) {

				a = this._getComparatorValue(this.attr(i), singleUseComparator);
				b = this._getComparatorValue(this.attr(iMin), singleUseComparator);

				// [1, 2, 3, 4(b), 9, 6, 3(a)]
				if (comparatorFn.call(this, a, b) < 0) {
					isSorted = false;
					iMin = i;
				}

				// [1, 2, 3, 4, 8(b), 12, 49, 9(c), 6(a), 3]
				// While iterating over the unprocessed items in search
				// of a "min", attempt to find two neighboring values
				// that are improperly sorted.
				// Note: This is not part of the original selection
				// sort agortithm
				if (c && comparatorFn.call(this, a, c) < 0) {
					isSorted = false;
				}

				c = a;
			}

			if (isSorted) {
				break;
			}

			if (iMin !== j) {
				this._swapItems(iMin, j);
			}
		}

		return finalize();
	},

	_swapItems: function (oldIndex, newIndex, actuallyMutate) {

		var temporaryItemReference = this[oldIndex];

		if(actuallyMutate) {
			// Remove the item from the list
			[].splice.call(this, oldIndex, 1);

			// Place the item at the correct index
			[].splice.call(this, newIndex, 0, temporaryItemReference);
		}

		// Update the DOM via can.view.live.list
		canEventQueueMap.dispatch.call(this, 'move', [
			temporaryItemReference,
			newIndex,
			oldIndex
		]);
	}

});

canReflect.eachKey({
		/**
		 * @function push
		 * Add items to the end of the list.
		 *
		 *     var l = new CanList([]);
		 *
		 *     l.bind('change', function(
		 *         ev,        // the change event
		 *         attr,      // the attr that was changed, for multiple items, "*" is used
		 *         how,       // "add"
		 *         newVals,   // an array of new values pushed
		 *         oldVals,   // undefined
		 *         where      // the location where these items where added
		 *         ) {
		 *
		 *     })
		 *
		 *     l.push('0','1','2');
		 *
		 * @param {...*} [...items] items to add to the end of the list.
		 * @return {Number} the number of items in the array
		 */
		push: "length",
		/**
		 * @function unshift
		 * Add items to the start of the list.  This is very similar to
		 * [CanList::push].  Example:
		 *
		 *     var l = new CanList(["a","b"]);
		 *     l.unshift(1,2,3) //-> 5
		 *     l.attr() //-> [1,2,3,"a","b"]
		 *
		 * @param {...*} [...items] items to add to the start of the list.
		 * @return {Number} the length of the array.
		 */
		unshift: 0
	},
	// adds a method where
	// @param where items in the array should be added
	// @param name method name
	function (where, name) {
		var proto = CanList.prototype,
			old = proto[name];
		proto[name] = function () {

			if (this.comparator && arguments.length) {
				// Get the items being added
				var args = makeArray(arguments);
				var length = args.length;
				var i = 0;
				var newIndex, val;

				// Increment, don't decrement in order to minimize the
				// number of items after each subsequent .splice();
				while (i < length) {

					// Convert anything to a `map` that needs to be converted.
					val = bubble.set(this, i, this.__type(args[i], i) );

					// Get the sorted index
					newIndex = this._getInsertIndex(val);

					// Insert this item at the correct index
					// NOTE: On ultra-big lists, this will be the slowest
					// part of an "add" because `.splice()` is O(n)
					Array.prototype.splice.apply(this, [newIndex, 0, val]);

					// Render, etc
					this._triggerChange('' + newIndex, 'add', [val], undefined);

					// Next
					i++;
				}

				// Render, etc
				canEventQueueMap.dispatch.call(this, 'reset', [args]);

				return this;
			} else {
				// Call the original method
				return old.apply(this, arguments);
			}
		};
	});

// Overwrite .splice so that items added to the list (no matter what the
// defined index) are inserted at the correct index, while preserving the
// ability to remove items from a list.
(function () {
	var proto = CanList.prototype;
	var oldSplice = proto.splice;

	proto.splice = function (index, howMany) {

		var args = makeArray(arguments);

		// Don't use this "sort" oriented splice unless this list has a
		// comparator
		if (! this.comparator) {
			return oldSplice.apply(this, args);
		}

		// Remove items using the original splice method
		oldSplice.call(this, index, howMany);

		// Remove the 1st and 2nd args so that the newly added
		// items can be processed directly, rather than `.slice()`
		// which creates a copy, or `for (...) { added.push(args[i]); }`
		// which iterates needlessly
		args.splice(0, 2);

		// Add items by way of push so that they're sorted into
		// the correct position
		proto.push.apply(this, args);
	};
})();

module.exports = exports = CanList;
