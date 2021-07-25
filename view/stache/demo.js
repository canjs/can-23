var demo = require("./demo.stache");
var jQuery = require("jquery");
document.body.appendChild( demo({message: "YES"}) );


$("body").append(demo);
