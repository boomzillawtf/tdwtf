#!/bin/bash

history_count=20
threshold="`printf "%05.1f" "90.0" | sed -e 's/\.//'`"

for (( i=0; $i <= $history_count; i++ )); do
	eval declare -A history$i="([1]=0)"
done

while true; do
	unset history$history_count
	eval "declare -A history$history_count=([1]=0 $(ps -C 'node' -o 'pid=,pcpu=' | awk '{ if ($1 != "1") print $1 "," $2; }' | while read line; do
		pid="`cut -d, -f1 <<< "$line"`"
		pcpu="`cut -d, -f2 <<< "$line"`"
		pcpu="`printf "%05.1f" "$pcpu" | sed -e 's/\.//'`"

		echo "[$pid]=$pcpu"
	done))"

	for pid in "${!history0[@]}"; do
		fail=""
		for (( i=0; $i <= $history_count; i++ )); do
			pcpu="history$i[$pid]"
			pcpu="${!pcpu}"
			if [[ -z "$pcpu" ]]; then
				fail=yes
				break
			fi

			if (( 10#$pcpu < 10#$threshold )); then
				fail=yes
				break
			fi
		done

		if [[ -z "$fail" ]]; then
			echo '{"level":"error","message":"[watchdog.bash] killing '"$pid"'","timestamp":"'"`date -u --iso-8601=ns | sed -e 's/......+00:00/Z/g' -e 's/,/./g'`"'"}'
			kill -9 "$pid"
		fi
	done

	for (( i=0; $i < $history_count; i++ )); do
		next=$(( $i + 1 ))
		unset history$i
		eval $(declare -p history$next | sed -e "s/history$next=/history$i=/")
	done

	sleep 5
done
