#!/bin/bash -eu

# Make sure we can support `docker network` (https://github.com/docker/docker/blob/master/CHANGELOG.md#190-2015-11-03)
required_docker="1.9.0"
set +e
installed_docker=$(docker --version | grep -Po '(?<=Docker version )\d+.\d+.\d+')
set -e
if [ ! -z "${installed_docker}" ]; then
	older_version=$(echo -e "${installed_docker}\n${required_docker}" | sort -V | head -n1)
	if [ "${older_version}" != "${required_docker}" ]; then
		# We can't safely use https://get.docker.com, manual intervention required
		echo "Your version of docker (${installed_docker}) is out of date,
(${required_docker} needed.) You  may want to update  your system or visit 
https://docs.docker.com/engine/installation/#on-linux if your repository doesn't 
support a more recent version or you could try running

	curl -sSL https://get.docker.com/ | sh

manually and hope for the best."
	else
		echo "Docker version OK.."
	fi
else
	# No docker present install it using https://get.docker.com
	echo "Installing docker..."
	curl -sSL https://get.docker.com/ | sh
fi

nginx_warning=""
if [ -d /etc/nginx/ ]; then
	# add the nginx config file
	sudo cp nodebb-upstream.conf /etc/nginx/
else
	nginx_warning="The host webserver does not appear to be the expected nginx (no
/etc/nginx directory.). You need to create a virtual host definition /include/ file matching 
nodebb-upstream.conf for a webserver running on the host."
fi

# pull the NodeBB image
docker pull boomzillawtf/tdwtf

# create a Docker network
docker network create --subnet 172.21.1.0/24 wtdwtf

# create the redis container
docker run -d --name wtdwtf-redis --net wtdwtf --restart unless-stopped redis redis-server /data/redis.conf

# stop the container, copy the config into its volume, and restart it
docker stop wtdwtf-redis
docker cp redis.conf wtdwtf-redis:/data/redis.conf
docker start wtdwtf-redis

# create the MongoDB container. we use mmapv1 on WTDWTF.
docker run -d --name wtdwtf-mongo --net wtdwtf --restart unless-stopped mongo --storageEngine mmapv1

# give MongoDB time to start up
until nc -z "`docker inspect -f '{{ .NetworkSettings.Networks.wtdwtf.IPAddress }}' wtdwtf-mongo`" 27017; do echo "Waiting for MongoDB"; sleep 1; done

# start the NodeBB container
docker run -d --name wtdwtf-nodebb --net wtdwtf --ip 172.21.1.254 --restart unless-stopped -v /usr/share/nginx/wtdwtf-nodebb.config:/usr/src/app/docker -v /usr/share/nginx/wtdwtf-nodebb.uploads:/usr/src/app/public/uploads boomzillawtf/tdwtf

# run the setup script
docker exec wtdwtf-nodebb node app --setup='{"url":"http://nodebb.local","secret":"not-secret wtdwtf test","database":"mongo","mongo:host":"wtdwtf-mongo","mongo:port":27017,"mongo:username":"","mongo:password":"","mongo:database":"0","redis:host":"wtdwtf-redis","redis:port":6379,"redis:password":"","redis:database":0,"admin:username":"PaulaBean","admin:email":"paula@example.com","admin:password":"brillant","admin:password:confirm":"brillant"}'

# copy the complete config
docker cp config.json wtdwtf-nodebb:/usr/src/app/docker/config.json

# restart the NodeBB container
docker restart wtdwtf-nodebb

if [ ! -z "${nginx_warning}" ]; then
	echo "${nginx_warning}"
fi
echo 'See nginx-config-example for an example nginx virtual host configuration file.'
echo 'You will probably also need a line pointing nodebb.local to localhost in /etc/hosts'
echo ''
echo 'Admin username: PaulaBean'
echo 'Admin password: brillant'
