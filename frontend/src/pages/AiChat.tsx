import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import ReactMarkdown from "react-markdown";
import {
  Sparkles,
  MessageSquarePlus,
  Search,
  MessagesSquare,
  PanelLeft,
  Pencil,
  Trash2,
  Send,
  Square,
  RefreshCw,
  LoaderCircle,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  ChevronLeft,
  ChevronRight,
  X,
  UserRound,
  Database,
  ArrowUpRight,
  CalendarDays,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Modal } from "../components/ui/dialog";
import { ErrorState } from "../components/ui/states";
import { ChatPrivacyPreferences } from "../components/chat/privacy";
import { PageTitle } from "./Finance";
import { api, jsonBody } from "../services/api";
import {
  chatQuestions,
  chatFactNature,
  formatChatFact,
  readChatMetadata,
  safeChatUrl,
  type ChatStatus,
  type ChatConversation,
  type ChatMessage,
  type ChatPage,
} from "../services/chat";
import { monthNow } from "../utils/format";

const conversationSize = 15;
const messageSize = 40;
interface SendRequest {
  conversationId: number;
  content: string;
  clientMessageId: string;
  month: string;
}
interface ActiveRequest extends SendRequest {
  controller: AbortController;
}
export function timestamp(value: string) {
  const localized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(
    value,
  )
    ? `${value}+07:00`
    : value;
  const date = new Date(localized);
  return Number.isNaN(date.valueOf())
    ? ""
    : new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(date);
}
function isAssistant(message: ChatMessage) {
  return message.role.toUpperCase() === "ASSISTANT";
}

export function ChatMessageContent({ message }: { message: ChatMessage }) {
  const metadata = readChatMetadata(message.metadata);
  const facts = Array.isArray(metadata.facts) ? metadata.facts : [];
  const sources = Array.isArray(metadata.sources) ? metadata.sources : [];
  const mlResponse = Boolean(
    metadata.mlStatus?.forecast || metadata.mlStatus?.anomalies,
  );
  const limitedHistory =
    metadata.mlStatus?.forecast?.historyLimited === true ||
    metadata.mlStatus?.anomalies?.historyLimited === true;
  return (
    <>
      <div className="chat-markdown">
        <ReactMarkdown
          skipHtml
          components={{
            a: ({ href, children }) => {
              const url = safeChatUrl(href);
              return url ? (
                <a
                  href={url}
                  target={url.startsWith("http") ? "_blank" : undefined}
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              ) : (
                <span>{children}</span>
              );
            },
            img: ({ alt }) => <span>{alt ?? ""}</span>,
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
      {isAssistant(message) && facts.length > 0 && (
        <dl className="chat-facts" aria-label="Số liệu được truy xuất">
          {facts
            .filter(
              (fact) =>
                fact &&
                typeof fact.label === "string" &&
                (typeof fact.value === "string" ||
                  typeof fact.value === "number"),
            )
            .map((fact, index) => (
              <div key={fact.id ?? index}>
                <dt>{fact.label}</dt>
                <dd>
                  <span>{formatChatFact(fact.value, fact.kind)}</span>
                  {fact.nature && chatFactNature[fact.nature] && (
                    <small>{chatFactNature[fact.nature]}</small>
                  )}
                </dd>
              </div>
            ))}
        </dl>
      )}
      {isAssistant(message) && mlResponse && (
        <p className="metric-note">
          {limitedHistory && (
            <>
              Chat phân tích phần lịch sử gần nhất. Mở màn hình AI để xem phân
              tích đầy đủ.{" "}
            </>
          )}
          Mô hình tài chính được đánh giá trên dữ liệu tổng hợp; kết quả cần
          được xem cùng dữ liệu thực tế của bạn.
        </p>
      )}
      {isAssistant(message) &&
        (metadata.period || metadata.retrievedAt || sources.length > 0) && (
          <details className="chat-sources">
            <summary>
              <Database size={13} /> Nguồn dữ liệu
              {metadata.period ? ` · ${metadata.period}` : ""}
            </summary>
            {metadata.retrievedAt && (
              <p>
                Truy xuất:{" "}
                <time dateTime={metadata.retrievedAt}>
                  {timestamp(metadata.retrievedAt)}
                </time>{" "}
                (giờ Việt Nam)
              </p>
            )}
            <ul>
              {sources
                .filter((source) => typeof source.label === "string")
                .map((source, index) => {
                  const url = safeChatUrl(source.url, true);
                  return (
                    <li key={source.id ?? index}>
                      {url ? (
                        <a href={url}>
                          {source.label} <ArrowUpRight size={12} />
                        </a>
                      ) : (
                        source.label
                      )}
                    </li>
                  );
                })}
            </ul>
          </details>
        )}
    </>
  );
}

export function AiChatPage() {
  const cache = useQueryClient();
  const [params, setParams] = useSearchParams();
  const rawId = params.get("id") ?? "";
  const conversationId =
    /^\d+$/.test(rawId) && Number(rawId) > 0 ? Number(rawId) : null;
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [conversationPage, setConversationPage] = useState(0);
  const [messagePage, setMessagePage] = useState(0);
  const [drawer, setDrawer] = useState(false);
  const [month, setMonth] = useState(monthNow());
  const [content, setContent] = useState("");
  const [pending, setPending] = useState<SendRequest | null>(null);
  const [failed, setFailed] = useState<SendRequest | null>(null);
  const [sendError, setSendError] = useState("");
  const [notice, setNotice] = useState("");
  const [stopping, setStopping] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [action, setAction] = useState<"create" | "rename" | "delete" | null>(
    null,
  );
  const [title, setTitle] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState("");
  const [feedback, setFeedback] = useState<Record<number, number>>({});
  const [feedbackPending, setFeedbackPending] = useState<number | null>(null);
  const active = useRef<ActiveRequest | null>(null);
  const requestBusy = useRef(false);
  const openedConversation = useRef<number | null>(null);
  const mounted = useRef(true);
  const bottom = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setConversationPage(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    setMessagePage(0);
    openedConversation.current = null;
    setSendError("");
    setFailed(null);
    setContent("");
  }, [conversationId]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const request = active.current;
      if (request) {
        request.controller.abort();
        void api(`/chat/conversations/${request.conversationId}/cancel`, {
          method: "POST",
          body: jsonBody({ clientMessageId: request.clientMessageId }),
        }).catch(() => {});
      }
    };
  }, []);
  const status = useQuery({
    queryKey: ["/chat/status"],
    queryFn: ({ signal }) => api<ChatStatus>("/chat/status", { signal }),
    retry: 1,
  });
  const conversations = useQuery({
    queryKey: ["chat-conversations", debouncedSearch, conversationPage],
    queryFn: ({ signal }) =>
      api<ChatPage<ChatConversation>>(
        `/chat/conversations?search=${encodeURIComponent(debouncedSearch)}&page=${conversationPage}&size=${conversationSize}`,
        { signal },
      ),
    retry: 1,
  });
  const messages = useQuery({
    queryKey: ["chat-messages", conversationId, messagePage],
    queryFn: ({ signal }) =>
      api<ChatPage<ChatMessage>>(
        `/chat/conversations/${conversationId}/messages?page=${messagePage}&size=${messageSize}`,
        { signal },
      ),
    enabled: conversationId !== null,
    retry: 1,
    refetchInterval: (query) =>
      query.state.data?.items.some((message) => message.status === "PENDING")
        ? 1800
        : false,
  });
  const selected = conversations.data?.items.find(
    (item) => item.id === conversationId,
  );
  const items = messages.data?.items ?? [];
  const optimistic =
    pending &&
    pending.conversationId === conversationId &&
    !items.some(
      (message) =>
        !isAssistant(message) &&
        message.clientMessageId === pending.clientMessageId,
    );
  const configured = Boolean(status.data?.configured);
  const consent = !status.data?.external || status.data.externalConsent;
  const canSend =
    configured &&
    consent &&
    !pending &&
    !status.isPending &&
    !status.error &&
    !messages.error;
  useEffect(() => {
    if (
      conversationId &&
      messages.data &&
      openedConversation.current !== conversationId
    ) {
      openedConversation.current = conversationId;
      setMessagePage(
        Math.max(0, Math.ceil(messages.data.total / messageSize) - 1),
      );
    }
  }, [conversationId, messages.data]);
  useEffect(() => {
    if (typeof bottom.current?.scrollIntoView === "function")
      bottom.current.scrollIntoView({ block: "nearest" });
  }, [items.length, pending?.clientMessageId, conversationId, messagePage]);
  async function refreshHistory() {
    await cache.invalidateQueries({ queryKey: ["chat-conversations"] });
    await cache.invalidateQueries({ queryKey: ["chat-messages"] });
  }
  function select(id: number) {
    setParams({ id: String(id) });
    setDrawer(false);
    setNotice("");
  }
  function openAction(next: "create" | "rename" | "delete") {
    setAction(next);
    setTitle(next === "rename" ? (selected?.title ?? "") : "");
    setActionError("");
  }
  async function saveAction(event: FormEvent) {
    event.preventDefault();
    setActionPending(true);
    setActionError("");
    try {
      if (action === "create") {
        const result = await api<ChatConversation>("/chat/conversations", {
          method: "POST",
          body: jsonBody({ title: title.trim() || undefined }),
        });
        setSearch("");
        setConversationPage(0);
        select(result.id);
      } else if (action === "rename" && conversationId) {
        await api(`/chat/conversations/${conversationId}`, {
          method: "PATCH",
          body: jsonBody({ title: title.trim() }),
        });
      } else if (action === "delete" && conversationId) {
        await api(`/chat/conversations/${conversationId}`, {
          method: "DELETE",
        });
        cache.removeQueries({ queryKey: ["chat-messages", conversationId] });
        setParams({});
        setNotice("Hội thoại đã được xóa.");
        setConversationPage(0);
      }
      await refreshHistory();
      setAction(null);
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setActionPending(false);
    }
  }
  async function send(request?: SendRequest) {
    if (requestBusy.current || active.current || !configured || !consent)
      return;
    let targetId = request?.conversationId ?? conversationId;
    const text = request?.content ?? content.trim();
    if (!text || text.length > 2000) return;
    requestBusy.current = true;
    setSendError("");
    setNotice("");
    setFailed(null);
    const controller = new AbortController();
    let current: SendRequest | undefined;
    try {
      if (!targetId) {
        // The send request waits for its own conversation to exist before posting.
        setActionPending(true);
        const created = await api<ChatConversation>("/chat/conversations", {
          method: "POST",
          body: jsonBody({}),
        });
        targetId = created.id;
        select(created.id);
      }
      current = request ?? {
        conversationId: targetId,
        content: text,
        clientMessageId: crypto.randomUUID(),
        month,
      };
      active.current = { ...current, controller };
      setPending(current);
      setContent("");
      const response = await api<ChatMessage>(
        `/chat/conversations/${targetId}/messages`,
        {
          method: "POST",
          signal: controller.signal,
          body: jsonBody({
            content: current.content,
            clientMessageId: current.clientMessageId,
            month: current.month,
          }),
        },
      );
      if (controller.signal.aborted || !mounted.current) return;
      // Jump to the page containing the newly persisted response after long histories.
      const first = await api<ChatPage<ChatMessage>>(
        `/chat/conversations/${targetId}/messages?page=0&size=${messageSize}`,
      );
      const lastPage = Math.max(0, Math.ceil(first.total / messageSize) - 1);
      cache.setQueryData(["chat-messages", targetId, 0], first);
      setMessagePage(lastPage);
      if (response.status === "FAILED") {
        setFailed(current);
        setSendError(
          response.content || "AI chưa trả lời được. Bạn có thể thử lại.",
        );
      }
      if (response.status === "CANCELLED") setNotice("Đã dừng phản hồi.");
      await refreshHistory();
    } catch (e) {
      if (!mounted.current || controller.signal.aborted) return;
      if (current) setFailed(current);
      setSendError(
        (e as Error).message || "Không thể gửi câu hỏi. Hãy thử lại.",
      );
      await refreshHistory();
    } finally {
      const ownsRequest = active.current?.controller === controller;
      if (ownsRequest) active.current = null;
      if (ownsRequest || !active.current) {
        requestBusy.current = false;
        if (mounted.current) {
          setPending(null);
          setStopping(false);
          setActionPending(false);
        }
      }
    }
  }
  async function stop() {
    const request = active.current;
    if (!request || stopping) return;
    setStopping(true);
    try {
      const deadline = Date.now() + 3000;
      let cancelled: ChatMessage;
      for (;;) {
        try {
          cancelled = await api<ChatMessage>(
            `/chat/conversations/${request.conversationId}/cancel`,
            {
              method: "POST",
              body: jsonBody({ clientMessageId: request.clientMessageId }),
            },
          );
          break;
        } catch (e) {
          // On a fresh page, CSRF initialization may precede the message insert.
          // Wait briefly for that insert; only abort once cancellation is saved.
          if (
            e &&
            typeof e === "object" &&
            "status" in e &&
            e.status === 404 &&
            Date.now() < deadline
          ) {
            if (active.current !== request) {
              request.controller.abort();
              await refreshHistory();
              return;
            }
            await new Promise((resolve) => setTimeout(resolve, 200));
            continue;
          }
          throw e;
        }
      }
      request.controller.abort();
      active.current = null;
      setPending(null);
      setFailed(null);
      setSendError("");
      setNotice(
        cancelled.status === "CANCELLED"
          ? "Đã dừng phản hồi. Câu hỏi vẫn được lưu trong hội thoại."
          : "Phản hồi đã kết thúc trước khi dừng.",
      );
      await refreshHistory();
    } catch (e) {
      setSendError(`Không thể dừng: ${(e as Error).message}`);
    } finally {
      setStopping(false);
    }
  }
  async function rate(id: number, rating: number) {
    setFeedbackPending(id);
    setNotice("");
    try {
      await api(`/chat/messages/${id}/feedback`, {
        method: "POST",
        body: jsonBody({ rating }),
      });
      setFeedback((previous) => ({ ...previous, [id]: rating }));
      setNotice("Đã lưu đánh giá. Cảm ơn bạn đã góp ý.");
    } catch (e) {
      setSendError((e as Error).message);
    } finally {
      setFeedbackPending(null);
    }
  }
  function suggest(question: string) {
    setContent(question);
    composer.current?.focus();
  }
  function retryMessage(message: ChatMessage) {
    const userMessage = items.find(
      (item) =>
        !isAssistant(item) && item.clientMessageId === message.clientMessageId,
    );
    if (userMessage && conversationId) {
      const period = readChatMetadata(message.metadata).period;
      void send({
        conversationId,
        clientMessageId: message.clientMessageId,
        content: userMessage.content,
        month: period ?? month,
      });
    }
  }
  const history = (mobile: boolean) => (
    <div className="chat-history-inner">
      <div className="chat-history-heading">
        <h2>
          <MessagesSquare size={18} /> Hội thoại
        </h2>
        {mobile && (
          <Dialog.Close
            className="btn btn-ghost btn-icon"
            aria-label="Đóng lịch sử hội thoại"
          >
            <X size={19} />
          </Dialog.Close>
        )}
      </div>
      <Button
        onClick={() => {
          setDrawer(false);
          openAction("create");
        }}
        disabled={Boolean(pending) || actionPending}
        className="chat-create"
      >
        <MessageSquarePlus size={17} /> Hội thoại mới
      </Button>
      <label className="chat-search">
        <Search size={16} />
        <input
          aria-label="Tìm hội thoại"
          placeholder="Tìm trong tên hội thoại"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <div className="chat-history-list" aria-label="Danh sách hội thoại">
        {conversations.isPending ? (
          <p role="status" className="chat-history-empty">
            Đang tải hội thoại…
          </p>
        ) : conversations.error ? (
          <ErrorState
            error={conversations.error}
            retry={() => conversations.refetch()}
          />
        ) : conversations.data?.items.length ? (
          conversations.data.items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`chat-conversation ${item.id === conversationId ? "selected" : ""}`}
              onClick={() => select(item.id)}
              disabled={Boolean(pending)}
              aria-current={item.id === conversationId ? "true" : undefined}
            >
              <MessagesSquare size={16} />
              <span>
                <b>{item.title}</b>
                <time dateTime={item.updatedAt}>
                  {timestamp(item.updatedAt)}
                </time>
              </span>
              <ChevronRight size={14} />
            </button>
          ))
        ) : (
          <p className="chat-history-empty">
            {debouncedSearch
              ? "Không có hội thoại khớp tên."
              : "Chưa có hội thoại. Bắt đầu với câu hỏi của bạn."}
          </p>
        )}
      </div>
      <div className="chat-pagination">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Trang hội thoại trước"
          disabled={conversationPage === 0 || conversations.isFetching}
          onClick={() => setConversationPage((page) => page - 1)}
        >
          <ChevronLeft size={16} />
        </Button>
        <span>
          Trang {conversationPage + 1}
          {conversations.data
            ? ` / ${Math.max(1, Math.ceil(conversations.data.total / conversationSize))}`
            : ""}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Trang hội thoại tiếp"
          disabled={
            !conversations.data ||
            (conversationPage + 1) * conversationSize >=
              conversations.data.total ||
            conversations.isFetching
          }
          onClick={() => setConversationPage((page) => page + 1)}
        >
          <ChevronRight size={16} />
        </Button>
      </div>
      <div className="chat-history-foot">
        <ShieldCheck size={16} />
        <span>Chỉ tài khoản của bạn xem được các hội thoại này.</span>
      </div>
    </div>
  );

  return (
    <div className="chat-page">
      <PageTitle
        title="Chat tư vấn AI"
        text="Đặt câu hỏi. Hiểu rõ dòng tiền và lựa chọn của bạn."
      >
        <Button variant="outline" onClick={() => setPrivacy(true)}>
          <ShieldCheck size={16} /> Quyền riêng tư
        </Button>
      </PageTitle>
      <div className="chat-layout">
        <aside className="chat-history" aria-label="Lịch sử tư vấn">
          {history(false)}
        </aside>
        <section className="chat-workspace" aria-label="Chat tư vấn tài chính">
          <header className="chat-header">
            <Button
              variant="ghost"
              size="icon"
              className="chat-drawer-trigger"
              aria-label="Mở lịch sử hội thoại"
              onClick={() => setDrawer(true)}
            >
              <PanelLeft size={19} />
            </Button>
            <span className="chat-assistant-icon">
              <Sparkles size={21} />
            </span>
            <div className="chat-header-title">
              <h2>
                {selected?.title ??
                  (conversationId
                    ? "Hội thoại của bạn"
                    : "Trợ lý tài chính FinSight")}
              </h2>
              <p>
                {status.data?.model
                  ? `Mô hình: ${status.data.model}`
                  : "Tư vấn từ dữ liệu tài khoản của bạn"}
              </p>
            </div>
            {conversationId && (
              <div className="chat-header-actions">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Đổi tên hội thoại"
                  disabled={Boolean(pending)}
                  onClick={() => openAction("rename")}
                >
                  <Pencil size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Xóa hội thoại"
                  disabled={Boolean(pending)}
                  onClick={() => openAction("delete")}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            )}
          </header>
          <div className="chat-status-strip">
            <span
              className={`chat-status-dot ${configured && consent ? "ready" : ""}`}
            />
            <p>
              {status.isPending
                ? "Đang kiểm tra AI…"
                : status.error
                  ? "Không thể kiểm tra trạng thái AI."
                  : !configured
                    ? status.data?.message ||
                      "AI chưa được cấu hình. Hãy kiểm tra máy chủ mô hình."
                    : !consent
                      ? "Cần bạn đồng ý trước khi gửi dữ liệu đến AI bên ngoài."
                      : status.data?.external
                        ? "AI bên ngoài · Bạn đã đồng ý gửi dữ liệu cần thiết."
                        : "AI nội bộ · Dữ liệu không gửi đến nhà cung cấp bên ngoài."}
            </p>
            {!status.isPending && (status.error || !configured) && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Kiểm tra lại AI"
                onClick={() => status.refetch()}
              >
                <RefreshCw size={15} />
              </Button>
            )}
            {status.data?.external && !consent && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPrivacy(true)}
              >
                Cài đặt
              </Button>
            )}
          </div>
          <div
            className="chat-timeline"
            role="log"
            aria-label="Tin nhắn hội thoại"
            aria-live="polite"
            aria-busy={Boolean(pending)}
          >
            {conversationId && messages.isPending ? (
              <div className="chat-placeholder" role="status">
                <LoaderCircle size={24} className="spin" />
                <p>Đang tải tin nhắn…</p>
              </div>
            ) : messages.error ? (
              <ErrorState
                error={messages.error}
                retry={() => messages.refetch()}
              />
            ) : items.length === 0 && !pending ? (
              <div className="chat-welcome">
                <span className="chat-welcome-icon">
                  <Sparkles size={32} />
                </span>
                <span className="eyebrow">TƯ VẤN CHO RIÊNG BẠN</span>
                <h3>Bạn muốn hiểu điều gì về tài chính?</h3>
                <p>
                  Tôi có thể đọc các tổng hợp của bạn, giải thích dự báo và gợi
                  ý kế hoạch. Các số liệu luôn đi kèm kỳ thời gian và nguồn dữ
                  liệu.
                </p>
                <div className="chat-suggestions">
                  {chatQuestions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => suggest(question)}
                    >
                      <MessagesSquare size={15} />
                      <span>{question}</span>
                      <ArrowUpRight size={15} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.data && messages.data.total > messageSize && (
                  <div className="chat-pagination chat-message-pages">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={messagePage === 0 || Boolean(pending)}
                      onClick={() => setMessagePage((page) => page - 1)}
                    >
                      <ChevronLeft size={14} /> Tin trước
                    </Button>
                    <span>
                      Trang tin nhắn {messagePage + 1} /{" "}
                      {Math.ceil(messages.data.total / messageSize)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        (messagePage + 1) * messageSize >=
                          messages.data.total || Boolean(pending)
                      }
                      onClick={() => setMessagePage((page) => page + 1)}
                    >
                      Tin tiếp <ChevronRight size={14} />
                    </Button>
                  </div>
                )}
                {items.map((message) => {
                  const assistant = isAssistant(message);
                  const rating = feedback[message.id] ?? message.feedbackRating;
                  return (
                    <article
                      key={message.id}
                      className={`chat-message ${assistant ? "assistant" : "user"}`}
                      data-message-id={message.id}
                      data-message-role={assistant ? "assistant" : "user"}
                      data-message-status={message.status}
                    >
                      <span className="chat-message-avatar">
                        {assistant ? (
                          <Sparkles size={17} />
                        ) : (
                          <UserRound size={17} />
                        )}
                      </span>
                      <div className="chat-message-body">
                        <div className="chat-message-byline">
                          <b>{assistant ? "FinSight AI" : "Bạn"}</b>
                          <time dateTime={message.createdAt}>
                            {timestamp(message.createdAt)}
                          </time>
                        </div>
                        <ChatMessageContent message={message} />
                        {assistant && message.status === "PENDING" && (
                          <p className="chat-message-state">
                            <LoaderCircle size={14} className="spin" /> Đang tạo
                            phản hồi…
                          </p>
                        )}
                        {assistant && message.status === "CANCELLED" && (
                          <p className="chat-message-state">
                            Phản hồi đã dừng.
                          </p>
                        )}
                        {assistant && message.status === "FAILED" && (
                          <div className="chat-message-state danger">
                            Phản hồi chưa hoàn tất.
                            {items.some(
                              (item) =>
                                !isAssistant(item) &&
                                item.clientMessageId ===
                                  message.clientMessageId,
                            ) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={!canSend}
                                onClick={() => retryMessage(message)}
                              >
                                <RefreshCw size={13} /> Thử lại câu hỏi này
                              </Button>
                            )}
                          </div>
                        )}
                        {assistant && message.status === "COMPLETED" && (
                          <div className="chat-message-feedback">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Phản hồi hữu ích"
                              aria-pressed={rating === 1}
                              disabled={feedbackPending === message.id}
                              onClick={() => void rate(message.id, 1)}
                            >
                              <ThumbsUp size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Phản hồi chưa hữu ích"
                              aria-pressed={rating === -1}
                              disabled={feedbackPending === message.id}
                              onClick={() => void rate(message.id, -1)}
                            >
                              <ThumbsDown size={14} />
                            </Button>
                            {message.modelVersion && (
                              <span>{message.modelVersion}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </>
            )}
            {optimistic && (
              <article className="chat-message user">
                <span className="chat-message-avatar">
                  <UserRound size={17} />
                </span>
                <div className="chat-message-body">
                  <div className="chat-message-byline">
                    <b>Bạn</b>
                    <span>Đang gửi</span>
                  </div>
                  <p className="chat-user-pending">{pending.content}</p>
                </div>
              </article>
            )}
            {pending &&
              !items.some(
                (message) =>
                  isAssistant(message) &&
                  message.clientMessageId === pending.clientMessageId &&
                  message.status === "PENDING",
              ) && (
                <div className="chat-generating" role="status">
                  <LoaderCircle size={17} className="spin" />
                  <span>AI đang đọc dữ liệu và tạo phản hồi…</span>
                </div>
              )}
            <div ref={bottom} />
          </div>
          <div className="chat-composer-area">
            {sendError && (
              <div className="chat-send-error" role="alert">
                <span>{sendError}</span>
                {failed && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canSend}
                    onClick={() => void send(failed)}
                  >
                    <RefreshCw size={13} /> Gửi lại
                  </Button>
                )}
              </div>
            )}
            {notice && (
              <p className="chat-action-notice" role="status">
                {notice}
              </p>
            )}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (canSend && !actionPending) void send();
              }}
            >
              <div className="chat-context-row">
                <label>
                  <CalendarDays size={14} />
                  <span>Kỳ dữ liệu</span>
                  <input
                    aria-label="Kỳ dữ liệu tư vấn"
                    type="month"
                    value={month}
                    onChange={(event) => setMonth(event.target.value)}
                    disabled={Boolean(pending)}
                    required
                  />
                </label>
                <span>{content.length} / 2.000</span>
              </div>
              <div className="chat-composer">
                <textarea
                  ref={composer}
                  aria-label="Câu hỏi tư vấn tài chính"
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  maxLength={2000}
                  rows={3}
                  placeholder="Hỏi về chi tiêu, ngân sách hoặc kế hoạch tiết kiệm…"
                  disabled={Boolean(pending) || actionPending}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      if (canSend && content.trim() && !actionPending)
                        void send();
                    }
                  }}
                />
                {pending ? (
                  <Button
                    variant="outline"
                    aria-label="Dừng phản hồi"
                    disabled={stopping}
                    onClick={() => void stop()}
                  >
                    <Square size={15} /> {stopping ? "Đang dừng…" : "Dừng"}
                  </Button>
                ) : (
                  <Button
                    variant="ai"
                    type="submit"
                    aria-label="Gửi câu hỏi"
                    disabled={
                      !canSend || !content.trim() || !month || actionPending
                    }
                  >
                    <Send size={16} />
                    <span>Gửi</span>
                  </Button>
                )}
              </div>
            </form>
            <p className="chat-composer-note">
              AI có thể sai. Hãy kiểm tra số liệu và nguồn trước khi quyết định.
              Chat chỉ tư vấn, không tự thực hiện giao dịch.
            </p>
          </div>
        </section>
      </div>
      <Dialog.Root open={drawer} onOpenChange={setDrawer}>
        <Dialog.Portal>
          <Dialog.Overlay className="chat-drawer-overlay" />
          <Dialog.Content className="chat-drawer">
            <Dialog.Title className="sr-only">
              Lịch sử hội thoại AI
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              Chọn, tìm hoặc tạo hội thoại riêng của bạn.
            </Dialog.Description>
            {history(true)}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Modal
        title="Quyền riêng tư của AI"
        description="Bạn kiểm soát việc gửi dữ liệu đến nhà cung cấp AI."
        open={privacy}
        onClose={() => setPrivacy(false)}
      >
        <ChatPrivacyPreferences always />
      </Modal>
      <Modal
        title={
          action === "create"
            ? "Tạo hội thoại mới"
            : action === "rename"
              ? "Đổi tên hội thoại"
              : "Xóa hội thoại"
        }
        description={
          action === "delete"
            ? "Toàn bộ tin nhắn và đánh giá của hội thoại này sẽ được xóa. Thao tác này không thể khôi phục."
            : "Đặt một tên ngắn để dễ tìm lại nội dung tư vấn."
        }
        open={action !== null}
        onClose={() => !actionPending && setAction(null)}
      >
        <form className="form-grid" onSubmit={saveAction}>
          {action !== "delete" && (
            <label className="field">
              <span>
                Tên hội thoại{action === "create" ? " (không bắt buộc)" : ""}
              </span>
              <input
                aria-label="Tên hội thoại"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={100}
                required={action === "rename"}
                autoFocus
                placeholder="Ví dụ: Kế hoạch tiết kiệm"
              />
            </label>
          )}
          {actionError && (
            <p role="alert" className="danger">
              {actionError}
            </p>
          )}
          <div className="form-actions">
            <Button
              variant="outline"
              disabled={actionPending}
              onClick={() => setAction(null)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant={action === "delete" ? "danger" : "default"}
              disabled={actionPending || (action === "rename" && !title.trim())}
            >
              {actionPending
                ? "Đang lưu…"
                : action === "delete"
                  ? "Xác nhận xóa"
                  : action === "create"
                    ? "Tạo hội thoại"
                    : "Lưu tên"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
