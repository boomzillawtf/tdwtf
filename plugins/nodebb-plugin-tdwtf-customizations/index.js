/* jshint node: true */

var async = module.parent.require('async');
var nconf = module.parent.require('nconf');
var request = module.parent.require('request');
var winston = module.parent.require('winston');
var db = module.parent.require('./database');
var Categories = module.parent.require('./categories');
var Groups = module.parent.require('./groups');
var Posts = module.parent.require('./posts');
var SocketPosts = module.parent.require('./socket.io/posts');
var SocketPlugins = module.parent.require('./socket.io/plugins');
var Topics = module.parent.require('./topics');
var User = module.parent.require('./user');
var privileges = module.parent.require('./privileges');
var meta = module.parent.require('./meta');
var utils = module.parent.require('../public/src/utils');

var realLoggerAdd = winston.Logger.prototype.add;
winston.Logger.prototype.add = function() {
	this.filters.push(function(level, msg) {
		// add port/pid to log output
		return '[' + nconf.get('port') + '/' + global.process.pid + '] ' + msg;
	});
	winston.Logger.prototype.add = realLoggerAdd;
};
winston.add();

var uploadsController = module.parent.require('./controllers/uploads');
var realUpload = uploadsController.upload;
uploadsController.upload = function(req, res, filesIterator) {
	// Ensure a category is set. We use General Discussion because it
	// allows all users to upload files.
	if (parseInt(req.body.cid, 10) === 0) {
		req.body.cid = 8;
	}

	realUpload(req, res, filesIterator);
};

// Modifications documented inline:
SocketPosts.getVoters = function (socket, data, callback) {
	if (!data || !data.pid || !data.cid) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.waterfall([
		function (next) {
			// Removed:
			//if (parseInt(meta.config.votesArePublic, 10) !== 0) {
			//	return next(null, true);
			//}
			privileges.categories.isAdminOrMod(data.cid, socket.uid, next);
		},
		function (isAdminOrMod, next) {
			// Removed:
			//if (!isAdminOrMod) {
			//	return next(new Error('[[error:no-privileges]]'));
			//}

			async.parallel({
				upvoteUids: function (next) {
					db.getSetMembers('pid:' + data.pid + ':upvote', next);
				},
				downvoteUids: function (next) {
					// Added:
					if (!isAdminOrMod && parseInt(meta.config.votesArePublic, 10) !== 1) {
						return db.setCount('pid:' + data.pid + ':downvote', function (err, count) {
							next(err, Array(count).fill(14));
						});
					}
					// End Added
					db.getSetMembers('pid:' + data.pid + ':downvote', next);
				},
			}, next);
		},
		function (results, next) {
			async.parallel({
				upvoters: function (next) {
					User.getUsersFields(results.upvoteUids, ['username', 'userslug', 'picture'], next);
				},
				upvoteCount: function (next) {
					next(null, results.upvoteUids.length);
				},
				downvoters: function (next) {
					User.getUsersFields(results.downvoteUids, ['username', 'userslug', 'picture'], next);
				},
				downvoteCount: function (next) {
					next(null, results.downvoteUids.length);
				},
			}, next);
		},
	], callback);
};

SocketPlugins.tdwtf = {};
SocketPlugins.tdwtf.getPopcornBookmark = function(socket, data, callback) {
	var tid = parseInt(data, 10);

	function done(err, isMember) {
		if (err || !isMember) {
			// hide real error
			return callback(new Error("[[invalid-data]]"));
		}

		Topics.getUserBookmark(tid, socket.uid, callback);
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

var upstreamPorts = module.parent.require('../config.json').port;

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

	var data = {title: 'The Daily WTF', entries: []};

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

		db.getSortedSetRevRangeByScore('ip:recent', 0, -1, now, now - 60 * 60 * 1000, function(err, recentIPs) {
			if (err) {
				return next(err);
			}

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

module.exports = {
	"init": function(params, callback) {
		params.router.get('/admin/plugins/tdwtf', params.middleware.admin.buildHeader, renderAdminPage);
		params.router.get('/api/admin/plugins/tdwtf', renderAdminPage);
		params.router.get('/api/tdwtf-ip', renderIPPage);

		callback();
	},
	"meta": function(data, callback) {
		data.tags.push({
			name: 'google-site-verification',
			content: 'CHVbCxly52Dog4tN9fsbqoQkNTASojg2LzYSeJzqRgw'
		}, {
			name: 'msvalidate.01',
			content: '8B5F1BB25DCAA2F72ED1C203180B0774'
		});

		callback(null, data);
	},
	"adminHeader": function(header, callback) {
		header.plugins.push({
			route: '/plugins/tdwtf',
			name: 'TDWTF'
		});

		callback(null, header);
	},
	"header": function(data, callback) {
		async.parallel({
			groups: async.apply(Groups.isMemberOfGroups, data.templateValues.user.uid, ['Mafia - Players', 'Mafia - Club Ded', 'Self-Serve Mafia - Players', 'Self-Serve Mafia - Club Ded', 'Impossible Mission - A', 'Impossible Mission - B']),
			clubDed: async.apply(Categories.getTopicIds, {cid: 32, start: 0, stop: 0}),
			clubDedSS: async.apply(Categories.getTopicIds, {cid: 47, start: 0, stop: 0})
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
			data.templateValues.userJSON = JSON.stringify(data.templateValues.user);
			callback(null, data);
		});
	},
	"notificationPush": function(data, callback) {
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
	"addNotificationCategory": function(data, callback) {
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
	"postReplyCount": function(data, callback) {
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
	"registerCheck": function(data, callback) {
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
	"disableFuzzy": function(parser) {
		parser.linkify.set({
			"fuzzyLink": false,
			"fuzzyIP": false,
			"fuzzyEmail": false
		});
	}
};
