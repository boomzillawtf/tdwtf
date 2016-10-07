/* jshint browser: true */
/* globals $, ajaxify, app, socket */
$(window).on('action:ajaxify.contentLoaded', function() {
	if (ajaxify.data && ajaxify.data.cid) {
		$('html').attr('data-category-id', ajaxify.data.cid);
	} else {
		$('html').removeAttr('data-category-id');
	}

	if (app.user && app.user.uid) {
		$('html').attr('data-user-id', app.user.uid);
	} else {
		$('html').removeAttr('data-user-id');
	}

	if (app.user && app.user.isMafiaPlayer) {
		$('html').attr('data-mafia-player', '');
	} else {
		$('html').removeAttr('data-mafia-player');
	}

	if (app.user && app.user.isMafiaPlayerSS) {
		$('html').attr('data-mafia-player-ss', '');
	} else {
		$('html').removeAttr('data-mafia-player-ss');
	}

	if (app.user && app.user.isMafiaClubDed) {
		$('html').attr('data-mafia-club-ded', app.user.isMafiaClubDed);
	} else {
		$('html').removeAttr('data-mafia-club-ded');
	}

	if (app.user && app.user.isMafiaClubDedSS) {
		$('html').attr('data-mafia-club-ded-ss', app.user.isMafiaClubDedSS);
	} else {
		$('html').removeAttr('data-mafia-club-ded-ss');
	}
});

function addClubDedQuoteButton() {
	[{
		data: 'data-mafia-club-ded',
		current: '31/current-game',
		ded: '32/club-ded'

	}, {
		data: 'data-mafia-club-ded-ss',
		current: '45/self-serve-mafia',
		ded: '47/self-serve-club-ded'
	}].forEach(function(mafia) {
		if ($('html').is('[' + mafia.data + ']') &&
				$('.breadcrumb a[href="/category/' + mafia.current + '"]').length &&
				!$('.breadcrumb a[href="/category/' + mafia.ded + '"]').length) {
			$('[component="topic"]').off('click', '[component="post/quote-club-ded"]').on('click', '[component="post/quote-club-ded"]', function() {
				var tid = $('html').attr(mafia.data);
				var p = $(this).parents('[component="post"]');
				var pid = p.attr('data-pid');
				var username = '@' + p.attr('data-username').replace(/\s/g, '-');
				socket.emit('posts.getRawPost', pid, function(err, post) {
					if (err) {
						return app.alertError(err.message);
					}

					$(window).trigger('action:composer.addQuote', {
						tid: tid,
						slug: ajaxify.data.slug,
						pid: pid,
						index: p.attr('data-index'),
						username: username,
						topicName: ajaxify.data.titleRaw,
						text: post
					});

					ajaxify.go('/topic/' + tid);
				});
			});
			$('.post-tools:not(:has([component="post/quote-club-ded"]))').append('<a component="post/quote-club-ded" href="#" class="no-select">Popcorn</a>');
		}
	});
}
$(window).on('action:ajaxify.contentLoaded', addClubDedQuoteButton);
$(window).on('action:posts.loaded', addClubDedQuoteButton);

// fix title thingy
$(window).on('action:ajaxify.end', function() {
	$('[component="navbar/title"] span:hidden').addClass('hidden').removeAttr('style');
});
