(function(ns) {

	var modules = {}, cache = {}, canon = {};

	if (typeof ns.__fhtagn__ == "undefined") {
		ns.__fhtagn__ = {};
	}

	ns.__fhtagn__.exp = function(paths,cpath,mod) {
		for (var i in paths) {
			modules[paths[i]] = mod;
			canon[paths[i]]   = cpath;
		}
	};

	ns.__fhtagn__.req = function(path,rel) {

		if (cache[path]) return cache[path];

		path = path.replace("/client", '');
		path = path.replace(/^\.\//, '');
		if (rel) rel = rel.replace("/client", '');

		function grab(p) {
			if (!cache[p]) {
				cache[p] = modules[p](function(mod) {
					return ns.__fhtagn__.req(mod, canon[p]);
				});
			} return cache[p];
		}

		for (var mod in modules) {
			if (mod==path+'.js'
				|| mod==path+'.js'
				|| rel+'/'+path+'.js'==mod
				|| mod==path
				|| mod.replace(/node_modules\//g, '')==path
				|| rel+'/'+path==mod
			) return grab(mod);
		}

		throw "Cannot find module "+path+" (called from "+(rel||"root")+")";

	}

})(this);