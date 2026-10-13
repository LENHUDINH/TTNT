from pathlib import Path
import numpy as np
import pandas as pd
from app.features import CATEGORIES

def generate(seed=20261010, users=20, days=365):
    rng=np.random.default_rng(seed);rows=[];daily=[];tid=1
    start=pd.Timestamp("2025-10-10")
    descriptions={"Ăn uống":["Mua cơm trưa","Cà phê sáng","Ăn tối"],"Mua sắm":["Mua laptop","Mua áo","Siêu thị"],"Đi lại":["Đổ xăng","Vé xe buýt","Đi taxi"],"Học tập":["Đóng học phí","Mua sách","Khóa học"],"Giải trí":["Xem phim","Vé hòa nhạc","Du lịch"],"Nhà ở":["Tiền thuê nhà","Sửa nhà","Mua nội thất"],"Hóa đơn":["Hóa đơn điện","Tiền nước","Internet"],"Sức khỏe":["Mua thuốc","Khám bệnh","Phí nha khoa"],"Thu nhập":["Lương tháng","Thưởng dự án","Thu nhập freelance"],"Khác":["Quà tặng","Ủng hộ","Chi phí khác"]}
    for u in range(users):
        scale=rng.uniform(.65,1.5)
        for day in range(days):
            date=start+pd.Timedelta(days=day);total=0.;recurring=0.
            for _ in range(int(rng.integers(2,5))):
                cat=rng.choice(CATEGORIES[:8]);amount=round(float(rng.lognormal(11.1,.35))*scale*(1.25 if date.weekday()>=5 else 1),-3)
                hour=int(rng.integers(8,22));label=bool(rng.random()<.012)
                if label: amount*=rng.uniform(12,22);hour=int(rng.integers(0,5))
                amount=round(amount,2);total+=amount
                rows.append(dict(id=tid,userId=u,occurredAt=(date+pd.Timedelta(hours=hour)).isoformat(),amount=amount,category=cat,description=str(rng.choice(descriptions[cat])),label=int(label),recurring=False));tid+=1
            if date.day in [1,15]:
                amount=round(scale*(2200000 if date.day==1 else 450000),2);cat="Nhà ở" if date.day==1 else "Hóa đơn";total+=amount;recurring=amount
                rows.append(dict(id=tid,userId=u,occurredAt=(date+pd.Timedelta(hours=9)).isoformat(),amount=amount,category=cat,description="Tiền thuê nhà" if date.day==1 else "Hóa đơn điện",label=0,recurring=True));tid+=1
            daily.append(dict(userId=u,date=date.isoformat(),amount=total,recurring=recurring))
    return pd.DataFrame(rows),pd.DataFrame(daily)

def write(root):
    root=Path(root);root.mkdir(parents=True,exist_ok=True);tx,daily=generate();tx.to_csv(root/"transactions.csv",index=False);daily.to_csv(root/"daily.csv",index=False)
    return tx,daily
