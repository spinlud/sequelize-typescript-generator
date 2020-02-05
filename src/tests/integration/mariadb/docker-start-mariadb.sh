#!/usr/bin/env sh
set -e

IMAGE_NAME="mariadb"
CONTAINER_NAME="mariadb"
IMAGE_FULL_NAME="$IMAGE_NAME:$DOCKER_MARIADB_VERSION"

docker pull "$IMAGE_FULL_NAME"

docker run -d --name $CONTAINER_NAME \
  -e MYSQL_DATABASE="$TEST_DB_DATABASE" \
  -e MYSQL_USER="$TEST_DB_USERNAME" \
  -e MYSQL_ROOT_PASSWORD="$TEST_DB_PASSWORD" \
  -e MYSQL_PASSWORD="$TEST_DB_PASSWORD" \
  -p "$TEST_DB_PORT":3306  \
  "$IMAGE_FULL_NAME"

# Wait until database becomes online
until docker logs --tail all ${CONTAINER_NAME} 2>&1 | grep -c "dump completed" > /dev/null; do
    echo "Waiting database to become online..."
    sleep 5
done

echo "Database online"
