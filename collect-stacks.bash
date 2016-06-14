#!/usr/bin/env bash
set -e
DOCKER_PID=$1
HOST_PID=$2

docker cp wtdwtf-nodebb:/tmp/perf-$DOCKER_PID.map /tmp/perf-$HOST_PID.map
chown root /tmp/perf-$HOST_PID.map
perf record -F 99 -p $HOST_PID -g -- sleep 30
perf script > nodestacks
