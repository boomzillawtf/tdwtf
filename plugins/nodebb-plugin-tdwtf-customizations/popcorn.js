/* jshint browser: true */
/* globals $, ajaxify, app, socket */
function addPopcornButton(tid) {
	$('[component="topic"]').off('click', '[component="post/quote-club-ded"]').on('click', '[component="post/quote-club-ded"]', function() {
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

			socket.emit('plugins.tdwtf.getPopcornBookmark', tid, function(err, index) {
				if (err || !index) {
					return ajaxify.go('/topic/' + tid + '/popcorn');
				}

				ajaxify.go('/topic/' + tid + '/popcorn/' + index);
			});
		});
	});
	$('.post-tools:not(:has([component="post/quote-club-ded"]))').prepend('<a component="post/quote-club-ded" href="#" class="no-select">Popcorn</a>');
}

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
			addPopcornButton($('html').attr(mafia.data));
		}
	});

	// NodeBB Updates
	if ($('html').is('[data-user-id]') && $('body').is('.page-topic-19454')) {
		addPopcornButton(19758);
	}

	// Song of the day
	if ($('html').is('[data-user-id]') && $('body').is('.page-topic-13289')) {
		addPopcornButton(13309);
	}

	// automated instance restart tracking thread
	if ($('html').is('[data-user-id]') && $('body').is('.page-topic-21402')) {
		addPopcornButton(21555);
	}

	// The Impossible Mission
	if ($('html').is('[data-user-id]') && $('body').is('.page-topic-20849, .page-topic-20850, .page-topic-20852, .page-topic-20854, .page-topic-20855, .page-topic-20858, .page-topic-20864, .page-topic-20865')) {
		addPopcornButton(20856);
	}
}
$(window).on('action:ajaxify.contentLoaded', addClubDedQuoteButton);
$(window).on('action:posts.loaded', addClubDedQuoteButton);
