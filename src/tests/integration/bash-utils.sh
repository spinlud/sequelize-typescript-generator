killContainer() {
  local containerName="${1}"
  local oldContainerExists="$(docker ps --quiet --filter=name="$containerName")"
  if [ -n "$oldContainerExists" ]; then
    echo "Stopping container: $containerName"
    docker stop $containerName
  fi

  oldContainerExists="$(docker ps --all --quiet --filter=name="$containerName")"
  if [ -n "$oldContainerExists" ]; then
    echo "Removing container: $containerName"
    docker rm -fv $containerName
  fi
}