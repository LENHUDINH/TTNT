import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, LoaderCircle } from "lucide-react";
import { api, jsonBody } from "../../services/api";
import type { ChatStatus } from "../../services/chat";

export function ChatPrivacyPreferences({
  always = false,
}: {
  always?: boolean;
}) {
  const cache = useQueryClient();
  const status = useQuery({
    queryKey: ["/chat/status"],
    queryFn: () => api<ChatStatus>("/chat/status"),
    retry: 1,
  });
  const preferences = useQuery({
    queryKey: ["/chat/preferences"],
    queryFn: () => api<{ externalConsent: boolean }>("/chat/preferences"),
    enabled: Boolean(status.data?.external),
    retry: 1,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function change(consent: boolean) {
    setPending(true);
    setError("");
    try {
      const result = await api<{ externalConsent: boolean }>(
        "/chat/preferences",
        {
          method: "PUT",
          body: jsonBody({ externalConsent: consent }),
        },
      );
      cache.setQueryData(["/chat/preferences"], result);
      await cache.invalidateQueries({ queryKey: ["/chat/status"] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  if (!always && !status.data?.external) return null;
  return (
    <div className="chat-privacy">
      <h3>
        <ShieldCheck size={18} /> Quyền riêng tư khi chat
      </h3>
      <p>
        Hội thoại thuộc tài khoản của bạn. Nội dung chat và dữ liệu tài chính
        không được tự động dùng để huấn luyện mô hình.
      </p>
      {status.isPending ? (
        <p role="status">
          <LoaderCircle size={16} className="spin" /> Đang kiểm tra cấu hình…
        </p>
      ) : status.error ? (
        <p role="alert">
          Không thể kiểm tra cấu hình chat: {status.error.message}
        </p>
      ) : status.data?.external ? (
        <>
          <p>
            Nhà cung cấp hiện tại: <b>{status.data.provider}</b>. Nếu bạn đồng
            ý, câu hỏi, phần lịch sử hội thoại cần thiết và dữ liệu tài chính
            tổng hợp sẽ được gửi đến dịch vụ bên ngoài để tạo phản hồi. Không
            gửi mật khẩu hoặc khóa dịch vụ. Bạn có thể tắt lựa chọn này bất cứ
            lúc nào.
          </p>
          <label className="chat-consent">
            <input
              type="checkbox"
              checked={preferences.data?.externalConsent ?? false}
              disabled={
                pending || preferences.isPending || Boolean(preferences.error)
              }
              onChange={(e) => void change(e.target.checked)}
            />
            <span>Tôi đồng ý gửi dữ liệu cần thiết đến AI bên ngoài</span>
          </label>
          {pending && <p role="status">Đang lưu lựa chọn…</p>}
          {preferences.error && <p role="alert">{preferences.error.message}</p>}
        </>
      ) : (
        <p>
          AI hội thoại sử dụng máy chủ nội bộ. Cấu hình hiện tại không gửi dữ
          liệu đến nhà cung cấp AI bên ngoài.
        </p>
      )}
      {error && (
        <p className="danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
