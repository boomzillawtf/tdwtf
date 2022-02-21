<h3>Recently restarted instances</h3>
<ul>
<!-- BEGIN recent -->
<li>{@value}</li>
<!-- END recent -->
</ul>

<hr>

<h3>Users on recently restarted instances</h3>
<ul>
<!-- BEGIN entries -->
<li>{entries.count}:
<!-- IF entries.guest -->
{entries.guest}
<!-- ELSE -->
<!-- IF entries.user.picture -->
<img src="{entries.user.picture}" class="user-img"/>
<!-- ELSE -->
<div class="user-img avatar avatar-sm" style="background-color: {entries.user.icon:bgColor};">{entries.user.icon:text}</div>
<!-- ENDIF entries.user.picture -->
<a href="/uid/{entries.user.uid}">{entries.user.username}</a>
<!-- ENDIF entries.guest -->
</li>
<!-- END entries -->
</ul>
<hr>
<form class="form tdwtf-settings">
    <div class="form-group">
        <label for="downvoteUid">
            Downvote UID:
        </label>
        <input type="number" id="downvoteUid" name="downvoteUid" class="form-control" placeholder="14" value="{downvoteUid}"/>
    </div>
    <button class="btn btn-primary" id="save">Save Settings</button>

</form>
<script type="text/javascript">
	require(['settings'], function(Settings) {
		Settings.load('tdwtf', $('.tdwtf-settings'));
		$('#save').on('click', function() {
			var data = {
			    downvoteUid: $('#downvoteUid').val()
		    };
			Settings.save('tdwtf', $('.tdwtf-settings'), function() {
				app.alert({
					type: 'success',
					alert_id: 'tdwtf-saved',
					title: 'Reload Required',
					message: 'Please reload your NodeBB to complete configuration of the TDWTF Customization Plugin',
					clickfn: function() {
						socket.emit('admin.reload');
					}
				})
			});
		});
	});
</script>