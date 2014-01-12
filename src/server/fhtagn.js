var fs   = require('fs'),
    path = require('path'),
    glob = require('glob');

var settings = {
	web_root     : '/js/',
	include_file : 'client_require.js',
	app_root     : process.env.PWD,
	env          : process.env.NODE_ENV,
	uglify       : true
}, require_paths = [], initPaths = [];

function config(k,v) {
	settings[k] = v;
}

var REQUIRE_METH = '__fhtagn__.req';

var scripts = false, scriptCallbacks = [], scriptPending = false;
function getScripts(cb) {

	if (!cb) return;

	if (scripts) return cb(false, scripts);

	scriptCallbacks.push(cb);

	if (scriptPending) return;

	scriptPending = true;

	var modules = [], pending = 0;

	function unpend() {
		if (pending===0) {
			scriptPending = false;
			scripts = modules;
			var s = scriptCallbacks.shift();
			while(s) {
				s(null,modules);
				s = scriptCallbacks.shift();
			}
		}
	}

	function contextualize(p,modulePath) {

		var file, mod, web, index, rpath,
		    fpath   = p.split('/');

		function rel(f) {
			return path.relative(settings.app_root,f).replace(/\.\.\//g, '');
		}

		if (fpath[fpath.length-2]=="server"||fpath[fpath.length-2]=="client") {
			fpath[fpath.length-2] = "client";
			file = fpath.join('/');
			fpath.splice(-2,1);
			mod = fpath.join('/');
		} else {
			file = p;
			mod  = p;
		}

		file  = file;
		mod   = rel(mod);
		web   = settings.web_root+rel(file);
		index = (modulePath) ? (rel(modulePath) || "__index__") : false;
		rpath = rel(p);

		return {file:file, module:mod, web:web, relative:rpath, index: index};

	}

	function grabFile(file, modulePath, initPath) {
		var paths = contextualize(file,modulePath);
		pending++;
		fs.readFile(paths.file,'utf-8',function (err, f){
			pending--;
			modules.push({
				content: f,
				module_path: paths.module,
				file_path: paths.file,
				web_path: paths.web,
				relative_path: paths.relative,
				index_path: paths.index
			});
			if (initPath) initPaths.push(paths.module);
			unpend();
		});
	}

	function walk(p,initPath) {
		p = path.normalize(p);
		pending++;
		fs.readFile(path.join(p, 'package.json'), 'utf-8', function(e,d) {

			if (e) throw e;
			pending--;
			d = JSON.parse(d || "{}");
			var deps  = d.client_dependencies || [],
			    index = d.main;
			if (!index.match(/\.js$/)) index += '.js';
			deps.forEach(function(dep) {
				walk(path.join(p, 'node_modules', dep));
			});

			grabFile(path.join(p, index), p, initPath);

			if (!d.client_require) return unpend();
			pending++;

			// Glob up everything else in the path.
			glob(path.join(p, "**", "*.js"), function(e,files) {
				pending--;
				if (!files) return unpend();
				files.forEach(function(file) {
					// If we went through all the node modules recursively as if
					// they were all full client-side requires, we'd end up with
					// a crapload of test code and server-side stuff loading on
					// the client.
					if (file.match(new RegExp('^'+p+'/node_modules'))) {
						return;
					}
					// Explicitly ignore things in /server/.
					if (file.match(/\/server\//)) return;
					grabFile(file);
				});
				unpend();
			});
		});
	}

	for (var p in require_paths) walk(require_paths[p], true);
	walk(settings.app_root, true);

}

var packed = false, packCallbacks = [], packPending = false;
function packScripts(scripts,cb) {

	if (!cb) return;

	if (packed) return cb(false, packed);

	packCallbacks.push(cb);

	if (packPending) return;

	packPending = true;

	// Separating the manifest from the files allows us to load each file once
	// without losing its module path aliases.
	var files = {}, manifest = {};

	function callback() {
		packed = files;
		var p = packCallbacks.shift();
		while(p) {
			p(null,packed);
			p = packCallbacks.shift();
		}
	}

	var moduleTemplate = path.join(__dirname, '..', 'templates', 'module.js');
	var indexFile;

	fs.readFile(moduleTemplate, 'utf-8', function(e,tmp) {
		tmp = tmp.replace(/\s+/g, " ");
		files[settings.web_root+'fhtagn.js'] = function(fun) {
			var fhtagn = path.join(__dirname, '..', 'client', 'fhtagn.js');
			fs.readFile(fhtagn,'utf-8',function (err, txt){
				fun(null,txt);
			});
		};
		scripts.forEach(function(f) {
			if (!manifest[f.web_path]) manifest[f.web_path] = [];
			manifest[f.web_path].push(f.module_path);
			if (f.module_path != f.relative_path) {
				manifest[f.web_path].push(f.relative_path);
			}
			if (f.index_path) {
				manifest[f.web_path].push(f.index_path);
			}
			if (f.module_path=="__index__") indexFile = true;
			var pack = function(cb) {
				fs.readFile(f.file_path,'utf-8',function (err, d){
					if (err) throw "Error loading file "+f.file_path+': '+e;
					var o = {};
					o.content = '\n'+d+'\n';
					o.module_path    = JSON.stringify(manifest[f.web_path]);
					o.canonical_path = path.dirname(f.relative_path);
					if (o.caninical_path === '.') o.caninical_path = "";
					o.canonical_path = JSON.stringify(o.canonical_path);
					var c = tmp.replace(/\{\{(\w*)\}\}/g, function(m,k) {
						return o[k] || '';
					});
					cb(err, c);
				});
			};
			files[f.web_path] = pack;
		});
		callback();
	});

}

function getInitCode() {
	var out = "";
	initPaths.forEach(function(p) {
		out += '\n'+REQUIRE_METH+'("'+p+'");';
	});
	return out;
}

var compiled = false, compilerCallbacks = [], compiling = false;
function compileScripts(cb) {

	if (compiled) return cb(null, compiled);
	if (cb) compilerCallbacks.push(cb);
	if (compiling) return;

	compiling = true;

	function callback() {
		compiling = false;
		var p = compilerCallbacks.shift();
		while(p) {
			p(null,packed);
			p = compilerCallbacks.shift();
		}
	}

	getScripts(function(e,scripts) {

		packScripts(scripts, function(e,files) {

			var q = [], modules = "";

			for (var f in files) q.push(files[f]);
			function next() {
				var f = q.shift();
				if (!f) return serveModules();
				f(function(e,d) {
					modules += d;
					next();
				});
			} next();

			function serveModules() {
				var app = path.join(
					__dirname, '..', 'templates', 'global_closure.js'
				), fhtagn = path.join(
					__dirname, '..', 'client', 'fhtagn.js'
				);
				fs.readFile(app, 'utf-8', function(e,tmp) {
					fs.readFile(fhtagn, 'utf-8', function(e,fhtagn) {
						if (e) return cb(e);
						tmp = tmp.split("{{fhtagn.js}}").join(fhtagn);
						tmp = tmp.split("{{modules}}").join(modules);
						tmp = tmp.split("{{initialize}}").join(getInitCode());
						if (settings.uglify) {
							//Compress with UglifyJs
							var jsp  = require("uglify-js").parser,
							    pro  = require("uglify-js").uglify,
							    code = jsp.parse(tmp);
							code = pro.ast_mangle(code);
							code = pro.ast_squeeze(code);
							tmp  = pro.gen_code(code);
						}
						compiled = tmp;
						callback();
					});
				});
			}

		});

	});
}

function new_require(p) {

	if (!p.match(/^(\/|\\)/)) {
		p = path.normalize(path.join(path.dirname(module.parent.id),p));
	}

	var mpath = path.dirname(module.parent.filename),
	    sp    = mpath.replace(/server/, '')+p;

	//If the module doesn't exist, check in the server/ path.
	if (!path.existsSync(p) && path.existsSync(sp)) p = sp;

	return module.parent.require(p);

}

function getSrcs(cb) {
	getScripts(function(e,scripts) {
		packScripts(scripts,function(e,d) {
			var srcs = [];
			for (var k in d) srcs.push(k);
			cb(null, srcs);
		});
	});
}

function serveScript(p, cb) {

	p = settings.web_root+p;

	var is_app = (p==settings.web_root+settings.include_file);

	getScripts(function(e,scripts) {

		packScripts(scripts, function(e,files) {

			if (settings.env!="production") {

				if (is_app) {
					var tmp = path.join(__dirname, '..', 'templates', 'client_require.js');
					getSrcs(function(e,srcs) {
						fs.readFile(tmp, 'utf-8', function(e,tmp) {
							tmp = tmp.replace('{{srcs}}', JSON.stringify(srcs));
							tmp = tmp.replace('{{initialize}}', getInitCode());
							cb(null, tmp);
						});
					});
					return;
				}

				if (files[p]) {
					files[p](function(e,d) { cb(e,d); });
				} else {
					cb(e||"File not found");
				}

			} else {

				if (is_app) return compileScripts(cb);

			}

		});

	});

}

function handle(req,res) {

	var url  = require('url').parse(req.url).path,
	    patt = '^'+settings.web_root.replace('/', '\/')+'(.*)$',
	    m    = url.match(new RegExp(patt));

	if (!m) return false;

	serveScript(m[1], function(e,d) {
		if (e) {
			res.writeHead('404');
			res.end("File not found");
		} else {
			res.setHeader('Content-Type', 'application/javascript');
			res.writeHead('200');
			res.end(d);
		}
	});

	return true;

}

function connect_server() {

	return function(req, res, next) {
		if (!handle(req,res)) next();
	};

}

function getIncludePath() {
	return settings.web_root+settings.include_file;
}

function add_path(p) {
	require_paths.push(p);
}

if (settings.env=="production") {
	compileScripts();
}

module.exports = {
	set      : config,
	require  : new_require,
	connect  : connect_server,
	add_path : add_path,
	get_src  : getIncludePath,
	handle   : handle
};
