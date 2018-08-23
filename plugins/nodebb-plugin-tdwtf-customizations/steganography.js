/*eslint-env browser, jquery*/
/*global app ajaxify*/

(function() {
	var steganographyCache = {};

	var bitsPerColor = 2;

	function makeSteganographyBits(payload) {
		if (payload.length % (bitsPerColor * 3) !== 0) {
			throw 'invalid payload length';
		}

		var accumulator = [];
		var bits = [];
		for (var i = 0; i < payload.length; i++) {
			var code = payload.charCodeAt(i);
			if (code > 0x7f) {
				throw 'payload must be ASCII';
			}
			for (var j = 0; j < 7; j++) {
				accumulator.push((code >> j) & 1);
				if (accumulator.length === bitsPerColor) {
					bits.push(accumulator.reduce(function(a, b) {
						return (a << 1) | b;
					}));
					accumulator = [];
				}
			}
		}
		return bits;
	}

	function createSteganography(payload, r, g, b) {
		var baseColor = [r & (~3), g & (~3), b & (~3)];
		var key = baseColor.join('/') + '/' + payload;
		if (key in steganographyCache) {
			return steganographyCache[key];
		}

		var bits = makeSteganographyBits(payload);

		var canvas = document.createElement('canvas');
		canvas.width = canvas.height = bits.length / 3;
		var ctx = canvas.getContext('2d');
		var data = ctx.createImageData(canvas.width, canvas.height);
		var i = 0;
		for (var y = 0; y < canvas.height; y++) {
			for (var x = 0; x < canvas.width; x++) {
				var bitIndex = ((x - y + canvas.width) % canvas.width) * 3;
				data.data[i++] = baseColor[0] | bits[bitIndex + 0];
				data.data[i++] = baseColor[1] | bits[bitIndex + 1];
				data.data[i++] = baseColor[2] | bits[bitIndex + 2];
				data.data[i++] = 255;
			}
		}
		ctx.putImageData(data, 0, 0);
		steganographyCache[key] = 'url("' + canvas.toDataURL('image/png') + '")';
		return steganographyCache[key];
	}

	var checkedImageSources = {};

	var payloads = [
		{payload: 'MafiA!', description: 'a private mafia category', protect: [32, 33, 34, 35, 38, 40, 41, 46, 47], except: [32]},
		{payload: 'Lounge', description: 'the lounge', protect: [16, 53], except: [4, 16, 53]},
		{payload: 'StafF?', description: 'the staff forum', protect: [4], except: [4]}
	];

	var payloadByCid = {};
	payloads.forEach(function(payload) {
		payload.protect.forEach(function(cid) {
			payloadByCid[cid] = payload;
		});
	});

	/* jshint -W073 */
	function checkUploadedImage(image, cid) {
		if (image.src in checkedImageSources) {
			return;
		}

		if (!image.complete) {
			image.addEventListener('load', function() {
				checkUploadedImage(image, cid);
			}, false);
			return;
		}

		checkedImageSources[image.src] = true;

		var data;
		try {
			var canvas = document.createElement('canvas');
			canvas.width = image.width;
			canvas.height = image.height;
			var ctx = canvas.getContext('2d');
			ctx.drawImage(image, 0, 0);
			data = ctx.getImageData(0, 0, image.width, image.height);
		} catch (ex) {
			if (window.console && window.console.log) {
				window.console.log('could not test image: ' + image.src, ex);
			}
			return;
		}

		payloads.forEach(function(payload) {
			if (payload.except.indexOf(cid) !== -1) {
				return;
			}
			var bits = makeSteganographyBits(payload.payload);
			for (var y = 0; y < image.height; y++) {
				for (var x = 0; x <= image.width - bits.length / 3; x++) {
					var i = (y * image.width + x) * 4;
					var r = data.data[i + 0] & ((1 << bitsPerColor) - 1);
					var g = data.data[i + 1] & ((1 << bitsPerColor) - 1);
					var b = data.data[i + 2] & ((1 << bitsPerColor) - 1);
					if (r === bits[0] && g === bits[1] && b === bits[2]) {
						var wrong = false; // sad
						for (var j = 1; j < bits.length / 3; j++) {
							r = data.data[i + (j * 4) + 0] & ((1 << bitsPerColor) - 1);
							g = data.data[i + (j * 4) + 1] & ((1 << bitsPerColor) - 1);
							b = data.data[i + (j * 4) + 2] & ((1 << bitsPerColor) - 1);
							if (r !== bits[j * 3 + 0] || g !== bits[j * 3 + 1] || b !== bits[j * 3 + 2]) {
								wrong = true;
								break;
							}
						}
						if (!wrong) {
							window.alert('Um, excuse me. Did you really mean to post that screenshot of ' + payload.description + '?');
							return;
						}
					}
				}
			}
		});
	}
	/* jshint +W073 */

	$(window).on('action:composer.preview', function() {
		var cid = parseInt(ajaxify.data.cid, 10);
		$('.preview img').each(function() {
			checkUploadedImage(this, cid);
			if (this.src.indexOf('-resized.') !== -1) {
				var notResized = new Image();
				notResized.src = this.src.replace(/-resized\./, '.');
				checkUploadedImage(notResized, cid);
			}
		});
	});

	function addSteganography(payload, node) {
		function parseInt10(c) {
			return parseInt(c, 10);
		}

		var bg;
		for (var p = node; p.length; p = p.parent()) {
			bg = p.css('background-color');
			if (bg.indexOf('rgb(') === 0) {
				bg = bg.substring(0, bg.length - 1).substring('rgb('.length).split(', ').map(parseInt10);
				break;
			}
		}

		var image = createSteganography(payload.payload, bg[0], bg[1], bg[2]);
		if (node.css('background-image') === image) {
		// don't manipulate the DOM repeatedly.
			return;
		}
		node.css('background-image', image);
	}

	var notificationObserver = new MutationObserver(function() {
		$('.header [component="notifications/list"] .notification-cid').each(function() {
			var payload = payloadByCid[$(this).attr('data-ncid')];
			if (!payload) {
				return;
			}

			var n = $(this).parents('[data-nid]');
			addSteganography(payload, n);
		});
	});
	$(document).ready(function() {
		if (app.user.uid) {
			notificationObserver.observe(document.querySelector('.header [component="notifications/list"]'), {childList: true, attributes: true, characterData: true, subtree: true});
		}
	});

	$(window).on('action:topics.loaded', function() {
		$('[component="category/topic"]').each(function() {
			var payload = payloadByCid[$(this).attr('data-cid')];
			if (!payload) {
				return;
			}

			addSteganography(payload, $(this));
		});
	});
})();
