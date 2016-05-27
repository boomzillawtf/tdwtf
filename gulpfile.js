const gulp = require( 'gulp' ),
	jshint = require( 'gulp-jshint' ),
	karma = require( 'karma' );

gulp.task( 'default', [ 'lint', 'test' ] );

gulp.task( 'lint:jshint', () =>
	gulp.src( [ '*.html', '*.js', 'test/**/*.js', '!gulpfile.js' ] )
	.pipe( jshint.extract( 'auto' ) )
	.pipe( jshint() )
	.pipe( jshint.reporter( 'default', { verbose: true } ) )
	.pipe( jshint.reporter( 'fail' ) )
);

gulp.task( 'lint', [ 'lint:jshint' ] );

gulp.task( 'test:karma', done => {
	const configFile = `${__dirname}/test/karma.conf.js`;
	new karma.Server( { configFile }, ( error ) => {
		done( error );
	} )
	.start();
} );

gulp.task( 'test', [ 'test:karma' ] );
