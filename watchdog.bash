#!/bin/bash

history_count=20
threshold="`printf "%05.1f" "90.0" | sed -e 's/\.//'`"

for (( i=0; $i <= $history_count; i++ )); do
	declare -A history$i
done

while true; do
	ps -C 'node' -o 'pid=,pcpu=' | awk '{ if ($1 != "1") print $1 "," $2; }' | while read line; do
		pid=`cut -d, -f1 <<< "$line"`
		pcpu=`cut -d, -f2 <<< "$line"`
		pcpu="`printf "%05.1f" "$pcpu" | sed -e 's/\.//'`"

		eval "history$history_count[\"\$pid\"]=\"\$pcpu\""
	done

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
		declare -A history$i
		eval keys=("\${!history$next[@]}")
		for key in "${keys[@]}"; do
			history$i["$key"]="${history$next["$key"]}"
		done
	done

	sleep 5
done
