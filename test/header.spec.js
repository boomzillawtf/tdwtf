( function( $ ) {
	var fixtures = jasmine.getFixtures();
	var styleFixtures = jasmine.getStyleFixtures();
	var jsonFixtures = jasmine.getJSONFixtures();
	fixtures.fixturesPath =
	styleFixtures.fixturesPath =
	jsonFixtures.fixturesPath =
		'';

	describe( 'header', function() {
		describe( 'custom.css', function() {
			beforeEach( function() {
				fixtures.load( 'base/test/fixtures/css-test.html' );
				styleFixtures.appendLoad( 'wtdwtf/stylesheet.css', 'base/custom.css' );
			} );
			it( 'prevents font from becoming too big', function() {
				var count = 0,
					expected = $( '#tagabuse-big .reference' ).css( 'font-size' );
				$( '#tagabuse-big .subject' ).each( function( i, subject ) {
					expect( $( subject ).css( 'font-size' ) ).toBe( expected );
					++count;
				} );
				expect( count ).toBe( 3 );
			} );
			it( 'prevents font from becoming too small', function() {
				var count = 0,
					expected = $( '#tagabuse-small .reference' ).css( 'font-size' );
				$( '#tagabuse-small .subject' ).each( function( i, subject ) {
					expect( $( subject ).css( 'font-size' ) ).toBe( expected );
					++count;
				} );
				expect( count ).toBe( 3 );
			} );
		} );
	} );
}( jQuery ) );
