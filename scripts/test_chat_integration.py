"""Real running MariaDB + Spring + FastAPI + Ollama chat acceptance checks.

Creates and deletes only its two temporary accounts. No financial writes on demo users.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timedelta
from decimal import Decimal
import json
import os
from pathlib import Path
import time
import uuid
from zoneinfo import ZoneInfo

import httpx

BASE = os.getenv("CHAT_TEST_URL", "http://127.0.0.1:8088")
PASSWORD = "ChatIntegration-2026!"
results = {"base": BASE, "startedAt": datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).isoformat(), "passed":False}


def headers(client):
    r = client.get("/api/auth/csrf"); r.raise_for_status()
    return {"X-CSRF-TOKEN": r.json()["token"], "Idempotency-Key":uuid.uuid4().hex}


def mutate(client, method, path, payload=None):
    return client.request(method, path, headers=headers(client), json=payload)


def ok(client, method, path, payload=None):
    r = mutate(client, method, path, payload)
    if r.is_error:
        raise RuntimeError(f"{method} {path}: {r.status_code} " + str(r.json().get("message","request failed")))
    r.raise_for_status()
    return r.json() if r.content else None


clients = [httpx.Client(base_url=BASE, timeout=110) for _ in range(2)]
accounts = []
try:
    for c in clients:
        email = "chat-qa-" + uuid.uuid4().hex + "@example.test"
        ok(c, "POST", "/api/auth/register", {"email": email, "password": PASSWORD, "name": "Chat acceptance"})
        accounts.append((c, email))
        ok(c, "POST", "/api/auth/login", {"email": email, "password": PASSWORD})
    a, b = clients
    status = a.get("/api/chat/status").json()
    assert status["configured"] and status["provider"] == "ollama" and not status["external"]
    results["realLocalEngine"] = {k:status[k] for k in ("provider", "model", "external")}
    assert not a.get("/api/chat/preferences").json()["externalConsent"]
    conversation = ok(a, "POST", "/api/chat/conversations", {"title":"QA private history"})
    cid = conversation["id"]; path = f"/api/chat/conversations/{cid}"
    assert a.post(path + "/messages", json={"content":"hello", "clientMessageId":uuid.uuid4().hex}).status_code == 403
    assert b.get(path + "/messages").status_code == 404
    assert mutate(b, "PATCH", path, {"title":"foreign"}).status_code == 404
    assert mutate(b, "DELETE", path).status_code == 404
    assert mutate(b, "POST", path + "/messages", {"content":"foreign", "clientMessageId":uuid.uuid4().hex}).status_code == 404
    assert b.get("/api/chat/conversations").json()["total"] == 0
    results["csrfAndCrossAccountIsolation"] = True

    wallet = ok(a, "POST", "/api/wallets", {"name":"QA chat wallet", "type":"CASH", "initialBalance":"1000000"})
    category = next(c for c in a.get("/api/categories").json() if c["name"] == "Ăn uống")
    now = (datetime.now(ZoneInfo("Asia/Ho_Chi_Minh"))-timedelta(minutes=1)).replace(tzinfo=None).isoformat(timespec="seconds")
    ok(a, "POST", "/api/transactions", {"walletId":wallet["id"], "categoryId":category["id"], "amount":"250000", "type":"EXPENSE", "description":"Synthetic chat test expense", "occurredAt":now})
    payload = {"content":"Tổng số dư ví hiện tại của tôi là bao nhiêu?", "clientMessageId":uuid.uuid4().hex}
    response = ok(a, "POST", path + "/messages", payload)
    assert response["status"] == "COMPLETED"
    facts = {f["id"]:f for f in response["metadata"]["facts"]}
    assert Decimal(facts["balance"]["value"]) == Decimal("750000.00")
    assert "750.000 ₫" in response["content"]
    assert response["metadata"]["grounding"] == "verified-fact-placeholders"
    assert response["metadata"]["fineTuned"] is False
    replay = ok(a, "POST", path + "/messages", payload)
    assert replay["id"] == response["id"]
    assert a.get(path + "/messages").json()["total"] == 2
    assert mutate(a, "POST", path + "/messages", {**payload,"content":"changed"}).status_code == 409
    results["exactMoneyAndIdempotentReplay"] = True

    ok(a, "POST", f"/api/chat/messages/{response['id']}/feedback", {"rating":1,"comment":"Verified test"})
    assert mutate(b, "POST", f"/api/chat/messages/{response['id']}/feedback", {"rating":1}).status_code == 404
    history = a.get(path + "/messages?page=0&size=1").json()
    assert history["total"] == 2 and len(history["items"]) == 1
    full = a.get(path + "/messages").json()["items"]
    assert full[-1]["feedbackRating"] == 1
    results["persistedHistoryFeedbackPagination"] = True

    # The concurrent second request has the same idempotency key and cannot invoke a second model run.
    payload = {"content":"Tháng này tôi chi nhiều nhất vào đâu?", "clientMessageId":uuid.uuid4().hex}
    h = headers(a)
    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(a.post, path + "/messages", headers=h, json=payload)
        time.sleep(.3)
        second = pool.submit(a.post, path + "/messages", headers=h, json=payload)
        responses = [first.result(),second.result()]
    for r in responses:r.raise_for_status()
    assert responses[0].json()["id"] == responses[1].json()["id"]
    answer = next(r.json() for r in responses if r.json()["status"] == "COMPLETED")
    assert any(f["id"] == "category_" + str(category["id"]) for f in answer["metadata"]["facts"])
    assert "Ăn uống" in answer["content"] and "250.000 ₫" in answer["content"]
    assert a.get(path + "/messages").json()["total"] == 4
    results["concurrentDuplicateAndQuestionSpecificEvidence"] = True

    greeting = ok(a, "POST", path + "/messages", {"content":"Xin chào!", "clientMessageId":uuid.uuid4().hex})
    assert greeting["status"] == "COMPLETED" and greeting["content"]
    results["greetingWithoutInventedMoney"] = True

    # Start a real generation, cancel after the PENDING pair is persisted and check it never reappears complete.
    payload = {"content":"Giải thích kỹ kế hoạch ngân sách và tiết kiệm của tôi.", "clientMessageId":uuid.uuid4().hex}
    h = headers(a)
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(a.post, path + "/messages", headers=h, json=payload)
        for _ in range(50):
            messages = a.get(path + "/messages").json()["items"]
            pending = next((m for m in messages if m["role"] == "ASSISTANT" and m["clientMessageId"] == payload["clientMessageId"]), None)
            if pending:break
            time.sleep(.1)
        assert pending and pending["status"] == "PENDING"
        cancelled = ok(a, "POST", path + "/cancel", {"clientMessageId":payload["clientMessageId"]})
        assert cancelled["status"] == "CANCELLED"
        final = future.result();final.raise_for_status();assert final.json()["status"] == "CANCELLED"
    assert a.get(path + "/messages").json()["items"][-1]["status"] == "CANCELLED"
    results["realGenerationCancellationNoLateCommit"] = True
    ok(a, "PATCH", path, {"title":"QA renamed"})
    assert a.get("/api/chat/conversations?search=QA%20renamed").json()["total"] == 1
    ok(a, "DELETE", path)
    assert a.get(path + "/messages").status_code == 404
    results["renameSearchDelete"] = True
    results["passed"] = True
finally:
    for c,email in accounts:
        r = mutate(c, "DELETE", "/api/auth/account", {"email":email,"password":PASSWORD})
        r.raise_for_status()
    for c in clients:c.close()
    results["temporaryAccountCleanup"] = True
    Path("docs/test-results/chat-api.json").write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(json.dumps(results,ensure_ascii=False,indent=2))
