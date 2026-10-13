import { it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Editor, monetary } from "./editor";
import { api } from "../../services/api";
import { z } from "zod";

it("keeps one idempotency key when retrying a failed financial request", async () => {
  vi.mocked(api).mockReset();
  vi.mocked(api)
    .mockRejectedValueOnce(new Error("Connection interrupted"))
    .mockResolvedValueOnce({});
  const close = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Editor
        config={{
          title: "Giao dịch",
          path: "/transactions",
          fields: [
            {
              key: "amount",
              label: "Số tiền",
              default: "100",
              validate: monetary,
            },
          ],
        }}
        onClose={close}
      />
    </QueryClientProvider>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Xác nhận & lưu" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Connection interrupted",
  );
  await user.click(screen.getByRole("button", { name: "Xác nhận & lưu" }));
  await vi.waitFor(() => expect(close).toHaveBeenCalled());
  const first = vi.mocked(api).mock.calls[0][1]?.headers as Record<
    string,
    string
  >;
  const second = vi.mocked(api).mock.calls[1][1]?.headers as Record<
    string,
    string
  >;
  expect(first["Idempotency-Key"]).toBeTruthy();
  expect(first["Idempotency-Key"]).toBe(second["Idempotency-Key"]);
  vi.mocked(api).mockClear();
});
vi.mock("../../services/api", () => ({
  api: vi.fn().mockResolvedValue({}),
  jsonBody: JSON.stringify,
  idempotency: () => ({ "Idempotency-Key": crypto.randomUUID() }),
}));
it("validates money and converts wallet IDs while preserving decimal money as a string", async () => {
  const close = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Editor
        config={{
          title: "Đóng góp",
          path: "/savings/1/contributions",
          fields: [
            { key: "amount", label: "Số tiền", validate: monetary },
            {
              key: "walletId",
              label: "Ví",
              options: [{ value: 3, label: "Cash" }],
              validate: z.coerce.number().positive(),
            },
          ],
        }}
        onClose={close}
      />
    </QueryClientProvider>,
  );
  const u = userEvent.setup();
  await u.type(screen.getByLabelText("Số tiền"), "-5");
  await u.selectOptions(screen.getByLabelText("Ví"), "3");
  await u.click(screen.getByRole("button", { name: "Xác nhận & lưu" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Nhập số tiền");
  expect(api).not.toHaveBeenCalled();
  await u.clear(screen.getByLabelText("Số tiền"));
  await u.type(screen.getByLabelText("Số tiền"), "123.45");
  await u.click(screen.getByRole("button", { name: "Xác nhận & lưu" }));
  await vi.waitFor(() => expect(api).toHaveBeenCalled());
  expect(vi.mocked(api).mock.calls[0][1]?.body).toBe(
    '{"amount":"123.45","walletId":3}',
  );
  expect(close).toHaveBeenCalled();
});
