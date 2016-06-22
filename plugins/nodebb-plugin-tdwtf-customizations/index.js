/* jshint node: true */

var Groups = module.parent.require('./groups');

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
	}
};
