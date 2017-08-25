/* jshint browser: true */
/* globals $ */
function addNecroPostMessage() {
	var necroThreshold = 7 * 24 * 60 * 60 * 1000;
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
$(window).on('action:ajaxify.contentLoaded', addNecroPostMessage);
$(window).on('action:posts.loaded', addNecroPostMessage);
