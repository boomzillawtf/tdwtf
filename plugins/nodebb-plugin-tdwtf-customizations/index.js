/* jshint node: true */

var Groups = module.parent.require('./groups');
var Posts = module.parent.require('./posts');
var events = module.parent.require('./events');

module.exports = {
	"meta": function(tags, callback) {
		tags = tags.concat([{
			name: 'google-site-verification',
			content: 'CHVbCxly52Dog4tN9fsbqoQkNTASojg2LzYSeJzqRgw'
		}]);

		callback(null, tags);
	},
	"header": function(data, callback) {
		Groups.isMember(data.templateValues.user.uid, 'Mafia - Players', function(err, ok) {
			if (err) {
				return callback(err, data);
			}

			data.templateValues.user.isMafiaPlayer = ok;
			data.templateValues.userJSON = JSON.stringify(data.templateValues.user);
			callback(null, data);
		});
	},
	"postEdit": function(data, callback) {
		if (data.uid === 140870) {
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
	}
};
