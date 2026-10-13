"""Chat tests validate financial grounding and provider boundaries, not prose style."""
import asyncio
import json

import pytest
from fastapi import HTTPException
from app import chat

FACTS = [
    {"id": "expense", "label": "Chi tiêu", "value": "123456789012345.67", "kind": "money", "source": "ledger"},
    {"id": "budget.ratio", "label": "Tỷ lệ", "value": "72.50", "kind": "percent", "source": "budgets"},
]


def test_numbers_are_decimal_facts_not_llm_arithmetic():
    answer, used = chat.grounded_answer(json.dumps({"answer": "Chi tiêu {{fact:expense}}, dùng {{fact:budget.ratio}} ngân sách."}), FACTS)
    assert "123.456.789.012.345,67 ₫" in answer
    assert "72.50%" in answer
    assert [f["id"] for f in used] == ["expense", "budget.ratio"]


@pytest.mark.parametrize("text", ["Bạn chi 999999 đồng.", "Bạn chi một đồng.", "{{fact:someone_else.balance}}", "{{fact:expense}} <script>alert('x')</script>", "{{fact:expense}} https://evil.test", "{{fact:expense}} {{bad}}"])
def test_unknown_facts_raw_numbers_and_markup_are_rejected(text):
    with pytest.raises(ValueError):
        chat.grounded_answer(json.dumps({"answer": text}), FACTS)


def test_duplicate_identifiers_and_nonfinite_facts_rejected():
    with pytest.raises(HTTPException):
        chat.normal_facts({"facts": FACTS + FACTS})
    with pytest.raises(HTTPException):
        chat.value_text({"kind": "money", "value": "NaN"})


def test_external_provider_denied_before_context_or_generation(monkeypatch):
    monkeypatch.setenv("CHAT_PROVIDER", "compatible")
    async def forbidden(_):
        pytest.fail("External refusal must happen before private context processing")
    async def run():
        with pytest.raises(HTTPException) as ex:
            await chat.generate(chat.ChatRequest(message="Tôi còn bao nhiêu tiền?", requestId="private-test"), forbidden)
        assert ex.value.status_code == 403
    asyncio.run(run())


def test_general_greeting_can_answer_without_disclosing_account_figures():
    assert chat.is_general_question("Xin chào!")
    assert chat.is_general_question("Ngân sách là gì?")
    assert not chat.is_general_question("Ngân sách của tôi là gì?")
    answer, used = chat.grounded_answer('{"answer":"Chào bạn, bạn muốn tìm hiểu chi tiêu hay tiết kiệm?"}', FACTS, require_evidence=False)
    assert used == [] and "Chào bạn" in answer


@pytest.mark.parametrize("reference,unit", [("forecast.minimumExpenseTransactions","ngày"),("forecast.minimumHistoryDays","giao dịch")])
def test_cold_start_requirement_units_cannot_be_swapped(reference,unit):
    facts=[{"id":reference,"label":"Điều kiện mô hình","value":"30","kind":"count","source":"forecast"}]
    with pytest.raises(ValueError):chat.grounded_answer(json.dumps({"answer":"Cần {{fact:"+reference+"}} "+unit}),facts)


def test_topic_selection_retains_goal_arithmetic_beyond_initial_facts():
    facts = chat.normal_facts({"facts": [{"id": "wallet_"+str(i), "label": "Ví", "value": "10", "kind": "money", "source": "wallets"} for i in range(60)] + [{"id":"goal_monthly", "label":"Kế hoạch chia đều", "value":"100", "kind":"money", "source":"goals"}]})
    selected = chat.select_facts(facts, "Mỗi tháng cần tiết kiệm cho mục tiêu thế nào?")
    assert selected[0]["id"] == "goal_monthly"


def test_cancel_before_provider_status_prevents_any_generation(monkeypatch):
    monkeypatch.setenv("CHAT_PROVIDER", "ollama")
    chat.cancel("early-cancel-test")
    async def forbidden(_):pytest.fail("Cancelled request must not read private context")
    async def run():
        with pytest.raises(HTTPException) as ex:
            await chat.generate(chat.ChatRequest(message="Số dư?", requestId="early-cancel-test"), forbidden)
        assert ex.value.status_code == 409
    asyncio.run(run())


def test_mixed_ml_status_and_unaccented_question_keep_independent_evidence(monkeypatch):
    monkeypatch.setenv("CHAT_PROVIDER", "ollama")
    async def ready():return {"configured":True}
    messages_seen=[]
    async def provider(messages,_):
        messages_seen.extend(messages)
        return '{"answer":"Đây là thông tin phân tích của bạn."}'
    async def context(_):
        return {"mlStatus":{"forecast":{"status":"INSUFFICIENT_DATA"},"anomalies":{"status":"READY"}},"facts":[
            {"id":"forecast.minimumHistoryDays","label":"Số ngày lịch sử tối thiểu","value":"60","kind":"count","source":"forecast"},
            {"id":"forecast.minimumExpenseTransactions","label":"Số giao dịch tối thiểu","value":"30","kind":"count","source":"forecast"},
            {"id":"anomaly.alertCount","label":"Tín hiệu cần xem lại","value":"2","kind":"count","source":"anomalies"}]}
    monkeypatch.setattr(chat,"status",ready);monkeypatch.setattr(chat,"provider_answer",provider)
    async def run():
        chat._slot=asyncio.Semaphore(1)
        result=await chat.generate(chat.ChatRequest(message="du bao va bat thuong",requestId="mixed-ml-test"),context)
        instructions=json.loads(messages_seen[-1]["content"])["instructions"]
        assert "forecast alone is INSUFFICIENT_DATA" in instructions
        assert "anomalies is READY" in instructions
        assert {f["id"] for f in result["metadata"]["facts"]}=={"forecast.minimumHistoryDays","forecast.minimumExpenseTransactions","anomaly.alertCount"}
        assert "60" in result["content"] and "30" in result["content"]
    asyncio.run(run())


def test_real_provider_adapter_contract_retry_and_grounding(monkeypatch):
    monkeypatch.setenv("CHAT_PROVIDER", "ollama")
    calls = []
    async def ready():
        return {"configured": True}
    async def provider(messages, _):
        calls.append(messages.copy())
        return json.dumps({"answer": "Số chi là 500 đồng." if len(calls) == 1 else "Số chi của kỳ là {{fact:expense}}."})
    async def context(_):
        return {"month": "2026-10", "asOf": "2026-10-11T10:00:00", "facts": FACTS, "transactions": [{"description": "secret merchant"}], "password": "never send", "sources": [{"id": "ledger", "label": "Giao dịch", "url": "/transactions"}]}
    monkeypatch.setattr(chat, "status", ready)
    monkeypatch.setattr(chat, "provider_answer", provider)
    async def run():
        chat._slot = asyncio.Semaphore(1)
        result = await chat.generate(chat.ChatRequest(message="Chi tháng này?", requestId="grounding-test"), context)
        assert len(calls) == 2
        assert result["metadata"]["grounding"] == "verified-fact-placeholders"
        assert "secret merchant" not in json.dumps(calls)
        assert "never send" not in json.dumps(calls)
        assert not chat._slot.locked()
    asyncio.run(run())


def test_cancel_releases_generation_slot(monkeypatch):
    monkeypatch.setenv("CHAT_PROVIDER", "ollama")
    async def ready():return {"configured": True}
    started = None
    async def waiting(*_):
        started.set()
        await asyncio.sleep(60)
    async def context(_):return {"facts": FACTS}
    monkeypatch.setattr(chat, "status", ready)
    monkeypatch.setattr(chat, "provider_answer", waiting)
    async def run():
        nonlocal started
        started = asyncio.Event()
        chat._slot = asyncio.Semaphore(1)
        task = asyncio.create_task(chat.generate(chat.ChatRequest(message="Chi tiêu?", requestId="cancel-test"), context))
        await asyncio.wait_for(started.wait(), 2)
        assert chat.cancel("cancel-test")["cancelled"]
        with pytest.raises(HTTPException) as ex:await task
        assert ex.value.status_code == 409
        assert not chat._slot.locked()
        assert "cancel-test" not in chat._active
    asyncio.run(run())
