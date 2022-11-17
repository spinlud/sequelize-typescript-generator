set -e

containerName=$1

if [[ -z "${TEST_DB_HOST}" ]]; then
  export TEST_DB_HOST="localhost";
fi

if [[ -z "${TEST_DB_PORT}" ]]; then
  case $containerName in
    "mariadb")      testPort="1235"   ;;
    "mssql")        testPort="1236"   ;;
    "mysql")        testPort="1237"   ;;
    "postgres")     testPort="1238"   ;;
    *)              testPort="1234"   ;;
  esac
  export TEST_DB_PORT="$testPort";
fi

if [[ -z "${TEST_DB_DATABASE}" ]]; then
  export TEST_DB_DATABASE="testdb";
fi

if [[ -z "${TEST_DB_USERNAME}" ]]; then
  export TEST_DB_USERNAME="sa";
fi

if [[ -z "${TEST_DB_PASSWORD}" ]]; then
  export TEST_DB_PASSWORD="Passw0rd88!";
fi

DIR="${BASH_SOURCE%/*}"
if [[ ! -d "$DIR" ]]; then DIR="$PWD"; fi
. "$DIR/bash-utils.sh"
killContainer $containerName