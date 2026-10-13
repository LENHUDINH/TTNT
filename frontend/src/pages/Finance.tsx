import { useState } from "react";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Plus,
  ArrowRight,
  ArrowLeftRight,
  ArrowDownLeft,
  ArrowUpRight,
  Pencil,
  Archive,
  Trash2,
  Download,
  Upload,
  Search,
  Repeat2,
  Sparkles,
  Check,
  Wallet as WalletIcon,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Modal } from "../components/ui/dialog";
import { Loading, ErrorState, Empty } from "../components/ui/states";
import { Editor, monetary, required } from "../components/finance/editor";
import type { EditorConfig, Field } from "../components/finance/editor";
import { Metrics, BudgetRows, GoalSummary } from "../components/finance/cards";
import { CashflowChart, CategoryChart } from "../components/charts/finance";
import { useData, useAction } from "../hooks/data";
import { api, download, idempotency, jsonBody } from "../services/api";
import { money, monthNow, localDateTime, dateLabel } from "../utils/format";
import type {
  Wallet,
  Category,
  Transaction,
  Budget,
  Goal,
  Dashboard,
  Forecast,
} from "../types";
const choice = z.coerce.number().int().positive("Chọn một mục");
const text100 = z.string().trim().min(1).max(100);
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
function Gate({
  query,
  children,
}: {
  query: { isPending: boolean; error: Error | null; refetch: () => unknown };
  children: ReactNode;
}) {
  return query.isPending ? (
    <Loading />
  ) : query.error ? (
    <ErrorState error={query.error} retry={() => query.refetch()} />
  ) : (
    <>{children}</>
  );
}
export function PageTitle({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <span className="eyebrow">
          <i /> KHÔNG GIAN TÀI CHÍNH CÁ NHÂN
        </span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      <div className="page-actions">{children}</div>
    </div>
  );
}
export function TransactionList({
  items,
  wallets = [],
  categories = [],
  onEdit,
  onDelete,
}: {
  items: Transaction[];
  wallets?: Wallet[];
  categories?: Category[];
  onEdit?: (t: Transaction) => void;
  onDelete?: (t: Transaction) => void;
}) {
  return items.length ? (
    <div className="transaction-list">
      {items.map((t) => (
        <div className="transaction-row" key={t.id}>
          <span
            className={`transaction-icon ${t.type === "INCOME" ? "income" : "expense"}`}
          >
            {t.type === "INCOME" ? (
              <ArrowDownLeft size={21} />
            ) : (
              <ArrowUpRight size={21} />
            )}
          </span>
          <div className="transaction-description">
            <b>{t.description}</b>
            <small>
              {categories.find((c) => c.id === t.categoryId)?.name ?? t.type} ·{" "}
              {dateLabel(t.occurredAt)}
              {wallets.find((w) => w.id === t.walletId) &&
                " · " + wallets.find((w) => w.id === t.walletId)?.name}
            </small>
          </div>
          <b
            className={`transaction-amount ${t.type === "INCOME" ? "positive" : ""}`}
          >
            {t.type === "INCOME" ? "+" : "−"}
            {money(t.amount)}
          </b>
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Sửa ${t.description}`}
              onClick={() => onEdit(t)}
            >
              <Pencil size={16} />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Xóa ${t.description}`}
              onClick={() => onDelete(t)}
            >
              <Trash2 size={16} />
            </Button>
          )}
        </div>
      ))}
    </div>
  ) : (
    <Empty
      title="Chưa có giao dịch"
      text="Ghi lại khoản thu hoặc chi đầu tiên của bạn."
    />
  );
}
function useFinanceOptions() {
  const wallets = useData<Wallet[]>("/wallets");
  const categories = useData<Category[]>("/categories");
  return { wallets: wallets.data ?? [], categories: categories.data ?? [] };
}
function transactionFields(
  wallets: Wallet[],
  categories: Category[],
  t?: Transaction,
): Field[] {
  return [
    {
      key: "type",
      label: "Loại giao dịch",
      options: [
        { value: "EXPENSE", label: "Chi tiêu" },
        { value: "INCOME", label: "Thu nhập" },
      ],
      default: t?.type ?? "EXPENSE",
    },
    {
      key: "amount",
      label: "Số tiền (VND)",
      default: String(t?.amount ?? ""),
      validate: monetary,
      hint: "Nhập số, không dùng dấu phân cách hàng nghìn.",
    },
    {
      key: "walletId",
      label: "Ví",
      options: wallets
        .filter((w) => !w.archived)
        .map((w) => ({
          value: w.id,
          label: w.name + " · " + money(w.balance),
        })),
      default: t?.walletId,
      validate: choice,
    },
    {
      key: "categoryId",
      label: "Danh mục",
      options: categories.map((c) => ({ value: c.id, label: c.name })),
      default: t?.categoryId,
      validate: choice,
    },
    {
      key: "description",
      label: "Nội dung",
      default: t?.description ?? "",
      validate: required,
    },
    {
      key: "occurredAt",
      label: "Ngày và giờ",
      type: "datetime-local",
      default: t?.occurredAt.slice(0, 16) ?? localDateTime(),
      validate: z
        .string()
        .min(16)
        .transform((v) => (v.length === 16 ? v + ":00" : v)),
    },
  ];
}
export function DashboardPage() {
  const [month, setMonth] = useState(monthNow());
  const q = useData<Dashboard>("/dashboard?month=" + month);
  const { categories, wallets } = useFinanceOptions();
  const [editor, setEditor] = useState<EditorConfig | null>(null);
  const d = q.data;
  const history = useData<{ payload: string; stale: boolean }[]>(
    "/ai/forecast/history",
  );
  const fresh = history.data?.find((p) => !p.stale);
  const prediction = fresh
    ? (JSON.parse(fresh.payload) as Forecast)
    : undefined;
  return (
    <>
      <PageTitle
        title="Xin chào, chào mừng trở lại!"
        text="Một góc nhìn rõ ràng về tài chính của bạn hôm nay."
      >
        <input
          aria-label="Tháng thống kê"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        <Button
          onClick={() =>
            setEditor({
              title: "Thêm giao dịch",
              path: "/transactions",
              fields: transactionFields(wallets, categories),
            })
          }
        >
          <Plus size={17} />
          Thêm giao dịch
        </Button>
      </PageTitle>
      <Gate query={q}>
        {d && (
          <>
            <Metrics
              values={[
                {
                  label: "Tổng số dư khả dụng",
                  value: d.balance,
                  hint: "Tổng số dư các ví",
                },
                { label: "Thu nhập tháng", value: d.income },
                { label: "Chi tiêu tháng", value: d.expense },
                {
                  label: "Dòng tiền còn lại",
                  value: d.remaining,
                  hint: "Thu nhập trừ chi tiêu",
                },
              ]}
            />
            <div className="dashboard-grid">
              <section className="card cashflow">
                <div className="section-head">
                  <div>
                    <h2>Biến động thu chi</h2>
                    <p>Dòng tiền vào và ra trong tháng</p>
                  </div>
                  <span className="badge">{month}</span>
                </div>
                <CashflowChart data={d.daily} />
              </section>
              <section className="card distribution">
                <div className="section-head">
                  <div>
                    <h2>Chi tiêu theo danh mục</h2>
                    <p>Hiểu rõ tiền của bạn đi đâu</p>
                  </div>
                </div>
                {d.categories.length ? (
                  <CategoryChart data={d.categories} />
                ) : (
                  <Empty text="Chưa có chi tiêu trong tháng này." />
                )}
              </section>
            </div>
            <section className="ai-insights">
              <div className="section-head">
                <h2>
                  <Sparkles size={20} /> Phân tích tài chính AI
                </h2>
                <Link to="/forecast">
                  Khám phá dự báo <ArrowRight size={15} />
                </Link>
              </div>
              <div className="insight-grid">
                <div>
                  <span className="badge ai-badge">DỰ BÁO CHI TIÊU</span>
                  <h3>
                    {prediction?.status === "READY"
                      ? money(prediction.total)
                      : "Sẵn sàng khi đủ dữ liệu"}
                  </h3>
                  <p>
                    {prediction?.status === "READY"
                      ? "Tổng chi tiêu dự báo gần nhất từ " +
                        prediction.modelName
                      : "Tạo dự báo từ mô hình đã huấn luyện khi có ít nhất 60 ngày lịch sử."}
                  </p>
                  <Link to="/forecast">Xem dự báo →</Link>
                </div>
                <div>
                  <span className="badge warning-badge">
                    GIAO DỊCH CẦN KIỂM TRA
                  </span>
                  <h3>{d.openAlerts} cảnh báo chưa xử lý</h3>
                  <p>Cảnh báo giúp bạn rà soát chi tiêu khác thường.</p>
                  <Link to="/anomalies">Kiểm tra giao dịch →</Link>
                </div>
                <div>
                  <span className="badge">TIẾT KIỆM CỦA BẠN</span>
                  <h3>{money(d.reservedSavings)}</h3>
                  <p>
                    Đã dành riêng cho các mục tiêu. Tổng tài sản:{" "}
                    {money(d.netAssets)}.
                  </p>
                  <Link to="/savings">Theo dõi mục tiêu →</Link>
                </div>
              </div>
            </section>
            <div className="dashboard-grid">
              <section className="card cashflow">
                <div className="section-head">
                  <div>
                    <h2>Giao dịch gần đây</h2>
                    <p>Những khoản thu chi mới nhất</p>
                  </div>
                  <Link to="/transactions">
                    Xem tất cả <ArrowRight size={15} />
                  </Link>
                </div>
                <TransactionList
                  items={d.recent}
                  categories={categories}
                  wallets={wallets}
                />
              </section>
              <section className="card distribution">
                <div className="section-head">
                  <h2>Tiến độ ngân sách</h2>
                  <Link to="/budgets">Quản lý</Link>
                </div>
                {d.budgets.length ? (
                  <BudgetRows budgets={d.budgets} categories={categories} />
                ) : (
                  <Empty
                    title="Lập ngân sách đầu tiên"
                    text="Đặt giới hạn chi tiêu theo danh mục."
                  />
                )}
              </section>
            </div>
          </>
        )}
      </Gate>
      {editor && <Editor config={editor} onClose={() => setEditor(null)} />}
    </>
  );
}
export function TransactionsPage() {
  const [urlParams] = useSearchParams();
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [wallet, setWallet] = useState(urlParams.get("wallet") ?? ""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [sort, setSort] = useState("dateDesc"),
    [page, setPage] = useState(0);
  const { wallets, categories } = useFinanceOptions();
  const params = new URLSearchParams({
    search,
    sort,
    page: String(page),
    size: "15",
  });
  if (category) params.set("categoryId", category);
  if (wallet) params.set("walletId", wallet);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const q = useData<{ items: Transaction[]; total: number }>(
    "/transactions?" + params,
  );
  const [editor, setEditor] = useState<EditorConfig | null>(null);
  const [remove, setRemove] = useState<Transaction | null>(null);
  const [status, setStatus] = useState("");
  const action = useAction(() => setRemove(null));
  const cache = useQueryClient();
  const recurring =
    useData<
      { id: number; description: string; nextDate: string; enabled: boolean }[]
    >("/recurring");
  const edit = (t?: Transaction) =>
    setEditor({
      title: t ? "Chỉnh sửa giao dịch" : "Thêm giao dịch",
      path: "/transactions" + (t ? "/" + t.id : ""),
      method: t ? "PUT" : "POST",
      fields: transactionFields(wallets, categories, t),
    });
  const importCsv = async (file: File) => {
    setStatus("Đang nhập…");
    try {
      if (file.size > 2_000_000) throw new Error("CSV tối đa 2 MB");
      const fingerprint = Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
        ),
        (byte) => byte.toString(16).padStart(2, "0"),
      ).join("");
      const body = new FormData();
      body.append("file", file);
      const r = await api<{ imported: number }>("/reports/import-csv", {
        method: "POST",
        headers: { "Idempotency-Key": "csv:" + fingerprint },
        body,
      });
      setStatus(`Đã nhập ${r.imported} giao dịch.`);
      cache.invalidateQueries();
    } catch (e) {
      setStatus((e as Error).message);
    }
  };
  return (
    <>
      <PageTitle
        title="Quản lý giao dịch"
        text="Ghi nhận, tìm kiếm và quản lý mọi chuyển động của dòng tiền."
      >
        <Button
          variant="outline"
          onClick={() => download("xlsx").catch((e) => setStatus(e.message))}
        >
          <Download size={17} />
          Xuất Excel
        </Button>
        <label className="btn btn-outline">
          <Upload size={17} />
          Nhập CSV
          <input
            type="file"
            accept=".csv"
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.[0]) importCsv(e.target.files[0]);
              e.target.value = "";
            }}
          />
        </label>
        <Button onClick={() => edit()}>
          <Plus size={17} />
          Thêm giao dịch
        </Button>
      </PageTitle>
      {status && (
        <p role="status" className="notice">
          {status}
        </p>
      )}
      <section className="card">
        <div className="filters">
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="Tìm giao dịch"
              placeholder="Tìm nội dung giao dịch…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <select
            aria-label="Lọc danh mục"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Lọc ví"
            value={wallet}
            onChange={(e) => {
              setWallet(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Tất cả ví</option>
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            aria-label="Từ ngày"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(0);
            }}
          />
          <input
            type="date"
            aria-label="Đến ngày"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(0);
            }}
          />
          <select
            aria-label="Sắp xếp giao dịch"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="dateDesc">Mới nhất</option>
            <option value="dateAsc">Cũ nhất</option>
            <option value="amountDesc">Số tiền giảm dần</option>
            <option value="amountAsc">Số tiền tăng dần</option>
          </select>
        </div>
        <Gate query={q}>
          <TransactionList
            items={q.data?.items ?? []}
            wallets={wallets}
            categories={categories}
            onEdit={edit}
            onDelete={setRemove}
          />
          <div className="pagination">
            <span className="muted">
              {q.data?.total ?? 0} giao dịch · Trang {page + 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={(page + 1) * 15 >= (q.data?.total ?? 0)}
              onClick={() => setPage((p) => p + 1)}
            >
              Tiếp
            </Button>
          </div>
        </Gate>
      </section>
      <section className="card">
        <div className="section-head">
          <div>
            <h2>
              <Repeat2 size={18} /> Giao dịch định kỳ
            </h2>
            <p>Chu kỳ tính theo số ngày, được Backend thực hiện tự động.</p>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              setEditor({
                title: "Tạo giao dịch định kỳ",
                path: "/recurring",
                fields: [
                  ...transactionFields(wallets, categories).filter(
                    (f) => f.key !== "occurredAt",
                  ),
                  {
                    key: "nextDate",
                    label: "Ngày bắt đầu",
                    type: "date",
                    validate: dateSchema,
                  },
                  {
                    key: "intervalDays",
                    label: "Chu kỳ (ngày)",
                    type: "number",
                    default: 30,
                    validate: z.coerce.number().int().min(1).max(366),
                  },
                ],
              })
            }
          >
            <Plus size={16} />
            Thêm định kỳ
          </Button>
        </div>
        {recurring.data
          ?.filter((r) => r.enabled)
          .map((r) => (
            <div className="simple-row" key={r.id}>
              <span>
                {r.description} · Lần tới: {r.nextDate}
              </span>
              <Button
                variant="ghost"
                disabled={action.isPending}
                onClick={() =>
                  action.mutate({
                    path: "/recurring/" + r.id,
                    method: "DELETE",
                  })
                }
              >
                Dừng lặp
              </Button>
            </div>
          ))}
        {!recurring.data?.some((r) => r.enabled) && (
          <p className="muted">Chưa có lịch giao dịch định kỳ.</p>
        )}
        <small className="muted">
          CSV: walletId,categoryId,type,amount,description,occurredAt
          (YYYY-MM-DDTHH:mm:ss). Tối đa 1000 dòng, toàn bộ file được nhập trong
          một transaction.
        </small>
      </section>
      {editor && <Editor config={editor} onClose={() => setEditor(null)} />}
      <Modal
        title="Xóa giao dịch?"
        description="Số dư ví sẽ được hoàn lại theo giao dịch này."
        open={!!remove}
        onClose={() => setRemove(null)}
      >
        {action.error && (
          <p role="alert" className="danger">
            {action.error.message}
          </p>
        )}
        <div className="form-actions">
          <Button variant="outline" onClick={() => setRemove(null)}>
            Hủy
          </Button>
          <Button
            variant="danger"
            disabled={action.isPending}
            onClick={() =>
              action.mutate({
                path: "/transactions/" + remove?.id,
                method: "DELETE",
              })
            }
          >
            Xác nhận xóa
          </Button>
        </div>
      </Modal>
    </>
  );
}
export function WalletsPage() {
  const q = useData<Wallet[]>("/wallets");
  const [editor, setEditor] = useState<EditorConfig | null>(null);
  const [archive, setArchive] = useState<Wallet | null>(null);
  const action = useAction(() => setArchive(null));
  const types = [
    { value: "CASH", label: "Tiền mặt" },
    { value: "BANK", label: "Ngân hàng giả lập" },
    { value: "EWALLET", label: "Ví điện tử giả lập" },
    { value: "SAVINGS", label: "Tiết kiệm" },
  ];
  const active = q.data?.filter((w) => !w.archived) ?? [];
  const transfers = useData<
    {
      id: number;
      fromWalletId: number;
      toWalletId: number;
      amount: number;
      createdAt: string;
    }[]
  >("/transfers");
  const edit = (w?: Wallet) =>
    setEditor({
      title: w ? "Sửa thông tin ví" : "Tạo ví mới",
      path: "/wallets" + (w ? "/" + w.id : ""),
      method: w ? "PUT" : "POST",
      fields: [
        { key: "name", label: "Tên ví", default: w?.name, validate: text100 },
        {
          key: "type",
          label: "Loại ví",
          options: types,
          default: w?.type ?? "CASH",
        },
        {
          key: "initialBalance",
          label: w
            ? "Số dư mở đầu (không thay đổi số dư hiện tại)"
            : "Số dư mở đầu (VND)",
          default: "0",
          validate: z.string().regex(/^\d{1,15}(\.\d{1,2})?$/),
        },
      ],
    });
  return (
    <>
      <PageTitle
        title="Ví của tôi"
        text="Tất cả tài sản của bạn, trong một không gian."
      >
        <Button
          variant="outline"
          disabled={active.length < 2}
          onClick={() =>
            setEditor({
              title: "Chuyển tiền giữa các ví",
              path: "/transfers",
              fields: [
                {
                  key: "fromWalletId",
                  label: "Ví nguồn",
                  options: active.map((w) => ({
                    value: w.id,
                    label: w.name + " · " + money(w.balance),
                  })),
                  validate: choice,
                },
                {
                  key: "toWalletId",
                  label: "Ví đích",
                  options: active.map((w) => ({ value: w.id, label: w.name })),
                  validate: choice,
                },
                { key: "amount", label: "Số tiền (VND)", validate: monetary },
                { key: "note", label: "Ghi chú", default: "Chuyển ví nội bộ" },
              ],
            })
          }
        >
          <ArrowLeftRight size={17} />
          Chuyển tiền
        </Button>
        <Button onClick={() => edit()}>
          <Plus size={17} />
          Tạo ví
        </Button>
      </PageTitle>
      <div className="notice">
        <ShieldNote /> Chuyển tiền chỉ giữa các ví giả lập. Không kết nối hoặc
        chuyển tiền ngân hàng thật.
      </div>
      <Gate query={q}>
        <div className="wallet-grid">
          {active.map((w, i) => (
            <article
              className={`wallet-card ${i === 0 ? "featured-wallet" : "card"}`}
              key={w.id}
            >
              <div className="wallet-heading">
                <span className="wallet-symbol">
                  <WalletIcon size={24} />
                </span>
                <span className="badge">
                  {types.find((t) => t.value === w.type)?.label}
                </span>
              </div>
              <h2>{w.name}</h2>
              <p>Số dư khả dụng</p>
              <div className="wallet-value">{money(w.balance)}</div>
              <div className="wallet-actions">
                <Link to={"/transactions?wallet=" + w.id}>
                  Lịch sử <ArrowRight size={15} />
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={"Sửa ví " + w.name}
                  onClick={() => edit(w)}
                >
                  <Pencil size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={"Lưu trữ ví " + w.name}
                  onClick={() => setArchive(w)}
                >
                  <Archive size={16} />
                </Button>
              </div>
            </article>
          ))}
          <button className="add-wallet" onClick={() => edit()}>
            <Plus size={25} />
            <h3>Tạo ví mới</h3>
            <p>Thêm một nơi lưu giữ tài chính</p>
          </button>
        </div>
        <section className="card">
          <div className="section-head">
            <h2>Lịch sử chuyển ví</h2>
            <span className="badge">Không tính vào thu chi</span>
          </div>
          {transfers.data?.length ? (
            transfers.data.slice(0, 20).map((t) => (
              <div className="simple-row" key={t.id}>
                <div>
                  <b>
                    {q.data?.find((w) => w.id === t.fromWalletId)?.name} →{" "}
                    {q.data?.find((w) => w.id === t.toWalletId)?.name}
                  </b>
                  <small>{dateLabel(t.createdAt)}</small>
                </div>
                <b>{money(t.amount)}</b>
              </div>
            ))
          ) : (
            <Empty
              title="Chưa có lần chuyển ví"
              text="Các lần chuyển tiền nội bộ sẽ hiển thị tại đây."
            />
          )}
        </section>
      </Gate>
      {editor && <Editor config={editor} onClose={() => setEditor(null)} />}
      <Modal
        title="Lưu trữ ví?"
        description="Ví cần có số dư bằng 0 và không có lịch định kỳ đang bật. Lịch sử được giữ lại."
        open={!!archive}
        onClose={() => setArchive(null)}
      >
        {action.error && (
          <p role="alert" className="danger">
            {action.error.message}
          </p>
        )}
        <div className="form-actions">
          <Button variant="outline" onClick={() => setArchive(null)}>
            Hủy
          </Button>
          <Button
            disabled={action.isPending}
            onClick={() =>
              action.mutate({
                path: "/wallets/" + archive?.id,
                method: "DELETE",
              })
            }
          >
            Lưu trữ ví
          </Button>
        </div>
      </Modal>
    </>
  );
}
function ShieldNote() {
  return <Check size={17} />;
}
export function BudgetsPage() {
  const q = useData<Budget[]>("/budgets");
  const { categories } = useFinanceOptions();
  const [month, setMonth] = useState(monthNow());
  const [editor, setEditor] = useState<EditorConfig | null>(null);
  const [remove, setRemove] = useState<Budget | null>(null);
  const action = useAction(() => setRemove(null));
  const selected = q.data?.filter((b) => b.month === month) ?? [];
  const edit = (b?: Budget) =>
    setEditor({
      title: b ? "Sửa ngân sách" : "Tạo ngân sách tháng",
      path: "/budgets" + (b ? "/" + b.id : ""),
      method: b ? "PUT" : "POST",
      fields: [
        {
          key: "categoryId",
          label: "Danh mục",
          options: categories.map((c) => ({ value: c.id, label: c.name })),
          default: b?.categoryId,
          validate: choice,
        },
        {
          key: "month",
          label: "Tháng",
          type: "month",
          default: b?.month ?? month,
          validate: monthSchema,
        },
        {
          key: "amount",
          label: "Giới hạn (VND)",
          default: String(b?.amount ?? ""),
          validate: monetary,
        },
      ],
    });
  return (
    <>
      <PageTitle
        title="Quản lý ngân sách"
        text="Chi tiêu có chủ đích. Chủ động trước mỗi giới hạn."
      >
        <input
          type="month"
          aria-label="Tháng ngân sách"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        <Button onClick={() => edit()}>
          <Plus size={17} />
          Tạo ngân sách
        </Button>
      </PageTitle>
      <Gate query={q}>
        <Metrics
          values={[
            {
              label: "Tổng ngân sách",
              value: selected.reduce((s, b) => s + Number(b.amount), 0),
            },
            {
              label: "Đã sử dụng",
              value: selected.reduce((s, b) => s + Number(b.spent), 0),
            },
            {
              label: "Ngân sách còn lại",
              value: selected.reduce(
                (s, b) => s + Number(b.amount) - Number(b.spent),
                0,
              ),
            },
          ]}
        />
        <div className="notice">
          Thông báo tại mức 70%, cảnh báo 90% và vượt ngân sách 100%. Mỗi ngưỡng
          chỉ thông báo một lần.
        </div>
        <div className="cards-grid">
          {selected.map((b) => (
            <article className="card" key={b.id}>
              <div className="section-head">
                <h3>{categories.find((c) => c.id === b.categoryId)?.name}</h3>
                <div className="inline-actions">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Sửa ngân sách"
                    onClick={() => edit(b)}
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Xóa ngân sách"
                    onClick={() => setRemove(b)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
              <BudgetRows budgets={[b]} categories={categories} />
              <p className={b.percentage >= 100 ? "danger" : "muted"}>
                {b.percentage >= 100
                  ? "Đã vượt ngân sách"
                  : b.percentage >= 90
                    ? "Sắp chạm giới hạn"
                    : "Bạn đang theo dõi ngân sách này"}
              </p>
            </article>
          ))}
        </div>
        {!selected.length && (
          <section className="card">
            <Empty
              title="Chưa có ngân sách tháng này"
              text="Thêm giới hạn cho những danh mục bạn muốn kiểm soát."
            />
          </section>
        )}
        <section className="card">
          <h2>So sánh các tháng</h2>
          {Array.from(new Set(q.data?.map((b) => b.month)))
            .sort()
            .reverse()
            .slice(0, 12)
            .map((m) => (
              <div className="simple-row" key={m}>
                <b>{m}</b>
                <span>
                  Chi tiêu{" "}
                  {money(
                    q.data
                      ?.filter((b) => b.month === m)
                      .reduce((s, b) => s + Number(b.spent), 0),
                  )}{" "}
                  / ngân sách{" "}
                  {money(
                    q.data
                      ?.filter((b) => b.month === m)
                      .reduce((s, b) => s + Number(b.amount), 0),
                  )}
                </span>
              </div>
            ))}
          <Link to="/forecast" className="text-link">
            Dự báo chi tiêu để xem nguy cơ vượt ngân sách <Sparkles size={16} />
          </Link>
        </section>
      </Gate>
      {editor && <Editor config={editor} onClose={() => setEditor(null)} />}
      <Modal
        title="Xóa ngân sách?"
        open={!!remove}
        onClose={() => setRemove(null)}
      >
        <div className="form-actions">
          <Button variant="outline" onClick={() => setRemove(null)}>
            Hủy
          </Button>
          <Button
            variant="danger"
            disabled={action.isPending}
            onClick={() =>
              action.mutate({
                path: "/budgets/" + remove?.id,
                method: "DELETE",
              })
            }
          >
            Xác nhận xóa
          </Button>
        </div>
        {action.error && (
          <p className="danger" role="alert">
            {action.error.message}
          </p>
        )}
      </Modal>
    </>
  );
}
export function SavingsPage() {
  const [plan, setPlan] = useState<{
    status: string;
    message?: string;
    modelVersion?: string;
    estimatedAvailable?: number;
    suggestions?: {
      goalId: number;
      name: string;
      suggestedContribution: number;
      monthlyTarget: number;
    }[];
  }>();
  const [planError, setPlanError] = useState("");
  const [planning, setPlanning] = useState(false);
  async function planSavings() {
    setPlanning(true);
    setPlanError("");
    try {
      setPlan(await api("/ai/savings-plan", { method: "POST" }));
    } catch (e) {
      setPlanError((e as Error).message);
    } finally {
      setPlanning(false);
    }
  }
  const q = useData<Goal[]>("/savings");
  const { wallets } = useFinanceOptions();
  const [editor, setEditor] = useState<EditorConfig | null>(null);
  const [remove, setRemove] = useState<Goal | null>(null);
  const [detail, setDetail] = useState<Goal | null>(null);
  const action = useAction(() => setRemove(null));
  const edit = (g?: Goal) =>
    setEditor({
      title: g ? "Sửa mục tiêu" : "Tạo mục tiêu tiết kiệm",
      path: "/savings" + (g ? "/" + g.id : ""),
      method: g ? "PUT" : "POST",
      fields: [
        {
          key: "name",
          label: "Tên mục tiêu",
          default: g?.name,
          validate: text100,
        },
        {
          key: "targetAmount",
          label: "Số tiền mục tiêu (VND)",
          default: String(g?.targetAmount ?? ""),
          validate: monetary,
        },
        {
          key: "dueDate",
          label: "Ngày hoàn thành",
          type: "date",
          default: g?.dueDate,
          validate: dateSchema,
        },
      ],
    });
  return (
    <>
      <PageTitle
        title="Mục tiêu tiết kiệm"
        text="Biến những dự định lớn thành từng bước nhỏ mỗi ngày."
      >
        <Button variant="ai" disabled={planning} onClick={planSavings}>
          <Sparkles size={17} />
          {planning ? "Đang dự báo…" : "Gợi ý kế hoạch AI"}
        </Button>
        <Button onClick={() => edit()}>
          <Plus size={17} />
          Tạo mục tiêu
        </Button>
      </PageTitle>
      <Gate query={q}>
        <Metrics
          values={[
            {
              label: "Đã dành riêng",
              value: q.data?.reduce((s, g) => s + Number(g.saved), 0) ?? 0,
            },
            {
              label: "Tổng mục tiêu",
              value:
                q.data?.reduce((s, g) => s + Number(g.targetAmount), 0) ?? 0,
            },
            {
              label: "Cần đóng góp thêm",
              value:
                q.data?.reduce(
                  (s, g) =>
                    s + Math.max(0, Number(g.targetAmount) - Number(g.saved)),
                  0,
                ) ?? 0,
            },
          ]}
        />
        <div className="cards-grid">
          {q.data?.map((g) => (
            <article className="card goal-card" key={g.id}>
              <GoalSummary goal={g} />
              <p className="muted">
                Kế hoạch theo thời hạn: {money(g.monthlyPlan)}/tháng.
              </p>
              <div className="goal-actions">
                <Button
                  size="sm"
                  onClick={() =>
                    setEditor({
                      title: "Đóng góp cho " + g.name,
                      path: "/savings/" + g.id + "/contributions",
                      fields: [
                        {
                          key: "walletId",
                          label: "Ví trích tiền",
                          options: wallets
                            .filter((w) => !w.archived)
                            .map((w) => ({
                              value: w.id,
                              label: w.name + " · " + money(w.balance),
                            })),
                          validate: choice,
                        },
                        {
                          key: "amount",
                          label: "Số tiền đóng góp (VND)",
                          validate: monetary,
                        },
                        {
                          key: "note",
                          label: "Ghi chú",
                          default: "Đóng góp tiết kiệm",
                        },
                      ],
                    })
                  }
                >
                  <Plus size={15} />
                  Đóng góp
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDetail(g)}>
                  Lịch sử
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Sửa mục tiêu"
                  onClick={() => edit(g)}
                >
                  <Pencil size={15} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Xóa mục tiêu"
                  onClick={() => setRemove(g)}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            </article>
          ))}
        </div>
        {!q.data?.length && (
          <section className="card">
            <Empty
              title="Bạn đang hướng đến điều gì?"
              text="Tạo mục tiêu tiết kiệm cho những điều quan trọng với bạn."
            />
          </section>
        )}
        <section className="card">
          <h2>
            <Sparkles size={18} /> Kế hoạch dựa trên dự báo AI
          </h2>
          {planError && (
            <p className="danger" role="alert">
              {planError}
            </p>
          )}
          {plan?.status === "READY" ? (
            <>
              <p className="muted">
                Thu nhập 30 ngày gần nhất trừ dự báo chi tiêu từ{" "}
                {plan.modelVersion}. Có thể dành thêm khoảng{" "}
                {money(plan.estimatedAvailable)}. Số tiền phân bổ đều giữa các
                mục tiêu; bạn quyết định và xác nhận đóng góp.
              </p>
              {plan.suggestions?.map((s) => (
                <div className="simple-row" key={s.goalId}>
                  <b>{s.name}</b>
                  <span>
                    Gợi ý {money(s.suggestedContribution)} · Theo thời hạn{" "}
                    {money(s.monthlyTarget)}/tháng
                  </span>
                </div>
              ))}
            </>
          ) : (
            <p className="muted">
              {plan?.message ??
                "Chọn Gợi ý kế hoạch AI để tính từ lịch sử thu nhập và dự báo của mô hình. Không tự chuyển tiền."}
            </p>
          )}
        </section>
        <section className="notice">
          <Sparkles size={18} />
          <span>
            Kế hoạch theo thời hạn dùng phép tính số tiền còn thiếu / số tháng.{" "}
            <Link to="/forecast">Xem dự báo AI</Link> để cân nhắc khả năng đóng
            góp. Bạn luôn xác nhận trước khi trích tiền.
          </span>
        </section>
      </Gate>
      {editor && <Editor config={editor} onClose={() => setEditor(null)} />}
      <Modal
        title="Xóa mục tiêu?"
        description="Tất cả khoản đóng góp sẽ được hoàn lại đúng ví đã trích."
        open={!!remove}
        onClose={() => setRemove(null)}
      >
        <div className="form-actions">
          <Button variant="outline" onClick={() => setRemove(null)}>
            Hủy
          </Button>
          <Button
            variant="danger"
            disabled={action.isPending}
            onClick={() =>
              action.mutate({
                path: "/savings/" + remove?.id,
                method: "DELETE",
              })
            }
          >
            Xóa & hoàn tiền
          </Button>
        </div>
        {action.error && (
          <p role="alert" className="danger">
            {action.error.message}
          </p>
        )}
      </Modal>
      <Modal
        title={"Lịch sử đóng góp · " + (detail?.name ?? "")}
        open={!!detail}
        onClose={() => setDetail(null)}
      >
        {detail?.contributions.length ? (
          detail.contributions.map((c) => (
            <div key={c.id} className="simple-row">
              <div>
                <b>{c.note}</b>
                <small>{dateLabel(c.createdAt)}</small>
              </div>
              <b className="positive">{money(c.amount)}</b>
            </div>
          ))
        ) : (
          <Empty title="Chưa có đóng góp" />
        )}
      </Modal>
    </>
  );
}
