function removeTextNodes(node) {
	for(var n = 0; n < node.childNodes.length; n++) {
		var child = node.childNodes[n];
		if ( child.nodeType === 8 ) {
			node.removeChild(child);
			n--;
		} else if(child.nodeType === 1) {
			removeTextNodes(child);
		}
	}
	return node;
}

module.exports = {
	removeTextNodes: removeTextNodes,
	innerHTML: function(node){
		return "innerHTML" in node ?
			removeTextNodes(node.cloneNode(true)).innerHTML :
			undefined;
	}
}
