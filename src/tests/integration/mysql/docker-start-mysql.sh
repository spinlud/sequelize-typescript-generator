#!/usr/bin/env sh

CONTAINER_NAME="mysql"

docker pull mysql:${DOCKER_MYSQL_VERSION}

docker run -d --name ${CONTAINER_NAME} \
  -e MYSQL_DATABASE=${TEST_DB_DATABASE} \
  -e MYSQL_USER=${TEST_DB_USERNAME} \
  -e MYSQL_PASSWORD=${TEST_DB_PASSWORD} \
  -e MYSQL_ROOT_PASSWORD=${TEST_DB_PASSWORD} \
  -p ${TEST_DB_PORT}:3306 \
  mysql:${DOCKER_MYSQL_VERSION}

# Wait until database becomes online
until docker logs --tail all ${CONTAINER_NAME} 2>&1 | grep -c "MySQL init process done. Ready for start up" > /dev/null; do
    echo "Waiting database to become online..."
    sleep 5
done

echo "Database online"
