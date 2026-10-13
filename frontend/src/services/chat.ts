export interface ChatStatus {
  configured: boolean;
  provider: string;
  model: string;
  external: boolean;
  externalConsent: boolean;
  message?: string;
}
export interface ChatConversation {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}
export interface ChatMetadata {
  period?: string;
  retrievedAt?: string;
  sources?: { id?: string; label: string; url?: string }[];
  facts?: {
    id?: string;
    label: string;
    value: string;
    kind?: string;
    source?: string;
    nature?: string;
  }[];
  provider?: string;
  mlStatus?: {
    forecast?: { status?: string; historyLimited?: boolean };
    anomalies?: { status?: string; historyLimited?: boolean };
    status?: string;
    message?: string;
  };
}
export interface ChatMessage {
  id: number;
  conversationId: number;
  role: "USER" | "ASSISTANT" | "user" | "assistant";
  content: string;
  status: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";
  clientMessageId: string;
  modelVersion?: string;
  createdAt: string;
  metadata?: ChatMetadata | string;
  feedbackRating?: number;
}
export interface ChatPage<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}
export const chatQuestions = [
  "Tháng này tôi chi nhiều nhất vào đâu?",
  "Tôi còn bao nhiêu ngân sách?",
  "Tôi nên tiết kiệm bao nhiêu mỗi tháng?",
  "Dự báo chi tiêu 30 ngày tới",
  "Có giao dịch nào cần xem lại?",
];
export const chatFactNature: Record<string, string> = {
  ACTUAL: "Thực tế",
  FORECAST: "Dự báo",
  SCENARIO: "Kịch bản",
  REQUIREMENT: "Điều kiện mô hình",
};
export function formatChatFact(value: string | number, kind?: string) {
  const text = String(value).trim();
  if (kind === "money") {
    // DECIMAL values arrive as strings: do not pass money through JS Number.
    const decimal = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
    if (!decimal) return `${text} ₫`;
    const integer = decimal[2]
      .replace(/^0+(?=\d)/, "")
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const fraction =
      decimal[3] && !/^0+$/.test(decimal[3]) ? `,${decimal[3]}` : "";
    return `${decimal[1]}${integer}${fraction} ₫`;
  }
  if (kind === "percent") {
    return text.endsWith("%")
      ? text
      : `${text.replace(/^(-?\d+)\.(\d+)$/, "$1,$2")}%`;
  }
  return text;
}
export function readChatMetadata(value: ChatMessage["metadata"]): ChatMetadata {
  try {
    const parsed: unknown =
      typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as ChatMetadata)
      : {};
  } catch {
    return {};
  }
}
export function safeChatUrl(url: string | undefined, localOnly = false) {
  if (!url) return undefined;
  if (/^\/(?!\/)/.test(url) && !url.includes("\\")) return url;
  if (!localOnly && /^https?:\/\//i.test(url)) return url;
  return undefined;
}
