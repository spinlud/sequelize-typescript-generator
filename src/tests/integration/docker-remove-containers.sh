#!/usr/bin/env bash
set -e

# Stop and remove any running container
if [[ "$OSTYPE" == "darwin"* ]]; then
  # MAC applies --no-run-if-empty by default
  docker ps -a | awk -F '[ ]+' 'NR>1 {print($1)}' | xargs -n1 docker stop | xargs -n1 docker rm --volumes
else
  docker ps -a | awk -F '[ ]+' 'NR>1 {print($1)}' | xargs --no-run-if-empty -n1 docker stop | xargs --no-run-if-empty -n1 docker rm --volumes
fi
