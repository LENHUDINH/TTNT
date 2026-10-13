"""Synthetic demo data travels through authenticated Spring API, never writes DB directly."""
import argparse,sys,json,time
from pathlib import Path
from datetime import datetime,timedelta
import httpx,pandas as pd
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'ai-service'))
from training.dataset import generate
def main():
 p=argparse.ArgumentParser();p.add_argument('--base',default='http://127.0.0.1:8080');p.add_argument('--accounts',type=int,default=12);p.add_argument('--reset',action='store_true');args=p.parse_args()
 if not 10<=args.accounts<=20: p.error('Use 10–20 demo accounts')
 data,_=generate(seed=20261011,users=args.accounts)
 for i in range(args.accounts):
  email=f'demo{i+1:02d}@finsight.local';password='DemoFinSight2026!'
  with httpx.Client(base_url=args.base,timeout=120) as c:
   def token():return {'X-CSRF-TOKEN':c.get('/api/auth/csrf').json()['token']}
   def authpost(path,data):
    for attempt in range(3):
     r=c.post(path,headers=token(),json=data)
     if r.status_code!=429:return r
     print('Rate limited; waiting before retry',flush=True);time.sleep(int(r.headers.get('Retry-After','60')))
    return r
   r=authpost('/api/auth/register',{'name':f'Người dùng demo {i+1:02d}','email':email,'password':password})
   if r.status_code not in [200,409]:r.raise_for_status()
   authpost('/api/auth/login',{'email':email,'password':password}).raise_for_status()
   if args.reset:c.post('/api/demo/reset',headers=token()).raise_for_status()
   rows=[];df=data[data.userId==i]
   # Use a separate seed from ML training; shift to end on yesterday in Vietnam.
   now=datetime.now(__import__('zoneinfo').ZoneInfo('Asia/Ho_Chi_Minh')).replace(tzinfo=None)
   end=pd.to_datetime(df.occurredAt).max().normalize();shift=pd.Timestamp(now.date()-timedelta(days=1))-end
   start=pd.to_datetime(df.occurredAt).min().normalize()+shift
   rows.append({'category':'Thu nhập','description':'Thu nhập đầu kỳ demo','amount':'25000000','type':'INCOME','occurredAt':start.isoformat()})
   for month in pd.date_range(start,end+shift,freq='MS'):
    rows.append({'category':'Thu nhập','description':'Lương tháng demo','amount':'20000000','type':'INCOME','occurredAt':month.isoformat()})
   for row in df.itertuples():rows.append({'category':row.category,'description':row.description,'amount':str(row.amount),'type':'EXPENSE','occurredAt':(pd.Timestamp(row.occurredAt)+shift).isoformat()})
   r=c.post('/api/demo/seed',headers=token(),json={'transactions':rows})
   if r.status_code==409 and not args.reset:print(email,'already seeded');continue
   r.raise_for_status();print(email,r.json())
if __name__=='__main__':main()
