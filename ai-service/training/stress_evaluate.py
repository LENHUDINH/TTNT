"""Evaluate a frozen financial candidate on a new synthetic seed; never refit.

Independent generated samples still share the generator; not a real-world test.
"""
from pathlib import Path
import argparse,json
import numpy as np
import pandas as pd
from sklearn.metrics import precision_recall_fscore_support,confusion_matrix
from training.artifacts import verify_candidate
from training.dataset import generate
from training.train import metrics
from app.features import predict_recursive,anomaly_rows


def evaluate(candidate,output,seed=20261014):
    bundle=verify_candidate(candidate);tx,daily=generate(seed=seed,users=8)
    report={'dataset':'Additional synthetic accounts from the existing generator','seed':seed,'accounts':8,'candidateVersion':bundle['metadata']['version'],'refit':False,'forecast':{}}
    for horizon in (1,7,30):
        actual=[];pred=[];baseline=[]
        for user in range(8):
            d=daily[daily.userId==user].copy();d['date']=pd.to_datetime(d.date)
            for origin in (310,335):
                dates=d.date.iloc[origin:origin+horizon]
                recurring={date.date().isoformat():float(v) for date,v in zip(dates,d.recurring.iloc[origin:origin+horizon])}
                history=d.amount.iloc[:origin]
                pred.extend(predict_recursive(bundle['model'],bundle['name'],history,dates,recurring))
                baseline.extend(predict_recursive(None,'moving_average',history,dates))
                actual.extend(d.amount.iloc[origin:origin+horizon])
        report['forecast'][str(horizon)]={'candidate':metrics(actual,pred),'movingAverage':metrics(actual,baseline)}
    rows=[];labels=[]
    for user in range(8):
        d,x,_=anomaly_rows(tx[tx.userId==user].to_dict('records'));rows.extend(x);labels.extend(d.label)
    flags=-bundle['detector'].score_samples(np.asarray(rows))>bundle['threshold']
    precision,recall,f1,_=precision_recall_fscore_support(labels,flags,average='binary',zero_division=0)
    tn,fp,fn,tp=confusion_matrix(labels,flags,labels=[0,1]).ravel()
    report['anomaly']={'precision':float(precision),'recall':float(recall),'f1':float(f1),'falsePositiveRate':float(fp/max(tn+fp,1)),'confusionMatrix':[[int(tn),int(fp)],[int(fn),int(tp)]]}
    report['stressChecks']={'forecast30DaysBeatsMovingAverage':report['forecast']['30']['candidate']['mae']<=report['forecast']['30']['movingAverage']['mae'],'anomalyFprAtMostThreePercent':report['anomaly']['falsePositiveRate']<=.03}
    report['limitations']=['Shares generation rules with training data.','No tuning or model selection is performed on this additional test.','No real-world accuracy claim.']
    Path(output).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False,indent=2))
    return report

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--candidate',required=True);p.add_argument('--output',required=True);p.add_argument('--seed',type=int,default=20261014)
    a=p.parse_args();evaluate(a.candidate,a.output,a.seed)
