/* jshint node: true */

var async = module.parent.require('async');
var nconf = module.parent.require('nconf');
var request = module.parent.require('request');
var winston = module.parent.require('winston');
var db = module.parent.require('./database');
var Categories = module.parent.require('./categories');
var Groups = module.parent.require('./groups');
var Posts = module.parent.require('./posts');
var SocketPlugins = module.parent.require('./socket.io/plugins');
var Topics = module.parent.require('./topics');
var User = module.parent.require('./user');
var events = module.parent.require('./events');
var privileges = module.parent.require('./privileges');

var realLoggerAdd = winston.Logger.prototype.add;
winston.Logger.prototype.add = function() {
	this.filters.push(function(level, msg) {
		// add port/pid to log output
		return '[' + nconf.get('port') + '/' + global.process.pid + '] ' + msg;
	});
	winston.Logger.prototype.add = realLoggerAdd;
};
winston.add();

var realDismissFlag = Posts.dismissFlag;
var dismissedFlags = {};
Posts.dismissFlag = function(pid, next) {
	if (pid in dismissedFlags) {
		delete dismissedFlags[pid];
		return next(null);
	}
	next(new Error("[[not-allowed]]"));
};

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

function renderAdminPage(req, res, next) {
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
						db.getSortedSetRevRangeByScore('ip:' + ip + ':uid', 0, -1, now, now - 60 * 60 * 1000, next);
					},
					function(uids, next) {
						User.getUsers(uids, req.uid, next);
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
					return b.count - a.count;
				});

				res.render('admin/plugins/tdwtf', data);
			});
		});
	});
}

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
	"meta": function(tags, callback) {
		tags = tags.concat([{
			name: 'google-site-verification',
			content: 'CHVbCxly52Dog4tN9fsbqoQkNTASojg2LzYSeJzqRgw'
		}]);

		callback(null, tags);
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
			groups: async.apply(Groups.isMemberOfGroups, data.templateValues.user.uid, ['Mafia - Players', 'Mafia - Club Ded', 'Self-Serve Mafia - Players', 'Self-Serve Mafia - Club Ded']),
			clubDed: async.apply(Categories.getTopicIds, 'cid:32:tids', false, 0, 0),
			clubDedSS: async.apply(Categories.getTopicIds, 'cid:47:tids', false, 0, 0)
		}, function(err, results) {
			if (err) {
				return callback(err, data);
			}

			data.templateValues.user.isMafiaPlayer = results.groups[0];
			data.templateValues.user.isMafiaClubDed = results.groups[1] && results.clubDed[0];
			data.templateValues.user.isMafiaPlayerSS = results.groups[2];
			data.templateValues.user.isMafiaClubDedSS = results.groups[3] && results.clubDedSS[0];
			data.templateValues.userJSON = JSON.stringify(data.templateValues.user);
			callback(null, data);
		});
	},
	"postEdit": function(data, callback) {
		if (data.uid === 140870 || data.uid === 140914 || data.uid === 140925 || data.uid === 141278) {
			return Posts.getPostField(data.post.pid, 'content', function(err, content) {
				if (err) {
					return callback(err, data);
				}

				events.log({
					type: 'fbmac',
					uid: data.uid,
					ip: data.req.ip,
					pid: data.post.pid,
					oldContent: content,
					newContent: data.post.content
				});

				callback(null, data);
			});
		}

		callback(null, data);
	},
	"postReplyCount": function(data, callback) {
		var pids = data.posts.filter(function(post) {
			return parseInt(post.replies, 10) !== 0;
		}).map(function(post) {
			post.replies = 0;
			return post.pid;
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

				Posts.getCidsByPids(replyPids, next);
			},
			function(replyCids, next) {
				replyCids.forEach(function(cid, index) {
					if (!cidReplyIndices[cid]) {
						cidReplyIndices[cid] = [];
					}
					cidReplyIndices[cid].push(replyIndices[replyPids[index]]);
				});

				var filteredCids = replyCids.filter(function(cid, index, array) {
					return array.indexOf(cid) === index;
				});

				privileges.categories.filterCids('read', filteredCids, data.uid, next);
			},
			function(allowedCids, next) {
				allowedCids.forEach(function(cid) {
					cidReplyIndices[cid].forEach(function(index) {
						data.posts[index].replies++;
					});
				});
				next(null, data);
			}
		], callback);
	},
	"postPurge": function(data, callback) {
		dismissedFlags[data.pid] = true;
		realDismissFlag(data.pid, function(err) {
			callback(err, data);
		});
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
