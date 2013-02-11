# Client Require

This library allows you to run your Node.JS application on the client side using
standard CommonJS module syntax.  It supports loading client files from
dependency NPM packages and easily branching between client and server modules
when necessary.

In development mode, loaded package files will present error messages in the
browser which match the filename and line number of the related server-side
file.

In production mode, packages will be placed within a single closure with no
leaking scope.

## Usage

In your package.json, list your dependencies as you normally would, and add an
additional configuration field called "client_dependencies", which is a list of
module names.

	{
		"main": "app.js",
		"dependencies": {
			"client_require": "*",
			"uuid-v4": "*"
		}
		"client_dependencies": ['uuid-v4']
	}

Type `npm install` as usual to install the dependencies.

In your Node.js app, pass an instance of your HTTP server to fhtagn:

	var client_require = require('client_require');

	var http = require('http');
	var app  = http.createServer(function (req, res) {
		var out = "<html><head>";
		client_require.getScripts(function(e, srcs) {
			for (var i in srcs) {
				out += '<script src="'+srcs[i]+'"></script>';
			}
			out += "</head><body>Ia! Ia!</body></html>";
			res.end(out);
		});
	}).listen(3000, 'localhost');

	client_require.listen(app);

## Client/Server Alternation

If you want to have separate versions of particular files for the client and 
the server, you can do so by placing the module in a directory called client/
or server/, respectively.

Example:

	server/
		app.js
	client/
		app.js

This will create a module file at the root path `app.js`. client/app.js will
be loaded on the client and server/app.js will be loaded on the server.

On the server-side, you must use the `require` method exported by the library
to properly load server-side files.

## API Methods

### getScripts

Will callback with an array of script srcs to inject into the page, in order.

### listen

Attaches a request event to the HTTP server to serve files which start with the
provided web_root configuration.

### require

This is useful on the server-side, as the standard `require` function is not
able to be overloaded.  This will make sure you load server/foo.js when there
is no root foo.js available, which mimicks the client-side functionality.

## Configuration

### web_root

The root web path to load files from.  Defaults to `/js/`.