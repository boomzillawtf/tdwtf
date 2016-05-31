/* jshint node: true */
module.exports = function( config ) {
	config.set( {
		basePath: '../',
		frameworks: [ 'jasmine-jquery', 'jasmine' ],
		files: [
			'test/**/*.spec.js',
			{ pattern: 'test/fixtures/**/*', served: true, included: false },
			{ pattern: 'plugins/nodebb-plugin-tdwtf-customizations/**/*', served: true, included: false }
		],
		exclude: [],
		preprocessors: {
			'**/*.scss': [ 'scss' ],
			'**/*.less': [ 'less' ]
		},
		proxies: {},
		reporters: [ 'spec' ],
		port: 9876,
		colors: true,
		logLevel: config.LOG_INFO,
		autoWatch: false,
		browsers: [ 'PhantomJS', 'Firefox' ],
		singleRun: true,
		concurrency: 1,
		captureTimeout: 60000,
		browserDisconnectTimeout : 60000,
		browserDisconnectTolerance : 1,
		browserNoActivityTimeout : 60000,
		plugins: [ 'karma-*' ],
		specReporter: {
			maxLogLines: 20,
			suppressErrorSummary: false,
			suppressFailed: false,
			suppressPassed: false,
			suppressSkipped: false,
			showSpecTiming: true
		},
		lessPreprocessor: {
			options: {
				paths: [ '.', 'test/fixtures' ]
			}
		}
	} );
};
