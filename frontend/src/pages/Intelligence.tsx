import { AnomalyChart } from "../components/charts/anomalies";
import { useState } from "react";
import {
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  ScanLine,
  RefreshCw,
  History,
  Info,
  Download,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Modal } from "../components/ui/dialog";
import { Loading, Empty, ErrorState } from "../components/ui/states";
import {
  ForecastChart,
  CashflowChart,
  CategoryChart,
} from "../components/charts/finance";
import { PageTitle } from "./Finance";
import { useData, useAction } from "../hooks/data";
import { api, download } from "../services/api";
import { money, dateLabel, monthNow } from "../utils/format";
import type { Forecast, AlertRow, Dashboard } from "../types";
interface ModelInfo {
  version: string;
  dataset: string;
  forecast: {
    selected: string;
    test: Record<string, { mae: number; rmse: number }>;
  };
  anomaly: {
    precision: number;
    recall: number;
    f1: number;
    falsePositiveRate: number;
    confusionMatrix: number[][];
    threshold: number;
  };
  classification: { accuracy: number; macroF1: number; limitation: string };
  limitations: string[];
}
export function ForecastPage() {
  const [horizon, setHorizon] = useState(30);
  const [result, setResult] = useState<Forecast>();
  const [error, setError] = useState<Error>();
  const [pending, setPending] = useState(false);
  const models = useData<ModelInfo>("/ai/models");
  const history = useData<
    { id: number; createdAt: string; payload: string; stale: boolean }[]
  >("/ai/forecast/history");
  async function run() {
    setPending(true);
    setError(undefined);
    try {
      setResult(
        await api<Forecast>("/ai/forecast?horizon=" + horizon, {
          method: "POST",
        }),
      );
      history.refetch();
    } catch (e) {
      setError(e as Error);
    } finally {
      setPending(false);
    }
  }
  const data = [
    ...(result?.historical?.map((p) => ({ date: p.date, actual: p.amount })) ??
      []),
    ...(result?.predictions?.map((p) => ({
      date: p.date,
      predicted: p.amount,
    })) ?? []),
  ];
  return (
    <>
      <PageTitle
        title="Dự báo chi tiêu AI"
        text="Nhìn trước dòng tiền. Chủ động với kế hoạch tương lai."
      >
        <select
          aria-label="Khoảng dự báo"
          value={horizon}
          onChange={(e) => setHorizon(Number(e.target.value))}
        >
          <option value={1}>Ngày tiếp theo</option>
          <option value={7}>7 ngày tới</option>
          <option value={30}>30 ngày tới</option>
        </select>
        <Button variant="ai" onClick={run} disabled={pending}>
          <Sparkles size={17} />
          {pending ? "Đang tính dự báo…" : "Tạo dự báo"}
        </Button>
      </PageTitle>
      <div className="notice">
        <Info size={18} /> Mô hình được huấn luyện trước. Dự báo là ước lượng để
        tham khảo, thay đổi theo lịch sử và các khoản định kỳ đã khai báo.
      </div>
      {pending && <Loading />}
      {error && <ErrorState error={error} retry={run} />}
      <section className="card">
        {result?.status === "READY" ? (
          <>
            <div className="section-head">
              <div>
                <h2>Chi tiêu thực tế & dự báo</h2>
                <p>
                  Đường nét liền: dữ liệu thực tế. Nét đứt: dự báo từ{" "}
                  {result.modelName}.
                </p>
              </div>
              <span className="badge ai-badge">{result.modelVersion}</span>
            </div>
            <ForecastChart data={data} />
            <div className="forecast-metrics">
              <div>
                <span>Tổng chi tiêu dự báo ({horizon} ngày)</span>
                <strong>{money(result.total)}</strong>
              </div>
              <div>
                <span>
                  Chi tiêu dự báo cuối tháng{" "}
                  {result.monthEndComplete ? "" : "(chưa đủ khoảng dự báo)"}
                </span>
                <strong>{money(result.monthEnd)}</strong>
              </div>
              <div>
                <span>Nguy cơ ngân sách tháng</span>
                <strong className={result.budgetRisk ? "danger" : "positive"}>
                  {result.budgetRisk
                    ? "Có nguy cơ vượt"
                    : "Xem cùng giới hạn ngân sách"}
                </strong>
              </div>
            </div>
            {result.metrics && (
              <div className="metric-note">
                MAE: {money(result.metrics.mae)} · RMSE:{" "}
                {money(result.metrics.rmse)}. Đánh giá trên dữ liệu giả lập giữ
                riêng; không phải sai số đo được trên tài khoản của bạn.
              </div>
            )}
            <details>
              <summary>Dữ liệu dự báo từng ngày</summary>
              {result.predictions?.map((p) => (
                <div className="simple-row" key={p.date}>
                  <span>{dateLabel(p.date)}</span>
                  <b>{money(p.amount)}</b>
                </div>
              ))}
            </details>
          </>
        ) : (
          <Empty
            title={
              result?.status === "INSUFFICIENT_DATA"
                ? "Chưa đủ dữ liệu để dự báo"
                : "Nhìn trước kế hoạch chi tiêu"
            }
            text={
              result?.message ??
              "Chọn 1, 7 hoặc 30 ngày rồi tạo dự báo. Cần ít nhất 60 ngày lịch sử và 30 giao dịch chi tiêu."
            }
          />
        )}
      </section>
      <div className="dashboard-grid">
        <section className="card cashflow">
          <div className="section-head">
            <h2>
              <ScanLine size={18} /> Thông tin mô hình
            </h2>
            <span className="badge">Đánh giá thực tế</span>
          </div>
          {models.isPending ? (
            <Loading />
          ) : models.error ? (
            <ErrorState error={models.error} retry={() => models.refetch()} />
          ) : (
            models.data && (
              <>
                <p className="muted">{models.data.dataset}</p>
                <p>
                  Mô hình chọn theo MAE validation:{" "}
                  <b>{models.data.forecast.selected}</b>
                </p>
                <div className="model-table">
                  <div className="model-table-head">
                    <span>Mô hình</span>
                    <span>MAE (VND)</span>
                    <span>RMSE (VND)</span>
                  </div>
                  {Object.entries(models.data.forecast.test).map(
                    ([name, m]) => (
                      <div className="model-table-row" key={name}>
                        <b>{name}</b>
                        <span>{money(m.mae)}</span>
                        <span>{money(m.rmse)}</span>
                      </div>
                    ),
                  )}
                </div>
                <p className="muted">
                  Backtest tuần tự 30 ngày trên tài khoản giả lập giữ riêng. Giá
                  trị tương lai không được dùng làm lag.
                </p>
              </>
            )
          )}
        </section>
        <section className="card distribution">
          <h2>
            <History size={18} /> Lịch sử dự báo
          </h2>
          {history.data?.length ? (
            history.data.slice(0, 10).map((p) => {
              const r = JSON.parse(p.payload) as Forecast;
              return (
                <div className="simple-row" key={p.id}>
                  <div>
                    <b>{dateLabel(p.createdAt)}</b>
                    <small>
                      {r.modelName} {p.stale ? "· Dữ liệu đã thay đổi" : ""}
                    </small>
                  </div>
                  <span>{money(r.total)}</span>
                </div>
              );
            })
          ) : (
            <Empty title="Chưa có lịch sử dự báo" />
          )}
        </section>
      </div>
    </>
  );
}
export function AnomaliesPage() {
  const q = useData<AlertRow[]>("/ai/anomalies");
  const model = useData<ModelInfo>("/ai/models");
  const [filter, setFilter] = useState("ALL");
  const [detail, setDetail] = useState<AlertRow | null>(null);
  const [analyzed, setAnalyzed] = useState<number>();
  const [message, setMessage] = useState("");
  const analyze = useAction();
  const review = useAction(() => setDetail(null));
  const alerts = q.data ?? [];
  const open = alerts.filter((r) => r.alert.status === "OPEN").length;
  const counts = alerts.reduce<Record<string, number>>((all, r) => {
    const date = r.transaction.occurredAt.slice(0, 10);
    all[date] = (all[date] ?? 0) + 1;
    return all;
  }, {});
  const timeline = Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
  function run() {
    setMessage("");
    analyze.mutate(
      { path: "/ai/anomalies/analyze" },
      {
        onSuccess: (r: unknown) => {
          const result = r as {
            status: string;
            message?: string;
            analyzed: number;
            alerts: unknown[];
          };
          setAnalyzed(result.analyzed);
          setMessage(
            result.status === "INSUFFICIENT_DATA"
              ? (result.message ?? "Chưa đủ dữ liệu")
              : `Đã phân tích ${result.analyzed} giao dịch. Phát hiện ${result.alerts.length} trường hợp cần kiểm tra.`,
          );
        },
      },
    );
  }
  return (
    <>
      <PageTitle
        title="Giao dịch bất thường"
        text="Nhận diện những khác biệt để hiểu chi tiêu tốt hơn."
      >
        <Button variant="ai" disabled={analyze.isPending} onClick={run}>
          <ScanLine size={17} />
          {analyze.isPending ? "Đang phân tích…" : "Phân tích giao dịch"}
        </Button>
      </PageTitle>
      <div className="notice warning-notice">
        <ShieldAlert size={20} /> Cảnh báo là dấu hiệu khác biệt với thói quen
        chi tiêu, không phải bằng chứng gian lận. Hệ thống không tự khóa ví.
      </div>
      <div className="stat-strip">
        <div>
          <span>Tổng cảnh báo</span>
          <strong>{alerts.length}</strong>
        </div>
        <div>
          <span>Chưa xử lý</span>
          <strong>{open}</strong>
        </div>
        <div>
          <span>Đã xử lý</span>
          <strong>{alerts.length - open}</strong>
        </div>
        <div>
          <span>Phân tích lần gần nhất</span>
          <strong>{analyzed ?? "—"}</strong>
        </div>
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {analyze.error && <ErrorState error={analyze.error} />}
      <section className="card">
        <div className="section-head">
          <h2>Danh sách cần rà soát</h2>
          <select
            aria-label="Lọc trạng thái cảnh báo"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="ALL">Tất cả</option>
            <option value="OPEN">Chưa xử lý</option>
            <option value="VALID">Đã xác nhận hợp lệ</option>
            <option value="REVIEWED">Đã kiểm tra</option>
          </select>
        </div>
        {q.isPending ? (
          <Loading />
        ) : q.error ? (
          <ErrorState error={q.error} />
        ) : alerts.filter((r) => filter === "ALL" || r.alert.status === filter)
            .length ? (
          alerts
            .filter((r) => filter === "ALL" || r.alert.status === filter)
            .map((r) => (
              <button
                className="alert-row"
                key={r.alert.id}
                onClick={() => setDetail(r)}
              >
                <span className="alert-symbol">
                  <ShieldAlert size={22} />
                </span>
                <div>
                  <b>{r.transaction.description}</b>
                  <small>
                    {dateLabel(r.transaction.occurredAt)} · {r.alert.reason}
                  </small>
                </div>
                <span
                  className={
                    "badge " +
                    (r.alert.status === "OPEN" ? "warning-badge" : "")
                  }
                >
                  {r.alert.status === "OPEN"
                    ? "Cần kiểm tra"
                    : r.alert.status === "VALID"
                      ? "Hợp lệ"
                      : "Đã kiểm tra"}
                </span>
                <b>{money(r.transaction.amount)}</b>
                <ArrowUpRight size={17} />
              </button>
            ))
        ) : (
          <Empty
            title="Không có cảnh báo trong bộ lọc"
            text="Bạn có thể chạy phân tích để rà soát lịch sử giao dịch."
          />
        )}
      </section>
      {timeline.length > 0 && (
        <section className="card">
          <h2>Lịch sử giao dịch được cảnh báo</h2>
          <p className="muted">
            Số cảnh báo đã lưu, nhóm theo ngày giao dịch gốc.
          </p>
          <AnomalyChart data={timeline} />
        </section>
      )}
      {model.data && (
        <section className="card">
          <div className="section-head">
            <h2>Isolation Forest · Chất lượng đánh giá</h2>
            <span className="badge">Dữ liệu giả lập có nhãn</span>
          </div>
          <div className="stat-strip">
            <div>
              <span>Precision</span>
              <strong>
                {(model.data.anomaly.precision * 100).toFixed(1)}%
              </strong>
            </div>
            <div>
              <span>Recall</span>
              <strong>{(model.data.anomaly.recall * 100).toFixed(1)}%</strong>
            </div>
            <div>
              <span>F1-score</span>
              <strong>{model.data.anomaly.f1.toFixed(3)}</strong>
            </div>
            <div>
              <span>False positive rate</span>
              <strong>
                {(model.data.anomaly.falsePositiveRate * 100).toFixed(1)}%
              </strong>
            </div>
          </div>
          <p className="muted">
            Ngưỡng được chọn trên validation. Điểm bất thường là −score_samples,
            lớn hơn nghĩa là khác thường hơn; đây không phải xác suất.
          </p>
          <details>
            <summary>Confusion matrix (hàng: nhãn thực, cột: dự đoán)</summary>
            <table>
              <thead>
                <tr>
                  <th>Nhãn thực</th>
                  <th>Bình thường</th>
                  <th>Bất thường</th>
                </tr>
              </thead>
              <tbody>
                {model.data.anomaly.confusionMatrix.map((row, i) => (
                  <tr key={i}>
                    <th>{i ? "Bất thường" : "Bình thường"}</th>
                    {row.map((v, j) => (
                      <td key={j}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>
      )}
      <Modal
        title="Chi tiết cảnh báo"
        open={!!detail}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <>
            <div className="alert-detail">
              <ShieldAlert size={35} />
              <h3>{detail.transaction.description}</h3>
              <strong>{money(detail.transaction.amount)}</strong>
              <p>{detail.alert.reason}</p>
              <div className="metric-note">
                Điểm bất thường: {detail.alert.score.toFixed(4)} · Mức{" "}
                {detail.alert.severity}
                <br />
                Mô hình: {detail.alert.modelVersion}
              </div>
            </div>
            {review.error && (
              <p role="alert" className="danger">
                {review.error.message}
              </p>
            )}
            <div className="form-actions">
              <Button
                variant="outline"
                disabled={review.isPending}
                onClick={() =>
                  review.mutate({
                    path: "/ai/anomalies/" + detail.alert.id,
                    method: "PATCH",
                    data: { status: "REVIEWED" },
                  })
                }
              >
                Đã kiểm tra
              </Button>
              <Button
                disabled={review.isPending}
                onClick={() =>
                  review.mutate({
                    path: "/ai/anomalies/" + detail.alert.id,
                    method: "PATCH",
                    data: { status: "VALID" },
                  })
                }
              >
                <CheckCircle2 size={17} />
                Đánh dấu hợp lệ
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
export function ReportsPage() {
  const [month, setMonth] = useState(monthNow());
  const q = useData<Dashboard>("/dashboard?month=" + month);
  const [error, setError] = useState<Error>();
  return (
    <>
      <PageTitle
        title="Báo cáo tài chính"
        text="Đọc hiểu dữ liệu, đưa ra quyết định có cơ sở."
      >
        <input
          type="month"
          aria-label="Tháng báo cáo"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        <Button
          variant="outline"
          onClick={() => download("xlsx", month).catch(setError)}
        >
          <Download size={17} />
          Excel
        </Button>
        <Button onClick={() => download("pdf", month).catch(setError)}>
          <Download size={17} />
          PDF
        </Button>
      </PageTitle>
      {error && <ErrorState error={error} />}
      <section className="card">
        <div className="section-head">
          <h2>Tổng quan báo cáo · {month}</h2>
          <Button
            variant="ghost"
            aria-label="Làm mới báo cáo"
            onClick={() => q.refetch()}
          >
            <RefreshCw size={17} />
          </Button>
        </div>
        {q.isPending ? (
          <Loading />
        ) : q.error ? (
          <ErrorState error={q.error} />
        ) : (
          q.data && (
            <>
              <div className="forecast-metrics">
                <div>
                  <span>Thu nhập</span>
                  <strong className="positive">{money(q.data.income)}</strong>
                </div>
                <div>
                  <span>Chi tiêu</span>
                  <strong>{money(q.data.expense)}</strong>
                </div>
                <div>
                  <span>Dòng tiền ròng</span>
                  <strong>{money(q.data.remaining)}</strong>
                </div>
              </div>
              <CashflowChart data={q.data.daily} />
              <div className="report-details">
                <div>
                  <h3>Cơ cấu chi tiêu</h3>
                  {q.data.categories.length ? (
                    <CategoryChart data={q.data.categories} />
                  ) : (
                    <Empty />
                  )}
                </div>
                <div>
                  <h3>Chi tiết theo danh mục</h3>
                  {q.data.categories.map((c) => (
                    <div className="simple-row" key={c.name}>
                      <span>{c.name}</span>
                      <b>{money(c.amount)}</b>
                    </div>
                  ))}
                  <div className="simple-row">
                    <b>Tổng tài sản</b>
                    <b>{money(q.data.netAssets)}</b>
                  </div>
                  <p className="muted">
                    Bao gồm số dư ví và tiền đã dành riêng cho mục tiêu. Chuyển
                    ví và đóng góp không được tính vào thu nhập hoặc chi tiêu.
                  </p>
                </div>
              </div>
            </>
          )
        )}
      </section>
    </>
  );
}
