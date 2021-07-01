var canString = require("can-string");
var stacheBindings = require("can-stache-bindings");
var assign = require('can-assign');


var bindingsRegExp = /\{(\()?(\^)?([^\}\)]+)\)?\}/,
	ignoreAttributesRegExp = /^(data-view-id|class|id|\[[\w\.-]+\]|#[\w\.-])$/i;

function removeBrackets(value, open, close){
	open = open || "{";
	close = close || "}";

	if(value[0] === open && value[value.length-1] === close) {
		return value.substr(1, value.length - 2);
	}
	return value;
}


var makeDataBinding = function(node, bindingContext, bindingSettings){
	var updatedBindSettings = assign({},bindingSettings);

	var matches = node.value.match(bindingsRegExp);
	if(matches) {

		updatedBindSettings.getSiblingBindingData = function(node, bindingSettings){

			return {
			   parent: {
				   source: "scope",
				   name: matches[3],
				   exports: true,
				   syncSibling: false
			   },
			   child: {
				   source: "viewModel",
				   name: canString.camelize( node.name ),
				   exports: true,
				   syncSibling: true
			   },
			   bindingAttributeName: node.name,
			   initializeValues: true
		   }
		};
		return stacheBindings.makeDataBinding(node, bindingContext, updatedBindSettings);
	}

	var binding = stacheBindings.makeDataBinding(node, bindingContext, bindingSettings);

	if(!binding) {
		if( ignoreAttributesRegExp.test(node.name) ) {
			return;
		}
		/*
		var siblingBindingData = {
			parent: {
				source: "scope",
				name: ('"' + node.value + '"'),
				exports: true,
				syncSibling: false
			},
			child: {
				source: "viewModel",
				name: node.name,
				exports: false,
				syncSibling: true
			},
			bindingAttributeName: node.name,
			initializeValues: true
		};
		var parentObservable = stacheBindings.getObservableFrom[siblingBindingData.parent.source](
				siblingBindingData.parent,
				bindingContext,
				bindingSettings
			),
			childObservable = stacheBindings.getObservableFrom[siblingBindingData.child.source](
				siblingBindingData.child,
				bindingContext, bindingSettings,
				parentObservable
			);

		var childToParent = !!siblingBindingData.child.exports;
		var parentToChild = !!siblingBindingData.parent.exports;

		// Check for child:bind="~parent" (it’s not supported because it’s unclear
		// what the “right” behavior should be)

		//!steal-remove-start
		if (process.env.NODE_ENV !== 'production') {
			if (siblingBindingData.child.setCompute && childToParent && parentToChild) {
				dev.warn("Two-way binding computes is not supported.");
			}
		}
		//!steal-remove-end

		var bindingOptions = {
			child: childObservable,
			childToParent: childToParent,
			// allow cycles if one directional
			cycles: childToParent === true && parentToChild === true ? 0 : 100,
			onInitDoNotUpdateChild: bindingSettings.alreadyUpdatedChild || siblingBindingData.initializeValues === false,
			onInitDoNotUpdateParent: siblingBindingData.initializeValues === false,
			onInitSetUndefinedParentIfChildIsDefined: true,
			parent: parentObservable,
			parentToChild: parentToChild,
			priority: bindingContext.parentNodeList ? bindingContext.parentNodeList.nesting + 1 : undefined,
			queue: "dom",
			sticky: siblingBindingData.parent.syncSibling ? "childSticksToParent" : undefined,
			element: bindingContext.element
		};

		var canBinding = new Bind(bindingOptions);
		return {
			siblingBindingData: siblingBindingData,
			binding: canBinding
		};*/

		// overwrite bind settings
		var updatedBindSettings = assign({},bindingSettings);
		updatedBindSettings.getSiblingBindingData = function(node, bindingSettings){

			return {
			   parent: {
				   source: "scope",
				   name: ('"' + node.value + '"'),
				   exports: true,
				   syncSibling: false
			   },
			   child: {
				   source: "viewModel",
				   name: canString.camelize( node.name ),
				   exports: false,
				   syncSibling: true
			   },
			   bindingAttributeName: node.name,
			   initializeValues: true
		   }
		};
		return stacheBindings.makeDataBinding(node, bindingContext, updatedBindSettings);

	} else {
		return binding;
	}
	/*
	var  siblingBindingData = {
		parent: assign({
			source: scopeBindingStr,
			name: result.special.raw ? ('"' + attributeValue + '"') : attributeValue,
			exports: true,
			syncSibling: false
		}, siblingBindingRules[dataBindingName].parent),
		child: assign({
			source: getChildBindingStr(result.tokens, bindingSettings && bindingSettings.favorViewModel),
			name: result.tokens[specialIndex - 1],
			event: childEventName,
			exports: false,
			syncSibling: true
		}, siblingBindingRules[dataBindingName].child),
		bindingAttributeName: attributeName,
		initializeValues: initializeValues
	};

	var bindingOptions = {
		child: childObservable,
		childToParent: childToParent,
		// allow cycles if one directional
		cycles: childToParent === true && parentToChild === true ? 0 : 100,
		onInitDoNotUpdateChild: bindingSettings.alreadyUpdatedChild || siblingBindingData.initializeValues === false,
		onInitDoNotUpdateParent: siblingBindingData.initializeValues === false,
		onInitSetUndefinedParentIfChildIsDefined: true,
		parent: parentObservable,
		parentToChild: parentToChild,
		priority: bindingContext.parentNodeList ? bindingContext.parentNodeList.nesting + 1 : undefined,
		queue: "dom",
		sticky: siblingBindingData.parent.syncSibling ? "childSticksToParent" : undefined,
		element: bindingContext.element
	};
	*/
}

module.exports = makeDataBinding;
