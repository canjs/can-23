var DOCUMENT = require('can-globals/document/document');

var templates = {};

module.exports = {
	from: function(id){
		if(!templates[id]) {
			var el = DOCUMENT().getElementById(id);
			if(el) {
				templates[id] = stache("#" + id, el.innerHTML);
			}
		}
		return templates[id];
	},
	registerPartial: function(id, partial) {
		templates[id] = (typeof partial === "string" ? stache(partial) : partial);
	}
};