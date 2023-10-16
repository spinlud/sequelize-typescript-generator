#!/usr/bin/env bash
set -e

DIR="${BASH_SOURCE%/*}"
if [[ ! -d "$DIR" ]]; then DIR="$PWD"; fi
. "$DIR/../test-env.sh"

IMAGE_NAME="mcr.microsoft.com/mssql/server"
CONTAINER_NAME="mssql"

if [[ -z "${DOCKER_MSSQL_TAG}" ]]; then
  IMAGE_TAG="2022-latest"
else
  IMAGE_TAG="${DOCKER_MSSQL_TAG}"
fi

IMAGE_FULL_NAME="$IMAGE_NAME:$IMAGE_TAG"

docker pull --platform=linux/amd64 "$IMAGE_FULL_NAME"

# NB: to test on Apple Silicon computers you have to enable "Use Rosetta" in Docker settings: see https://github.com/microsoft/mssql-docker/issues/668#issuecomment-1436802153
docker run --platform=linux/amd64 -d --name $CONTAINER_NAME \
  -e ACCEPT_EULA="Y" \
  -e SA_PASSWORD="$TEST_DB_PASSWORD" \
  -p "$TEST_DB_PORT":1433  \
  "$IMAGE_FULL_NAME"

# Wait until database becomes online
until docker logs --tail all ${CONTAINER_NAME} 2>&1 | grep -c "Service Broker manager has started." > /dev/null; do
    echo "Waiting database to become online..."
    sleep 5
done

echo "Database online"

# Create test database
docker exec -i "$CONTAINER_NAME" /opt/mssql-tools/bin/sqlcmd \
  -S localhost \
  -U "$TEST_DB_USERNAME" \
  -P "$TEST_DB_PASSWORD" \
  -Q "CREATE DATABASE $TEST_DB_DATABASE"
