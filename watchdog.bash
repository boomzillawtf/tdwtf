#!/bin/bash

start_time=$(date -u +%s)

until curl -fsm 5 http://127.0.0.1:"$1"/recent.rss > /dev/null; do
	echo "Waiting for $PPID/$1"
	sleep 5
done

start_time=$(( $(date -u +%s) - $start_time ))

echo "$PPID/$1 up after $start_time seconds"

failures=0

while true; do
	if ! curl -fsm 30 http://127.0.0.1:"$1"/recent.rss > /dev/null; then
		failures=$(( $failures + 1 ))
		echo "$PPID/$1 timed out ($failures/3)"
		date -uIns
		if [[ $failures -eq 3 ]]; then
			kill -9 "$PPID"
			exit
		fi
	else
		failures=0
		sleep 5
	fi
done
