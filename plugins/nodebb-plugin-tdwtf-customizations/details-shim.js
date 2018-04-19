/* jshint browser: true, -W071, -W083 */

// https://what.thedailywtf.com/post/1335607

if (!Element.prototype.matches && Element.prototype.mozMatchesSelector) {
	Element.prototype.matches = Element.prototype.mozMatchesSelector;
}

window.addEventListener('DOMContentLoaded', function () {
	var isDetailsSupported = (function () {
		var d = document.createElement('details');
		if (!('open' in d)) {
			return false;
		}

		var p = d.appendChild(document.createElement('p'));
		p.appendChild(document.createTextNode('?'));
		document.body.appendChild(d);
		var h = p.offsetHeight;
		document.body.removeChild(d);

		return !h;
	})();

	// add a shim for <details> and <summary> if the browser doesn't support them
	if (!isDetailsSupported) {
		var r = function() {
			try {
				var d;
				while ((d = document.querySelector('details')) !== null) {
					var open = d.hasAttribute('open') || d.getAttribute('data-open') === 'open';

					var details = document.createElement('div');
					details.classList.add('tdwtf-details-shim');
					if (open) {
						details.classList.add('open');
					}

					var summary = d.querySelector('summary');
					if (!summary) {
						summary = document.createElement('summary');
						summary.appendChild(document.createTextNode('Details'));
					}
					details.appendChild(summary);
					summary.addEventListener('click', function (e) {
						e.currentTarget.parentElement.classList.toggle('open');
					});

					var contents = document.createElement('div');
					details.appendChild(contents);
					while (d.firstChild) { contents.appendChild(d.firstChild); }

					d.parentElement.insertBefore(details, d);
					d.parentElement.removeChild(d);

					details.parentElement.normalize();
				}
			} catch (e) {
				if (window.console && window.console.error) {
					window.console.error(e);
				}
			}
		};

		new MutationObserver(r).observe(document.body, {childList: true, subtree: true});
		r();
	}
}, false);
