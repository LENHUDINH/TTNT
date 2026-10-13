import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Auth } from "./Auth";
import { api } from "../services/api";
vi.mock("../services/api", () => ({
  api: vi.fn().mockResolvedValue({}),
  csrf: vi.fn().mockResolvedValue({}),
  jsonBody: JSON.stringify,
}));
function setup(mode: "login" | "register" = "register") {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <Auth mode={mode} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
describe("Authentication forms", () => {
  it("rejects short registration passwords before contacting backend", async () => {
    setup();
    const u = userEvent.setup();
    await u.type(screen.getByLabelText("Họ và tên"), "An");
    await u.type(screen.getByLabelText("Email"), "an@example.com");
    await u.type(screen.getByLabelText("Mật khẩu"), "short");
    await u.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("ít nhất 10");
    expect(api).not.toHaveBeenCalled();
  });
  it("surfaces backend login errors accessibly", async () => {
    vi.mocked(api).mockRejectedValueOnce(
      new Error("Email hoặc mật khẩu không đúng"),
    );
    setup("login");
    const u = userEvent.setup();
    await u.type(screen.getByLabelText("Email"), "an@example.com");
    await u.type(screen.getByLabelText("Mật khẩu"), "Password123!");
    await u.click(screen.getByRole("button", { name: "Đăng nhập" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("không đúng"),
    );
  });
});
