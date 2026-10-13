import json,uuid
from pathlib import Path
import httpx
BASE='http://127.0.0.1:8088';result={}
with httpx.Client(base_url=BASE,timeout=60) as c:
 r=c.get('/');r.raise_for_status();assert 'FinSight' in r.text;result['frontend_nginx']=True
 assert c.get('/api/health').json()['status']=='UP';result['spring_health']=True
 def headers():return {'X-CSRF-TOKEN':c.get('/api/auth/csrf').json()['token']}
 c.post('/api/auth/login',headers=headers(),json={'email':'demo01@finsight.local','password':'DemoFinSight2026!'}).raise_for_status()
 me=c.get('/api/auth/me').json();assert 'passwordHash' not in me
 c.put('/api/auth/profile',headers=headers(),json={'name':me['name'],'theme':'light'}).raise_for_status()
 d=c.get('/api/dashboard').json();assert d['balance']>0;result['mysql_demo_data']={'balance':d['balance'],'recent':len(d['recent'])}
 assert c.post('/api/wallets',json={}).status_code==403;result['csrf']=True
 m=c.get('/api/ai/models').json();result['model_version']=m['version']
 r=c.post('/api/ai/forecast?horizon=30',headers=headers());r.raise_for_status();f=r.json();assert f['status']=='READY' and len(f['predictions'])==30;result['trained_forecast_days']=30
 r=c.post('/api/ai/anomalies/analyze',headers=headers());r.raise_for_status();a=r.json();assert a['status']=='READY' and a['analyzed']>=1000;result['anomaly_analysis']={'analyzed':a['analyzed'],'alerts':len(a['alerts'])}
 r=c.post('/api/ai/savings-plan',headers=headers());r.raise_for_status();assert r.json()['status']=='READY';result['savings_plan']=True
 r=c.get('/api/reports/export?format=pdf');r.raise_for_status();assert r.content.startswith(b'%PDF-');result['unicode_pdf']=True
 for path in ['/transactions','/wallets','/forecast','/settings']:
  r=c.get(path);r.raise_for_status();assert 'id="root"' in r.text
 result['spa_deep_routes']=True
Path('docs/test-results/compose-smoke.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
