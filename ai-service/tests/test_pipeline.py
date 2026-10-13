import os
os.environ['AI_SERVICE_KEY']='unit-test-service-key'
from datetime import date,datetime,timedelta
import json
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient
from app.main import app,ART
from app.features import forecast_row,anomaly_rows,predict_recursive,daily_frame
from training.dataset import generate

def test_reproducible_dataset():
 a,d=generate(seed=12,users=2,days=40);b,e=generate(seed=12,users=2,days=40);pd.testing.assert_frame_equal(a,b);assert set(a.label.unique())<={0,1}
def test_lags_never_read_future():
 history=np.arange(1.,61.);a,s=forecast_row(history[:40],pd.Timestamp('2026-01-01'));history[40:]=999999;b,t=forecast_row(history[:40],pd.Timestamp('2026-01-01'));np.testing.assert_array_equal(a,b);assert s==t
def test_anomaly_stats_exclude_candidate_and_future():
 rows=[{'id':i,'amount':10.,'category':'Ăn uống','occurredAt':f'2026-01-{i:02d}T12:00:00'} for i in range(1,9)];rows[-1]['amount']=100000
 _,x,reasons=anomaly_rows(rows);assert reasons[-1]['historicalMean']==10.;rows[-1]['amount']=500000;_,y,_=anomaly_rows(rows);np.testing.assert_array_equal(x[:-1],y[:-1])
def test_future_transactions_excluded():
 d=daily_frame([{'amount':10.,'occurredAt':'2026-01-01'},{'amount':999.,'occurredAt':'2026-02-01'}],date(2026,1,5));assert d.amount.sum()==10
def test_metadata_chronological_and_real():
 from training.artifacts import load_active
 m=load_active(ART)['metadata'];f=m['forecast'];assert f['trainDays'][1]<f['validationDays'][0]<f['testDays'][0];assert set(range(12)).isdisjoint(range(16,20));assert f['selected'] in f['validation'];assert min(f['validation'],key=lambda n:f['validation'][n]['mae'])==f['selected'];assert all(v['mae']>=0 and v['rmse']>=0 for v in f['test'].values());assert sum(sum(r) for r in m['anomaly']['confusionMatrix'])>0
def test_api_requires_service_key():
 with TestClient(app) as c:assert c.post('/forecast',json={'transactions':[],'asOf':'2026-10-10'}).status_code==401
def test_insufficient_data_and_loaded_models():
 with TestClient(app) as c:
  assert c.get('/health').json()['status']=='UP';assert c.post('/forecast',headers={'X-Service-Key':'unit-test-service-key'},json={'transactions':[],'asOf':'2026-10-10'}).json()['status']=='INSUFFICIENT_DATA'
def test_forecast_is_finite_and_recursive():
 tx,_=generate(seed=44,users=1,days=100);rows=tx.drop(columns=['userId','label']).to_dict('records');end=str(pd.to_datetime(tx.occurredAt).max().date())
 with TestClient(app) as c:
  r=c.post('/forecast',headers={'X-Service-Key':'unit-test-service-key'},json={'transactions':rows,'asOf':end,'horizon':30});assert r.status_code==200;r=r.json();assert r['status']=='READY';assert len(r['predictions'])==30;assert all(np.isfinite(p['amount']) and p['amount']>=0 for p in r['predictions']);assert 'confidence' not in r
def test_inference_anomaly_and_classification():
 tx,_=generate(seed=45,users=1,days=100)
 with TestClient(app) as c:
  r=c.post('/anomalies',headers={'X-Service-Key':'unit-test-service-key'},json={'transactions':tx.drop(columns=['userId','label']).to_dict('records')});assert r.status_code==200;assert r.json()['analyzed']==len(tx)
  r=c.post('/classify',headers={'X-Service-Key':'unit-test-service-key'},json={'text':'Mua cơm trưa'});assert r.json()['category']=='Ăn uống'
  assert c.post('/classify',headers={'X-Service-Key':'unit-test-service-key'},json={'text':'xyzabcdef'}).json()['status']=='UNKNOWN'

# Offline training is isolated from chat/user data and from serving activation.
import copy
import hashlib
import shutil
from pathlib import Path
import joblib
import pytest
from training.classifier_dataset import classification_dataset, normalize_phrase, near_duplicate, split_leakage
from training.train import train_classifier, dataset_fingerprint
from training.artifacts import ArtifactError, verify_candidate, activate, rollback, load_active


def test_phrase_splits_are_disjoint_and_near_duplicate_free():
    corpus = classification_dataset()
    pd.testing.assert_frame_equal(corpus, classification_dataset())
    assert corpus.groupby('split').size().to_dict() == {'train': 192, 'validation': 64, 'test': 64}
    assert not corpus.normalized.duplicated().any()
    assert split_leakage(corpus) == []
    assert corpus.groupby(['category', 'split']).size().min() == 8
    assert corpus.category.nunique() == 8
    assert near_duplicate('Thanh toán hóa đơn điện 10/2026!', 'thanh toan hoa don dien 11/2025')
    assert normalize_phrase('ĐÓNG học phí!') == 'dong hoc phi'
    injected = pd.concat([corpus, pd.DataFrame([{'phraseId': 'leaked', 'text': 'MUA CƠM TRƯA!',
                           'normalized': normalize_phrase('MUA CƠM TRƯA!'), 'category': 'Ăn uống', 'split': 'test'}])])
    assert split_leakage(injected)


def test_classifier_test_labels_do_not_select_or_fit_model():
    corpus = classification_dataset()
    first, report = train_classifier(corpus)
    altered = corpus.copy()
    altered.loc[altered.split == 'test', 'category'] = 'Mua sắm'
    second, changed = train_classifier(altered)
    assert report['selected'] == changed['selected']
    assert report['validation'] == changed['validation']
    assert first.named_steps['tfidfvectorizer'].vocabulary_ == second.named_steps['tfidfvectorizer'].vocabulary_
    np.testing.assert_array_equal(first.predict(corpus.text), second.predict(corpus.text))
    assert first.predict(['Mua cơm trưa'])[0] == 'Ăn uống'
    assert first.named_steps['tfidfvectorizer'].transform(['xyzabcdef']).nnz == 0
    assert report['macroF1'] != changed['macroF1']


def test_dataset_version_includes_classifier_corpus():
    original = {'transactions.csv': 'a' * 64, 'daily.csv': 'b' * 64, 'classification.csv': 'c' * 64}
    changed = {**original, 'classification.csv': 'd' * 64}
    assert dataset_fingerprint(original) != dataset_fingerprint(changed)
    assert dataset_fingerprint(original) == dataset_fingerprint(dict(reversed(list(original.items()))))


@pytest.fixture
def trusted_candidate(tmp_path):
    explicit = os.environ.get('AI_TEST_CANDIDATE_DIR')
    if explicit:
        source = Path(explicit)
    else:
        pointer = ART / 'active-manifest.json'
        if not pointer.exists():
            pytest.skip('Candidate activation tests require a v2 candidate or activated v2 model')
        source = ART / json.loads(pointer.read_text())['directory']
    destination = tmp_path / 'candidate'
    shutil.copytree(source, destination)
    verify_candidate(destination)
    return destination


def _repack_test_candidate(candidate, bundle):
    # Test-only malformed candidates exercise validation; these are never activated outside tmp_path.
    joblib.dump(bundle, candidate / 'models.joblib')
    (candidate / 'metadata.json').write_text(json.dumps(bundle['metadata'], ensure_ascii=False))
    manifest = json.loads((candidate / 'candidate-manifest.json').read_text())
    for name in manifest['files']:
        manifest['files'][name] = hashlib.sha256((candidate / name).read_bytes()).hexdigest()
    (candidate / 'candidate-manifest.json').write_text(json.dumps(manifest))


def test_corrupt_candidate_rejected_before_unpickling(trusted_candidate, monkeypatch):
    with (trusted_candidate / 'models.joblib').open('ab') as file:
        file.write(b'broken')
    monkeypatch.setattr(joblib, 'load', lambda _: pytest.fail('Corrupt file must not be deserialized'))
    with pytest.raises(ArtifactError, match='checksum mismatch'):
        verify_candidate(trusted_candidate)


def test_validation_gate_rejects_failed_candidate(trusted_candidate):
    bundle = verify_candidate(trusted_candidate)
    classifier = bundle['metadata']['classification']
    for metrics in classifier['validation'].values():
        metrics['macroF1'] = .1
    _repack_test_candidate(trusted_candidate, bundle)
    with pytest.raises(ArtifactError, match='quality gate'):
        verify_candidate(trusted_candidate)


def test_explicit_activation_keeps_previous_model_and_rolls_back(trusted_candidate, tmp_path):
    serving = tmp_path / 'serving'
    serving.mkdir()
    # Existing serving files must remain byte-for-byte intact after candidate activation.
    previous = load_active(ART)
    joblib.dump(previous, serving / 'models.joblib')
    (serving / 'metadata.json').write_text(json.dumps(previous['metadata'], ensure_ascii=False))
    original = hashlib.sha256((serving / 'models.joblib').read_bytes()).hexdigest()
    pointer = activate(trusted_candidate, serving)
    assert pointer['previousDirectory']
    assert load_active(serving)['metadata']['version'] == verify_candidate(trusted_candidate)['metadata']['version']
    assert hashlib.sha256((serving / 'models.joblib').read_bytes()).hexdigest() == original
    assert (serving / pointer['previousDirectory'] / 'models.joblib').exists()
    restored = rollback(serving)
    assert restored['directory'] == pointer['previousDirectory']
    assert load_active(serving)['metadata']['version'] == previous['metadata']['version']
    assert (serving / pointer['directory'] / 'models.joblib').exists()


def test_failed_pointer_update_preserves_serving_model(trusted_candidate, tmp_path, monkeypatch):
    serving = tmp_path / 'serving'
    first = activate(trusted_candidate, serving)
    def fail_replace(*_):
        raise OSError('simulated atomic pointer failure')
    monkeypatch.setattr(os, 'replace', fail_replace)
    with pytest.raises(OSError, match='pointer failure'):
        activate(trusted_candidate, serving)
    assert json.loads((serving / 'active-manifest.json').read_text()) == first
    assert load_active(serving)['metadata']['version'] == first['modelVersion']


def test_active_pointer_cannot_escape_directory(tmp_path):
    serving = tmp_path / 'serving'
    serving.mkdir()
    (serving / 'active-manifest.json').write_text(json.dumps({'schemaVersion': 1, 'directory': '../other', 'modelVersion': 'bad'}))
    with pytest.raises(ArtifactError, match='escapes'):
        load_active(serving)
