#!/usr/bin/env sh
set -e

IMAGE_NAME="postgres"
CONTAINER_NAME="postgres"
IMAGE_FULL_NAME="$IMAGE_NAME:$DOCKER_POSTGRES_TAG"

docker pull "$IMAGE_FULL_NAME"

docker run -d --name "$CONTAINER_NAME" \
  -e POSTGRES_DB="$TEST_DB_DATABASE" \
  -e POSTGRES_USER="$TEST_DB_USERNAME" \
  -e POSTGRES_PASSWORD="$TEST_DB_PASSWORD" \
  -p "$TEST_DB_PORT":5432 \
  "$IMAGE_FULL_NAME"

# Wait until database becomes online
until docker logs --tail all ${CONTAINER_NAME} 2>&1 | grep -c "PostgreSQL init process complete; ready for start up." > /dev/null; do
    echo "Waiting database to become online..."
    sleep 5
done

echo "Database online"
