(function() {

	var module = { exports: {} };

	var exports = module.exports;

	__fhtagn__.exp({{module_path}}, {{canonical_path}}, function(require) {

		return (new function(module) {

			{{content}}

			return module.exports;

		}(module));

	});

}());