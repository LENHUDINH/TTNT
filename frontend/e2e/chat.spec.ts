import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("private AI chat uses real account data, survives reload, supports feedback and mobile history", async ({
  page,
}) => {
  test.setTimeout(300000);
  const email = `chat-e2e-${Date.now()}@example.test`;
  const password = "ChatE2EPassword2026!";
  let registered = false;
  await page.emulateMedia({ reducedMotion: "reduce" });
  try {
    await page.goto("/register");
    await page.getByLabel("Họ và tên").fill("Chat E2E");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
    const registrationResponse = page.waitForResponse(
      (response) => response.url().endsWith("/api/auth/register") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
    registered = (await registrationResponse).ok();
    await expect(
      page.getByRole("heading", { name: "Xin chào, chào mừng trở lại!" }),
    ).toBeVisible({ timeout: 30000 });

    await page.goto("/wallets");
    await page.getByRole("button", { name: "Tạo ví", exact: true }).click();
    await page.getByLabel("Tên ví", { exact: true }).fill("Ví chat E2E");
    await page
      .getByLabel("Số dư mở đầu (VND)", { exact: true })
      .fill("1000000");
    await page.getByRole("button", { name: "Xác nhận & lưu" }).click();
    await expect(
      page.getByRole("heading", { name: "Ví chat E2E", exact: true }),
    ).toBeVisible();
    const walletRows = await (await page.request.get("/api/wallets")).json();
    const chatWallet = walletRows.find((wallet: { name: string }) => wallet.name === "Ví chat E2E");
    expect(chatWallet).toBeTruthy();
    await page.goto("/transactions");
    await page
      .getByRole("button", { name: "Thêm giao dịch", exact: true })
      .click();
    await page.getByLabel("Số tiền (VND)", { exact: true }).fill("250000");
    await page
      .getByLabel("Ví", { exact: true })
      .selectOption(String(chatWallet.id));
    await page
      .getByLabel("Danh mục", { exact: true })
      .selectOption({ label: "Ăn uống" });
    await page
      .getByLabel("Nội dung", { exact: true })
      .fill("Cơm kiểm thử chat");
    await page.getByRole("button", { name: "Xác nhận & lưu" }).click();
    await expect(
      page.getByText("Cơm kiểm thử chat", { exact: true }),
    ).toBeVisible();

    await page.goto("/ai-chat");
    await expect(
      page.getByRole("heading", { name: "Chat tư vấn AI", exact: true }),
    ).toBeVisible();
    const status = await page.request.get("/api/chat/status");
    expect(status.ok()).toBe(true);
    expect((await status.json()).configured).toBe(true);
    await page
      .getByRole("button", { name: "Hội thoại mới", exact: true })
      .click();
    await page
      .getByLabel("Tên hội thoại", { exact: true })
      .fill("Kế hoạch chat E2E");
    await page
      .getByRole("button", { name: "Tạo hội thoại", exact: true })
      .click();
    await expect(page).toHaveURL(/\/ai-chat\?id=\d+/);
    const conversationUrl = page.url();
    await page
      .getByRole("button", {
        name: "Tháng này tôi chi nhiều nhất vào đâu?",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Gửi câu hỏi", exact: true })
      .click();
    const completed = page.locator(
      '[data-message-role="assistant"][data-message-status="COMPLETED"]',
    );
    await expect(completed).toHaveCount(1, { timeout: 150000 });
    await expect(completed.locator(".chat-markdown")).not.toBeEmpty();
    await expect(
      completed
        .locator(".chat-facts")
        .getByText("250.000 ₫", { exact: true })
        .first(),
    ).toBeVisible();
    await completed.getByText(/Nguồn dữ liệu/).click();
    await expect(completed.getByText(/Truy xuất:/)).toBeVisible();
    await completed
      .getByRole("button", { name: "Phản hồi hữu ích", exact: true })
      .click();
    await expect(
      completed.getByRole("button", { name: "Phản hồi hữu ích", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page).toHaveURL(conversationUrl);
    await expect(completed).toHaveCount(1);
    await expect(page.locator('[data-message-role="user"]')).toHaveCount(1);

    await page
      .getByRole("button", { name: "Đổi tên hội thoại", exact: true })
      .click();
    await page
      .getByLabel("Tên hội thoại", { exact: true })
      .fill("Tiết kiệm riêng E2E");
    await page.getByRole("button", { name: "Lưu tên", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Tiết kiệm riêng E2E", exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Tìm hội thoại", { exact: true })
      .fill("Tiết kiệm riêng");
    await expect(page.locator(".chat-conversation")).toHaveCount(1);

    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(
        page.getByRole("heading", { name: "Chat tư vấn AI", exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    await page.setViewportSize({ width: 390, height: 1000 });
    await page
      .getByRole("button", { name: "Mở lịch sử hội thoại", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Lịch sử hội thoại AI" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Đóng lịch sử hội thoại", exact: true })
      .click();
    await page.screenshot({
      path: "../docs/test-results/chat-mobile-light.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    const accessibility = await new AxeBuilder({ page })
      .include(".chat-page")
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({
      path: "../docs/test-results/chat-desktop-light.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Chuyển giao diện sáng tối", exact: true })
      .click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.screenshot({
      path: "../docs/test-results/chat-desktop-dark.png",
      fullPage: true,
    });
    expect(
      (await new AxeBuilder({ page }).include(".chat-page").analyze())
        .violations,
    ).toEqual([]);
    await page
      .getByRole("button", { name: "Xóa hội thoại", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Xác nhận xóa", exact: true })
      .click();
    await expect(page).toHaveURL(/\/ai-chat$/);
  } finally {
    if (registered) {
      const csrf = await page.request.get("/api/auth/csrf");
      const token = (await csrf.json()).token;
      const removal = await page.request.delete("/api/auth/account", {
        data: { email, password },
        headers: { "X-CSRF-TOKEN": token },
      });
      expect(
        removal.ok(),
        "The temporary chat test account must be removed",
      ).toBe(true);
    }
  }
});
