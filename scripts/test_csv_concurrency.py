"""Two CSV imports through independent sessions must reconcile on real MySQL."""
import concurrent.futures,json,uuid,os
from pathlib import Path
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
from decimal import Decimal
import httpx
base=os.environ.get('VERIFY_BASE','http://127.0.0.1:8088');email='csvqa-'+uuid.uuid4().hex+'@example.test';pw='CSVQA-2026!'
clients=[httpx.Client(base_url=base,timeout=120) for _ in range(2)]
def h(c):return {'X-CSRF-TOKEN':c.get('/api/auth/csrf').json()['token']}
c=clients[0];r=c.post('/api/auth/register',headers=h(c),json={'email':email,'password':pw,'name':'CSV concurrent QA'});r.raise_for_status()
for c in clients:c.post('/api/auth/login',headers=h(c),json={'email':email,'password':pw}).raise_for_status()
c=clients[0];r=c.post('/api/wallets',headers=h(c),json={'name':'CSV atomic','type':'CASH','initialBalance':'5000'});r.raise_for_status();wallet=r.json()['id'];category=c.get('/api/categories').json()[0]['id'];date=(datetime.now(ZoneInfo('Asia/Ho_Chi_Minh'))-timedelta(seconds=2)).replace(tzinfo=None).isoformat(timespec='seconds')
def run(i):
 c=clients[i];header='walletId,categoryId,type,amount,description,occurredAt\n';rows=''.join(f'{wallet},{category},EXPENSE,1,CSV {i} row {j},{date}\n' for j in range(200));r=c.post('/api/reports/import-csv',headers={**h(c),'Idempotency-Key':uuid.uuid4().hex},files={'file':(f'{i}.csv',header+rows,'text/csv')});r.raise_for_status();return r.json()
try:
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:out=list(pool.map(run,range(2)))
 actual=Decimal(str(clients[0].get('/api/wallets').json()[0]['balance']));count=clients[0].get('/api/transactions').json()['total'];result={'expectedBalance':'4600.00','actualBalance':str(actual),'expectedTransactions':400,'actualTransactions':count,'passed':actual==4600 and count==400}
 Path('docs/test-results/csv-concurrency.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
finally:
 clients[0].request('DELETE','/api/auth/account',headers=h(clients[0]),json={'email':email,'password':pw}).raise_for_status()
 for c in clients:c.close()
assert result['passed']
