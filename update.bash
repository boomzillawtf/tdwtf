#!/bin/bash -e

if [[ "`basename "$0"`" == "update_local.bash" ]]; then
	# build the local image
	docker build -t boomzillawtf/tdwtf .
else
	# pull the new image
	docker pull boomzillawtf/tdwtf
fi

# rename the old image
docker rename wtdwtf-nodebb wtdwtf-nodebb-temp

# flip-flop IP addresses so we can let nginx handle the switchover
ip=172.21.1.254
other_ip=172.21.1.253
if [[ "`docker inspect -f '{{ .NetworkSettings.Networks.wtdwtf.IPAddress }}' wtdwtf-nodebb-temp`" == "172.21.1.254" ]]; then
	ip=172.21.1.253
	other_ip=172.21.1.254
fi

# start the new NodeBB container
docker run -d --name wtdwtf-nodebb --net wtdwtf --ip $ip --restart unless-stopped --init --volumes-from wtdwtf-nodebb-temp $TDWTF_NODEBB_DOCKER_RUN_ARGS boomzillawtf/tdwtf

# output logs
docker logs -f wtdwtf-nodebb &

# grab the log PID
log_pid=$!

# wait until it's listening on both ports
until nc -z $ip 4567; do sleep 1; done
until nc -z $ip 4568; do sleep 1; done

# stop outputting logs
kill $log_pid
wait $log_pid 2> /dev/null || true

# make sure the emailer plugin is disabled
docker exec wtdwtf-nodebb ./nodebb reset -p nodebb-plugin-emailer-amazon || true

# switch nginx upstream
sudo sed -i /etc/nginx/nodebb-upstream.conf -e "s/\\(server $ip:[0-9]\\+\\) down;/\\1;/" -e "s/\\(server $other_ip:[0-9]\\+\\);/\\1 down;/"
sudo /etc/init.d/nginx reload

# remove the old container
docker stop wtdwtf-nodebb-temp
docker rm wtdwtf-nodebb-temp
