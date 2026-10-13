"""Integration verification against real running Spring/MySQL/FastAPI/SMTP."""
import io,json,re,uuid,zipfile,concurrent.futures,os
from pathlib import Path
from decimal import Decimal
from datetime import datetime
from zoneinfo import ZoneInfo
import httpx
BASE=os.environ.get('SMOKE_BASE_URL','http://127.0.0.1:8080');results={};email='qa-'+uuid.uuid4().hex+'@example.test';password='QA-FinSight-2026!'
with httpx.Client(base_url=BASE,timeout=30) as c:
 def csrf():return {'X-CSRF-TOKEN':c.get('/api/auth/csrf').json()['token']}
 def request(method,path,data=None,key=None):
  h=csrf();h['Idempotency-Key']=key or uuid.uuid4().hex
  return c.request(method,path,headers=h,json=data)
 def ok(method,path,data=None,key=None):
  r=request(method,path,data,key);r.raise_for_status();return r.json() if r.content else None
 assert c.get('/api/wallets').status_code==401
 ok('POST','/api/auth/register',{'email':email,'password':password,'name':'API verifier'})
 ok('POST','/api/auth/login',{'email':email,'password':password})
 assert c.cookies.get('JSESSIONID');assert c.post('/api/wallets',json={}).status_code==403;results['csrf_and_auth']=True
 a=ok('POST','/api/wallets',{'name':'A','type':'CASH','initialBalance':'1000'});b=ok('POST','/api/wallets',{'name':'B','type':'BANK','initialBalance':'0'})
 category=c.get('/api/categories').json()[0]['id'];now=datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')).replace(tzinfo=None).isoformat(timespec='seconds')
 p={'walletId':a['id'],'categoryId':category,'amount':'100','type':'EXPENSE','description':'QA expense','occurredAt':now}
 tx=ok('POST','/api/transactions',p,'qa-replay');assert ok('POST','/api/transactions',p,'qa-replay')['id']==tx['id'];assert request('POST','/api/transactions',{**p,'amount':'200'},'qa-replay').status_code==409
 before=c.get('/api/wallets').json();assert request('POST','/api/transfers',{'fromWalletId':a['id'],'toWalletId':b['id'],'amount':'5000','note':'rollback'}).status_code==400;assert before==c.get('/api/wallets').json();results['rollback_and_idempotency']=True
 ok('POST','/api/transfers',{'fromWalletId':a['id'],'toWalletId':b['id'],'amount':'200','note':'QA transfer'},'transfer-replay')
 ok('POST','/api/transfers',{'fromWalletId':a['id'],'toWalletId':b['id'],'amount':'200','note':'QA transfer'},'transfer-replay')
 assert Decimal(str(c.get('/api/dashboard').json()['expense']))==100;results['transfers_excluded_from_expenses']=True
 before_total=c.get('/api/transactions').json()['total'];bad=f"walletId,categoryId,type,amount,description,occurredAt\n{a['id']},{category},EXPENSE,1,valid,{now}\n{a['id']},{category},EXPENSE,-5,invalid,{now}\n"
 r=c.post('/api/reports/import-csv',headers={**csrf(),'Idempotency-Key':'csv-atomic'},files={'file':('bad.csv',bad,'text/csv')});assert r.status_code==400;assert c.get('/api/transactions').json()['total']==before_total;results['csv_atomic_rollback']=True
 good=f"walletId,categoryId,type,amount,description,occurredAt\n{a['id']},{category},EXPENSE,1,CSV verified,{now}\n"
 r=c.post('/api/reports/import-csv',headers={**csrf(),'Idempotency-Key':'csv-valid'},files={'file':('good.csv',good,'text/csv')});r.raise_for_status();assert r.json()['imported']==1
 for fmt in ['xlsx','pdf']:
  r=c.get('/api/reports/export?format='+fmt);r.raise_for_status()
  if fmt=='xlsx':
   with zipfile.ZipFile(io.BytesIO(r.content)) as z:assert any('QA expense' in z.read(n).decode(errors='replace') for n in z.namelist() if n.endswith('.xml'))
  else:assert r.content.startswith(b'%PDF-') and len(r.content)>10000
 results['xlsx_pdf_real_content']=True
 assert ok('POST','/api/ai/forecast')['status']=='INSUFFICIENT_DATA';results['honest_cold_start']=True
 ok('POST','/api/auth/forgot',{'email':email})
 inbox_url=os.environ.get('SMTP_INBOX_URL','http://127.0.0.1:8025')
 if '8026' in inbox_url:
  inbox=httpx.get(inbox_url+'/api/v1/messages').json()['messages'];mail=next(m for m in inbox if any(t['Address']==email for t in m['To']));body=httpx.get(inbox_url+'/api/v1/message/'+mail['ID']).json()['Text']
 else:
  inbox=httpx.get(inbox_url+'/messages').json();mail=next(m for m in reversed(inbox) if email in m['to']);body=mail['body']
 token=re.search(r'Mã khôi phục: ([A-Za-z0-9_-]+)',body).group(1)
 newpassword='QA-Rotated-Password-2026!';ok('POST','/api/auth/reset',{'token':token,'password':newpassword});assert request('POST','/api/auth/reset',{'token':token,'password':newpassword}).status_code==400;assert c.get('/api/wallets').status_code==401
 ok('POST','/api/auth/login',{'email':email,'password':newpassword});password=newpassword;results['smtp_reset_single_use_session_revocation']=True
 ok('DELETE','/api/auth/account',{'email':email,'password':password});results['account_cleanup']=True
with httpx.Client(base_url=BASE,timeout=60) as c:
 def h():return {'X-CSRF-TOKEN':c.get('/api/auth/csrf').json()['token']}
 c.post('/api/auth/login',headers=h(),json={'email':'demo01@finsight.local','password':'DemoFinSight2026!'}).raise_for_status()
 r=c.post('/api/ai/forecast?horizon=30',headers=h());r.raise_for_status();forecast=r.json();assert forecast['status']=='READY' and len(forecast['predictions'])==30
 r=c.post('/api/ai/anomalies/analyze',headers=h());r.raise_for_status();anomalies=r.json();assert anomalies['status']=='READY' and anomalies['analyzed']>=1000
 r=c.post('/api/ai/classify',headers=h(),json={'text':'Mua cơm trưa'});r.raise_for_status();assert r.json()['category']=='Ăn uống'
 r=c.post('/api/ai/savings-plan',headers=h());r.raise_for_status();assert r.json()['status']=='READY';results['trained_ml_through_spring_mysql']={'forecastDays':30,'analyzed':anomalies['analyzed'],'alerts':len(anomalies['alerts']),'modelVersion':forecast['modelVersion']}
Path('docs/test-results').mkdir(exist_ok=True);Path('docs/test-results/api-smoke.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
