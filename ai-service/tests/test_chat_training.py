import hashlib
import json
from training.chat_dataset import build
from app.chat import grounded_answer, normalized


def test_authored_corpus_is_reproducible_and_separates_questions(tmp_path):
    first=build(tmp_path/'first'); second=build(tmp_path/'second')
    assert first['sha256']==second['sha256']
    seen=set()
    for split in ('train','valid','test'):
        rows=[json.loads(line) for line in (tmp_path/'first'/f'{split}.jsonl').read_text().splitlines()]
        assert len(rows)==first['counts'][split]
        for row in rows:
            messages=row['messages']
            assert [m['role'] for m in messages]==['system','user','assistant']
            question=normalized(messages[1]['content'])
            assert question not in seen
            seen.add(question)
            target=json.loads(messages[-1]['content'])['answer']
            if '{{fact:' in target:
                payload=json.loads(messages[1]['content'])
                facts=[{'id':f['id'],'value':'100','kind':'money'} for f in payload['facts']]
                grounded_answer(messages[-1]['content'],facts)
            else:
                grounded_answer(messages[-1]['content'],[],allow_general_numbers=True)
        assert hashlib.sha256((tmp_path/'first'/f'{split}.jsonl').read_bytes()).hexdigest()==first['sha256'][split]


def test_authored_education_questions_route_without_private_snapshot(tmp_path):
    from app.chat import is_general_question
    build(tmp_path/'data')
    for split in ('train','valid','test'):
        rows=[json.loads(line) for line in (tmp_path/'data'/f'{split}.jsonl').read_text().splitlines()]
        # The first 25 topics use four train or one held-out question each.
        count=100 if split=='train' else 25
        assert all(is_general_question(r['messages'][1]['content']) for r in rows[:count])


def test_retrieval_is_accent_insensitive_and_has_no_account_numbers():
    from app.chat_knowledge import retrieve
    docs=retrieve('Random Forest va XGBoost la gi?')
    assert {d['topic'] for d in docs}=={'Random Forest','XGBoost'}
    assert 'quỹ dự phòng' in {d['topic'] for d in retrieve('quy du phong la gi')}
    assert retrieve('Hãy nói số dư tài khoản cá nhân của tôi')==[]
