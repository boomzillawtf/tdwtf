jasmine.getFixtures().fixturesPath = '/base/test/fixtures';
( function( $ ) {
	describe( 'header', function() {
		describe( 'custom.css', function() {
			beforeEach( function() {
				loadFixtures( 'css-test.html' );
			} );
			it( 'prevents font from becoming too big', function() {
				var count = 0;
				$( '#tagabuse-big .subject' ).each( function( i, subject ) {
					expect( $( subject ).css( 'font-size' ) ).toBe( '50px' );
					++count;
				} );
				expect( count ).toBe( 3 );
			} );
			it( 'prevents font from becoming too small', function() {
				var count = 0;
				$( '#tagabuse-small .subject' ).each( function( i, subject ) {
					expect( $( subject ).css( 'font-size' ) ).toBe( '8px' );
					++count;
				} );
				expect( count ).toBe( 3 );
			} );
		} );
	} );
}( jQuery ) );