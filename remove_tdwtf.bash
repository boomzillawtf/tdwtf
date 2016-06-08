#!/bin/bash -u

echo "Stopping any running containers"
docker stop wtdwtf-nodebb
docker stop wtdwtf-mongo
docker stop wtdwtf-redis

echo "Deleting containers"
docker rm wtdwtf-nodebb
docker rm wtdwtf-mongo
docker rm wtdwtf-redis

echo "Deleting network"
docker network rm wtdwtf

