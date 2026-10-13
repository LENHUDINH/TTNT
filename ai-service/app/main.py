from contextlib import asynccontextmanager
from pathlib import Path
from datetime import date, datetime, timedelta
import os,secrets,re
import joblib,numpy as np,pandas as pd
from fastapi import FastAPI,Depends,HTTPException,Header
from pydantic import BaseModel,Field
from app.features import daily_frame,anomaly_rows,predict_recursive
from app.chat import ChatRequest,CancelRequest,generate as generate_chat,status as chat_status,cancel as cancel_chat
from training.artifacts import load_active
from starlette.concurrency import run_in_threadpool

ART=Path(os.environ.get("MODEL_DIR",str(Path(__file__).resolve().parents[1]/"artifacts")));bundle=None
@asynccontextmanager
async def lifespan(app):
    global bundle
    try:bundle=load_active(ART)
    except (FileNotFoundError,ValueError):bundle=None
    yield
app=FastAPI(title="FinSight AI inference",version="0.1.0",lifespan=lifespan)
def authorize(x_service_key:str=Header(default="")):
    key=os.environ.get("AI_SERVICE_KEY","")
    if not key or not secrets.compare_digest(x_service_key,key):raise HTTPException(401,"Invalid service key")
def model():
    if bundle is None:raise HTTPException(503,"Trained models unavailable; run training.train first")
    return bundle
class Transaction(BaseModel):
    id:int;amount:float=Field(gt=0,le=1e15);occurredAt:datetime;category:str;description:str="";recurring:bool=False
class ForecastRequest(BaseModel):
    transactions:list[Transaction]=Field(max_length=50000);horizon:int=Field(default=30,ge=1,le=30);asOf:date;recurring:dict[str,float]=Field(default_factory=dict)
class AnomalyRequest(BaseModel):transactions:list[Transaction]=Field(max_length=50000)
class ClassifyRequest(BaseModel):text:str=Field(min_length=1,max_length=250)
@app.get("/health")
def health():return {"status":"UP" if bundle else "MODELS_UNAVAILABLE","version":bundle["metadata"]["version"] if bundle else None}
@app.get("/models",dependencies=[Depends(authorize)])
def models():return model()["metadata"]
@app.post("/forecast",dependencies=[Depends(authorize)])
def forecast(req:ForecastRequest):
    m=model();df=daily_frame([t.model_dump() for t in req.transactions],req.asOf)
    if len(df)<60 or len(req.transactions)<30:return {"status":"INSUFFICIENT_DATA","message":"Cần ít nhất 60 ngày lịch sử và 30 giao dịch chi tiêu","daysAvailable":len(df),"transactionsAvailable":len(req.transactions),"requirements":{"dailyHistory":60,"expenseTransactions":30}}
    dates=pd.date_range(req.asOf+timedelta(days=1),periods=req.horizon)
    values=predict_recursive(m["model"],m["name"],df.amount,dates,req.recurring)
    current_month=df[df.date.dt.strftime("%Y-%m")==req.asOf.strftime("%Y-%m")].amount.sum();monthend=current_month+sum(v for d,v in zip(dates,values) if d.month==req.asOf.month)
    return {"status":"READY","modelVersion":m["metadata"]["version"],"modelName":m["name"],"predictions":[{"date":d.date().isoformat(),"amount":v} for d,v in zip(dates,values)],"total":round(sum(values),2),"monthEnd":round(monthend,2),"monthEndComplete":req.horizon>=(pd.Timestamp(req.asOf)+pd.offsets.MonthEnd(0)).day-req.asOf.day,"historical": [{"date":r.date.date().isoformat(),"amount":r.amount} for r in df.tail(60).itertuples()],"metrics":m["metadata"]["forecast"]["horizons"].get(str(req.horizon)),"evaluationDataset":"Synthetic held-out accounts; not accuracy on this user's history"}
@app.post("/anomalies",dependencies=[Depends(authorize)])
def anomalies(req:AnomalyRequest):
    m=model()
    if len(req.transactions)<30:return {"status":"INSUFFICIENT_DATA","message":"Cần ít nhất 30 giao dịch chi tiêu","analyzed":len(req.transactions),"alerts":[],"requirements":{"expenseTransactions":30}}
    df,x,reasons=anomaly_rows([t.model_dump() for t in req.transactions]);scores=-m["detector"].score_samples(x);alerts=[]
    for i,(r,score) in enumerate(zip(df.itertuples(),scores)):
        facts=reasons[i]
        if score>m["threshold"] and facts["priorCount"]>=5:
            reason=f"Số tiền bằng {facts['amountRatio']} lần trung bình {facts['priorCount']} giao dịch trước cùng danh mục ({facts['historicalMean']:,.0f} VND)."
            alerts.append({"transactionId":r.id,"score":round(float(score),6),"severity":"HIGH" if score>m["threshold"]+.07 else "REVIEW","reason":reason,"facts":facts})
    return {"status":"READY","analyzed":len(df),"modelVersion":m["metadata"]["version"],"threshold":m["threshold"],"alerts":alerts,"metrics":m["metadata"]["anomaly"]}
@app.post("/classify",dependencies=[Depends(authorize)])
def classify(req:ClassifyRequest):
    m=model();text=req.text.strip().lower();vect=m["classifier"].named_steps["tfidfvectorizer"]
    if vect.transform([text]).nnz==0:return {"status":"UNKNOWN","message":"Mô tả chưa nằm trong từ vựng huấn luyện"}
    return {"status":"READY","category":str(m["classifier"].predict([text])[0]),"modelVersion":m["metadata"]["version"]}

@app.get("/chat/status",dependencies=[Depends(authorize)])
async def chat_state():return await chat_status()

@app.post("/chat/cancel",dependencies=[Depends(authorize)])
async def chat_cancel(req:CancelRequest):return cancel_chat(req.requestId)

async def chat_context(req:ChatRequest):
    """Run only allowlisted, read-only financial inference on owned data from Spring.

    The LLM never receives raw transactions, descriptions, account IDs or SQL.
    Figures supplied by ML are explicitly forecast values, not historical facts.
    """
    context=dict(req.context);context["facts"]=list(context.get("facts",[]))
    text=req.message.casefold()
    wants_forecast=any(t in text for t in ["dự báo","du bao","tiết kiệm","tiet kiem","kế hoạch","ke hoach","forecast","savings"])
    wants_anomaly=any(t in text for t in ["bất thường","bat thuong","xem lại","xem lai","anomaly","gian lận"])
    rows=context.get("transactions",[])[:1000]
    if not (wants_forecast or wants_anomaly):return context
    try:
        transactions=[Transaction.model_validate(t) for t in rows]
        as_of=date.fromisoformat(str(context.get("asOf",date.today().isoformat()))[:10])
        ml_status={}
        facts=[]
        if wants_forecast:
            horizon=30
            if re.search(r"\b7\s*(ngày|ngay|days?)\b",text):horizon=7
            if re.search(r"\b1\s*(ngày|ngay|days?)\b",text):horizon=1
            result=await run_in_threadpool(forecast,ForecastRequest(transactions=transactions,horizon=horizon,asOf=as_of,recurring=context.get("recurring",{})))
            ml_status["forecast"]={"status":result["status"],"message":"Chưa đủ lịch sử và giao dịch để dự báo; xem các fact điều kiện." if result["status"]=="INSUFFICIENT_DATA" else result.get("message"),"historyLimited":bool(context.get("transactionsTruncated"))}
            if result["status"]=="READY":
                context["mlModelVersion"]=result["modelVersion"]
                facts.append({"id":"forecast.horizon","label":"Số ngày của chân trời dự báo được chọn, không phải điều kiện lịch sử tối thiểu","value":str(horizon),"kind":"count","nature":"SELECTED","source":"forecast"})
                facts.append({"id":"forecast.total","label":"Dự báo tổng chi sau thời điểm truy xuất, theo chân trời đã chọn","value":str(result["total"]),"kind":"money","nature":"FORECAST","source":"forecast"})
                from decimal import Decimal
                income=Decimal(str(context.get("incomeLast30Days","0")))
                allowance=max(Decimal("0"),income-Decimal(str(result["total"]))) if horizon==30 else None
                if allowance is not None:
                    facts.append({"id":"savings.forecastCapacity","label":"Khoản thu nhập gần đây còn lại sau chi dự báo, chưa trừ nghĩa vụ khác; không phải mức tiết kiệm bảo đảm","value":str(allowance),"kind":"money","nature":"SCENARIO","source":"forecast"})
            elif result["status"]=="INSUFFICIENT_DATA":
                for fact_id,label,value in [("forecast.minimumHistoryDays","Số ngày lịch sử tối thiểu để dự báo",result["requirements"]["dailyHistory"]),("forecast.minimumExpenseTransactions","Số giao dịch chi tiêu tối thiểu để dự báo",result["requirements"]["expenseTransactions"]),("forecast.availableHistoryDays","Số ngày lịch sử hiện có",result["daysAvailable"]),("forecast.availableExpenseTransactions","Số giao dịch chi tiêu hiện có",result["transactionsAvailable"])]:
                    facts.append({"id":fact_id,"label":label,"value":str(value),"kind":"count","nature":"REQUIREMENT" if "minimum" in fact_id else "ACTUAL","source":"forecast"})
        if wants_anomaly:
            result=await run_in_threadpool(anomalies,AnomalyRequest(transactions=transactions))
            ml_status["anomalies"]={"status":result["status"],"message":"Chưa đủ giao dịch để phân tích; xem fact điều kiện." if result["status"]=="INSUFFICIENT_DATA" else result.get("message"),"historyLimited":bool(context.get("transactionsTruncated"))}
            if result["status"]=="READY":
                context["mlModelVersion"]=result["modelVersion"]
                facts.extend([{"id":"anomaly.alertCount","label":"Tín hiệu bất thường từ mô hình, cần xem lại; không kết luận gian lận","value":str(len(result["alerts"])),"kind":"count","source":"anomalies"},{"id":"anomaly.analyzed","label":"Số giao dịch chi tiêu được phân tích trong lịch sử có giới hạn","value":str(result["analyzed"]),"kind":"count","source":"anomalies"}])
            elif result["status"]=="INSUFFICIENT_DATA":
                facts.extend([{"id":"anomaly.minimumExpenseTransactions","label":"Số giao dịch chi tiêu tối thiểu để phân tích","value":str(result["requirements"]["expenseTransactions"]),"kind":"count","nature":"REQUIREMENT","source":"anomalies"},{"id":"anomaly.availableExpenseTransactions","label":"Số giao dịch chi tiêu hiện có","value":str(result["analyzed"]),"kind":"count","nature":"ACTUAL","source":"anomalies"}])
        context["facts"]=facts+context["facts"]
        context["mlStatus"]=ml_status
        sources=list(context.get("sources",[]))
        if wants_forecast:sources.append({"id":"forecast","label":"Mô hình dự báo chi tiêu, dữ liệu do Backend cung cấp","url":"/forecast"})
        if wants_anomaly:sources.append({"id":"anomalies","label":"Mô hình phát hiện bất thường, cần người dùng xem lại","url":"/anomalies"})
        context["sources"]=sources
    except HTTPException as e:
        context["mlStatus"]={"status":"UNAVAILABLE","message":"Mô hình tài chính chưa sẵn sàng; không có dự báo thay thế."}
    except (ValueError,TypeError):
        raise HTTPException(400,"Invalid financial context") from None
    return context

@app.post("/chat",dependencies=[Depends(authorize)])
async def chat(req:ChatRequest):return await generate_chat(req,chat_context)
