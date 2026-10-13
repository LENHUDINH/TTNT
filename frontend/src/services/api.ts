let csrfToken = "";
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export async function csrf() {
  const r = await fetch("/api/auth/csrf", { credentials: "include" });
  if (!r.ok) throw new ApiError(r.status, "Không thể tạo phiên bảo mật");
  const d = await r.json();
  csrfToken = d.token;
  return d;
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = options.method ?? "GET";
  if (method !== "GET" && !csrfToken) await csrf();
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (method !== "GET") headers.set("X-CSRF-TOKEN", csrfToken);
  const response = await fetch("/api" + path, {
    ...options,
    headers,
    credentials: "include",
  });
  if (!response.ok) {
    let message = "Không thể xử lý yêu cầu";
    try {
      const data = await response.json();
      message = Array.isArray(data.message)
        ? data.message.join(", ")
        : (data.message ?? message);
    } catch {}
    throw new ApiError(response.status, message);
  }
  if (response.status === 204 || response.headers.get("content-length") === "0")
    return undefined as T;
  const text = await response.text();
  return text ? JSON.parse(text) : (undefined as T);
}
export const jsonBody = (data: unknown) => JSON.stringify(data);
export const idempotency = () => ({ "Idempotency-Key": crypto.randomUUID() });
export async function download(format: "xlsx" | "pdf", month?: string) {
  const r = await fetch(
    `/api/reports/export?format=${format}${month ? "&month=" + month : ""}`,
    { credentials: "include" },
  );
  if (!r.ok) throw new ApiError(r.status, "Xuất báo cáo thất bại");
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `finsight-${month ?? "all"}.${format}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
