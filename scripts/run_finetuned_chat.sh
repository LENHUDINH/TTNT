#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
task_run_dir=${1:-runtime/professional-training-20261014}
# A trained adapter is not automatically approved for serving.
runtime/llm-training-venv/bin/python - "$task_run_dir" <<'PY'
from pathlib import Path
import hashlib,json,sys
root=Path(sys.argv[1]);report=json.loads((root/'grounded-evaluation.json').read_text())
review=json.loads((root/'grounded-model-review.json').read_text())
knowledge=Path('ai-service/app/chat_knowledge.py')
if hashlib.sha256(knowledge.read_bytes()).hexdigest()!=report['knowledgeSha256']:
 raise SystemExit('Reviewed knowledge changed; run evaluation again.')
weights=root/'selected-adapter'/'adapters.safetensors'
sha=hashlib.sha256(weights.read_bytes()).hexdigest()
if not report['activationEligible'] or not review.get('approved') or review.get('adapterSha256')!=sha or report['selectedAdapterSha256']!=sha:
 raise SystemExit('Model has not passed evaluation and reviewed-answer checks; keep the current chatbot.')
PY
mkdir -p .cache/huggingface/hub
export HF_HUB_DISABLE_TELEMETRY=1
export HF_HOME="$PWD/.cache/huggingface"
exec runtime/llm-training-venv/bin/mlx_lm.server \
  --model "$task_run_dir/base-model" --adapter-path "$task_run_dir/selected-adapter" \
  --host 127.0.0.1 --port 11435 --temp 0 --log-level WARNING
