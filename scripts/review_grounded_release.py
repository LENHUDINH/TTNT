"""Score the reference-grounded suite with the actual serving validator.

Semantic review is an explicit operator record, separate from structural checks.
"""
from pathlib import Path
import argparse,hashlib,json,re,sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'ai-service'))
from app.chat import grounded_answer


def main():
 p=argparse.ArgumentParser();p.add_argument('--run-dir',required=True,type=Path);a=p.parse_args();root=a.run_dir
 report=json.loads((root/'grounded-evaluation.json').read_text());raw=json.loads((root/'llm-evaluation.json').read_text())
 for label in ('baseline','candidate'):
  passed=0
  for case,result in zip(report['cases'],report[label]['results']):
   financial=case['mode']=='account';facts=[];required=[]
   if financial:
    payload=json.loads(case['messages'][-1]['content'])
    facts=[{'id':f['id'],'value':'2026-10' if f['id']=='selectedPeriod' else '1000.50','kind':'date' if f['id']=='selectedPeriod' else 'money'} for f in payload['facts']]
    required=re.findall(r'\{\{fact:([^}]+)\}\}',' '.join(payload['requiredReferences']))
   try:
    _,used=grounded_answer(result['answer'],facts,require_evidence=financial,allow_general_numbers=not financial)
    valid=set(required).issubset({f['id'] for f in used})
   except (ValueError,TypeError):valid=False
   result['structuralPass']=valid;passed+=valid
  report[label]['passed']=passed;report[label]['total']=len(report['cases'])
 candidate=report['candidate'];baseline=report['baseline']
 eligible=(candidate['passed']/candidate['total']>=.95 and candidate['passed']>=baseline['passed'] and all(result['structuralPass'] for result in candidate['results'] if result['mode']=='account'))
 report['automatedActivationEligible']=eligible
 report['activationEligible']=False
 report['selectedAdapterSha256']=raw['selectedAdapterSha256']
 report['knowledgeSha256']=hashlib.sha256(Path('ai-service/app/chat_knowledge.py').read_bytes()).hexdigest()
 report['releaseScope']='Frozen QLoRA adapter WITH reviewed reference retrieval and existing financial serving validator; not the ungrounded adapter.'
 report['limitations']=['Small synthetic same-domain suite; not real-world accuracy.','Structural score is not semantic accuracy.','Some answers include extra verified facts or unnecessary prose.']
 (root/'grounded-evaluation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print('Grounded structural:',baseline['passed'],candidate['passed'],'/',candidate['total'],'automatic eligible:',eligible)

if __name__=='__main__':main()
