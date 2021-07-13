var Control = require("./control");
var canReflect = require("can-reflect");

function addNoopEventHandlers(Control) {

	var oldShifter = Control._shifter;

	Control._shifter =  function (context, name) {
		var shifted = oldShifter.apply(this, arguments);
		function noopOnDestroyed(){

			if(!context.element) {
				console.warn("can23 "+canReflect.getName(context)+"["+name+"] is called after destroyed");
			} else {
				return shifted.apply(this, arguments);
			}
		}
		//!steal-remove-start
		if(process.env.NODE_ENV !== 'production') {
			Object.defineProperty(noopOnDestroyed, "name", {
				value: canReflect.getName(this) + "_NoopOnDestroyed["+name+"]",
			});
		}
		//!steal-remove-end

		return noopOnDestroyed;
	};
}

addNoopEventHandlers(Control);
