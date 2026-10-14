"""Re-score saved outputs against references declared in each prompt.

Optional period references in an authored example answer are not mandatory.
No generation, refit or checkpoint selection is performed here.
"""
from pathlib import Path
import argparse,json,re,shutil,sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'ai-service'))
from app.chat import grounded_answer


def main():
 p=argparse.ArgumentParser();p.add_argument('--run-dir',type=Path,required=True);args=p.parse_args();r=args.run_dir
 path=r/'llm-evaluation.json';d=json.loads(path.read_text());backup=r/'llm-evaluation-original-scoring.json'
 if not backup.exists():shutil.copy2(path,backup)
 rows=[json.loads(line) for line in (r/'chat-data'/'test.jsonl').read_text().splitlines()]
 pattern=r'\{\{fact:([a-zA-Z0-9_.-]+)\}\}'
 for label in ('baseline','candidate'):
  for output,row in zip(d[label]['generation']['results'],rows):
   target=json.loads(row['messages'][-1]['content'])['answer'];refs=re.findall(pattern,target)
   try:answer=json.loads(output['answer'])['answer'];valid=isinstance(answer,str) and bool(answer.strip())
   except (ValueError,KeyError,TypeError):answer='';valid=False
   used=re.findall(pattern,answer);required=[];allowed=[]
   if refs:
    payload=json.loads(row['messages'][1]['content']);required=re.findall(pattern,' '.join(payload['requiredReferences']));allowed=[f['id'] for f in payload['facts']]
    remainder=re.sub(pattern,'',answer)
    valid=valid and set(required).issubset(used) and set(used).issubset(allowed) and not re.search(r'\d|\b(triệu|tỷ|nghìn|ngàn)\b',remainder,re.I)
   else:valid=valid and not used
   valid=valid and not re.search(r'<[^>]+>|https?://|```',answer)
   # Use the actual serving validator for the final structural score.
   facts=[{'id':i,'value':'2026-10' if i=='selectedPeriod' else '1000.50','kind':'date' if i=='selectedPeriod' else 'money'} for i in allowed]
   try:
    _,verified=grounded_answer(output['answer'],facts,require_evidence=bool(refs),allow_general_numbers=not refs)
    valid=valid and set(required).issubset({f['id'] for f in verified})
   except (ValueError,TypeError):valid=False
   output.update({'structuralPass':bool(valid),'financial':bool(refs),'requiredReferences':required,'allowedReferences':allowed})
  d[label]['generation']['passed']=sum(row['structuralPass'] for row in d[label]['generation']['results'])
 b,c=d['baseline'],d['candidate']
 d['activationEligible']=(d['selected']['validationLoss']<=d['baselineValidationLoss']*.9 and c['testLoss']<b['testLoss'] and c['generation']['passed']>=b['generation']['passed'] and c['generation']['passed']/c['generation']['total']>=.95 and all(row['structuralPass'] for row in c['generation']['results'] if row['financial']))
 d['decoding']={'temperature':0,'maxTokens':220,'jsonGrammar':False,'sameForBothModels':True}
 d['servingValidatorUsed']=True
 d['scoringCorrection']='Only prompt-declared requiredReferences are mandatory; optional period markers in a reference answer do not invalidate a correct answer. Re-scored saved outputs; no model was refitted or reselected.'
 path.write_text(json.dumps(d,ensure_ascii=False,indent=2))
 print('Corrected structural pass:',b['generation']['passed'],c['generation']['passed'],'/',len(rows),'eligible:',d['activationEligible'])

if __name__=='__main__':main()
