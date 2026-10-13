import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AiChatPage, ChatMessageContent, timestamp } from "./AiChat";
import { api } from "../services/api";
import type { ChatMessage, ChatStatus } from "../services/chat";

vi.mock("../services/api", () => ({
  api: vi.fn(),
  jsonBody: JSON.stringify,
}));

const now = "2026-10-10T12:00:00Z";
const conversation = {
  id: 7,
  title: "Kế hoạch tháng",
  createdAt: now,
  updatedAt: now,
};
const defaultStatus: ChatStatus = {
  configured: true,
  provider: "local",
  model: "model-test",
  external: false,
  externalConsent: false,
};
let status: ChatStatus;
let rows: ChatMessage[];
let post: ((options: RequestInit) => Promise<ChatMessage>) | undefined;
let earlyCancelAttempts: number;

function message(
  role: "USER" | "ASSISTANT",
  content: string,
  clientMessageId = "existing",
  state: ChatMessage["status"] = "COMPLETED",
): ChatMessage {
  return {
    id: role === "USER" ? 1 : 2,
    conversationId: 7,
    role,
    content,
    status: state,
    clientMessageId,
    createdAt: now,
  };
}
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/ai-chat?id=7"]}>
        <AiChatPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  status = { ...defaultStatus };
  rows = [];
  post = undefined;
  earlyCancelAttempts = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options = {}) => {
    if (path === "/chat/status") return status;
    if (path === "/chat/preferences") {
      if (options.method === "PUT")
        status = {
          ...status,
          externalConsent: JSON.parse(String(options.body)).externalConsent,
        };
      return { externalConsent: status.externalConsent };
    }
    if (
      path.startsWith("/chat/conversations?") ||
      path === "/chat/conversations"
    )
      return { items: [conversation], total: 1, page: 0, size: 15 };
    if (path.startsWith("/chat/conversations/7/messages")) {
      if (options.method === "POST") return post?.(options);
      return { items: [...rows], total: rows.length, page: 0, size: 40 };
    }
    if (path.endsWith("/cancel")) {
      if (earlyCancelAttempts > 0) {
        earlyCancelAttempts--;
        throw Object.assign(new Error("Message has not been inserted"), {
          status: 404,
        });
      }
      const id = JSON.parse(String(options.body)).clientMessageId;
      const cancelled = message("ASSISTANT", "", id, "CANCELLED");
      rows = [message("USER", "Tôi còn bao nhiêu ngân sách?", id), cancelled];
      return cancelled;
    }
    if (path.includes("/feedback")) return {};
    throw new Error("Unexpected API path " + path);
  });
});

describe("Private financial chat", () => {
  it("interprets backend timestamps as Vietnam time while preserving explicit time zones", () => {
    const local = timestamp("2026-10-11T14:30:00");
    expect(local).toContain("14:30");
    expect(local).toBe(timestamp("2026-10-11T14:30:00+07:00"));
    expect(local).toBe(timestamp("2026-10-11T07:30:00Z"));
    expect(local).toBe(timestamp("2026-10-11T09:30:00+02:00"));
  });
  it("renders saved messages from the selected conversation and disables an unconfigured engine", async () => {
    status = {
      ...status,
      configured: false,
      message: "Chưa cài mô hình hội thoại",
    };
    rows = [
      message("USER", "Lịch sử riêng đã lưu"),
      message("ASSISTANT", "Dữ liệu thuộc tài khoản này"),
    ];
    setup();
    expect(await screen.findByText("Lịch sử riêng đã lưu")).toBeVisible();
    expect(screen.getByText("Chưa cài mô hình hội thoại")).toBeVisible();
    await userEvent.type(
      screen.getByRole("textbox", { name: "Câu hỏi tư vấn tài chính" }),
      "Ngân sách tháng này",
    );
    expect(screen.getByRole("button", { name: "Gửi câu hỏi" })).toBeDisabled();
    expect(
      vi
        .mocked(api)
        .mock.calls.some(([path]) =>
          path.startsWith("/chat/conversations/7/messages"),
        ),
    ).toBe(true);
  });

  it("retries a failed send with the same clientMessageId and does not duplicate the user message", async () => {
    let attempts = 0;
    post = async (options) => {
      const body = JSON.parse(String(options.body));
      rows = [message("USER", body.content, body.clientMessageId)];
      if (++attempts === 1) throw new Error("AI tạm thời không phản hồi");
      const response = message(
        "ASSISTANT",
        "Bạn còn ngân sách cho kỳ đã chọn.",
        body.clientMessageId,
      );
      rows.push(response);
      return response;
    };
    setup();
    const user = userEvent.setup();
    await screen.findByText("Bạn muốn hiểu điều gì về tài chính?");
    await user.click(
      screen.getByRole("button", { name: "Tôi còn bao nhiêu ngân sách?" }),
    );
    await user.click(screen.getByRole("button", { name: "Gửi câu hỏi" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("AI tạm thời");
    await user.click(screen.getByRole("button", { name: "Gửi lại" }));
    expect(
      await screen.findByText("Bạn còn ngân sách cho kỳ đã chọn."),
    ).toBeVisible();
    const sends = vi
      .mocked(api)
      .mock.calls.filter(
        ([path, options]) =>
          path === "/chat/conversations/7/messages" &&
          options?.method === "POST",
      );
    expect(sends).toHaveLength(2);
    expect(JSON.parse(String(sends[0][1]?.body))).toEqual(
      JSON.parse(String(sends[1][1]?.body)),
    );
    expect(
      screen.getAllByText("Tôi còn bao nhiêu ngân sách?", { exact: true }),
    ).toHaveLength(1);
  });

  it("cancels the persisted generation and aborts the outstanding HTTP request", async () => {
    let signal: AbortSignal | null | undefined;
    post = (options) =>
      new Promise((_resolve, reject) => {
        signal = options.signal;
        signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      });
    setup();
    const user = userEvent.setup();
    await screen.findByText("Bạn muốn hiểu điều gì về tài chính?");
    await user.click(
      screen.getByRole("button", { name: "Tôi còn bao nhiêu ngân sách?" }),
    );
    await user.click(screen.getByRole("button", { name: "Gửi câu hỏi" }));
    await user.click(
      await screen.findByRole("button", { name: "Dừng phản hồi" }),
    );
    await waitFor(() => expect(signal?.aborted).toBe(true));
    expect(await screen.findByText("Phản hồi đã dừng.")).toBeVisible();
    const sent = vi
      .mocked(api)
      .mock.calls.find(
        ([path, options]) =>
          path === "/chat/conversations/7/messages" &&
          options?.method === "POST",
      );
    const cancelled = vi
      .mocked(api)
      .mock.calls.find(([path]) => path.endsWith("/cancel"));
    expect(JSON.parse(String(cancelled?.[1]?.body)).clientMessageId).toBe(
      JSON.parse(String(sent?.[1]?.body)).clientMessageId,
    );
  });

  it("waits for a newly submitted message before saving cancellation", async () => {
    earlyCancelAttempts = 2;
    let signal: AbortSignal | null | undefined;
    post = (options) =>
      new Promise((_resolve, reject) => {
        signal = options.signal;
        signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      });
    setup();
    const user = userEvent.setup();
    await screen.findByText("Bạn muốn hiểu điều gì về tài chính?");
    await user.click(
      screen.getByRole("button", { name: "Tôi còn bao nhiêu ngân sách?" }),
    );
    await user.click(screen.getByRole("button", { name: "Gửi câu hỏi" }));
    await user.click(
      await screen.findByRole("button", { name: "Dừng phản hồi" }),
    );
    expect(signal?.aborted).toBe(false);
    await waitFor(() => expect(signal?.aborted).toBe(true));
    expect(await screen.findByText("Phản hồi đã dừng.")).toBeVisible();
    expect(
      vi.mocked(api).mock.calls.filter(([path]) => path.endsWith("/cancel")),
    ).toHaveLength(3);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("requires an explicit external-provider opt-in before sending financial data", async () => {
    status = { ...status, external: true, provider: "external-test" };
    setup();
    const user = userEvent.setup();
    await screen.findByText(
      "Cần bạn đồng ý trước khi gửi dữ liệu đến AI bên ngoài.",
    );
    await user.click(
      screen.getByRole("button", { name: "Tôi còn bao nhiêu ngân sách?" }),
    );
    expect(screen.getByRole("button", { name: "Gửi câu hỏi" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Quyền riêng tư" }));
    const checkbox = await screen.findByRole("checkbox", {
      name: "Tôi đồng ý gửi dữ liệu cần thiết đến AI bên ngoài",
    });
    await waitFor(() => expect(checkbox).toBeEnabled());
    expect(checkbox).not.toBeChecked();
    expect(
      vi
        .mocked(api)
        .mock.calls.some(
          ([path, options]) =>
            path === "/chat/preferences" && options?.method === "PUT",
        ),
    ).toBe(false);
    await user.click(checkbox);
    await waitFor(() => expect(checkbox).toBeChecked());
    await user.click(screen.getByRole("button", { name: "Đóng hộp thoại" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Gửi câu hỏi" })).toBeEnabled(),
    );
  });

  it("renders financial facts and permits neither raw HTML nor unsafe links or remote images", () => {
    const malicious = message(
      "ASSISTANT",
      '**Tổng chi tiêu** <script>alert("x")</script>\n\n[Unsafe](javascript:alert%281%29)\n\n![Remote image](https://outside.test/track.png)\n\n[Safe](https://example.test/guide)',
    );
    malicious.metadata = {
      period: "2026-10",
      retrievedAt: now,
      facts: [
        { id: "expense", label: "Chi tiêu", value: "1250000", kind: "money" },
      ],
      sources: [
        { id: "transactions", label: "Giao dịch tháng", url: "/transactions" },
      ],
    };
    const view = render(<ChatMessageContent message={malicious} />);
    expect(view.container.querySelector("script")).toBeNull();
    expect(view.container.querySelector("img")).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Unsafe" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Safe" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    expect(screen.getByText("1.250.000 ₫")).toBeInTheDocument();
    expect(screen.getByText("Nguồn dữ liệu · 2026-10")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Giao dịch tháng" }),
    ).toHaveAttribute("href", "/transactions");
  });

  it("preserves exact decimal money, percent units and the nature of financial facts", () => {
    const response = message("ASSISTANT", "Số liệu theo kỳ đã chọn.");
    response.metadata = {
      facts: [
        {
          id: "balance",
          label: "Số dư",
          value: "12345678901234567890.25",
          kind: "money",
          nature: "ACTUAL",
          source: "ledger",
        },
        {
          id: "forecast",
          label: "Chi tiêu dự báo",
          value: "1200000.00",
          kind: "money",
          nature: "FORECAST",
          source: "forecast_service",
        },
        {
          id: "plan",
          label: "Tỷ lệ tiết kiệm",
          value: "12.50",
          kind: "percent",
          nature: "SCENARIO",
        },
        {
          id: "minimum",
          label: "Lịch sử tối thiểu",
          value: "60",
          kind: "count",
          nature: "REQUIREMENT",
        },
      ],
    };
    const view = render(<ChatMessageContent message={response} />);
    expect(
      screen.getByText("12.345.678.901.234.567.890,25 ₫"),
    ).toBeInTheDocument();
    expect(screen.getByText("1.200.000 ₫")).toBeInTheDocument();
    expect(screen.getByText("12,50%")).toBeInTheDocument();
    for (const nature of ["Thực tế", "Dự báo", "Kịch bản", "Điều kiện mô hình"])
      expect(screen.getByText(nature)).toBeInTheDocument();
    expect(screen.queryByText("ledger")).not.toBeInTheDocument();
    expect(screen.queryByText("forecast_service")).not.toBeInTheDocument();
    for (const group of view.container.querySelectorAll("dl > div")) {
      expect(Array.from(group.children).map((child) => child.tagName)).toEqual([
        "DT",
        "DD",
      ]);
    }
  });

  it("explains limited ML history and synthetic evaluation only on financial model responses", () => {
    const response = message("ASSISTANT", "Kết quả phân tích.");
    response.metadata = {
      mlStatus: { forecast: { status: "READY", historyLimited: true } },
    };
    const view = render(<ChatMessageContent message={response} />);
    expect(
      screen.getByText(/Chat phân tích phần lịch sử gần nhất/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Mô hình tài chính được đánh giá trên dữ liệu tổng hợp/),
    ).toBeInTheDocument();
    response.metadata = {
      mlStatus: { anomalies: { status: "READY", historyLimited: false } },
    };
    view.rerender(<ChatMessageContent message={response} />);
    expect(
      screen.queryByText(/Chat phân tích phần lịch sử gần nhất/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Mô hình tài chính được đánh giá trên dữ liệu tổng hợp/),
    ).toBeInTheDocument();
    response.metadata = {
      facts: [
        {
          id: "expense",
          label: "Chi tiêu",
          value: "250000",
          kind: "money",
          nature: "ACTUAL",
        },
      ],
    };
    view.rerender(<ChatMessageContent message={response} />);
    expect(
      screen.queryByText(/Chat phân tích phần lịch sử gần nhất/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        /Mô hình tài chính được đánh giá trên dữ liệu tổng hợp/,
      ),
    ).not.toBeInTheDocument();
    response.metadata = {};
    view.rerender(<ChatMessageContent message={response} />);
    expect(
      screen.queryByText(
        /Mô hình tài chính được đánh giá trên dữ liệu tổng hợp/,
      ),
    ).not.toBeInTheDocument();
  });
});
