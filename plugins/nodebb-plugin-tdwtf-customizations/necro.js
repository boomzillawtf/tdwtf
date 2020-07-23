/*eslint-env browser, jquery*/

function addNecroPostMessage() {
	var necroThreshold = 7 * 24 * 60 * 60 * 1000; // a week
	var gdThreshold = 1000 * 60 * 60 * 24 * 365 * 10; // 10 years
	var gdText = 'goddamnit fbmac';

	function addNecro(poost, dateDiff) {
		// change suffix to "later", otherwise it would look wrong
		// also, English is the only language
		var dataAgo = $.timeago.settings.strings.suffixAgo;
		$.timeago.settings.strings.suffixAgo = ' later';
		var agoText = dateDiff >= gdThreshold ? gdText : $.timeago.inWords(dateDiff);
		$.timeago.settings.strings.suffixAgo = dataAgo;

		$('<aside>').addClass('necro-post').text(agoText).append($('<hr>')).prependTo(poost);
	}

	function isArticle(poost) {
		return poost.is('[data-index="0"]') && !poost.find('.content>:not([class*="iframely"])').length;
	}

	$('[component="post"]').each(function() {
		var post = $(this);
		if (post.is(':has(.necro-post)')) {
			return;
		}

		var postDate = post.attr('data-timestamp');
		var prevDate = postDate; // if it doesn't get overridden, eventually nothing happens

		var prev = post.prev('[component="post"]');

		if (isArticle(post)) {
			prevDate = new Date(post.find('[data-date]').attr('data-date'));
		} else if (prev.length) {
			prevDate = prev.attr('data-timestamp');
		}

		var diff = postDate - prevDate;

		if (diff >= necroThreshold) {
			addNecro(post, diff);
		}
	});
}
$(window).on('action:ajaxify.contentLoaded', addNecroPostMessage);
$(window).on('action:posts.loaded', addNecroPostMessage);
