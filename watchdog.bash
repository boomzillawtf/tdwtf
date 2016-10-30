#!/bin/bash

start_time=$(date -u +%s)

failures=0

until curl -fsm 5 http://127.0.0.1:"$1"/recent.rss > /dev/null; do
	kill -0 $PPID &> /dev/null || (echo "$PPID/$1 died unexpectedly"; exit)
	failures=$(( $failures + 1 ))
	echo "Waiting for $PPID/$1 ($failures/200)"
	if [[ $failures -eq 200 ]]; then
		kill -9 "$PPID"
		exit
	fi
	sleep 5
done

start_time=$(( $(date -u +%s) - $start_time ))

echo "$PPID/$1 up after $start_time seconds"

failures=0

while true; do
	kill -0 $PPID &> /dev/null || (echo "$PPID/$1 died unexpectedly"; exit)
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
