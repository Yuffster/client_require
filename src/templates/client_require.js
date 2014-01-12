/**
 * This file is in charge of loading scripts as single files for development
 * use. All errors reported in the console will be relative to a proper 
 * filename and (almost) correct line number -- the line number will be off by
 * one.
 *
 * Setting your NODE_ENV to production will use the global_closure.js file
 * instead of this one, and be much more efficient.
 */
(new function(srcs) {

	function initialize() {
		{{initialize}}
	}

	(function loadScript(n) {
		if (!srcs[n]) return initialize();
		var script    = document.createElement('script');
		script.src    = srcs[n];
		script.type   = "text/javascript";
		document.body.appendChild(script);
		script.onload = function() { loadScript(n++); }; 
	}(0))

}({{srcs}}));