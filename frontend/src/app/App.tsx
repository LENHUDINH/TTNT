import { useState, useEffect, lazy, Suspense } from "react";
import {
  Routes,
  Route,
  Navigate,
  NavLink,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import {
  LayoutDashboard,
  ReceiptText,
  Wallet,
  ChartPie,
  PiggyBank,
  Sparkles,
  ShieldAlert,
  ChartNoAxesCombined,
  Settings,
  Bell,
  Sun,
  Moon,
  Menu,
  LogOut,
  ArrowUpRight,
  X,
  ChevronRight,
  MessagesSquare,
} from "lucide-react";
import { useData } from "../hooks/data";
import { api, jsonBody } from "../services/api";
import { Button } from "../components/ui/button";
import { Loading, ErrorState } from "../components/ui/states";
import { Auth } from "../pages/Auth";
const DashboardPage = lazy(() =>
  import("../pages/Finance").then((m) => ({ default: m.DashboardPage })),
);
const TransactionsPage = lazy(() =>
  import("../pages/Finance").then((m) => ({ default: m.TransactionsPage })),
);
const WalletsPage = lazy(() =>
  import("../pages/Finance").then((m) => ({ default: m.WalletsPage })),
);
const BudgetsPage = lazy(() =>
  import("../pages/Finance").then((m) => ({ default: m.BudgetsPage })),
);
const SavingsPage = lazy(() =>
  import("../pages/Finance").then((m) => ({ default: m.SavingsPage })),
);
const ForecastPage = lazy(() =>
  import("../pages/Intelligence").then((m) => ({ default: m.ForecastPage })),
);
const AnomaliesPage = lazy(() =>
  import("../pages/Intelligence").then((m) => ({ default: m.AnomaliesPage })),
);
const ReportsPage = lazy(() =>
  import("../pages/Intelligence").then((m) => ({ default: m.ReportsPage })),
);
const SettingsPage = lazy(() =>
  import("../pages/Settings").then((m) => ({ default: m.SettingsPage })),
);
const NotificationsPage = lazy(() =>
  import("../pages/Settings").then((m) => ({ default: m.NotificationsPage })),
);
const AiChatPage = lazy(() =>
  import("../pages/AiChat").then((m) => ({ default: m.AiChatPage })),
);
import type { User, Notice } from "../types";
const navigation = [
  { path: "/", name: "Tổng quan", icon: LayoutDashboard },
  { path: "/transactions", name: "Giao dịch", icon: ReceiptText },
  { path: "/wallets", name: "Ví của tôi", icon: Wallet },
  { path: "/budgets", name: "Ngân sách", icon: ChartPie },
  { path: "/savings", name: "Mục tiêu tiết kiệm", icon: PiggyBank },
  { path: "/forecast", name: "Dự báo AI", icon: Sparkles, ai: true },
  { path: "/ai-chat", name: "Chat tư vấn AI", icon: MessagesSquare, ai: true },
  { path: "/anomalies", name: "Giao dịch bất thường", icon: ShieldAlert },
  { path: "/reports", name: "Báo cáo", icon: ChartNoAxesCombined },
  { path: "/settings", name: "Cài đặt", icon: Settings },
];
function Protected() {
  const user = useData<User>("/auth/me");
  const location = useLocation();
  const nav = useNavigate();
  const cache = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false),
    [notice, setNotice] = useState("");
  const notifications = useData<Notice[]>("/notifications", !!user.data);
  const theme = user.data?.theme ?? "system";
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function apply() {
      document.documentElement.classList.toggle(
        "dark",
        theme === "dark" || (theme === "system" && media.matches),
      );
    }
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => setMobileOpen(false), [location.pathname]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handler = (e: Event) => {
      setNotice((e as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setNotice(""), 4500);
    };
    window.addEventListener("finsight-toast", handler);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("finsight-toast", handler);
    };
  }, []);
  async function changeTheme(t: User["theme"]) {
    if (!user.data) return;
    try {
      await api("/auth/profile", {
        method: "PUT",
        body: jsonBody({ name: user.data.name, theme: t }),
      });
      user.refetch();
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      cache.clear();
      nav("/login");
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  if (user.isPending) return <Loading />;
  if (user.error) {
    if ("status" in user.error && user.error.status === 401)
      return <Navigate to="/login" replace />;
    return <ErrorState error={user.error} retry={() => user.refetch()} />;
  }
  if (!user.data) return null;
  const u = user.data;
  const current = navigation.find((n) => n.path === location.pathname);
  const unread = notifications.data?.filter((n) => !n.readFlag).length ?? 0;
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Đi đến nội dung
      </a>
      {mobileOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Đóng menu"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={"sidebar " + (mobileOpen ? "mobile-open" : "")}>
        <Link to="/" className="brand">
          <span className="brand-icon">
            <ChartNoAxesCombined size={24} />
          </span>
          <span>
            FinSight <b>AI</b>
            <small>PRIVATE WEALTH</small>
          </span>
        </Link>
        <div className="nav-label">KHÔNG GIAN CỦA BẠN</div>
        <nav aria-label="Điều hướng chính">
          {navigation.map(({ path, name, icon: Icon, ai }) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/"}
              className={({ isActive }) =>
                "nav-item " + (isActive ? "active" : "")
              }
            >
              <Icon size={19} />
              <span>{name}</span>
              {ai && <small className="nav-ai">AI</small>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-insight">
            <span className="metric-icon tone-3">
              <Sparkles size={17} />
            </span>
            <b>
              Mỗi bước nhỏ,
              <br />
              một tương lai lớn.
            </b>
            <p>Hiểu dữ liệu để đưa ra quyết định sáng suốt.</p>
            <Link to="/forecast">
              Khám phá FinSight AI <ArrowUpRight size={16} />
            </Link>
          </div>
          <Button variant="ghost" className="logout" onClick={logout}>
            <LogOut size={17} />
            <span>Đăng xuất</span>
          </Button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <Button
            variant="ghost"
            size="icon"
            className="mobile-menu"
            aria-label="Mở menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            <Menu size={22} />
          </Button>
          <div className="breadcrumbs">
            <span>Trang chủ</span>
            <ChevronRight size={15} />
            <b>{current?.name ?? "Thông báo"}</b>
          </div>
          <div className="topbar-right">
            <time>
              {new Intl.DateTimeFormat("vi-VN", {
                day: "2-digit",
                month: "long",
                year: "numeric",
                timeZone: "Asia/Ho_Chi_Minh",
              }).format(new Date())}
            </time>
            <Link
              to="/notifications"
              className="icon-link"
              aria-label={`Thông báo, ${unread} chưa đọc`}
            >
              <Bell size={20} />
              {unread > 0 && <i />}
            </Link>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Chuyển giao diện sáng tối"
              onClick={() =>
                changeTheme(
                  document.documentElement.classList.contains("dark")
                    ? "light"
                    : "dark",
                )
              }
            >
              {document.documentElement.classList.contains("dark") ? (
                <Sun size={20} />
              ) : (
                <Moon size={20} />
              )}
            </Button>
            <span className="topbar-separator" />
            <Link to="/settings" className="profile-link">
              <span className="avatar">{u.name.charAt(0).toUpperCase()}</span>
              <span>
                <b>{u.name}</b>
                <small>Tài khoản cá nhân</small>
              </span>
            </Link>
          </div>
        </header>
        <main id="main-content" className="main-content" tabIndex={-1}>
          {notice && (
            <div className="toast" role="status">
              {notice}
              <button aria-label="Đóng thông báo" onClick={() => setNotice("")}>
                <X size={16} />
              </button>
            </div>
          )}
          <Suspense fallback={<Loading />}>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Routes>
                  <Route index element={<DashboardPage />} />
                  <Route path="transactions" element={<TransactionsPage />} />
                  <Route path="wallets" element={<WalletsPage />} />
                  <Route path="budgets" element={<BudgetsPage />} />
                  <Route path="savings" element={<SavingsPage />} />
                  <Route path="forecast" element={<ForecastPage />} />
                  <Route path="ai-chat" element={<AiChatPage />} />
                  <Route path="anomalies" element={<AnomaliesPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route
                    path="settings"
                    element={<SettingsPage user={u} onTheme={changeTheme} />}
                  />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </motion.div>
            </AnimatePresence>
          </Suspense>
          <footer className="main-footer">
            <span>FinSight AI · Quản lý tài chính có cơ sở</span>
            <span>Dữ liệu của bạn. Quyết định của bạn.</span>
          </footer>
        </main>
        <nav className="mobile-nav" aria-label="Điều hướng di động">
          {navigation.slice(0, 4).map(({ path, name, icon: Icon }) => (
            <NavLink end={path === "/"} key={path} to={path}>
              <Icon size={20} />
              <span>{name}</span>
            </NavLink>
          ))}
          <button onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
            <span>Thêm</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Routes>
        <Route path="login" element={<Auth />} />
        <Route path="register" element={<Auth mode="register" />} />
        <Route path="forgot" element={<Auth mode="forgot" />} />
        <Route path="reset" element={<Auth mode="reset" />} />
        <Route path="/*" element={<Protected />} />
      </Routes>
    </MotionConfig>
  );
}
