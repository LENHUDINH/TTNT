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
        assert not messages_seen  # Known ML statuses are rendered from verified facts.
        assert "Chưa đủ dữ liệu để dự báo" in result["content"]
        assert "2 tín hiệu" in result["content"]
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


@pytest.mark.parametrize('question', ['Quy tắc 50/30/20 là gì?', 'Ngan sach la gi?', 'Giải thích lãi kép'])
def test_general_education_intents(question):
    assert chat.is_general_question(question)


@pytest.mark.parametrize('question', ['Thu nhập của tôi là gì?', 'Số dư tài khoản là gì?', 'Giải thích chi tiêu của mình'])
def test_personal_questions_stay_grounded(question):
    assert not chat.is_general_question(question)


def test_general_numbers_allowed_only_in_isolated_education_mode():
    raw = json.dumps({'answer': 'Quy tắc 50/30/20 phân bổ 50% cho nhu cầu, 30% cho mong muốn và 20% cho tiết kiệm.'})
    with pytest.raises(ValueError):
        chat.grounded_answer(raw, FACTS)
    answer, used = chat.grounded_answer(raw, [], allow_general_numbers=True)
    assert '50%' in answer and used == []


def test_general_generation_does_not_retrieve_or_send_account_data(monkeypatch):
    monkeypatch.setenv('CHAT_PROVIDER', 'ollama')
    async def ready():return {'configured': True}
    async def forbidden(_):pytest.fail('General education must not fetch account data')
    async def provider(messages, config):
        assert 'private previous figure' not in json.dumps(messages)
        payload=json.loads(messages[-1]['content'])
        assert payload['question'] == 'Giải thích cách lập ngân sách cho người mới'
        assert 'kế hoạch phân bổ' in payload['reference']
        assert config['factIds'] == []
        return json.dumps({'answer': 'Ví dụ giả định: tiết kiệm 20% của 10 triệu đồng là 2 triệu đồng.'})
    monkeypatch.setattr(chat, 'status', ready)
    monkeypatch.setattr(chat, 'provider_answer', provider)
    async def run():
        chat._slot = asyncio.Semaphore(1)
        result = await chat.generate(chat.ChatRequest(message='Giải thích cách lập ngân sách cho người mới', requestId='education', history=[{'role':'assistant', 'content':'private previous figure'}]), forbidden)
        assert result['metadata']['facts'] == []
        assert result['metadata']['grounding'] == 'general-education'
        assert '2 triệu' in result['content']
    asyncio.run(run())


def test_simple_balance_uses_verified_data_even_without_llm(monkeypatch):
    monkeypatch.setenv('CHAT_PROVIDER', 'ollama')
    async def forbidden(*args):pytest.fail('Basic balance must not depend on LLM')
    async def context(_):return {'facts':[{'id':'balance','label':'Tổng số dư ví hiện tại','value':'123456.78','kind':'money','source':'wallets'}]}
    monkeypatch.setattr(chat, 'status', forbidden)
    monkeypatch.setattr(chat, 'provider_answer', forbidden)
    async def run():
        chat._slot = asyncio.Semaphore(1)
        result = await chat.generate(chat.ChatRequest(message='toi con bao nhieu tien?', requestId='direct-balance'), context)
        assert '123.456,78 ₫' in result['content']
        assert result['metadata']['facts'][0]['id'] == 'balance'
    asyncio.run(run())


def test_specific_date_or_wallet_is_never_replaced_by_current_total():
    facts = [{'id':'balance','label':'Tổng ví','value':'100','kind':'money','source':'wallets'}]
    assert chat.direct_account_answer('Số dư ví tiền mặt?', facts) is None
    assert chat.direct_account_answer('Tôi đã chi bao nhiêu tháng trước?', facts) is None


def test_unaccented_topic_selection_keeps_requested_evidence():
    facts = chat.normal_facts({'facts': [*FACTS, {'id':'balance','label':'Tổng ví','value':'100','kind':'money','source':'wallets'}]})
    assert chat.required_fact_ids(facts, 'so du cua toi') == ['balance']


def test_reviewed_budget_definition_and_greeting():
    answer, used = chat.direct_general_answer('Ngan sach la gi?')
    assert 'kế hoạch phân bổ' in answer and 'tiền điện tử' not in answer
    assert not used
    assert '2 + 2' not in chat.direct_general_answer('Xin chào!')[0]
    assert chat.direct_general_answer('Ngân sách của tôi là gì?') is None


def test_followup_uses_topic_not_assistant_claims():
    req = chat.ChatRequest(message='Cho ví dụ', requestId='followup', history=[
        {'role':'user','content':'Lãi kép là gì?'},
        {'role':'assistant','content':'Bạn có 999 triệu đồng.'}])
    result = chat.resolve_question(req)
    assert 'Lãi kép là gì' in result and '999' not in result
    assert chat.is_general_question(result)


def test_forecast_followup_replaces_horizon():
    req = chat.ChatRequest(message='Còn 7 ngày thì sao?', requestId='horizon', history=[{'role':'user','content':'Dự báo chi tiêu 30 ngày tới'}])
    assert chat.resolve_question(req) == 'Dự báo chi tiêu 7 ngày tới'


def test_period_guard_checks_year_boundary_and_explicit_month():
    ctx = {'month':'2026-01', 'asOf':'2026-01-04T12:00:00+07:00'}
    assert '2025-12' in chat.period_clarification('Tôi chi bao nhiêu tháng trước?', ctx)[0]
    assert '2025-10' in chat.period_clarification('Chi tháng 10/2025?', ctx)[0]
    assert chat.period_clarification('Chi tháng này?', ctx) is None
    assert chat.period_clarification('Chi hôm nay?', ctx)
    assert chat.period_clarification('Dự báo 7 ngày tới', ctx) is None


def test_surplus_ratio_is_exact_and_not_divided_by_zero():
    facts = chat.normal_facts({'facts':[
        {'id':'income','value':'300','kind':'money'},
        {'id':'expense','value':'100','kind':'money'}]})
    derived = chat.decision_facts(facts)[-1]
    assert derived['value'] == '66.67' and derived['nature'] == 'DERIVED'
    facts[0]['value'] = '0'
    assert len(chat.decision_facts(facts)) == 2


def test_resolved_question_reaches_ml_enrichment(monkeypatch):
    monkeypatch.setenv('CHAT_PROVIDER', 'ollama')
    async def enrich(req):
        assert req.message == 'Dự báo chi tiêu 7 ngày tới'
        return {'facts':[]}
    async def ready():return {'configured':True}
    async def provider(*_):return '{"answer":"Chưa đủ dữ liệu dự báo."}'
    monkeypatch.setattr(chat, 'status', ready)
    monkeypatch.setattr(chat, 'provider_answer', provider)
    async def run():
        chat._slot=asyncio.Semaphore(1)
        response=await chat.generate(chat.ChatRequest(message='Còn 7 ngày thì sao?',requestId='resolve-enrich',history=[{'role':'user','content':'Dự báo chi tiêu 30 ngày'}]),enrich)
        assert response['metadata']['followUpResolved']
    asyncio.run(run())


def test_repeated_followups_keep_original_topic():
    req=chat.ChatRequest(message='Nói rõ hơn',requestId='repeat-followup',history=[
        {'role':'user','content':'Lãi kép là gì?'},
        {'role':'assistant','content':'An explanation'},
        {'role':'user','content':'Cho ví dụ'},
        {'role':'assistant','content':'A sample'}])
    assert 'Lãi kép là gì' in chat.resolve_question(req)
    assert not chat.is_general_question('Giải thích chi tiêu tháng trước')


def test_mlx_local_and_remote_consent_classification(monkeypatch):
    monkeypatch.setenv('CHAT_PROVIDER','mlx')
    monkeypatch.setenv('MLX_URL','http://127.0.0.1:11435')
    monkeypatch.setenv('CHAT_FINE_TUNED','true')
    assert not chat.config()['external'] and chat.config()['fineTuned']
    monkeypatch.setenv('MLX_URL','https://external.example')
    assert chat.config()['external']
    async def forbidden(_):pytest.fail('Remote MLX must require consent before processing private data')
    async def run():
        with pytest.raises(HTTPException) as e:
            await chat.generate(chat.ChatRequest(message='Số dư?',requestId='remote-mlx-denied'),forbidden)
        assert e.value.status_code == 403
    asyncio.run(run())


def test_ready_forecast_reports_estimate_without_other_account_totals():
    facts=chat.normal_facts({'facts':[
        {'id':'forecast.horizon','label':'Horizon','value':'7','kind':'count'},
        {'id':'forecast.total','label':'Forecast','value':'123456.78','kind':'money'},
        {'id':'income','label':'Income','value':'999999','kind':'money'}]})
    answer,used=chat.verified_analysis_answer('Dự báo 7 ngày tới',{'mlStatus':{'forecast':{'status':'READY'}}},facts)
    assert '7 ngày' in answer and '123.456,78 ₫' in answer
    assert 'ước tính' in answer and '999999' not in answer
    assert {f['id'] for f in used}=={'forecast.total','forecast.horizon'}
