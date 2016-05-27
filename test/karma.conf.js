module.exports = function( config ) {
	config.set( {
		basePath: '../',
		frameworks: [ 'jasmine-jquery', 'jasmine' ],
		files: [
			'test/**/*.spec.js',
			'*.scss',
			'*.css',
			'*.less',
			'*.html',
			'test/fixtures/**/*'
		],
		exclude: [],
		preprocessors: {
			'**/*.scss': [ 'scss' ],
			'**/*.less': [ 'less' ]
		},
		reporters: [ 'spec' ],
		port: 9876,
		colors: true,
		logLevel: config.LOG_INFO,
		autoWatch: false,
		browsers: [ 'PhantomJS', 'Firefox' ],
		singleRun: true,
		concurrency: Infinity,
		plugins: [ 'karma-*' ],
		specReporter: {
			maxLogLines: 20,
			suppressErrorSummary: false,
			suppressFailed: false,
			suppressPassed: false,
			suppressSkipped: false,
			showSpecTiming: true
		}
	} )
	} );
};
