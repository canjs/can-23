// # can/view/scope/scope.js
//
// This allows you to define a lookup context and parent contexts that a key's value can be retrieved from.
// If no parent scope is provided, only the scope's context will be explored for values.
var can = require("../../can-core");
var makeComputeData = require("./compute_data");
var assign = require("can-assign");
var TemplateContext = require('can-view-scope/template-context');
var ObservationRecorder = require("can-observation-recorder");
var canReflect = require("can-reflect");
var defineLazyValue = require('can-define-lazy-value');
var stacheHelpers = require("../helpers");
var jQuery = require("jquery");

if (!String.prototype.startsWith) {
    Object.defineProperty(String.prototype, 'startsWith', {
        value: function(search, rawPos) {
            var pos = rawPos > 0 ? rawPos|0 : 0;
            return this.substring(pos, pos + search.length) === search;
        }
    });
}

		/**
		 * @add can.view.Scope
		 */
		function Scope(context, parent, meta) {
			// The obj that will be looked on for values.
			this._context = context;
			// The next Scope object whose context should be looked on for values.
			this._parent = parent;
			// If this is a special context, it can be labeled here.
			// Options are:
			// - viewModel - This is a viewModel
			// - notContext - This can't be looked within using `./` and `../`. It will be skipped.  This is
			//   for virtual contexts like those used by `%index`.
			this._meta = meta || {};

			// A cache that can be used to store computes used to look up within this scope.
			// For example if someone creates a compute to lookup `name`, another compute does not
			// need to be created.
			this.__cache = {};
		}

		/**
		 * @static
		 */
		assign(Scope, {
			// ## Scope.read
			// Scope.read was moved to can.compute.read
			// can.compute.read reads properties from a parent.  A much more complex version of getObject.
			read: can.compute.read.read,
			// ## Scope.Refs
			// A special type of `can.Map` used for the references scope.
			Refs: can.Map.extend({shortName: "ReferenceMap"},{}),

			// ## Scope.refsScope
			// A scope with a references scope in it and no parent.
			refsScope: function(){
				return new can.view.Scope( new this.Refs() );
			}
		});
		/**
		 * @prototype
		 */
		assign(Scope.prototype,{

			// ## Scope.prototype.add
			// Creates a new scope and sets the current scope to be the parent.
			// ```
			// var scope = new can.view.Scope([
			//   {name:"Chris"},
			//   {name: "Justin"}
			// ]).add({name: "Brian"});
			// scope.attr("name") //-> "Brian"
			// ```
			add: function (context, meta) {
				if (context !== this._context) {
					return new this.constructor(context, this, meta);
				} else {
					return this;
				}
			},

			// ## Scope.prototype.read
			// Reads from the scope chain and returns the first non-`undefined` value.
			// `read` deals mostly with setting up "context based" keys to start reading
			// from the right scope.  Once the right scope is located, `_read` is called.
			/**
			 * @hide
			 * @param {can.mustache.key} attr A dot seperated path.  Use `"\."` if you have a property name that includes a dot.
			 * @param {can.view.Scope.readOptions} options that configure how this gets read.
			 * @return {{}}
			 *   @option {Object} parent the value's immediate parent
			 *   @option {can.Map|can.compute} rootObserve the first observable to read from.
			 *   @option {Array<String>} reads An array of properties that can be used to read from the rootObserve to get the value.
			 *   @option {*} value the found value
			 */
			read: function (attr, options) {

				// If it's the root, jump right to it.
				if(attr === "%root") {
					return { value: this.getRoot() };
				}

				if(attr.startsWith("%element") || attr.startsWith("%event") || attr.startsWith("%viewModel") || attr.startsWith("%jQueryElement") ) {
					return this.getSpecial(attr.substr(1) , options);
				}

				// Identify context based keys.  Context based keys try to
				// specify a particular context a key should be within.
				var isInCurrentContext = attr.substr(0, 2) === './',
					isInParentContext = attr.substr(0, 3) === "../",
					isCurrentContext = attr === "." || attr === "this",
					isParentContext = attr === "..",
					isSpecialContext = attr[0] === "%",
					isContextBased = isInCurrentContext ||
						isInParentContext ||
						isCurrentContext ||
						isParentContext;


				// `notContext` contexts should be skipped if the key is "context based".
				// For example, the context that holds `%index`.
				if(isContextBased && this._meta.notContext) {
					return this._parent.read(attr, options);
				}

				// If true, lookup stops after the current context.
				var currentScopeOnly;

				if(isInCurrentContext) {
					// Stop lookup from checking parent scopes.
					// Set flag to halt lookup from walking up scope.
					currentScopeOnly = true;
					attr = attr.substr(2);
				}
				else if (isInParentContext || isParentContext) {
					// walk up until we find a parent that can have context.
					// the `isContextBased` check above won't catch it when you go from
					// `../foo` to `foo` because `foo` isn't context based.
					var parent = this._parent;
					while(parent._meta.notContext || parent._meta.special) {
						parent = parent._parent;
					}
					if ( isParentContext ) {
						return {
							value: parent._context
						};
					}
					return parent.read(attr.substr(3) || ".", options);
				}
				else if ( isCurrentContext ) {
					var cur = this;
					while(cur._meta.notContext || cur._meta.special) {
						cur = cur._parent;
					}
					return {
						value: canReflect.getValue( cur._context )
					};
				}

				// if it's a reference scope, read from there.
				var keyReads = can.compute.read.reads(attr);
				if(keyReads[0].key.charAt(0) === "*") {
					return this.getRefs()._read(keyReads, options, true);
				} else {
					return this._read(keyReads,options, currentScopeOnly);
				}
			},
			getSpecial: function(specialAttr,readOptions){
				var keyReads = can.compute.read.reads(specialAttr);
				var cur = this;
				while(cur && !cur._meta.special) {
					cur = cur._parent;
				}
				// punch in jQueryElement so %jQueryElement.val would work
				
				if(cur && keyReads[0].key === "jQueryElement" && !cur._context.jQueryElement) {
					cur._context.jQueryElement = jQuery(cur._context.element);
				}
				return can.compute.read.read(cur._context, keyReads, readOptions);
			},
			// ## Scope.prototype._read
			//
			_read: function(keyReads, options, currentScopeOnly, isSpecialContext){

				// The current scope and context we are trying to find "keyReads" within.
				var currentScope = this,
					currentContext,

				// If no value can be found, this is a list of of every observed
				// object and property name to observe.
					undefinedObserves = [],

				// Tracks the first found observe.
					currentObserve,
				// Tracks the reads to get the value from `currentObserve`.
					currentReads,

				// Tracks the most likely observable to use as a setter.
					setObserveDepth = -1,
					currentSetReads,
					currentSetObserve,

					readOptions = assign({
						/* Store found observable, incase we want to set it as the rootObserve. */
						foundObservable: function (observe, nameIndex) {
							currentObserve = observe;
							currentReads = keyReads.slice(nameIndex);
						},
						earlyExit: function (parentValue, nameIndex) {
							if (nameIndex > setObserveDepth) {
								currentSetObserve = currentObserve;
								currentSetReads = currentReads;
								setObserveDepth = nameIndex;
							}
						},
						can23Compatibility: true
					}, options);

				// Goes through each scope context provided until it finds the key (attr).  Once the key is found
				// then it's value is returned along with an observe, the current scope and reads.
				// While going through each scope context searching for the key, each observable found is returned and
				// saved so that either the observable the key is found in can be returned, or in the case the key is not
				// found in an observable the closest observable can be returned.



				if(readOptions.prioritizeHelpers) {
					var getObserves = ObservationRecorder.trap();
					var helper = this.getHelperOrPartial(keyReads);
					var observes = getObserves();
					if (helper && helper.value) {
						if(options.callHelperFunction) {

							return {
								//setRoot: currentSetObserve,
								//reads: currentSetReads(),
								value: helper.value.call(this._context, options.helperOptions)
							}
						}

						// Don't return parent so `.bind` is not used.
						return {value: helper.value};
					}
				}

				while (currentScope) {
					currentContext = currentScope._context;



					if ( currentContext !== null &&
							// if its a primitive type, keep looking up the scope, since there won't be any properties
						(typeof currentContext === "object" || typeof currentContext === "function")
					) {

						// Prevent computes from temporarily observing the reading of observables.
						var getObserves = ObservationRecorder.trap();

						var data = can.compute.read.read(currentContext, keyReads, readOptions);

						// Retrieve the observes that were read.
						var observes = getObserves();
						// If a **value was was found**, return value and location data.
						if (data.value !== undefined) {
							ObservationRecorder.addMany(observes);
							return {
								scope: currentScope,
								rootObserve: currentObserve,
								value: data.value,
								reads: currentReads,
								thisArg: data.parent,
								parentHasKey: data.parentHasKey
							};
						}
						// Otherwise, save all observables that were read.  If no value
						// is found, we will observe on all of them.
						else {
							undefinedObserves.push.apply(undefinedObserves, observes);
						}
					}

					//
					if(currentScopeOnly) {
						currentScope = null;
					} else {
						// Move up to the next scope.
						currentScope = currentScope._parent;
					}
				}

				if(!readOptions.prioritizeHelpers) {
					var helper = this.getHelperOrPartial(keyReads);

					if (helper && helper.value) {
						// Call expressions certainly should not be called
						if(options.callHelperFunction && !keyReads[keyReads.length - 1].at) {

							return {
								//setRoot: currentSetObserve,
								//reads: currentSetReads(),
								value: helper.value.call(this._context, options.helperOptions)
							}
						}
						// Don't return parent so `.bind` is not used.
						return {value: helper.value};
					}
				}

				// The **value was not found**, return `undefined` for the value.
				// Make sure we listen to everything we checked for when the value becomes defined.
				// Once it becomes defined, we won't have to listen to so many things.
				ObservationRecorder.addMany(undefinedObserves);
				return {
					setRoot: currentSetObserve,
					reads: currentSetReads,
					value: undefined
				};
			},
			getHelperOrPartial: function(keyReads) {
				// try every template context
				var scope = this, context, helper;
				while (scope) {
					context = scope._context;
					if (context instanceof TemplateContext) {
						helper = can.compute.read.read(context.helpers, keyReads, { proxyMethods: false });
						if(helper.value !== undefined) {
							return helper;
						}
						helper = can.compute.read.read(context.partials, keyReads, { proxyMethods: false });
						if(helper.value !== undefined) {
							return helper;
						}
					}
					scope = scope._parent;
				}

				return can.compute.read.read(stacheHelpers, keyReads, { proxyMethods: false });
			},
			// not filled out for debugging
			getPathsForKey: function(){
				return [];
			},

			// ## Scope.prototype.get
			// Gets a value from the scope without being observable.
			get: ObservationRecorder.ignore(function (key, options) {

				options = assign({
					isArgument: true
				}, options);

				var res = this.read(key, options);
				return res.value;
			}),
			peek: ObservationRecorder.ignore(function(key, options) {
				return this.get(key, options);
			}),
			// ## Scope.prototype.getScope
			// Returns the first scope that passes the `tester` function.
			getScope: function(tester){
				var scope = this;
				while (scope) {
					if(tester(scope)) {
						return scope;
					}
					scope = scope._parent;
				}
			},
			// ## Scope.prototype.getContext
			// Returns the first context whose scope passes the `tester` function.
			getContext: function(tester){
				var res = this.getScope(tester);
				return res && res._context;
			},
			// ## Scope.prototype.getRefs
			// Returns the first references scope.
			// Used by `.read` when looking up `*key` and by the references
			// view binding.
			getRefs: function(){
				return this.getScope(function(scope){
					return scope._context  instanceof Scope.Refs;
				});
			},
			// ## Scope.prototype.getRoot
			// Returns the top most context that is not a references scope.
			// Used by `.read` to provide `%root`.
			getRoot: function(){
				var cur = this,
					child = this;

				while(cur._parent) {
					child = cur;
					cur = cur._parent;
				}

				if(cur._context instanceof Scope.Refs) {
					cur = child;
				}
				return cur._context;
			},
			set: function(key, value, options){
				// Use `.read` to read everything upto, but not including the last property name
				// to find the object we want to set some property on.
				// For example:
				//  - `foo.bar` -> `foo`
				//  - `../foo.bar` -> `../foo`
				//  - `../foo` -> `..`
				//  - `foo` -> `.`
				var dotIndex = key.lastIndexOf('.'),
					slashIndex = key.lastIndexOf('/'),
					contextPath,
					propName;

				if(slashIndex > dotIndex) {
					contextPath = key.substring(0, slashIndex);
					propName = key.substring(slashIndex + 1, key.length);
				} else {
					if(dotIndex !== -1) {
						contextPath = key.substring(0, dotIndex);
						propName = key.substring(dotIndex + 1, key.length);
					} else {
						contextPath = ".";
						propName = key;
					}
				}

				if(key.charAt(0) === "*") {
					can.compute.set(this.getRefs()._context, key, value, options);
				} else {
					var context = this.read(contextPath, options).value;
					can.compute.set(context, propName, value, options);
				}
			},
			getTemplateContext: function() {
				var lastScope;

				// find the first reference scope
				var templateContext = this.getScope(function(scope) {
					lastScope = scope;
					return scope._context instanceof TemplateContext;
				});

				// if there is no reference scope, add one as the root
				if(!templateContext) {
					templateContext = new Scope(new TemplateContext());

					// add templateContext to root of the scope chain so it
					// can be found using `getScope` next time it is looked up
					lastScope._parent = templateContext;
				}
				return templateContext;
			},

			// ## Scope.prototype.attr
			// Gets or sets a value in the scope without being observable.
			attr: ObservationRecorder.ignore(function (key, value, options) {


				options = assign({
					isArgument: true
				}, options);

				// Allow setting a value on the context
				if(arguments.length === 2) {
					return this.set(key, value, options);

				} else {
					return this.get(key, options);
				}

			}),



			// ## Scope.prototype.computeData
			// Finds the first location of the key in the scope and then provides a get-set compute that represents the key's value
			// and other information about where the value was found.
			computeData: function (key, options) {
				return makeComputeData(this, key, options);
			},

			// ## Scope.prototype.compute
			// Provides a get-set compute that represents a key's value.
			compute: function (key, options) {
				return this.computeData(key, options)
					.compute;
			},
			// ## Scope.prototype.cloneFromRef
			//
			// This takes a scope and essentially copies its chain from
			// right before the last Refs.  And it does not include the ref.
			// this is a helper function to provide lexical semantics for refs.
			// This will not be needed for leakScope: false.
			cloneFromRef: function(){
				var contexts = [];
				var scope = this,
					context,
					parent;
				while (scope) {
					context = scope._context;
					if(context instanceof Scope.Refs) {
						parent = scope._parent;
						break;
					}
					contexts.unshift(context);
					scope = scope._parent;
				}
				if(parent) {
					can.each(contexts, function(context){
						parent = parent.add(context);
					});
					return parent;
				} else {
					return this;
				}
			},

			isSpecial: function(){
				return this._meta.notContext || this._meta.special || (this._context instanceof TemplateContext) || this._meta.variable;
			}
		});

		defineLazyValue(Scope.prototype, 'templateContext', function() {
			return this.getTemplateContext()._context;
		});



		function Options(data, parent, meta){
			if (!data.helpers && !data.partials && !data.tags) {
				data = {
					helpers: data
				};
			}
			Scope.call(this, data, parent, meta);
		}
		Options.prototype = new Scope();
		Options.prototype.constructor = Options;
		Scope.Options = Options;


		module.exports = Scope;
