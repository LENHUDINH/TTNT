"""Validation selects a checkpoint; held-out test is evaluated only afterwards.

Loss is measured on assistant tokens. Generation checks are structural checks,
not a claim of semantic correctness or general intelligence.
"""
from pathlib import Path
from types import SimpleNamespace
import argparse
import gc
import hashlib
import json
import math
import re
import shutil
import time
import mlx.core as mx
from mlx_lm import load, generate
from mlx_lm.sample_utils import make_sampler
from mlx_lm.tuner.datasets import load_dataset, CacheDataset
from mlx_lm.tuner.trainer import evaluate


def evaluate_loss(model,tokenizer,data,split):
    args=SimpleNamespace(data=str(data),mask_prompt=True,train=False,test=True)
    datasets=load_dataset(args,tokenizer)
    dataset=datasets[{'train':0,'valid':1,'test':2}[split]]
    return float(evaluate(model,CacheDataset(dataset),batch_size=1,num_batches=-1,max_seq_length=3072))


def generation_checks(model,tokenizer,rows):
    results=[]
    # All held-out test rows are checked with identical greedy decoding limits.
    for i,row in enumerate(rows):
        messages=row['messages'][:-1]
        prompt=tokenizer.apply_chat_template(messages,tokenize=False,add_generation_prompt=True,enable_thinking=False)
        text=generate(model,tokenizer,prompt=prompt,max_tokens=220,sampler=make_sampler(temp=0),verbose=False)
        expected=json.loads(row['messages'][-1]['content'])['answer']
        financial_refs=re.findall(r'\{\{fact:([a-zA-Z0-9_.-]+)\}\}',expected)
        required_refs=financial_refs
        allowed_refs=financial_refs
        if financial_refs:
            payload=json.loads(messages[-1]['content'])
            required_refs=re.findall(r'\{\{fact:([a-zA-Z0-9_.-]+)\}\}', ' '.join(payload['requiredReferences']))
            allowed_refs=[f['id'] for f in payload['facts']]
        try:
            parsed=json.loads(text);answer=parsed['answer']
            valid=isinstance(answer,str) and bool(answer.strip())
        except (ValueError,KeyError,TypeError):answer='';valid=False
        used=re.findall(r'\{\{fact:([a-zA-Z0-9_.-]+)\}\}',answer)
        if financial_refs:
            remainder=re.sub(r'\{\{fact:[a-zA-Z0-9_.-]+\}\}','',answer)
            valid=valid and set(required_refs).issubset(used) and set(used).issubset(allowed_refs) and not re.search(r'\d|\b(triệu|tỷ|nghìn|ngàn)\b',remainder,re.I)
        else:valid=valid and not used
        valid=valid and not re.search(r'<[^>]+>|https?://|```',answer)
        results.append({'index':i,'question':messages[-1]['content'],'structuralPass':bool(valid),'financial':bool(financial_refs),'answer':text,'expectedReferenceAnswer':expected})
        print('Generation',i+1,'/',len(rows),'structural pass:',bool(valid),flush=True)
        mx.clear_cache()
    return {'passed':sum(r['structuralPass'] for r in results),'total':len(results),'results':results}


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--run-dir',required=True,type=Path)
    args=parser.parse_args();root=args.run_dir.resolve();data=root/'chat-data';model_path=str(root/'base-model')
    report={'base':json.loads((root/'base-model.json').read_text()),'startedAt':time.time(),'activationEligible':False}
    model,tokenizer=load(model_path)
    baseline_valid=evaluate_loss(model,tokenizer,data,'valid')
    report['baselineValidationLoss']=baseline_valid
    del model,tokenizer;gc.collect();mx.clear_cache()
    configs=json.loads((root/'adapters'/'adapter_config.json').read_text())
    candidates=sorted((root/'adapters').glob('*_adapters.safetensors'))
    if not candidates:candidates=[root/'adapters'/'adapters.safetensors']
    selection=[]
    for checkpoint in candidates:
        staging=root/'checkpoint-eval';staging.mkdir(exist_ok=True)
        (staging/'adapter_config.json').write_text(json.dumps(configs))
        shutil.copy2(checkpoint,staging/'adapters.safetensors')
        model,tokenizer=load(model_path,adapter_path=str(staging))
        loss=evaluate_loss(model,tokenizer,data,'valid')
        selection.append({'checkpoint':checkpoint.name,'validationLoss':loss})
        print('Validation',checkpoint.name,loss,flush=True)
        del model,tokenizer;gc.collect();mx.clear_cache()
    best=min(selection,key=lambda r:r['validationLoss'])
    selected=root/'selected-adapter';selected.mkdir(exist_ok=True)
    (selected/'adapter_config.json').write_text(json.dumps(configs,indent=2))
    shutil.copy2(root/'adapters'/best['checkpoint'],selected/'adapters.safetensors')
    report['checkpointSelection']=selection;report['selected']=best
    (root/'validation-selection.json').write_text(json.dumps(report,indent=2))
    # Freeze selection before ever inspecting test loss or generated test answers.
    rows=[json.loads(line) for line in (data/'test.jsonl').read_text().splitlines()]
    for label,adapter in [('baseline',None),('candidate',str(selected))]:
        model,tokenizer=load(model_path,adapter_path=adapter)
        loss=evaluate_loss(model,tokenizer,data,'test')
        report[label]={'testLoss':loss,'perplexity':math.exp(loss),'generation':generation_checks(model,tokenizer,rows)}
        del model,tokenizer;gc.collect();mx.clear_cache()
        (root/'llm-evaluation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    b,c=report['baseline'],report['candidate']
    report['activationPolicy']={'validationLossReductionAtLeast':0.10,'minimumStructuralPassRate':0.95,'allFinancialCasesMustPass':True,'manualSemanticReviewRequired':True}
    report['activationEligible']=(best['validationLoss']<=baseline_valid*0.9 and c['testLoss']<b['testLoss'] and c['generation']['passed']>=b['generation']['passed'] and c['generation']['passed']/c['generation']['total']>=0.95 and all(row['structuralPass'] for row in c['generation']['results'] if row['financial']))
    report['limitations']=['Loss and structural checks do not certify semantic financial correctness.','Synthetic authored test; no independent real-user benchmark.','Activation additionally requires manual review of generated answers.']
    report['selectedAdapterSha256']=hashlib.sha256((selected/'adapters.safetensors').read_bytes()).hexdigest()
    (root/'llm-evaluation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps({k:report[k] for k in ['baselineValidationLoss','selected','activationEligible']},indent=2))

if __name__=='__main__':main()
