"""Local development SMTP inbox. Never relays mail to external addresses."""
from contextlib import asynccontextmanager
from email import policy
from email.parser import BytesParser
from datetime import datetime,timezone
from aiosmtpd.controller import Controller
from fastapi import FastAPI
messages=[]
class Inbox:
 async def handle_DATA(self,server,session,envelope):
  mail=BytesParser(policy=policy.default).parsebytes(envelope.content)
  body=mail.get_body(preferencelist=('plain',)) if mail.is_multipart() else mail
  messages.append({'to':envelope.rcpt_tos,'subject':str(mail.get('Subject','')),'body':body.get_content(),'receivedAt':datetime.now(timezone.utc).isoformat()})
  del messages[:-100]
  return '250 Accepted by LOCAL development inbox'
@asynccontextmanager
async def lifespan(app):
 controller=Controller(Inbox(),hostname='127.0.0.1',port=1025);controller.start();yield;controller.stop()
app=FastAPI(title='FinSight LOCAL SMTP inbox',lifespan=lifespan)
@app.get('/messages')
def inbox():return messages
@app.get('/health')
def health():return {'status':'UP','mode':'LOCAL_ONLY_NO_RELAY'}
