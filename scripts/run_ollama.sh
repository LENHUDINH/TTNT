#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p .cache/ollama/models runtime
export OLLAMA_HOST=127.0.0.1:11434
export OLLAMA_MODELS="$PWD/.cache/ollama/models"
export OLLAMA_NUM_PARALLEL=1 OLLAMA_MAX_LOADED_MODELS=1 OLLAMA_CONTEXT_LENGTH=4096
export OLLAMA_FLASH_ATTENTION=1 OLLAMA_KV_CACHE_TYPE=q8_0
export OLLAMA_NO_CLOUD=1
exec /opt/homebrew/bin/ollama serve
