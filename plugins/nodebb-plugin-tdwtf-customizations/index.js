/* jshint node: true */

var spawn = require('child_process').spawn;
var nconf = module.parent.require('nconf');
var async = module.parent.require('async');
var Categories = module.parent.require('./categories');
var Groups = module.parent.require('./groups');
var Posts = module.parent.require('./posts');
var events = module.parent.require('./events');

var realDismissFlag = Posts.dismissFlag;
var dismissedFlags = {};
Posts.dismissFlag = function(pid, next) {
	if (pid in dismissedFlags) {
		delete dismissedFlags[pid];
		return next(null);
	}
	next(new Error("[[not-allowed]]"));
};

module.exports = {
	"init": function(data, callback) {
		spawn('./watchdog.bash', [nconf.get('port')], {
			stdio: 'inherit'
		}).unref();
		callback();
	},
	"protectChats": function(req, res, next) {
		if (req.route.path === '/user/:userslug/chats/:roomid?' || req.route.path === '/api/user/:userslug/chats/:roomid?') {
			return User.getUidByUserslug(req.params.userslug, function(err, uid) {
				if (err) {
					return next(err);
				}

				if (req.uid === uid) {
					return next();
				}

				controllerHelpers.notAllowed(req, res);
			});
		}

		next();
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
	"postPurge": function(data, callback) {
		dismissedFlags[data.pid] = true;
		realDismissFlag(data.pid, function(err) {
			callback(err, data);
		});
	}
};
