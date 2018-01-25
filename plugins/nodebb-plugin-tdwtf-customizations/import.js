/* jshint node: true */

(function(Plugin) {
	var db = require.main.require('./src/database'),
	    Posts = require.main.require('./src/posts'),
	    Topics = require.main.require('./src/topics'),
	    User = require.main.require('./src/user'),
	    Categories = require.main.require('./src/categories'),
	    Messaging = require.main.require('./src/messaging'),
	    nconf = require.main.require('nconf'),
	    utils = require.main.require('./public/src/utils.js');

	// change: also take the request as a parameter
	function redirect(req, res, url) {
		// change: keep the query string intact
		var query = req.url.indexOf('?');
		if (query !== -1) {
			url += req.url.substr(query);
		}

		if (res.locals.isAPI) {
			res.status(308).json(url);
		} else {
			// change: do a permanent redirect instead of a "found"
			res.redirect(301, nconf.get('relative_path') + encodeURI(url));
		}
	}

	Plugin.load = function(params, callback) {
		params.router.get('/t/:tid', Plugin.topicRedirect);
		params.router.get('/api/t/:tid', Plugin.topicRedirect);
		params.router.get('/t/:title/:tid/:post_index?', Plugin.topicRedirect);
		params.router.get('/api/t/:title/:tid/:post_index?', Plugin.topicRedirect);
		params.router.get('/t/:title?/:tid.rss', Plugin.rssRedirect);
		params.router.get('/api/t/:title?/:tid.rss', Plugin.rssRedirect);
		params.router.get('/p/:pid', Plugin.postRedirect);
		params.router.get('/api/p/:pid', Plugin.postRedirect);
		params.router.get('/user_avatar/:host/:user/:size/:name', Plugin.avatarRedirect);
		params.router.get('/api/user_avatar/:host/:user/:size/:name', Plugin.avatarRedirect);
		params.router.get('/c/:parent/:child?', Plugin.categoryRedirect);
		params.router.get('/api/c/:parent/:child?', Plugin.categoryRedirect);

		params.router.get('/user/Profile.aspx', Plugin.telligentUserRedirect);
		params.router.get('/api/user/Profile.aspx', Plugin.telligentUserRedirect);
		params.router.get('/forums/:id.aspx', Plugin.telligentCategoryRedirect);
		params.router.get('/api/forums/:id.aspx', Plugin.telligentCategoryRedirect);
		params.router.get('/forums/t/:tid.aspx', Plugin.telligentTopicRedirect);
		params.router.get('/api/forums/t/:tid.aspx', Plugin.telligentTopicRedirect);
		params.router.get('/forums/p/:tid/:pid.aspx', Plugin.telligentPostRedirect);
		params.router.get('/api/forums/p/:tid/:pid.aspx', Plugin.telligentPostRedirect);
		params.router.get('/users/avatar.aspx', Plugin.telligentAvatarRedirect);
		params.router.get('/api/users/avatar.aspx', Plugin.telligentAvatarRedirect);

		callback();
	};

	Plugin.topicRedirect = function(req, res, next) {
		if (!utils.isNumber(req.params.tid)) {
			return next();
		}
		db.sortedSetScore('_imported:_topics', req.params.tid * 2 + 1, function(err, id) {
			if (err || !id) {
				return db.sortedSetScore('_imported:_rooms', req.params.tid, function(err, roomId) {
					if (err || !roomId) {
						return next();
					}

					Messaging.isUserInRoom(req.uid, roomId, function(err, inRoom) {
						if (err || !inRoom) {
							return next();
						}

						redirect(req, res, '/chats/' + roomId);
					});
				});
			}

			Topics.getTopicField(id, 'slug', function(err, slug) {
				if (err || !slug) {
					return next();
				}

				redirect(req, res, '/topic/' + slug + (req.params.post_index ? '/' + req.params.post_index : ''));
			});
		});
	};

	Plugin.rssRedirect = function(req, res, next) {
		if (!utils.isNumber(req.params.tid)) {
			return next();
		}
		db.sortedSetScore('_imported:_topics', req.params.tid * 2 + 1, function(err, id) {
			if (err || !id) {
				return next();
			}

			redirect(req, res, '/topic/' + id + '.rss');
		});
	};

	Plugin.postRedirect = function(req, res, next) {
		if (!utils.isNumber(req.params.pid)) {
			return next();
		}
		db.sortedSetScore('_imported:_posts', req.params.pid * 2 + 1, function(err, id) {
			if (err || !id) {
				return db.sortedSetScore('_imported:_messages', req.params.pid, function(err, mid) {
					if (err || !mid) {
						return next();
					}

					Messaging.getMessageField(mid, 'roomId', function(err, roomId) {
						if (err || !roomId) {
							return next();
						}

						Messaging.isUserInRoom(req.uid, roomId, function(err, inRoom) {
							if (err || !inRoom) {
								return next();
							}

							redirect(req, res, '/chats/' + roomId);
						});
					});
				});
			}

			Posts.generatePostPath(id, req.uid, function(err, path) {
				if (err || !path) {
					return next();
				}

				redirect(req, res, path);
			});
		});
	};

	Plugin.avatarRedirect = function(req, res, next) {
		User.getUidByUserslug(req.params.user, function(err, id) {
			if (err || !id) {
				return next();
			}

			User.getUserField(id, 'picture', function(err, url) {
				if (err || !url) {
					return next();
				}

				redirect(req, res, url);
			});
		});
	};

	Plugin.categoryRedirect = function(req, res, next) {
		var slug = req.params.child || req.params.parent;

		Categories.getAllCategoryFields(['cid', 'slug'], function(err, cats) {
			if (err) {
				return next();
			}

			if (!cats.some(function(cat) {
				if (cat.slug === cat.cid + '/' + slug) {
					redirect(req, res, '/category/' + cat.slug);
					return true;
				}
				return false;
			})) {
				next();
			}
		});
	};

	Plugin.telligentUserRedirect = function(req, res, next) {
		if (isNaN(req.query.UserID)) {
			return next();
		}

		db.sortedSetScore('_telligent:_users', req.query.UserID, function(err, id) {
			if (err || !id) {
				return next();
			}

			db.sortedSetScore('_imported:_users', id, function(err, id) {
				if (err || !id) {
					return next();
				}

				User.getUserField(id, 'userslug', function(err, slug) {
					if (err || !slug) {
						return next();
					}

					redirect(req, res, '/user/' + slug);
				});
			});
		});
	};

	Plugin.telligentCategoryRedirect = function(req, res, next) {
		db.sortedSetScore('_telligent:_categories', req.params.id, function(err, id) {
			if (err || !id) {
				return next();
			}

			db.sortedSetScore('_imported:_categories', id, function(err, id) {
				if (err || !id) {
					return next();
				}

				Categories.getCategoryField(id, 'slug', function(err, slug) {
					if (err || !slug) {
						return next();
					}

					redirect(req, res, '/category/' + slug);
				});
			});
		});
	};

	Plugin.telligentTopicRedirect = function(req, res, next) {
		if (!utils.isNumber(req.params.tid)) {
			return next();
		}
		db.sortedSetScore('_imported:_topics', req.params.tid * 2, function(err, id) {
			if (err || !id) {
				return next();
			}

			Topics.getTopicField(id, 'slug', function(err, slug) {
				if (err || !slug) {
					return next();
				}

				redirect(req, res, '/topic/' + slug + '/' + ((req.query.PageIndex || 1) * 50 - 49));
			});
		});
	};

	Plugin.telligentPostRedirect = function(req, res, next) {
		if (!utils.isNumber(req.params.pid)) {
			return next();
		}
		db.sortedSetScore('_imported:_posts', req.params.pid * 2, function(err, id) {
			if (err || !id) {
				return Plugin.telligentTopicRedirect(req, res, next);
			}

			Posts.generatePostPath(id, req.uid, function(err, path) {
				if (err || !path) {
					return next();
				}

				redirect(req, res, path);
			});
		});
	};


	Plugin.telligentAvatarRedirect = function(req, res, next) {
		if (isNaN(req.query.userid)) {
			return next();
		}

		db.sortedSetScore('_telligent:_users', req.query.userid, function(err, id) {
			if (err || !id) {
				return next();
			}

			db.sortedSetScore('_imported:_users', id, function(err, id) {
				if (err || !id) {
					return next();
				}

				User.getUserField(id, 'picture', function(err, url) {
					if (err || !url) {
						return next();
					}

					redirect(req, res, url);
				});
			});
		});
	};
})(module.exports);
