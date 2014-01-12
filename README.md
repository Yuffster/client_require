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

## Reading Manuals is for Nerds!

To play around with a demo repository which loads jQuery from NPM in a
constrained namespace along with two other NPM modules (uuid-v4 and sillynames), 
visit <http://github.com/Yuffster/client_require_demo>.

## Credits

Copyright 2012-2014 by Michelle Steigerwalt <http://msteigerwalt.com> and licensed
under the MIT license.

If you find this library useful, please let me know!

### Built Using

* [LAB.js](http://labjs.com/) by Getify Solutions <http://getify.com/>
* [UglifyJS](http://marijn.haverbeke.nl/uglifyjs) by Mihai Bazon
<http://mihai.bazon.net/blog>
* [glob](http://github.com/isaacs/node-glob) (and NPM!) by Isaac Z. Schlueter <http://izs.me>

## Using Modules

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

### Vanilla Node.js

In your Node.js app, pass requests as they come in to client_require.handle.

	var client_require = require('client_require');

	var http = require('http');
	var app  = http.createServer(function(req,res) {
		//Let client_require try to handle this if it can.
		if (client_require.handle(req,res)) return;
		//Otherwise, handle it as usual.
		res.write("Hello, world!");
		//Don't forget to add the script tag that loads all the other scripts!
		res.end('<script src="'+client_require.get_src+'"></script>');
	});

	app.listen(3000, 'localhost');

### Connect Middleware

If you're using Connect, you can use the .connect() handler instead.

	app.use(require('client_require').connect());

### Loading the Scripts

To load all your scripts in development and production mode, just require the
base include, which by default is `/js/client_require.js`.  It's best to place
this file at the **end of your document**, so the module can load all necessary 
script files in a nonblocking manner.

	<script src="/js/client_require.js"></script>

## Packaging Modules for the Client

When client_require looks through your node_module, it will open up your
package.json file and look for a `client_require` key, which should point to
where your main files live (and you're either using client/server 
differentiation or aren't calling server-side Node modules).  

If you don't have a `client_require` key, but do have a `main` key,
client_require will load the file specified (but no others which might be
required within the main module).

## Configuration

To change the default settings of client_require, you can use the `.set()` 
function.

	var client_require = require('client_require');

	client_require.set('web_root', '/assets/scripts/');

### Options

#### web_root

Defaults to `/js/`.

This will be appended to all script srcs, and only requests
with a path which starts with this string will be served.

#### include_file

Defaults to `client_require.js`.

The main file which will then load all other necessary scripts.

#### app_root

Defaults to `process.env.PWD` (the directory in which you type the `node` 
command to launch the webserver).

client_require will start by indexing all JavaScript files within this file and
all dependent files listed in the package.json in this directory.

#### env

Defaults to `process.env.NODE_ENV` or 'development'.  If your server is in 
development mode, all modules will be served as their own file.  In production,
all files will be packaged into one JavaScript file.

### uglify

Defaults to `true`.  When set to true, production code will be minified
using the NPM module for [Uglify](http://marijnhaverbeke.nl//uglifyjs).

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

### connect

When called as a function, this will return a Connect module, which can be 
attached to any Connect application.

	app.use(client_require.connect());

### handle

You can pass a request object to client_require.handle within your HTTP request
handler.  If the request matches client_require's web_path, the handle
method will return true, and a response will be sent once it's available.

	if (client_require.handle(req,res)) return;

### require

This is useful on the server-side, as the standard `require` function is not
able to be overloaded.  This will make sure you load server/foo.js when there
is no root foo.js available, which mimicks the client-side functionality.

### set

Sets a configuration key to the provided value.

	client_require.set('app_root', __dirname);

### get_src

Returns the web-accessible path to the main application JavaScript, which will
in turn load all other modules.

	res.write('<script src="'+client_require.get_src()+'"></script>');