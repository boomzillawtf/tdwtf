#!/bin/bash

history_count=20
threshold=$(( 90 * ( $history_count - 1 ) * 5 / $(getconf CLK_TICK) ))

for (( i=0; $i <= $history_count; i++ )); do
	eval declare -A history$i="([1]=0)"
done

while true; do
	unset history$history_count
	eval "declare -A history$history_count=([1]=0 $(for pid in $(pidof node); do
		if [[ "$pid" == "1" ]]; then
			continue
		fi

		declare -a stat=($(cat /proc/$pid/stat))
		echo "[$pid]=${stat[13]}"
		unset stat
	done))"

	for pid in "${!history0[@]}"; do
		pcpu="history$history_count[$pid]"
		pcpu="${!pcpu}"
		if [[ -z "$pcpu" ]]; then
			continue
		fi

		if (( $pcpu - "${history0[$pid]}" < $threshold )); then
			continue
		fi

		echo '{"level":"error","message":"[watchdog.bash] killing '"$pid"'","timestamp":"'"`date -u --iso-8601=ns | sed -e 's/......+00:00/Z/g' -e 's/,/./g'`"'"}'
		kill -9 "$pid"
	done

	for (( i=0; $i < $history_count; i++ )); do
		next=$(( $i + 1 ))
		unset history$i
		eval $(declare -p history$next | sed -e "s/history$next=/history$i=/")
	done

	sleep 5
done
