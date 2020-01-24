#!/usr/bin/env sh

# Stop and remove any running container
docker ps -a | awk -F '[ ]+' 'NR>1 {print($1)}' | xargs -n1 docker stop | xargs -n1 docker rm
