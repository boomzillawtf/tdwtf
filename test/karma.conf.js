module.exports = function( config ) {
	config.set( {
		basePath: '../',
		frameworks: [ 'jasmine-jquery', 'jasmine' ],
		files: [
			'test/**/*.spec.js',
			'*.scss',
			'*.html',
			'test/fixtures/**/*'
		],
		exclude: [],
		preprocessors: {
			'**/*.scss': [ 'scss' ]
		},
		reporters: [ 'spec' ],
		port: 9876,
		colors: true,
		logLevel: config.LOG_INFO,
		autoWatch: false,
		browsers: [ 'PhantomJS' ],
		singleRun: true,
		concurrency: Infinity,
		plugins: [ 'karma-spec-reporter', 'karma-phantomjs-launcher', 'karma-jasmine-jquery', 'karma-jasmine', 'karma-scss-preprocessor' ],
		specReporter: {
			maxLogLines: 20,
			suppressErrorSummary: false,
			suppressFailed: false,
			suppressPassed: false,
			suppressSkipped: false,
			showSpecTiming: true
		}
	} )
};
