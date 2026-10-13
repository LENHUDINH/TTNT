import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  ShieldCheck,
  ChartNoAxesCombined,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { api, csrf, jsonBody } from "../services/api";
export function Auth({
  mode = "login",
}: {
  mode?: "login" | "register" | "forgot" | "reset";
}) {
  const register = mode === "register",
    forgot = mode === "forgot",
    reset = mode === "reset";
  const nav = useNavigate();
  const cache = useQueryClient();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState(false);
  const shape: Record<string, z.ZodType> = {};
  if (!reset) shape.email = z.email("Email không hợp lệ");
  if (!forgot)
    shape.password = z
      .string()
      .min(register || reset ? 10 : 1, "Mật khẩu cần ít nhất 10 ký tự")
      .max(72);
  if (register)
    shape.name = z.string().trim().min(2, "Nhập tên của bạn").max(100);
  if (reset) shape.token = z.string().min(10, "Nhập mã khôi phục");
  const schema = z.object(shape);
  const form = useForm<Record<string, string>>({
    resolver: zodResolver(schema) as never,
  });
  const onSubmit = async (data: Record<string, string>) => {
    setPending(true);
    setError("");
    try {
      await csrf();
      if (register) {
        await api("/auth/register", { method: "POST", body: jsonBody(data) });
        await api("/auth/login", { method: "POST", body: jsonBody(data) });
      } else if (forgot) {
        const r = await api<{ message: string }>("/auth/forgot", {
          method: "POST",
          body: jsonBody(data),
        });
        setSuccess(r.message);
        return;
      } else if (reset) {
        await api("/auth/reset", {
          method: "POST",
          body: jsonBody({ token: data.token, password: data.password }),
        });
        setSuccess("Mật khẩu đã được cập nhật. Bạn có thể đăng nhập.");
        return;
      } else await api("/auth/login", { method: "POST", body: jsonBody(data) });
      await csrf();
      cache.clear();
      nav("/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };
  const title = register
    ? "Bắt đầu hành trình thịnh vượng"
    : forgot
      ? "Khôi phục mật khẩu"
      : reset
        ? "Đặt mật khẩu mới"
        : "Chào mừng bạn trở lại";
  return (
    <div className="auth-page">
      <section className="auth-story">
        <Link className="brand" to="/login">
          <span className="brand-icon">
            <ChartNoAxesCombined />
          </span>
          <span>
            FinSight <b>AI</b>
            <small>INTELLIGENT WEALTH</small>
          </span>
        </Link>
        <div className="auth-copy">
          <span className="eyebrow">
            <Sparkles size={16} /> TÀI CHÍNH THÔNG MINH, CUỘC SỐNG TỰ DO
          </span>
          <h1>
            Hiểu dòng tiền.
            <br />
            <em>Làm chủ tương lai.</em>
          </h1>
          <p>
            Một góc nhìn rõ ràng về tài chính của bạn.
            <br />
            Từ những khoản chi nhỏ đến các mục tiêu lớn.
          </p>
          <div className="auth-visual">
            <div className="visual-line" />
            <span>
              <ArrowUpRight size={25} /> Mỗi quyết định đều có cơ sở
            </span>
            <p>Quản lý thu chi · Lập ngân sách · Dự báo AI</p>
          </div>
          <div className="trust">
            <ShieldCheck size={18} /> Dữ liệu riêng tư theo tài khoản
          </div>
        </div>
        <small>
          © 2026 FinSight AI. Nền tảng nghiên cứu tài chính cá nhân.
        </small>
      </section>
      <main className="auth-main">
        <div className="auth-form">
          <span className="eyebrow">KHÔNG GIAN TÀI CHÍNH CỦA BẠN</span>
          <h2>{title}</h2>
          <p className="muted">
            {register
              ? "Tạo tài khoản để quản lý tài chính theo cách của bạn."
              : forgot
                ? "Nhập email đã đăng ký để yêu cầu mã khôi phục."
                : "Tiếp tục xây dựng tương lai tài chính vững vàng."}
          </p>
          {success ? (
            <div className="success-message">
              <CheckCircle2 />
              {success}
              <Link to="/login">Đăng nhập</Link>
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)}>
              {register && (
                <label className="field">
                  <span>Họ và tên</span>
                  <input autoComplete="name" {...form.register("name")} />
                  {form.formState.errors.name && (
                    <small role="alert" className="danger">
                      {String(form.formState.errors.name.message)}
                    </small>
                  )}
                </label>
              )}
              {!reset && (
                <label className="field">
                  <span>Email</span>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="ban@example.com"
                    {...form.register("email")}
                  />
                  {form.formState.errors.email && (
                    <small role="alert" className="danger">
                      {String(form.formState.errors.email.message)}
                    </small>
                  )}
                </label>
              )}
              {reset && (
                <label className="field">
                  <span>Mã khôi phục</span>
                  <input {...form.register("token")} />
                </label>
              )}
              {!forgot && (
                <label className="field">
                  <span>Mật khẩu</span>
                  <input
                    type="password"
                    autoComplete={
                      register || reset ? "new-password" : "current-password"
                    }
                    {...form.register("password")}
                  />
                  {form.formState.errors.password && (
                    <small role="alert" className="danger">
                      {String(form.formState.errors.password.message)}
                    </small>
                  )}
                </label>
              )}
              {mode === "login" && (
                <Link className="forgot-link" to="/forgot">
                  Quên mật khẩu?
                </Link>
              )}
              {error && (
                <p role="alert" className="danger">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={pending} className="full">
                {pending
                  ? "Đang xử lý…"
                  : register
                    ? "Tạo tài khoản"
                    : forgot
                      ? "Gửi yêu cầu khôi phục"
                      : reset
                        ? "Cập nhật mật khẩu"
                        : "Đăng nhập"}
                <ArrowUpRight size={18} />
              </Button>
            </form>
          )}
          <div className="auth-switch">
            {register ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
            <Link to={register ? "/login" : "/register"}>
              {register ? "Đăng nhập" : "Đăng ký miễn phí"}
            </Link>
          </div>
          {forgot && <Link to="/reset">Tôi đã có mã khôi phục</Link>}
          <div className="auth-security">
            <ShieldCheck size={14} /> Phiên đăng nhập được bảo vệ bằng cookie
            HttpOnly.
          </div>
        </div>
      </main>
    </div>
  );
}
