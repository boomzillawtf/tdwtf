/* jshint browser: true */
/* globals $, ajaxify, app */
$(window).on('action:ajaxify.contentLoaded', function() {
	var $html = $('html');

	function data(name, value) {
		if (value) {
			$html.attr('data-' + name, value === true ? '' : value);
		} else {
			$html.removeAttr('data-' + name);
		}
	}

	$html.addClass('preventSlideout');

	data('category-id', ajaxify.data && ajaxify.data.cid);
	data('user-id', app.user && app.user.uid);
	data('mafia-player', app.user && app.user.isMafiaPlayer);
	data('mafia-player-ss', app.user && app.user.isMafiaPlayerSS);
	data('mafia-club-ded', app.user && app.user.isMafiaClubDed);
	data('mafia-club-ded-ss', app.user && app.user.isMafiaClubDedSS);
	data('impossible-mission-a', app.user && app.user.isImpossibleMissionA);
	data('impossible-mission-b', app.user && app.user.isImpossibleMissionB);

	var now = new Date();
	$html.attr('data-current-year', now.getFullYear());
	$html.attr('data-current-month', now.getMonth() + 1);
	$html.attr('data-current-day-of-week', now.getDay());
	$html.attr('data-current-day-of-month', now.getDate());

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

$(function() {
	new MutationObserver(function(records) {
		records.forEach(function(record) {
			record.addedNodes.forEach(function(node) {
				if (node.classList && [].some.call(node.classList, function(c) {
					return /^emoji-/.test(c);
				})) {
					node.classList.add('emoji');
				}
			});
		});
	}).observe(document.body, {childList: true, subtree: true});
});
