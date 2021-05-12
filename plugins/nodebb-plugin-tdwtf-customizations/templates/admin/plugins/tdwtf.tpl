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
