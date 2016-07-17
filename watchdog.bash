#!/bin/bash

until curl -fsm 5 http://127.0.0.1:"$1"/recent.rss > /dev/null; do
	echo "Waiting for $PPID/$1"
	sleep 5
done

while true; do
	if ! curl -fsm 5 http://127.0.0.1:"$1"/recent.rss > /dev/null; then
		echo "$PPID/$1 timed out"
		date -uIns
		gdb -p "$PPID" -ex 'thread apply all bt' --batch || exit
		kill -9 "$PPID"
		exit
	fi
	sleep 5
done
