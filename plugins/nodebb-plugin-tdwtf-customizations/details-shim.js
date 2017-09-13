/* jshint browser: true, -W071, -W083 */

// https://what.thedailywtf.com/post/1014136

if (!Element.prototype.matches && Element.prototype.mozMatchesSelector) {
	Element.prototype.matches = Element.prototype.mozMatchesSelector;
}

window.addEventListener('DOMContentLoaded', function() {
	var isDetailsSupported = (function() {
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
				var d, s;
				while ((d = document.querySelector('details')) !== null) {
					var open = d.hasAttribute('open') || d.getAttribute('data-open') === 'open';
					var label = document.createElement('label');
					label.classList.add('details');
					label.addEventListener('click', function(e) {
						if (!e.target.matches('.details > input:first-child, .details > .summary')) {
							var i = e.target;
							while (i && !i.classList.contains('details')) {
								i = i.parentNode;
							}
							i = i.querySelector('input:first-child');
							i.setAttribute('disabled', 'true');
							setTimeout(function() { i.removeAttribute('disabled'); }, 10);
							e.stopPropagation();
						}
					});

					var i = document.createElement('input');
					i.setAttribute('type', 'checkbox');
					if (open) {
						i.setAttribute('checked', '');
					}
					label.appendChild(i);

					[].slice.call(d.children).
						filter(function(e) { return e.matches('summary'); }).
						forEach(function(e) { label.appendChild(e); });
					if (!label.querySelector('summary')) {
						var summary = document.createElement('summary');
						summary.appendChild(document.createTextNode('Details'));
						label.appendChild(summary);
					}

					s = document.createElement('div');
					label.appendChild(s);
					while (d.firstChild) { s.appendChild(d.firstChild); }

					d.parentElement.insertBefore(label, d);
					d.parentElement.removeChild(d);

					label.parentElement.normalize();
				}

				while ((s = document.querySelector('.details > summary')) !== null) {
					var span = document.createElement('span');
					span.classList.add('summary');
					span.innerHTML = s.innerHTML;

					s.parentElement.insertBefore(span, s);
					s.parentElement.removeChild(s);
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
