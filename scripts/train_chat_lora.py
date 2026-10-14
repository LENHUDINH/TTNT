"""Reproducible MLX QLoRA run. Run with the isolated MLX training interpreter.

No cloud training, telemetry service, DB read or automatic model activation.
"""
from pathlib import Path
import argparse
import hashlib
import json
import os
import subprocess
import sys


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--run-dir',required=True,type=Path)
    p.add_argument('--iters',type=int,default=160)
    args=p.parse_args(); root=args.run_dir.resolve(); model=root/'base-model';data=root/'chat-data'
    manifest=json.loads((data/'manifest.json').read_text())
    for split,expected in manifest['sha256'].items():
        actual=hashlib.sha256((data/f'{split}.jsonl').read_bytes()).hexdigest()
        if actual!=expected:raise RuntimeError('Dataset changed: '+split)
    # Use the same non-thinking template for baseline, training and candidate.
    tc=model/'tokenizer_config.json';cfg=json.loads(tc.read_text())
    prefix='{% set enable_thinking = false %}'
    if not cfg['chat_template'].startswith(prefix):
        (root/'original-tokenizer-config.json').write_text(tc.read_text())
        cfg['chat_template']=prefix+cfg['chat_template'];tc.write_text(json.dumps(cfg,ensure_ascii=False,indent=2))
    from transformers import AutoTokenizer
    tokenizer=AutoTokenizer.from_pretrained(str(model),trust_remote_code=False)
    lengths=[]
    for split in ('train','valid','test'):
        for line in (data/f'{split}.jsonl').read_text().splitlines():
            lengths.append(len(tokenizer.apply_chat_template(json.loads(line)['messages'], return_dict=False)))
    max_length=max(lengths)
    sequence=((max_length+63)//64)*64
    if sequence>3072:raise RuntimeError('Unexpected long examples; inspect corpus before training')
    run={
        'model':str(model),'data':str(data),'train':True,'fine_tune_type':'lora',
        'seed':20261014,'num_layers':8,'batch_size':1,'iters':args.iters,
        'learning_rate':0.0001,'max_seq_length':sequence,'grad_checkpoint':True,
        'mask_prompt':True,'val_batches':12,'steps_per_report':10,
        'steps_per_eval':40,'save_every':40,'adapter_path':str(root/'adapters'),
        'lora_parameters':{'rank':8,'dropout':0.05,'scale':16.0},
        'report_to':None,'trust_remote_code':False,
    }
    # JSON is a YAML subset, accepted by the upstream config parser.
    config_path=root/'lora-config.json';config_path.write_text(json.dumps(run,indent=2))
    provenance={'base':json.loads((root/'base-model.json').read_text()),'dataset':manifest,
                'longestExampleTokens':max_length,'trainingConfig':run,
                'tokenizerNonThinkingTemplateSha256':hashlib.sha256(tc.read_bytes()).hexdigest()}
    (root/'training-provenance.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2))
    print('Maximum example tokens:',max_length,'; sequence length:',sequence,flush=True)
    executable=Path(sys.executable).parent/'mlx_lm.lora'
    env={**os.environ,'HF_HUB_DISABLE_TELEMETRY':'1','TOKENIZERS_PARALLELISM':'false'}
    result=subprocess.run([str(executable),'--config',str(config_path)],env=env)
    if result.returncode:raise SystemExit(result.returncode)
    packages=subprocess.check_output([sys.executable,'-m','pip','freeze'],text=True)
    (root/'training-requirements.lock').write_text(packages)
    weights=root/'adapters'/'adapters.safetensors'
    (root/'adapter-integrity.json').write_text(json.dumps({'trained':True,'iterations':args.iters,'sha256':hashlib.sha256(weights.read_bytes()).hexdigest(),'activated':False},indent=2))

if __name__=='__main__':main()
