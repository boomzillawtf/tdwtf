#!/bin/bash -e

# add the nginx config file
sudo cp nodebb-upstream.conf /etc/nginx/

# make sure we have Docker
which docker &> /dev/null || curl -sSL https://get.docker.com/ | sh

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
until nc -z "`docker inspect -f '{{ .NetworkSettings.Networks.wtdwtf.IPAddress }}' wtdwtf-mongo`" 27017; do echo Waiting for MongoDB; sleep 1; done

# start the NodeBB container
docker run -d --name wtdwtf-nodebb --net wtdwtf --ip 172.21.1.254 --restart unless-stopped -v /usr/share/nginx/wtdwtf-nodebb.config:/usr/src/app/docker -v /usr/share/nginx/wtdwtf-nodebb.uploads:/usr/src/app/public/uploads boomzillawtf/tdwtf

# run the setup script
docker exec wtdwtf-nodebb node app --setup='{"url":"http://nodebb.local","secret":"not-secret wtdwtf test","database":"mongo","mongo:host":"wtdwtf-mongo","mongo:port":27017,"mongo:username":"","mongo:password":"","mongo:database":"0","redis:host":"wtdwtf-redis","redis:port":6379,"redis:password":"","redis:database":0,"admin:username":"PaulaBean","admin:email":"paula@example.com","admin:password":"brillant","admin:password:confirm":"brillant"}'

# copy the complete config
docker cp config.json wtdwtf-nodebb:/usr/src/app/docker/config.json

# restart the NodeBB container
docker restart wtdwtf-nodebb

echo 'See nginx-config-example for an example nginx configuration file.'
echo ''
echo 'Admin username: PaulaBean'
echo 'Admin password: brillant'
