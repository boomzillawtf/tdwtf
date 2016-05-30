#!/bin/bash -e

# build the new image
docker build -t boomzillawtf/tdwtf .

# rename the old image
docker rename wtdwtf-nodebb wtdwtf-nodebb-temp

# flip-flop IP addresses so we can let nginx handle the switchover
ip=172.21.1.254
if [[ "`docker inspect -f '{{ .NetworkSettings.Networks.wtdwtf.IPAddress }}' wtdwtf-nodebb-temp`" == "172.21.1.254" ]]; then
	ip=172.21.1.253
fi

# start the new NodeBB container
docker run -d --name wtdwtf-nodebb --net wtdwtf --ip $ip --restart unless-stopped --volumes-from wtdwtf-nodebb-temp boomzillawtf/tdwtf

# wait until it's listening on both ports
until nc -z $ip 4567; do echo Waiting for NodeBB; sleep 1; done
until nc -z $ip 4568; do echo Waiting for NodeBB; sleep 1; done

# remove the old container
docker stop wtdwtf-nodebb-temp
docker rm wtdwtf-nodebb-temp
