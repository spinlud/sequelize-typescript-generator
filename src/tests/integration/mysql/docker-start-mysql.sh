#!/usr/bin/env bash
set -e

DIR="${BASH_SOURCE%/*}"
if [[ ! -d "$DIR" ]]; then DIR="$PWD"; fi
. "$DIR/../test-env.sh"

IMAGE_NAME="mysql"
CONTAINER_NAME="mysql"

if [[ -z "${DOCKER_MYSQL_TAG}" ]]; then
  IMAGE_TAG="8"
else
  IMAGE_TAG="${DOCKER_MYSQL_TAG}"
fi

IMAGE_FULL_NAME="$IMAGE_NAME:$IMAGE_TAG"

docker pull "$IMAGE_FULL_NAME"

docker run -d --name "$CONTAINER_NAME" \
  -e MYSQL_DATABASE="$TEST_DB_DATABASE" \
  -e MYSQL_USER="$TEST_DB_USERNAME" \
  -e MYSQL_PASSWORD="$TEST_DB_PASSWORD" \
  -e MYSQL_ROOT_PASSWORD="$TEST_DB_PASSWORD" \
  -p "$TEST_DB_PORT":3306 \
  "$IMAGE_FULL_NAME"

# Wait until database becomes online
until docker logs --tail all ${CONTAINER_NAME} 2>&1 | grep -c "MySQL init process done. Ready for start up" > /dev/null; do
    echo "Waiting database to become online..."
    sleep 5
done

echo "Database online"
