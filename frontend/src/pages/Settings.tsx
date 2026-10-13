import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  UserRound,
  ShieldCheck,
  Palette,
  Plus,
  Bell,
  CheckCheck,
  LogOut,
  Trash2,
} from "lucide-react";
import { PageTitle } from "./Finance";
import { Button } from "../components/ui/button";
import { Editor } from "../components/finance/editor";
import type { EditorConfig } from "../components/finance/editor";
import { Modal } from "../components/ui/dialog";
import { ChatPrivacyPreferences } from "../components/chat/privacy";
import { useData, useAction } from "../hooks/data";
import { api, jsonBody } from "../services/api";
import { Loading, Empty, ErrorState } from "../components/ui/states";
import { dateLabel } from "../utils/format";
import type { User, Category, Notice } from "../types";
export function SettingsPage({
  user,
  onTheme,
}: {
  user: User;
  onTheme: (theme: User["theme"]) => void;
}) {
  const [editor, setEditor] = useState<EditorConfig | null>(null);
  const categories = useData<Category[]>("/categories");
  const sessions =
    useData<
      { id: string; createdAt: number; lastAccess: number; current: boolean }[]
    >("/auth/sessions");
  const action = useAction();
  const nav = useNavigate();
  const cache = useQueryClient();
  const [remove, setRemove] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  async function deleteAccount() {
    setError("");
    try {
      await api("/auth/account", {
        method: "DELETE",
        body: jsonBody({ email: user.email, password }),
      });
      cache.clear();
      nav("/login");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <PageTitle
        title="Cài đặt tài khoản"
        text="Quản lý hồ sơ, bảo mật và trải nghiệm của bạn."
      />
      <div className="settings-grid">
        <section className="card">
          <h2>
            <UserRound size={19} />
            Hồ sơ cá nhân
          </h2>
          <div className="profile-block">
            <span className="avatar big-avatar">
              {user.name.charAt(0).toUpperCase()}
            </span>
            <div>
              <h3>{user.name}</h3>
              <p className="muted">{user.email}</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              setEditor({
                title: "Chỉnh sửa hồ sơ",
                path: "/auth/profile",
                method: "PUT",
                fields: [
                  {
                    key: "name",
                    label: "Họ và tên",
                    default: user.name,
                    validate: z.string().trim().min(2).max(100),
                  },
                  {
                    key: "theme",
                    label: "Giao diện",
                    default: user.theme,
                    options: [
                      { value: "light", label: "Sáng" },
                      { value: "dark", label: "Tối" },
                      { value: "system", label: "Theo hệ thống" },
                    ],
                  },
                ],
              })
            }
          >
            Chỉnh sửa hồ sơ
          </Button>
        </section>
        <section className="card">
          <h2>
            <Palette size={19} />
            Giao diện
          </h2>
          <p className="muted">
            Màu sắc và phông chữ theo thiết kế Google Stitch.
          </p>
          <div className="theme-options">
            {(["light", "dark", "system"] as const).map((t, i) => (
              <Button
                key={t}
                variant={user.theme === t ? "default" : "outline"}
                onClick={() => onTheme(t)}
              >
                {["Sáng", "Tối", "Hệ thống"][i]}
              </Button>
            ))}
          </div>
        </section>
        <section className="card">
          <h2>
            <ShieldCheck size={19} />
            Bảo mật
          </h2>
          <p className="muted">
            Mật khẩu được băm BCrypt. Thay đổi mật khẩu sẽ đăng xuất các phiên
            khác.
          </p>
          <Button
            variant="outline"
            onClick={() =>
              setEditor({
                title: "Đổi mật khẩu",
                path: "/auth/password",
                fields: [
                  {
                    key: "currentPassword",
                    label: "Mật khẩu hiện tại",
                    type: "password",
                  },
                  {
                    key: "newPassword",
                    label: "Mật khẩu mới",
                    type: "password",
                    validate: z.string().min(10).max(72),
                  },
                ],
              })
            }
          >
            Đổi mật khẩu
          </Button>
          <h3 className="space-top">Phiên đăng nhập</h3>
          {sessions.data?.map((s) => (
            <div className="simple-row" key={s.id}>
              <div>
                <b>{s.current ? "Phiên hiện tại" : "Phiên đăng nhập khác"}</b>
                <small>{new Date(s.lastAccess).toLocaleString("vi-VN")}</small>
              </div>
              {!s.current && (
                <Button
                  variant="ghost"
                  onClick={() =>
                    action.mutate({
                      path: "/auth/sessions/" + s.id,
                      method: "DELETE",
                    })
                  }
                >
                  <LogOut size={16} />
                  Thu hồi
                </Button>
              )}
            </div>
          ))}
        </section>
        <section className="card">
          <div className="section-head">
            <h2>Danh mục của bạn</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setEditor({
                  title: "Tạo danh mục",
                  path: "/categories",
                  fields: [
                    {
                      key: "name",
                      label: "Tên danh mục",
                      validate: z.string().trim().min(1).max(100),
                    },
                  ],
                })
              }
            >
              <Plus size={16} />
              Thêm
            </Button>
          </div>
          <div className="category-chips">
            {categories.data?.map((c) => (
              <span className="badge" key={c.id}>
                {c.name}
              </span>
            ))}
          </div>
        </section>
        <section className="card">
          <h2>
            <ShieldCheck size={19} /> AI tư vấn
          </h2>
          <ChatPrivacyPreferences always />
        </section>
        <section className="card danger-zone">
          <h2>
            <Trash2 size={19} />
            Xóa tài khoản
          </h2>
          <p>
            Toàn bộ dữ liệu tài chính, hội thoại AI và đánh giá của tài khoản sẽ
            bị xóa vĩnh viễn.
          </p>
          <Button variant="danger" onClick={() => setRemove(true)}>
            Xóa tài khoản
          </Button>
        </section>
      </div>
      {action.error && <ErrorState error={action.error} />}{" "}
      {editor && <Editor config={editor} onClose={() => setEditor(null)} />}
      <Modal
        title="Xóa vĩnh viễn tài khoản?"
        description="Nhập mật khẩu để xác nhận. Hành động này không thể hoàn tác."
        open={remove}
        onClose={() => setRemove(false)}
      >
        <label className="field">
          <span>Mật khẩu xác nhận</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="danger">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button variant="outline" onClick={() => setRemove(false)}>
            Hủy
          </Button>
          <Button variant="danger" disabled={!password} onClick={deleteAccount}>
            Xác nhận xóa tài khoản
          </Button>
        </div>
      </Modal>
    </>
  );
}
export function NotificationsPage() {
  const q = useData<Notice[]>("/notifications");
  const [unread, setUnread] = useState(false);
  const action = useAction();
  const rows = q.data?.filter((n) => !unread || !n.readFlag) ?? [];
  return (
    <>
      <PageTitle
        title="Trung tâm thông báo"
        text="Những cập nhật giúp bạn giữ tài chính trong tầm kiểm soát."
      >
        <Button
          variant="outline"
          disabled={action.isPending}
          onClick={() => action.mutate({ path: "/notifications/read-all" })}
        >
          <CheckCheck size={17} />
          Đánh dấu tất cả đã đọc
        </Button>
      </PageTitle>
      <section className="card">
        <div className="section-head">
          <h2>
            <Bell size={19} />
            Thông báo của bạn
          </h2>
          <Button
            variant={unread ? "default" : "outline"}
            onClick={() => setUnread((v) => !v)}
          >
            {unread ? "Chưa đọc" : "Tất cả"}
          </Button>
        </div>
        {q.isPending ? (
          <Loading />
        ) : q.error ? (
          <ErrorState error={q.error} />
        ) : rows.length ? (
          rows.map((n) => (
            <div
              className={"notification-row " + (!n.readFlag ? "unread" : "")}
              key={n.id}
            >
              <span className="metric-icon tone-3">
                <Bell size={18} />
              </span>
              <div>
                <b>{n.message}</b>
                <small>{dateLabel(n.createdAt)}</small>
              </div>
              {!n.readFlag && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    action.mutate({
                      path: "/notifications/" + n.id + "/read",
                      method: "PATCH",
                    })
                  }
                >
                  Đã đọc
                </Button>
              )}
            </div>
          ))
        ) : (
          <Empty
            title="Bạn đã xem hết thông báo"
            text="Các cảnh báo ngân sách và AI mới sẽ hiển thị tại đây."
          />
        )}
        {action.error && <ErrorState error={action.error} />}
      </section>
    </>
  );
}
