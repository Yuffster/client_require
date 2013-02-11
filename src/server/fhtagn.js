var fs   = require('fs'),
    path = require('path'),
    glob = require('glob');

var settings = {
	web_root: 'js'
};
function config(k,v) {
	settings[k] = v;
}

function getScripts(cb) {

	if (!cb) return;

	var modules = [], pending = 0;

	function unpend() {
		if (pending==0) {
			cb(null,modules);
		}
	}

	function contextualize(p) {
		var file_path, module_path;
		var fpath = p.split('/');
		if (fpath[fpath.length-2]=="server"||fpath[fpath.length-2]=="client") {
			fpath[fpath.length-2] = "client";
			file_path = fpath.join('/');
			fpath.splice(-2,1);
			module_path = fpath.join('/');
		} else {
			file_path = p;
			module_path = p;
		}
		file_path   = path.relative(process.env.PWD,file_path);
		module_path = path.relative(process.env.PWD,module_path);
		return {file_path:file_path, module_path:module_path};
	}

	function grabFile(file, modulePath) {
		var paths = contextualize(file);
		if (modulePath) {
			modulePath = path.relative(process.env.PWD,modulePath)||'__index__';
		}
		var module_path = modulePath || paths.module_path;
		pending++;
		fs.readFile(paths.file_path,'utf-8',function (err, f){
			pending--;
			modules.push({
				content: f,
				module_path: module_path,
				file_path: paths.file_path,
				web_path: '/'+settings.web_root+'/'+paths.file_path
			});
			unpend();
		});
	}

	function walk(p) {
		p = path.normalize(p);
		pending++;
		fs.readFile(path.join(p, 'package.json'), 'utf-8', function(e,d) {
			pending--;
			d = JSON.parse(d || "{}");
			var deps  = d.client_dependencies || [],
			    index = d.main;
			deps.forEach(function(dep) {
				walk(path.join(p, 'node_modules', dep));
			});
			grabFile(path.join(p, index), p);
			if (!d.client_require) return unpend();
			pending++;
			// Glob up everything else in the path.
			glob(path.join(p, "**", "*.js"), function(e,files) {
				pending--;
				if (!files) return unpend();
				files.forEach(function(file) {
					if (file.match(new RegExp('^'+p+'/node_modules'))) {
						return;
					}
					if (file.match(/\/server\//)) return;
					grabFile(file);
				});
				unpend();
			});
		});
	};

	walk(path.normalize(process.env.PWD));

}

function packScripts(scripts,cb) {
	var files = {}, manifest = {};
	var moduleTemplate = path.join(__dirname, '..', 'templates', 'module.js');
	var indexFile;
	fs.readFile(moduleTemplate, 'utf-8', function(e,tmp) {
		tmp = tmp.replace(/\s+/g, " ");
		files['fhtagn.js'] = function(fun) {
			var fhtagn = path.join(__dirname, '..', 'client', 'fhtagn.js');
			fs.readFile(fhtagn,'utf-8',function (err, txt){
				fun(null,txt);
			});
		};
		scripts.forEach(function(f) {
			var pack = function(cb) {
				fs.readFile(f.file_path,'utf-8',function (err, d){
					f.content = '\n'+d+'\n';
					f.module_path = JSON.stringify(manifest[f.file_path]);
					var c = tmp.replace(/{{([^}]*)}}/g, function(m,k) {
						return f[k] || '';
					});
					cb(null, c);
				});
			};
			if (!manifest[f.file_path]) manifest[f.file_path] = [];
			manifest[f.file_path].push(f.module_path);
			if (f.module_path=="__index__") indexFile = true;
			files[f.file_path] = pack;
		});
		if (indexFile) {
			files['__init__.js'] = function(fun) {
				var txt = "__fhtagn__.req('__index__');";
				fun(null,txt);
			};
		}
		cb(null,files);
	});
}

function new_require(p) {
	var a = [];
	for (var i in arguments) a[i] = arguments[i];
	try {
		require.apply(require, a);
	} catch (e) {
		//if (!p.match(/^\//)) throw e;
		var path = p.split(/\/\\/);
		path.splice(path.length-2, 0, 'server');
		try {
			require.apply(require, [path.join('/')]);
		} catch (f) {
			throw e;
		}
	}
}

function getSrcs(cb) {

	if (process.env.NODE_ENV!="production") {
		getScripts(function(e,scripts) {
			packScripts(scripts,function(e,d) {
				var srcs = [];
				for (var k in d) srcs.push('/'+settings.web_root+'/'+k);
				cb(null, srcs);
			});
		});
	} else {
		cb(null, ["/"+settings.web_root+'/application.js']);
	}

}

function listen(server) {

	getScripts(function(e,scripts) {

		if (process.env.NODE_ENV!="production") {
			packScripts(scripts, function(e,files) {
				server.on('request', function (req,res) {
					var url = require('url').parse(req.url).path,
					    m = url.match(new RegExp('^/'+settings.web_root+'/(.*)$'));
					if (m && files[m[1]]) {
						files[m[1]](function(e,d) { res.end(d); });
					}
				});	
			});
		} else {
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
					var app = path.join(__dirname, '..', 'templates', 'global_closure.js');
					fs.readFile(app, 'utf-8', function(e,tmp) {
						var code = tmp.replace("{{modules}}", modules);
						server.on('request', function (req,res) {
							var url = require('url').parse(req.url).path;
							if (url=="/"+settings.web_root+'/application.js') {
								res.end(code);
							}
						});	
					});
				}
			});	
		}
	});

}

module.exports = {
	listen: listen,
	config: config,
	getScripts: getSrcs,
	require: new_require
};