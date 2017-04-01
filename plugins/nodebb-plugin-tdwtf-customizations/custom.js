/* jshint browser: true */
/* globals $, ajaxify, app, socket */
$(window).on('action:ajaxify.contentLoaded', function() {
	var $html = $('html');

	if (ajaxify.data && ajaxify.data.cid) {
		$html.attr('data-category-id', ajaxify.data.cid);
	} else {
		$html.removeAttr('data-category-id');
	}

	if (app.user && app.user.uid) {
		$html.attr('data-user-id', app.user.uid);
	} else {
		$html.removeAttr('data-user-id');
	}

	if (app.user && app.user.isMafiaPlayer) {
		$html.attr('data-mafia-player', '');
	} else {
		$html.removeAttr('data-mafia-player');
	}

	if (app.user && app.user.isMafiaPlayerSS) {
		$html.attr('data-mafia-player-ss', '');
	} else {
		$html.removeAttr('data-mafia-player-ss');
	}

	if (app.user && app.user.isMafiaClubDed) {
		$html.attr('data-mafia-club-ded', app.user.isMafiaClubDed);
	} else {
		$html.removeAttr('data-mafia-club-ded');
	}

	if (app.user && app.user.isMafiaClubDedSS) {
		$html.attr('data-mafia-club-ded-ss', app.user.isMafiaClubDedSS);
	} else {
		$html.removeAttr('data-mafia-club-ded-ss');
	}

	var now = new Date();
	$html.attr('data-current-year', now.getFullYear());
	$html.attr('data-current-month', now.getMonth() + 1);
	$html.attr('data-current-day-of-week', now.getDay());
	$html.attr('data-current-day-of-month', now.getDate());

	if ($('#new_topic').length && $('#new-topics-alert').length) {
		$('#new-topics-alert').css('margin-left', $('#new_topic').outerWidth() + 10 + 'px');
	}
});

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

	var necroThreshold = (new Date().getMonth() + 1 === 4 && new Date().getDate() === 1 ? 5 : 7 * 24 * 60 * 60) * 1000;
	$('[component="post"]').each(function() {
		var post = $(this);
		if (post.is(':has(.necro-post)')) {
			return;
		}
		var prev = post.prev('[component="post"]');
		if (!prev.length) {
			return;
		}
		var diff = post.attr('data-timestamp') - prev.attr('data-timestamp');
		if (diff >= necroThreshold) {
			var ago = $.timeago.settings.strings.suffixAgo;
			$.timeago.settings.strings.suffixAgo = ' later';
			$('<aside>').addClass('necro-post').text(diff >= 1000 * 60 * 60 * 24 * 365 * 10 ? 'goddamnit fbmac' : $.timeago.inWords(diff)).append($('<hr>')).prependTo(post);
			$.timeago.settings.strings.suffixAgo = ago;
		}
	});
}
$(window).on('action:ajaxify.contentLoaded', addClubDedQuoteButton);
$(window).on('action:posts.loaded', addClubDedQuoteButton);

// fix title thingy
$(window).on('action:ajaxify.end', function() {
	$('[component="navbar/title"] span:hidden').addClass('hidden').removeAttr('style');
	var $fa = $('[component="navbar/title"] a.fa');
	if (ajaxify.data.category) {
		if ($fa.length === 0) {
			$fa = $('<a>').appendTo($('[component="navbar/title"]'));
		}
		$fa.attr('title', ajaxify.data.category.name);
		$fa.attr('href', '/category/' + ajaxify.data.category.slug);
		$fa.attr('class', 'fa ' + ajaxify.data.category.icon);
		$fa.css({
			color: ajaxify.data.category.color,
			backgroundColor: ajaxify.data.category.bgColor
		});
		if (ajaxify.data.category.image) {
			$fa.css({
				backgroundImage: 'url(' + ajaxify.data.category.image + ')',
				backgroundSize: ajaxify.data.category.imageClass
			});
		} else {
			$fa.css('background-image', 'none');
		}
	} else {
		$fa.remove();
	}
});
