#!/usr/bin/env sh

CONTAINER_NAME="postgres"
IMAGE_NAME="postgres:${DOCKER_POSTGRES_VERSION}"

docker pull ${IMAGE_NAME}

docker run -d --name ${CONTAINER_NAME} \
  -e POSTGRES_DB=${TEST_DB_DATABASE} \
  -e POSTGRES_USER=${TEST_DB_USERNAME} \
  -e POSTGRES_PASSWORD=${TEST_DB_PASSWORD} \
  -p ${TEST_DB_PORT}:5432 \
  ${IMAGE_NAME}

# Wait until database becomes online
until docker logs --tail all ${CONTAINER_NAME} 2>&1 | grep -c "PostgreSQL init process complete; ready for start up." > /dev/null; do
    echo "Waiting database to become online..."
    sleep 5
done

echo "Database online"
