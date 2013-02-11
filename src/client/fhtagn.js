(function() {

	var modules = {}, cache = {};

	if (typeof __fhtagn__ == "undefined") {
		window.__fhtagn__ = {};
		__fhtagn__ = window.__fhtagn__;
	}

	__fhtagn__.exp = function(paths, mod) {
		for (var i in paths) modules[paths[i]] = mod;
	};

	__fhtagn__.req = function(path,relative) {

		var mod_relative;

		if (relative=="__index__") relative = null;

		mod_relative = relative+'/node_modules/'+path;

		if (relative) path = relative+'/'+path;

		if (cache[path]) return cache[path];

		function grab(p) {
			cache[p] = modules[p](function(mod) {
				return __fhtagn__.req(mod, p);
			});
			return cache[p];
		}

		for (var mod in modules) {
			if (mod==path+'.js'
				|| mod==path.replace(/^\.\//, '')+'.js'
				|| mod==path
				|| mod.replace(/node_modules\//g, '')==path
				|| mod_relative==mod
			) return grab(mod);
		}

		console.error("Cannot find module", path);

	}

	__fhtagn__ = __fhtagn__;

})();