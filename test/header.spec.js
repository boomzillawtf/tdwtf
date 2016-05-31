/* jshint jasmine: true */
/* globals jQuery */
( function( $ ) {
	var fixtures = jasmine.getFixtures(),
		styleFixtures = jasmine.getStyleFixtures(),
		jsonFixtures = jasmine.getJSONFixtures(),
		basePath = 'base',
		testPath = basePath + '/test',
		fixturesPath = testPath + '/fixtures',
		customizationsPath = basePath + '/plugins/nodebb-plugin-tdwtf-customizations';

	fixtures.fixturesPath =
	styleFixtures.fixturesPath =
	jsonFixtures.fixturesPath =
		'';

	describe( 'header', function() {
		describe( 'custom.css', function() {
			beforeEach( function() {
				fixtures.load( fixturesPath + '/css-test.html' );
				styleFixtures.appendLoad( customizationsPath + '/custom.css' );
			} );
			it( 'prevents font from becoming too big', function() {
				var count = 0,
					expected = $( '#tagabuse-big .reference' ).css( 'font-size' );

				expect( expected ).toMatch( /^[-+]?[0-9]+(?:\.[0-9]+)?px$/ );
				$( '#tagabuse-big .subject' ).each( function( i, subject ) {
					expect( $( subject ).css( 'font-size' ) ).toBe( expected );
					++count;
				} );
				expect( count ).toBe( 3 );
			} );
			it( 'prevents font from becoming too small', function() {
				var count = 0,
					expected = $( '#tagabuse-small .reference' ).css( 'font-size' );

				expect( expected ).toMatch( /^[-+]?[0-9]+(?:\.[0-9]+)?px$/ );
				$( '#tagabuse-small .subject' ).each( function( i, subject ) {
					expect( $( subject ).css( 'font-size' ) ).toBe( expected );
					++count;
				} );
				expect( count ).toBe( 3 );
			} );
		} );
	} );
}( jQuery ) );
