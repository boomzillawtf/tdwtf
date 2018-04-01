/* jshint browser: true */
/* globals $, ajaxify, app */
var initialSearch = location.search || '?';

$(window).on('action:ajaxify.contentLoaded', function() {
	var $html = $('html');

	function data(name, value) {
		var params = initialSearch.substring(1).split(/&/g);
		for (var i = 0; i < params.length; i++) {
			var param = params[i].split(/=/);
			if (decodeURIComponent(param[0]) === 'override_' + name) {
				$html.attr('data-' + name, decodeURIComponent(param[1]));
				return;
			}
		}

		if (value) {
			$html.attr('data-' + name, value === true ? '' : value);
		} else {
			$html.removeAttr('data-' + name);
		}
	}

	if (app.user && app.user.disableMobileSlide) {
		$html.addClass('preventSlideout');
	} else {
		$html.removeClass('preventSlideout');
	}

	data('category-id', ajaxify.data && ajaxify.data.cid);
	data('user-id', app.user && app.user.uid);
	data('mafia-player', app.user && app.user.isMafiaPlayer);
	data('mafia-player-ss', app.user && app.user.isMafiaPlayerSS);
	data('mafia-club-ded', app.user && app.user.isMafiaClubDed);
	data('mafia-club-ded-ss', app.user && app.user.isMafiaClubDedSS);
	data('impossible-mission-a', app.user && app.user.isImpossibleMissionA);
	data('impossible-mission-b', app.user && app.user.isImpossibleMissionB);

	var now = new Date();
	data('current-year', now.getFullYear());
	data('current-month', now.getMonth() + 1);
	data('current-day-of-week', now.getDay());
	data('current-day-of-month', now.getDate());

	if ($('#new_topic').length && $('#new-topics-alert').length) {
		$('#new-topics-alert').css('margin-left', $('#new_topic').outerWidth() + 10 + 'px');
	}
});

// fix title thingy
$(window).on('action:ajaxify.end', function() {
	$('[component="navbar/title"] span:hidden').addClass('hidden').removeAttr('style');
	var $span = $('[component="navbar/title"] span');
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
			$span.text('');
			$span.hide();
		}
	} else {
		$fa.remove();
	}
});
