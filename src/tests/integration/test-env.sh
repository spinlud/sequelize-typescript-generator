#!/usr/bin/env bash
set -e

if [[ -z "${TEST_DB_HOST}" ]]; then
  export TEST_DB_HOST="localhost";
fi

if [[ -z "${TEST_DB_PORT}" ]]; then
  export TEST_DB_PORT="1234";
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
