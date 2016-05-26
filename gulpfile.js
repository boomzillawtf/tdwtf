const gulp = require( 'gulp' ),
	karma = require( 'karma' );

gulp.task( 'default', [ 'test' ] );

gulp.task( 'test:karma', done => {
	const configFile = `${__dirname}/test/karma.conf.js`;
	new karma.Server( { configFile }, ( error ) => {
		done( error );
	} )
	.start();
} );

gulp.task( 'test', [ 'test:karma' ] );
