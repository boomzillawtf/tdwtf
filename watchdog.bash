#!/bin/bash

start_time=$(date -u +%s)

until curl -fsm 5 http://127.0.0.1:"$1"/recent.rss > /dev/null; do
	echo "Waiting for $PPID/$1"
	sleep 5
done

start_time=$(( $(date -u +%s) - $start_time ))

echo "$PPID/$1 up after $start_time seconds"

while true; do
	if ! curl -fsm 15 http://127.0.0.1:"$1"/recent.rss > /dev/null; then
		echo "$PPID/$1 timed out"
		date -uIns
		#gdb -p "$PPID" -ex 'thread apply all bt' -ex 'kill' --batch
		kill -9 "$PPID"
		exit
	fi
	sleep 5
done
