/*eslint-env node*/

var async = require.main.require('async');
var jsesc = require.main.require('jsesc');
var nconf = require.main.require('nconf');
var request = require.main.require('request');
var winston = require.main.require('winston');
var db = require.main.require('./src/database');
var Categories = require.main.require('./src/categories');
var Groups = require.main.require('./src/groups');
var plugins = require.main.require('./src/plugins');
var translator = require.main.require('./src/translator');
var SocketPosts = require.main.require('./src/socket.io/posts');
var SocketPlugins = require.main.require('./src/socket.io/plugins');
var Topics = require.main.require('./src/topics');
var User = require.main.require('./src/user');
var privileges = require.main.require('./src/privileges');
var meta = require.main.require('./src/meta');
var utils = require.main.require('./public/src/utils');
var crypto = require('crypto');
var winston = require('winston');
var importRedirects = require('./import.js');

// Modifications documented inline:
var downvoteUid = 14;
SocketPosts.getVoters = async function (socket, data) {
	if (!data || !data.pid || !data.cid) {
		throw new Error('[[error:invalid-data]]');
	}
	const showDownvotes = !meta.config['downvote:disabled'];
	// TDWTF: split into variable
	const isAdminOrMod = await privileges.categories.isAdminOrMod(data.cid, socket.uid);
	const canSeeVotes = meta.config.votesArePublic || isAdminOrMod;
	if (!canSeeVotes) {
		throw new Error('[[error:no-privileges]]');
	}
	var [upvoteUids, downvoteUids] = await Promise.all([
		db.getSetMembers('pid:' + data.pid + ':upvote'),
		showDownvotes ? db.getSetMembers('pid:' + data.pid + ':downvote') : [],
	]);

	// TDWTF: Added:
	winston.info(`downvoteUid: ${JSON.stringify(downvoteUid)}`)
	if (!isAdminOrMod && downvoteUid > 0) {
		downvoteUids = Array(downvoteUids.length).fill(downvoteUid || 14);
	}
	// End Added

	const [upvoters, downvoters] = await Promise.all([
		User.getUsersFields(upvoteUids, ['username', 'userslug', 'picture']),
		User.getUsersFields(downvoteUids, ['username', 'userslug', 'picture']),
	]);

	return {
		upvoteCount: upvoters.length,
		downvoteCount: downvoters.length,
		showDownvotes: showDownvotes,
		upvoters: upvoters,
		downvoters: downvoters,
	};
};

// Drop built-in sanitization in favor of nodebb-plugin-htmlcleaner.
Posts.sanitize = function (content) {
	return content;
};


SocketPlugins.tdwtf = {};
SocketPlugins.tdwtf.getPopcornBookmark = function(socket, data) {
	var tid = parseInt(data, 10);

	function done(err, isMember) {
		if (err || !isMember) {
			// hide real error
			return Promise.reject(new Error('[[invalid-data]]'));
		}

		return Topics.getUserBookmark(tid, socket.uid);
	}

	// Discussion of NodeBB Updates is always allowed for popcorning.
	if (tid === 19758) {
		return done(null, true);
	}

	// The officious song of the day comment thread!
	if (tid === 13309) {
		return done(null, true);
	}

	// The Impossible Mission is always allowed for popcorning.
	if (tid === 20856) {
		return done(null, true);
	}

	Topics.getTopicField(tid, 'cid', function(err, cid) {
		if (err) {
			return done(err);
		}

		// Club Ded
		if (cid === 32) {
			return Groups.isMember(socket.uid, 'Mafia - Club Ded', done);
		}
		// Club Ded (Self-Serve)
		if (cid === 47) {
			return Groups.isMember(socket.uid, 'Self-Serve Mafia - Club Ded', done);
		}
		// Staff
		if (cid === 4) {
			return User.isAdminOrGlobalMod(socket.uid, done);
		}

		done(null, false);
	});
};

var upstreamIP = require('os').networkInterfaces().eth0.find(function(addr) {
	return addr.family === 'IPv4';
}).address;

db.sortedSetAdd('tdwtf-upstreams:started', Date.now(), upstreamIP + ':' + nconf.get('port'));

var upstreamPorts = require.main.require('./config.json').port;

var upstreamIPs = upstreamPorts.map(function(port) {
	return upstreamIP.replace(/\.254$/, '.253') + ':' + port;
}).concat(upstreamPorts.map(function(port) {
	return upstreamIP.replace(/\.253$/, '.254') + ':' + port;
}));

function findUpstreams(clientIP) {
	var octetString = clientIP.split(/\./g);
	var octets = [parseInt(octetString[0], 10), parseInt(octetString[1], 10), parseInt(octetString[2], 10)];

	var hits = [];

	var hash = 89;
	for (var tries = 0; tries < 20; tries++) {
		for (var i = 0; i < octets.length; i++) {
			hash = (hash * 113 + octets[i]) % 6271;
		}

		var hit = upstreamIPs[hash % upstreamIPs.length];
		if (hit.split(/:/)[0] === upstreamIP && hits.indexOf(hit) === -1) {
			hits.push(hit);
		}
	}
	return hits;
}

function prepareAdminPage(uid, next) {
	var now = Date.now();

	var data = {title: 'The Daily WTF', entries: [], downvoteUid: downvoteUid };

	db.getSortedSetRevRangeWithScores('tdwtf-upstreams:started', 0, upstreamPorts.length - 1, function(err, upstreamsStarted) {
		if (err) {
			return next(err);
		}

		var recentRestarts = upstreamsStarted.filter(function(upstream) {
			return upstream.score > upstreamsStarted[0].score - 60 * 1000;
		}).map(function(upstream) {
			return upstream.value;
		});

		data.recent = recentRestarts;

		db.client.query({
			name: 'query_wtdwtf_real_ip',
			text: `
SELECT HOST(r."ip") "ip"
  FROM "legacy_object_live" o
 INNER JOIN "legacy_zset" z
         ON o."_key" = z."_key"
        AND o."type" = z."type"
 INNER JOIN "wtdwtf_real_ip" r
         ON DECODE(z."value", 'hex') = r."hash"
 WHERE o."_key" = 'ip:recent'
   AND z."score" >= $1::NUMERIC
 ORDER BY z."score" DESC
`,
			values: [now - 60 * 60 * 1000]
		}, function(err, res) {
			if (err) {
				return next(err);
			}

			var recentIPs = res.rows.map(function (r) {
				return r.ip;
			});

			async.eachLimit(recentIPs, 10, function(ip, next) {
				var upstreams = findUpstreams(ip);

				if (recentRestarts.indexOf(upstreams[0]) === -1) {
					return next();
				}

				async.waterfall([
					function(next) {
						db.getSortedSetRange('ip:' + ip + ':uid', 0, -1, next);
					},
					function(uids, next) {
						User.getUsers(uids, uid, next);
					},
					function(users, next) {
						var count = upstreams.findIndex(function(upstream) {
							return recentRestarts.indexOf(upstream) === -1;
						});
						if (count === -1) {
							count = upstreams.length;
						}

						if (users.length === 0) {
							data.entries.push({count: count, guest: ip});
						} else {
							users.forEach(function(user) {
								data.entries.push({count: count, user: user});
							});
						}

						next();
					}
				], next);
			}, function(err) {
				if (err) {
					return next(err);
				}

				data.entries = data.entries.sort(function(a, b) {
					if (b.count !== a.count) {
						return b.count - a.count;
					}
					if (a.user && b.user) {
						return a.user.uid - b.user.uid;
					}
					if (a.user || b.user) {
						return a.user ? -1 : 1;
					}
					var aip = a.guest.split(/\./g);
					var bip = b.guest.split(/\./g);
					for (var i = 0; i < 4; i++) {
						if (aip[i] !== bip[i]) {
							return aip[i] - bip[i];
						}
					}
					return 0;
				});

				next(null, data);
			});
		});
	});
}

function renderAdminPage(req, res, next) {
	prepareAdminPage(req.uid, function(err, data) {
		if (err) {
			return next(err);
		}

		res.render('admin/plugins/tdwtf', data);
	});
}

setTimeout(function() {
	var uid = 1567;
	var tid = 21402;

	async.waterfall([
		function(next) {
			db.getSortedSetRevRangeWithScores('tdwtf-upstreams:started', 0, upstreamPorts.length - 1, next);
		},
		function(recentlyStarted, next) {
			if (recentlyStarted[0].value !== upstreamIP + ':' + nconf.get('port')) {
				// not last started instance
				return;
			}
			if (recentlyStarted.every(function(instance) {
				return instance.score >= recentlyStarted[0].score - 60 * 1000;
			})) {
				// all instances restarted, not useful
				return;
			}
			next();
		},
		function(next) {
			prepareAdminPage(uid, next);
		},
		function(data, next) {
			var content = ['# Instance restart\n\n<details>\n\n## Affected instances\n\n'];
			data.recent.forEach(function(recent) {
				content.push('- ', recent, '\n');
			});
			content.push('\n## Users connected to affected instances in the past hour\n\n');
			data.entries.forEach(function(entry) {
				content.push('- ', entry.count, ' ');
				if (entry.user) {
					content.push('@', entry.user.userslug);
				} else {
					content.push('guest: ', entry.guest);
				}
				content.push('\n');
			});
			content.push('\n*This was an automated post by nodebb-plugin-tdwtf-customizations*\n\n</details>');
			next(null, content.join(''));
		},
		function(content, next) {
			Topics.reply({
				uid: uid,
				tid: tid,
				content: content,
				timestamp: Date.now(),
				ip: null
			}, next);
		}
	], function(err) {
		if (err) {
			winston.warn('posting restart notice: ' + err.stack);
		}
	});
}, 60 * 1000);

function renderIPPage(req, res) {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.json({client_ip: req.ip, upstream_ip: upstreamIP, upstream_port: nconf.get('port')});
}

function encryptFrontPageData(data) {
	data = Buffer.from(data, 'utf8');

	var verify = crypto.createHmac('sha256', Buffer.from(nconf.get('tdwtf_front_v'), 'base64'));
	verify.update(data);
	var encrypted = [verify.digest()];

	var iv = crypto.randomBytes(16);
	encrypted.push(iv);

	var cipher = crypto.createCipheriv('aes256', Buffer.from(nconf.get('tdwtf_front_d'), 'base64'), iv);
	encrypted.push(cipher.update(data));
	encrypted.push(cipher.final());

	return Buffer.concat(encrypted).toString('base64');
}

function decryptFrontPageData(data) {
	data = Buffer.from(data, 'base64');

	var decipher = crypto.createDecipheriv('aes256', Buffer.from(nconf.get('tdwtf_front_e'), 'base64'), data.slice(32, 48));
	var decrypted = decipher.update(data.slice(48));
	decrypted = Buffer.concat([decrypted, decipher.final()]);

	var verify = crypto.createHmac('sha256', Buffer.from(nconf.get('tdwtf_front_s'), 'base64'));
	verify.update(decrypted);
	var hash = verify.digest();

	if (!crypto.timingSafeEqual(data.slice(0, 32), hash)) {
		throw new Error('invalid data');
	}

	return decrypted.toString('utf8');
}

function renderFrontPageAuth(req, res) {
	var target = 'https://thedailywtf.com/login/nodebb';
	var state;

	try {
		if (req.query.target) {
			target = decryptFrontPageData(req.query.target);
		}

		if (!req.query.state) {
			res.redirect(302, target);
			return;
		}

		state = decryptFrontPageData(req.query.state);
	} catch (ex) {
		winston.warn('[tdwtf-front-page-auth] ' + ex.toString());
		res.status(400).json('bad-request');
		return;
	}

	User.getUserFields(req.uid, ['username', 'userslug'], function(err, u) {
		if (err) {
			return res.status(500).json(err.message);
		}

		User.isAdminOrGlobalMod(req.uid, function(err, isMod) {
			if (err) {
				return res.status(500).json(err.message);
			}

			target += target.indexOf('?') === -1 ? '?' : '&';
			target += 'token=' + encodeURIComponent(encryptFrontPageData(JSON.stringify({n: u.username, s: u.userslug, m: isMod, t: state})));
			res.redirect(302, target);
		});
	});
}

module.exports = {
	'init': function(params, callback) {
		params.router.get('/admin/plugins/tdwtf', params.middleware.admin.buildHeader, renderAdminPage);
		params.router.get('/api/admin/plugins/tdwtf', renderAdminPage);
		params.router.get('/api/tdwtf-ip', renderIPPage);
		params.router.get('/api/tdwtf-front-page-auth', params.middleware.ensureLoggedIn, renderFrontPageAuth);
		db.getObjectFields('settings:tdwtf', ['downvoteUid'], function(err, uid){
			if( err ){
				return callback(err);
			}
			if( uid.downvoteUid ) downvoteUid = uid.downvoteUid || 14;
		})
		db.client.query(`
CREATE TABLE IF NOT EXISTS "wtdwtf_real_ip" (
	"ip" INET NOT NULL UNIQUE,
	"hash" BYTEA NOT NULL PRIMARY KEY CHECK(OCTET_LENGTH("hash") = 20)
);`, function(err) {
			if (err) {
				return callback(err);
			}

			importRedirects.load(params, callback);
		});
	},
	'meta': function(data, callback) {
		data.tags.push({
			name: 'google-site-verification',
			content: 'CHVbCxly52Dog4tN9fsbqoQkNTASojg2LzYSeJzqRgw'
		}, {
			name: 'msvalidate.01',
			content: '8B5F1BB25DCAA2F72ED1C203180B0774'
		});

		callback(null, data);
	},
	'adminHeader': function(header, callback) {
		header.plugins.push({
			route: '/plugins/tdwtf',
			name: 'TDWTF'
		});

		callback(null, header);
	},
	'header': function(data, callback) {
		async.parallel({
			groups: async.apply(Groups.isMemberOfGroups, data.templateValues.user.uid, ['Mafia - Players', 'Mafia - Club Ded', 'Self-Serve Mafia - Players', 'Self-Serve Mafia - Club Ded', 'Impossible Mission - A', 'Impossible Mission - B']),
			clubDed: async.apply(Categories.getTopicIds, {cid: 32, start: 0, stop: 0}),
			clubDedSS: async.apply(Categories.getTopicIds, {cid: 47, start: 0, stop: 0}),
			settings: async.apply(db.getObjectFields, 'user:' + data.templateValues.user.uid + ':settings', ['tdwtfDisableMobileSlide'])
		}, function(err, results) {
			if (err) {
				return callback(err, data);
			}

			data.templateValues.user.isMafiaPlayer = results.groups[0];
			data.templateValues.user.isMafiaClubDed = results.groups[1] && results.clubDed[0];
			data.templateValues.user.isMafiaPlayerSS = results.groups[2];
			data.templateValues.user.isMafiaClubDedSS = results.groups[3] && results.clubDedSS[0];
			data.templateValues.user.isImpossibleMissionA = results.groups[4];
			data.templateValues.user.isImpossibleMissionB = results.groups[5];
			data.templateValues.user.disableMobileSlide = Boolean(results.settings && parseInt(results.settings.tdwtfDisableMobileSlide, 10));
			data.templateValues.userJSON = jsesc(JSON.stringify(data.templateValues.user), { isScriptContext: true });
			callback(null, data);
		});
	},
	'notificationPush': function(data, callback) {
		if (!data.notification.tid) {
			return callback(null, data);
		}

		Topics.getTopicField(data.notification.tid, 'cid', function(err, cid) {
			if (err) {
				return callback(err, data);
			}

			data.notification.cid = cid;

			callback(null, data);
		});
	},
	'addNotificationCategory': function(data, callback) {
		var pids = [];
		var tids = [];
		data.notifications.forEach(function(n) {
			if (n.cid) {
				return;
			}
			if (n.tid) {
				tids.push(n.tid);
				return;
			}
			if (n.pid) {
				pids.push(n.pid);
				return;
			}
		});

		async.parallel({
			pcid: async.apply(Posts.getCidsByPids, pids),
			tcid: async.apply(Topics.getTopicsFields, tids, ['cid'])
		}, function(err, mapping) {
			if (err) {
				return callback(err);
			}

			data.notifications.forEach(function(n) {
				if (n.cid) {
					n.bodyShort += '<i class="notification-cid" data-ncid="' + n.cid + '"></i>';
					return;
				}
				if (n.tid) {
					n.bodyShort += '<i class="notification-cid" data-ncid="' + (mapping.tcid[tids.indexOf(n.tid)] || {}).cid + '"></i>';
					return;
				}
				if (n.pid) {
					n.bodyShort += '<i class="notification-cid" data-ncid="' + mapping.pcid[pids.indexOf(n.pid)] + '"></i>';
					return;
				}
			});
			callback(null, data);
		});
	},
	'postReplyCount': function(data, callback) {
		var pids = data.posts.map(function(post) {
			post.replies = {
				count: 0,
				users: [],
				hasMore: false,
				timestamp: 0
			};
			return post.pid;
		}).filter(function(pid, index, array) {
			return array.indexOf(pid) === index;
		});

		var replyPids;
		var replyIndices = {};
		var cidReplyIndices = {};

		async.waterfall([
			function(next) {
				db.getSortedSetsMembers(pids.map(function(pid) {
					return 'pid:' + pid + ':replies';
				}), next);
			},
			function(_replyPids, next) {
				replyPids = [].concat.apply([], _replyPids);
				_replyPids.forEach(function(replies, index) {
					replies.forEach(function(reply) {
						replyIndices[reply] = data.posts.findIndex(function(post) {
							return post.pid === pids[index];
						});
					});
				});

				async.parallel({
					cids: async.apply(Posts.getCidsByPids, replyPids),
					uids: async.apply(Posts.getPostsFields, replyPids, ['uid', 'timestamp'])
				}, next);
			},
			function(replyData, next) {
				replyData.cids.forEach(function(cid, index) {
					if (!cidReplyIndices[cid]) {
						cidReplyIndices[cid] = [];
					}
					cidReplyIndices[cid].push({
						idx: replyIndices[replyPids[index]],
						uid: replyData.uids[index].uid,
						ts: replyData.uids[index].timestamp
					});
				});

				var filteredCids = replyData.cids.filter(function(cid, index, array) {
					return array.indexOf(cid) === index;
				});

				privileges.categories.filterCids('read', filteredCids, data.uid, next);
			},
			function(allowedCids, next) {
				allowedCids.forEach(function(cid) {
					cidReplyIndices[cid].forEach(function(reply) {
						data.posts[reply.idx].replies.count++;
						if (data.posts[reply.idx].replies.users.indexOf(reply.uid) === -1 && data.posts[reply.idx].replies.users.length < 6) {
							data.posts[reply.idx].replies.users.push(reply.uid);
						}
						data.posts[reply.idx].replies.timestamp = Math.max(data.posts[reply.idx].replies.timestamp, reply.ts);
					});
				});
				async.forEach(data.posts, function(post, next) {
					if (post.replies.users.length > 5) {
						post.replies.users.pop();
						post.replies.hasMore = true;
					}
					post.replies.text = post.replies.count > 1 ? '[[topic:replies_to_this_post, ' + post.replies.count + ']]' : '[[topic:one_reply_to_this_post]]';
					post.replies.timestampISO = utils.toISOString(post.replies.timestamp);
					delete post.replies.timestamp;

					User.getUsersWithFields(post.replies.users, ['uid', 'username', 'userslug', 'picture'], data.uid, function(err, users) {
						post.replies.users = users;
						next(err);
					});
				}, function(err) {
					next(err, data);
				});
			}
		], callback);
	},
	'registerCheck': function(data, callback) {
		if (data.queue) {
			return callback(null, data);
		}

		var ip = data.req.ip.replace('::ffff:', '');

		request({
			method: 'get',
			url: 'https://api.stopforumspam.org/api' +
				'?ip=' + encodeURIComponent(ip) +
				'&email=' + encodeURIComponent(data.userData.email) +
				'&username=' + encodeURIComponent(data.userData.username) +
				'&f=json',
			json: true
		}, function (err, response, body) {
			if (err) {
				data.queue = true;
				return callback(null, data);
			}
			if (response.statusCode === 200 && body) {
				var usernameSpam = body.username ? body.username.frequency > 0 || body.username.appears > 0 : true;
				var emailSpam = body.email ? body.email.frequency > 0 || body.email.appears > 0 : true;
				var ipSpam = body.ip ? body.ip.frequency > 0 || body.ip.appears > 0 : true;

				if (usernameSpam || emailSpam || ipSpam) {
					data.queue = true;
				}
			} else {
				data.queue = true;
			}

			callback(null, data);
		});
	},
	'disableFuzzy': function(parser) {
		parser.linkify.set({
			'fuzzyLink': false,
			'fuzzyIP': false,
			'fuzzyEmail': false
		});
	},
	'defineEmoji': function(data, callback) {
		data.packs.push({
			name: 'The Daily WTF Custom Emoji',
			id: 'tdwtf-emoji',
			attribution: 'Pull requests accepted: https://github.com/boomzillawtf/tdwtf/tree/master/emoji/tdwtf',
			path: '/usr/src/app/tdwtf-emoji',
			mode: 'images',
			images: {
				directory: '/usr/src/app/tdwtf-emoji'
			},
			dictionary: require('/usr/src/app/tdwtf-emoji/dictionary.json')
		}, require('/usr/src/app/tdwtf-emoji/fontawesome.json'));
		callback(null, data);
	},
	'addCustomSettings': function(data, callback) {
		db.getObjectFields('user:' + data.uid + ':settings', ['tdwtfDisableMobileSlide'], function(err, settings) {
			if (err) {
				return callback(err);
			}

			data.customSettings.push({
				'title': 'TDWTF',
				'content': '<div class="checkbox"><label><input type="checkbox" data-property="tdwtfDisableMobileSlide"' + (settings && parseInt(settings.tdwtfDisableMobileSlide, 10) ? ' checked' : '') + '> <strong>Disable side-sliding on mobile.</strong></label></div><p class="help-block">Requires a refresh to take effect.</p>'
			});

			callback(null, data);
		});
	},
	'saveUserSettings': function(data) {
		db.setObjectField('user:' + data.uid + ':settings', 'tdwtfDisableMobileSlide', data.settings.tdwtfDisableMobileSlide ? 1 : 0);
	},
	'getUserSettings': function(data, callback) {
		data.settings.tdwtfDisableMobileSlide = parseInt(data.settings.tdwtfDisableMobileSlide || '0', 10);
		callback(null, data);
	},
	'storeRealIP': function(data) {
		var reallyDumbObfuscationMethod = crypto.createHash('sha1').update(data.req.ip + nconf.get('secret')).digest();
		db.client.query({
			name: 'insert_wtdwtf_real_ip',
			text: 'INSERT INTO "wtdwtf_real_ip" ("ip", "hash") VALUES ($1::TEXT::INET, $2::BYTEA) ON CONFLICT DO NOTHING',
			values: [data.req.ip, reallyDumbObfuscationMethod]
		}, function() {});
	}
};
