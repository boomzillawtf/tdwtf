/* jshint node: true */

var spawn = require('child_process').spawn;
var nconf = module.parent.require('nconf');
var async = module.parent.require('async');
var request = module.parent.require('request');
var db = module.parent.require('./database');
var Categories = module.parent.require('./categories');
var Groups = module.parent.require('./groups');
var Posts = module.parent.require('./posts');
var SocketPlugins = module.parent.require('./socket.io/plugins');
var Topics = module.parent.require('./topics');
var events = module.parent.require('./events');
var privileges = module.parent.require('./privileges');

var realDismissFlag = Posts.dismissFlag;
var dismissedFlags = {};
Posts.dismissFlag = function(pid, next) {
	if (pid in dismissedFlags) {
		delete dismissedFlags[pid];
		return next(null);
	}
	next(new Error("[[not-allowed]]"));
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

module.exports = {
	"init": function(data, callback) {
		spawn('./watchdog.bash', [nconf.get('port')], {
			stdio: 'inherit'
		}).unref();
		callback();
	},
	"meta": function(tags, callback) {
		tags = tags.concat([{
			name: 'google-site-verification',
			content: 'CHVbCxly52Dog4tN9fsbqoQkNTASojg2LzYSeJzqRgw'
		}]);

		callback(null, tags);
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

		var replyIndices = {};

		async.waterfall([
			function(next) {
				db.getSortedSetsMembers(pids.map(function(pid) {
					return 'pid:' + pid + ':replies';
				}), next);
			},
			function(_replyPids, next) {
				var replyPids = [].concat.apply([], _replyPids);
				_replyPids.forEach(function(replies, index) {
					replies.forEach(function(reply) {
						replyIndices[reply] = data.posts.findIndex(function(post) {
							return post.pid === pids[index];
						});
					});
				});

				privileges.posts.filter('read', replyPids, data.uid, next);
			},
			function(allowedPids, next) {
				allowedPids.forEach(function(pid) {
					data.posts[replyIndices[pid]].replies++;
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
