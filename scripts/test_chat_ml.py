"""Exercise trained financial models through the real chat provider, with QA cleanup."""
import json
from pathlib import Path
import uuid
import httpx

results = {"passed":False}
email = "chat-ml-" + uuid.uuid4().hex + "@example.test"
password = "ChatMLTools-2026!"
with httpx.Client(base_url="http://127.0.0.1:8088", timeout=110) as c:
    def change(method,path,data=None):
        token=c.get("/api/auth/csrf").json()["token"]
        r=c.request(method,path,headers={"X-CSRF-TOKEN":token},json=data)
        r.raise_for_status()
        return r.json() if r.content else None
    change("POST","/api/auth/register",{"email":email,"password":password,"name":"Chat ML tools QA"})
    change("POST","/api/auth/login",{"email":email,"password":password})
    try:
        conv=change("POST","/api/chat/conversations",{"title":"QA cold start"})
        answer=change("POST",f"/api/chat/conversations/{conv['id']}/messages",{"content":"Dự báo chi tiêu trong 30 ngày tới của tôi.","clientMessageId":uuid.uuid4().hex})
        meta=answer["metadata"]
        assert answer["status"]=="COMPLETED" and meta["mlStatus"]["forecast"]["status"]=="INSUFFICIENT_DATA"
        assert all(f["id"]!="forecast.total" for f in meta["facts"])
        assert "chưa đủ dữ liệu để dự báo" in answer["content"].casefold()
        assert "cảnh báo bất thường" not in answer["content"].casefold()
        assert any(f["id"]=="forecast.minimumHistoryDays" and f["value"]=="60" for f in meta["facts"])
        results["coldStart"]={"status":"INSUFFICIENT_DATA","noFakeForecast":True,"requirementsFromModel":True,"content":answer["content"]}
        definition=change("POST",f"/api/chat/conversations/{conv['id']}/messages",{"content":"Giải thích Random Forest bằng ngôn ngữ dễ hiểu.","clientMessageId":uuid.uuid4().hex})
        assert definition["status"]=="COMPLETED"
        assert "Random Forest" in definition["metadata"].get("knowledgeTopics",[])
        assert "cây" in definition["content"].casefold()
        assert definition["metadata"].get("facts")==[]
        followup=change("POST",f"/api/chat/conversations/{conv['id']}/messages",{"content":"Nói rõ hơn","clientMessageId":uuid.uuid4().hex})
        assert followup["status"]=="COMPLETED" and followup["metadata"].get("followUpResolved")
        assert "Random Forest" in followup["metadata"].get("knowledgeTopics",[])
        results["referenceGroundingAndFollowup"]={"passed":True,"noAccountFactsSent":True}
    finally:
        change("DELETE","/api/auth/account",{"email":email,"password":password})
    change("POST","/api/auth/login",{"email":"demo01@finsight.local","password":"DemoFinSight2026!"})
    active_version=c.get("/api/ai/models").json()["version"]
    conv=change("POST","/api/chat/conversations",{"title":"QA real trained ML"})
    try:
        for name,question,factid in [("forecast","Dự báo tổng chi tiêu trong 30 ngày tới.","forecast.total"),("anomalies","Có giao dịch bất thường nào cần xem lại không?","anomaly.alertCount")]:
            answer=change("POST",f"/api/chat/conversations/{conv['id']}/messages",{"content":question,"clientMessageId":uuid.uuid4().hex})
            meta=answer["metadata"]
            assert answer["status"]=="COMPLETED" and meta["mlModelVersion"]==active_version
            assert meta["mlStatus"][name]["status"]=="READY"
            assert "chưa đủ dữ liệu" not in answer["content"].casefold()
            assert any(f["id"]==factid for f in meta["facts"])
            results[name]={"status":meta["mlStatus"][name]["status"],"mlModelVersion":meta["mlModelVersion"],"usedFacts":[f["id"] for f in meta["facts"]],"historyLimited":meta["mlStatus"][name]["historyLimited"]}
        results["passed"]=True
    finally:
        change("DELETE",f"/api/chat/conversations/{conv['id']}")
Path("docs/test-results/chat-ml-tools.json").write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(json.dumps(results,ensure_ascii=False,indent=2))
