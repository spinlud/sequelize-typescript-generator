DIR="${BASH_SOURCE%/*}"
if [[ ! -d "$DIR" ]]; then DIR="$PWD"; fi
. "$DIR/bash-utils.sh"

# Stop and remove any of our db containers
declare -a containers=("mariadb" "mssql" "mysql" "postgres") 
for c in "${containers[@]}"
do
  killContainer $c
done
