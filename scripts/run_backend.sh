#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ -f .env ]; then set -a; . ./.env; set +a; fi
mkdir -p runtime
app_artifact=$(mktemp "$PWD/runtime/finsight-api.XXXXXX")
cp backend/target/finsight-api-0.1.0.jar "$app_artifact"
printf '%s\n' "$$" > runtime/backend.pid
exec java -Duser.timezone=Asia/Ho_Chi_Minh -jar "$app_artifact" --debug=false --logging.level.org.springframework=INFO --logging.level.org.hibernate=INFO
