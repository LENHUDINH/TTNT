"""All aggregates are computed from strictly earlier observations."""
import numpy as np
import pandas as pd

FORECAST_FEATURES = ["daily_spending", "lag1", "lag7", "lag14", "lag30", "mean7", "mean30", "weekday", "month", "weekend", "recurring"]
ANOMALY_FEATURES = ["log_amount", "hour", "weekday", "category", "frequency", "log_mean", "amount_ratio", "deviation"]
CATEGORIES = ["Ăn uống", "Mua sắm", "Đi lại", "Học tập", "Giải trí", "Nhà ở", "Hóa đơn", "Sức khỏe", "Thu nhập", "Khác"]

def forecast_row(history, date, recurring=0.0):
    h = np.asarray(history, dtype=float)
    if len(h) < 30:
        raise ValueError("At least 30 prior daily observations required")
    scale = max(float(np.mean(h[-30:])), 1.0)
    row = [h[-1]/scale, h[-1]/scale, h[-7]/scale, h[-14]/scale, h[-30]/scale,
           np.mean(h[-7:])/scale, np.mean(h[-30:])/scale, date.weekday(), date.month,
           int(date.weekday() >= 5), recurring/scale]
    return np.asarray(row, dtype=float), scale

def daily_frame(transactions, as_of):
    df = pd.DataFrame(transactions)
    if df.empty:
        return pd.DataFrame(columns=["date", "amount"])
    df["date"] = pd.to_datetime(df["occurredAt"]).dt.normalize()
    df = df[df.date <= pd.Timestamp(as_of)]
    if df.empty:
        return pd.DataFrame(columns=["date", "amount"])
    s = df.groupby("date")["amount"].sum().reindex(pd.date_range(df.date.min(), as_of), fill_value=0.)
    return pd.DataFrame({"date":s.index, "amount":s.to_numpy(dtype=float)})

def anomaly_rows(transactions):
    """Expanding per-account/category statistics exclude the candidate transaction.
    Category IDs are NEVER used as model features: normalize to semantic categories.
    """
    df = pd.DataFrame(transactions).copy()
    if df.empty:
        return df, np.empty((0, len(ANOMALY_FEATURES))), []
    df["date"] = pd.to_datetime(df.occurredAt)
    df = df.sort_values(["date", "id"], kind="stable").reset_index(drop=True)
    history = {}; daily_counts = {}; rows=[]; reasons=[]
    for r in df.itertuples():
        cat = r.category if r.category in CATEGORIES else "Khác"
        h = history.setdefault(cat, [])
        # First observations have no learned user baseline; no unsupported rationale is shown.
        mean = float(np.mean(h)) if h else max(float(r.amount), 1.)
        std = max(float(np.std(h)), mean*.15, 1.) if h else max(mean*.15, 1.)
        freq = daily_counts.get(r.date.date(), 0)
        ratio = float(r.amount)/max(mean, 1.)
        deviation=(float(r.amount)-mean)/std
        rows.append([np.log1p(r.amount), r.date.hour, r.date.weekday(), CATEGORIES.index(cat), freq, np.log1p(mean), ratio, deviation])
        reasons.append({"priorCount":len(h),"historicalMean":round(mean,2),"amountRatio":round(ratio,2),"deviation":round(deviation,2)})
        h.append(float(r.amount));daily_counts[r.date.date()]=freq+1
    return df, np.asarray(rows), reasons

def predict_recursive(model, name, history, dates, recurring=None):
    h=list(map(float,history));result=[]
    for date in dates:
        row,scale=forecast_row(h,date,(recurring or {}).get(date.date().isoformat(),0.))
        if name == "seasonal_naive": p=h[-7]
        elif name == "moving_average": p=float(np.mean(h[-7:]))
        else: p=float(model.predict(row.reshape(1,-1))[0])*scale
        p=max(0.,p);result.append(round(p,2));h.append(p)
    return result
