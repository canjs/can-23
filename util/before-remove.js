var jQuery = require("jquery");
var assign = require("can-assign");
var mutateNode = require("can-dom-mutate/node");

function getWindow(element) {
	var document = element.ownerDocument;
	if(!document) {
		debugger;
	}
	return document.defaultView || document.parentWindow;
}

var createEventThatDoesntBubble = (function(){
	if(typeof CustomEvent === "function") {
		return function createEvent(element, event) {
			var CustomEvent = getWindow(element).CustomEvent;
			return new CustomEvent(event.type, assign({bubbles: false, cancelable: false}, event));
		}
	} else {
		return function createEvent(element, eventSource) {
			const event = document.createEvent(eventSource.type);
			// Define that the event name is 'build'.
			event.initEvent(eventSource.type, false, false);
			assign(event, eventSource);
			return event;
		}
	}
})();
/*
var oldClean = jQuery.cleanData;
jQuery.cleanData = function (elems) {
	$.each(elems, function (i, elem) {
		if (elem) {
			elem.dispatchEvent(createEventThatDoesntBubble(elem, {type: "beforeRemove"}))
		}
	});
	oldClean(elems);
};
*/

var oldRemoveChild = mutateNode.removeChild;


mutateNode.removeChild = function can23_beforeRemove_removeChild(child) {
	if(child.nodeType === 1) {
		var removedElements = child.getElementsByTagName("*");
		child.dispatchEvent( createEventThatDoesntBubble(child, {type: "beforeRemove"}) );

		[].forEach.call( removedElements, function removeElement(elem){
			elem.dispatchEvent(createEventThatDoesntBubble(elem, {type: "beforeRemove"}))
		})
	}
	oldRemoveChild.apply(this, arguments);
}
