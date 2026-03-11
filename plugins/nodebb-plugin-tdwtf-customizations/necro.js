/*eslint-env browser, jquery*/

function addNecroPostMessage() {
	var necroThreshold = ajaxify.data.necroThreshold * 24 * 60 * 60 * 1000; // a week or however long
	var gdThreshold = 1000 * 60 * 60 * 24 * 365 * 10; // almost 10 years
	var gdText = 'goddamnit fbmac'; // TODO: define a localized string for this
	var laterKey = "topic:timeago_later";
	var earlierKey = "topic:timeago_earlier";
	var necroPostUrl = 'partials/topic/necro-post';

	function cloneObject(o) {
		// @#$@#! IE doesn't support spread syntax
		var copy = {};
		for (var k in o) {
			copy[k] = o[k];
		}

		return copy;
	}

	function getTimeInWords(n){
		var ts = $.timeago.settings;

		if (!ts.origStrings) {
			ts.origStrings = ts.strings;

			// make a copy to blank out
			ts.blankStrings = cloneObject(ts.strings);

			ts.blankStrings.prefixAgo = '';
			ts.blankStrings.suffixAgo = '';
			ts.blankStrings.prefixFromNow = '';
			ts.blankStrings.suffixFromNow = '';
		}

		ts.strings = ts.blankStrings;
		var o = $.timeago.inWords(n);
		ts.strings = ts.origStrings;
		return o;
	}

	function addNecro(poost, dateDiff) {
		var words = getTimeInWords(dateDiff);

		var finalKey = dateDiff > 0? laterKey: earlierKey;

		// not using template literals for compatibility with :belt_onion: browsers
		var finalText = dateDiff >= gdThreshold? gdText: '[[' + finalKey + ', ' + words + ']]';

		app.parseAndTranslate(necroPostUrl, { text: finalText}, function(html) {
			html.insertBefore(poost);
		});
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

		if (Math.abs(diff) >= necroThreshold) {
			addNecro(post, diff);
		}
	});
}
$(window).on('action:ajaxify.contentLoaded', addNecroPostMessage);
$(window).on('action:posts.loaded', addNecroPostMessage);
