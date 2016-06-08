#!/bin/bash -u

echo "Stopping any running containers"
docker stop wtdwtf-nodebb
docker stop wtdwtf-mongo
docker stop wtdwtf-redis

echo "Deleting containers"
docker rm -v wtdwtf-nodebb
docker rm -v wtdwtf-mongo
docker rm -v wtdwtf-redis

echo "Deleting network"
docker network rm wtdwtf

