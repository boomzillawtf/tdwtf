/* jshint browser: true */
/* globals $, ajaxify, socket */

// https://what.thedailywtf.com/post/1044675

// add "view raw" and "reply as topic" options to posts
function processPosts() {
	// this function actually creates the element and requests the raw content to display
	function addRaw(pid, post, vis) {
		var raw = document.createElement('div');
		raw.setAttribute('class', 'content raw-content loading hidden');
		post.parentElement.insertBefore(raw, post);

		socket.emit('posts.getRawPost', pid, function (err, rawContent) {
			raw.classList.remove('loading');
			if (err) {
				// console.error(err);
				raw.parentElement.removeChild(raw);
			} else {
				$(raw).text(rawContent);
				if (vis) {
					raw.classList.remove('hidden');
					post.classList.add('hidden');
				}

				// this mutation observer will watch the post for deletion / edits
				var o = new MutationObserver(function () {
					var li = post.parentElement, raw = li.querySelector(".raw-content");
					if (li.classList.contains("deleted")) {
						o.disconnect();
					} else if (!raw || raw.classList.contains("hidden")) {
						if (li.contains(raw)) {
							li.removeChild(raw);
						}
						o.disconnect();
					} else {
						// post was edited, update raw content
						socket.emit('posts.getRawPost', pid, function (err, rawContent) {
							if (err) {
								o.disconnect();
								// console.error(err);
							} else {
								$(raw).text(rawContent);
							}
						});
					}
				});
				o.observe(post, {childList: true, characterData: true, subtree: true});
			}
		});
	}

	// if the raw exists, this just toggles between it and the baked post
	// otherwise, it'll call addRaw to do the heavy lifting
	function showRaw(event) {
		var e = event.target;
		while (e.getAttribute("component") !== "post") {
			e = e.parentElement;
		}
		var post = e.querySelector(".content:not(.raw-content)");
		var raw = e.querySelector(".content.raw-content");
		var pid = e.getAttribute("data-pid");

		if (raw) {
			if (!raw.classList.contains('loading')) {
				if (post.classList.contains("hidden")) {
					raw.classList.add("hidden");
					post.classList.remove("hidden");
					$(event.target).text('Show raw');
				} else {
					post.classList.add("hidden");
					raw.classList.remove("hidden");
					$(event.target).text('Hide raw');
				}
			}
		} else {
			addRaw(pid, post, true);
			$(event.target).text('Hide raw');
		}
		
		// this scrolls the page only if necessary to keep the "view raw" button within the viewport
		var t = document.getElementById("header-menu").getBoundingClientRect().bottom;
		var b = window.innerHeight;
		var r = event.target.getBoundingClientRect();
		if (r.top < t) {
			window.scrollBy(0, r.top - t);
		} else if (r.bottom > b) {
			window.scrollBy(0, r.bottom - b);
		}
	}
	
	// this relies on the addRaw function from above, and it quotes the entire post, regardless of any selected text
	// by default, the new topic will be titled "Re: (original title)" and in the same category as the original
	function replyAsTopic(event) {
		var e = $(event.target).closest('li[component="post"]').get(0);
		var pid = e.getAttribute('data-pid');

		// start a new topic composer, with the same category as the quoted post's topic selected by default
		window.app.newTopic(window.ajaxify.data.cid);
		
		// this watches the post so it'll fire when addRaw has finished
		var o = new MutationObserver(function () {
			var raw = e.querySelector('.raw-content');
			if (raw) {
				o.disconnect();
				
				// I can't add a quote to the composer until after it's finished loading
				// as far as I know, there's no event or callback when the composer finishes loading
				// a mutation observer would need to watch the whole page, so I'm just going to use an interval
				var i = setInterval(function () {
					try {
						var t = document.querySelector('.composer input.title');
						if (t) {
							clearInterval(i);
							
							// set the title of the new topic
							t.value = "Re: " + window.ajaxify.data.title;
							
							// grab the raw post out of the element that addRaw created
							var r = e.querySelector('.raw-content'), h = r.classList.contains('hidden');
							r.classList.remove('hidden');
							var raw = $(r).text();
							r.classList.toggle('hidden', h);

							// add the quote to the composer
							$(window).trigger('action:composer.addQuote', {
								tid: ajaxify.data.tid,
								slug: ajaxify.data.slug,
								index: e.getAttribute('data-index'),
								pid: e.getAttribute('data-pid'),
								topicName: ajaxify.data.titleRaw,
								username: '@' + e.getAttribute('data-username'),
								text: raw
							});
							setTimeout(function () {
								document.querySelector('.composer textarea.write').focus();
							}, 100);
						}
					} catch (e) {
						// console.error(e);
						clearInterval(i);
					}
				}, 100);
			}
		});
		o.observe(e, {childList: true, subtree: true});
		
		// if the raw element doesn't exist, call addRaw to add it; otherwise, just force the observer to fire
		if (!e.querySelector('.raw-content')) {
			addRaw(pid, e.querySelector('.content'));
		} else {
			e.appendChild(e.lastChild);
		}
	}
	
	$('.post-footer .dropdown.open').each(function() {
		var e = $(this);
		// if there's a "Bookmark" option, this adds it right before that; otherwise, at the very top
		var favOption = e.find('[component="post/bookmark"]').closest('li');
		if (!favOption.length) {
			favOption = e.find('.dropdown-menu > li:first-of-type');
		}
		// add the "view raw" button
		if (!e.is(":has(.view-raw)")) {
			$('<li>').attr('role', 'presentation').append($('<a>').text('View raw').attr({
				role: 'menuitem',
				href: '#',
				'class': 'view-raw'
			}).on('click', showRaw)).insertBefore(favOption);
		}

		// add the "reply as topic" item and a separator to the hamburger menu
		if (!e.is(":has(.reply-as-topic)")) {
			$('<li>').attr('role', 'presentation').append($('<a>').text('Reply as topic').attr({
				role: 'menuitem',
				href: '#',
				'class': 'reply-as-topic'
			}).on('click', replyAsTopic)).insertBefore(favOption);

			$('<li>').attr({
				role: 'presentation',
				'class': 'divider',
			}).insertBefore(favOption);
		}
	});
}

$(function() {
	new MutationObserver(processPosts).observe(document.body, {childList: true, subtree: true});
	processPosts();
});
