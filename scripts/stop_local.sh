#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
for task in backend ai mail frontend; do
  if [ -f "runtime/$task.pid" ]; then
    task_pid=$(cat "runtime/$task.pid")
    case "$task_pid" in *[!0-9]*|'') exit 1;; esac
    kill -TERM "$task_pid" 2>/dev/null || true
  fi
done
