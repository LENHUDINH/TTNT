#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p .cache/docker
if [ ! -f .cache/docker/config.json ]; then
  printf '%s\n' '{"cliPluginsExtraDirs":["/opt/homebrew/lib/docker/cli-plugins"]}' > .cache/docker/config.json
fi
export DOCKER_CONFIG="$PWD/.cache/docker"
task_colima_home=${COLIMA_HOME:-$HOME/.colima}
if [ -S "$task_colima_home/finsight/docker.sock" ]; then
 export DOCKER_HOST="unix://$task_colima_home/finsight/docker.sock"
fi
exec docker compose -p finsight "$@"
