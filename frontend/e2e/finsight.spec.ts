import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("register, wallets, income, expense, transfer, budget, savings, forecast and reports", async ({
  page,
}) => {
  const email = `e2e-${Date.now()}@example.test`;
  await page.goto("/register");
  await page.getByLabel("Họ và tên").fill("E2E Tester");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("E2EPassword2026!");
  await page
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Xin chào, chào mừng trở lại!" }),
  ).toBeVisible();
  await page.goto("/wallets");
  await page.getByRole("button", { name: "Tạo ví", exact: true }).click();
  await page.getByLabel("Tên ví", { exact: true }).fill("Ví kiểm thử");
  await page.getByLabel("Số dư mở đầu (VND)", { exact: true }).fill("1000000");
  await page.getByRole("button", { name: "Xác nhận & lưu" }).click();
  await expect(
    page.getByRole("heading", { name: "Ví kiểm thử", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tạo ví", exact: true }).click();
  await page.getByLabel("Tên ví", { exact: true }).fill("Ví đích kiểm thử");
  await page.getByRole("button", { name: "Xác nhận & lưu" }).click();
  await expect(
    page.getByRole("heading", { name: "Ví đích kiểm thử", exact: true }),
  ).toBeVisible();
  await page.goto("/transactions");
  await page
    .getByRole("button", { name: "Thêm giao dịch", exact: true })
    .click();
  await page
    .getByLabel("Loại giao dịch", { exact: true })
    .selectOption("INCOME");
  await page.getByLabel("Số tiền (VND)", { exact: true }).fill("500000");
  await page
    .getByLabel("Ví", { exact: true })
    .selectOption({ label: "Ví kiểm thử · 1.000.000 ₫" });
  await page
    .getByLabel("Danh mục", { exact: true })
    .selectOption({ label: "Thu nhập" });
  await page.getByLabel("Nội dung", { exact: true }).fill("Lương kiểm thử");
  await page.getByRole("button", { name: "Xác nhận & lưu" }).click();
  await expect(page.getByText("Lương kiểm thử", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Thêm giao dịch", exact: true })
    .click();
  await page.getByLabel("Số tiền (VND)", { exact: true }).fill("100000");
  await page
    .getByLabel("Ví", { exact: true })
    .selectOption({ label: "Ví kiểm thử · 1.500.000 ₫" });
  await page
    .getByLabel("Danh mục", { exact: true })
    .selectOption({ label: "Ăn uống" });
  await page.getByLabel("Nội dung", { exact: true }).fill("Cơm trưa kiểm thử");
  await page.getByRole("button", { name: "Xác nhận & lưu" }).click();
  await expect(
    page.getByText("Cơm trưa kiểm thử", { exact: true }),
  ).toBeVisible();
  await page.goto("/wallets");
  await page.getByRole("button", { name: "Chuyển tiền", exact: true }).click();
  await page
    .getByLabel("Ví nguồn", { exact: true })
    .selectOption({ label: "Ví kiểm thử · 1.400.000 ₫" });
  await page
    .getByLabel("Ví đích", { exact: true })
    .selectOption({ label: "Ví đích kiểm thử" });
  await page.getByLabel("Số tiền (VND)", { exact: true }).fill("200000");
  await page.getByRole("button", { name: "Xác nhận & lưu" }).click();
  await expect(page.getByText("1.200.000 ₫", { exact: true })).toBeVisible();
  await page.goto("/budgets");
  await page
    .getByRole("button", { name: "Tạo ngân sách", exact: true })
    .click();
  await page
    .getByLabel("Danh mục", { exact: true })
    .selectOption({ label: "Ăn uống" });
  await page.getByLabel("Giới hạn (VND)", { exact: true }).fill("120000");
  await page.getByRole("button", { name: "Xác nhận & lưu" }).click();
  await expect(page.getByText("83%", { exact: true })).toBeVisible();
  await page.goto("/savings");
  await page.getByRole("button", { name: "Tạo mục tiêu", exact: true }).click();
  await page.getByLabel("Tên mục tiêu", { exact: true }).fill("Quỹ kiểm thử");
  await page
    .getByLabel("Số tiền mục tiêu (VND)", { exact: true })
    .fill("500000");
  await page.getByLabel("Ngày hoàn thành", { exact: true }).fill("2027-01-10");
  await page.getByRole("button", { name: "Xác nhận & lưu" }).click();
  await expect(
    page.getByRole("heading", { name: "Quỹ kiểm thử" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Đóng góp", exact: true }).click();
  await page
    .getByLabel("Ví trích tiền", { exact: true })
    .selectOption({ label: "Ví kiểm thử · 1.200.000 ₫" });
  await page
    .getByLabel("Số tiền đóng góp (VND)", { exact: true })
    .fill("50000");
  await page.getByRole("button", { name: "Xác nhận & lưu" }).click();
  await expect(page.getByText("10% hoàn thành", { exact: true })).toBeVisible();
  await page.goto("/forecast");
  await page.getByRole("button", { name: "Tạo dự báo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Chưa đủ dữ liệu để dự báo" }),
  ).toBeVisible();
  await page.goto("/anomalies");
  await page
    .getByRole("button", { name: "Phân tích giao dịch", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "30 giao dịch" }),
  ).toBeVisible();
  await page.goto("/reports");
  const excelPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Excel", exact: true }).click();
  expect((await excelPromise).suggestedFilename()).toMatch(/xlsx$/);
  const pdfPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  expect((await pdfPromise).suggestedFilename()).toMatch(/pdf$/);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Tối", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Sáng", exact: true }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.goto("/");
  await expect(page.locator(".metric-value").first()).toBeVisible();
  await expect(page.locator(".metric").last()).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: "../docs/test-results/dashboard-empty-desktop.png",
    fullPage: true,
  });
});
test("demo ML inference, responsive layouts, accessible pages and zero overflow", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("demo01@finsight.local");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("DemoFinSight2026!");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Xin chào, chào mừng trở lại!" }),
  ).toBeVisible();
  await page.goto("/forecast");
  await page.getByRole("button", { name: "Tạo dự báo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Chi tiêu thực tế & dự báo" }),
  ).toBeVisible();
  await page.goto("/anomalies");
  await page
    .getByRole("button", { name: "Phân tích giao dịch", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Đã phân tích" }),
  ).toBeVisible();
  await page.locator('.alert-row').first().click();
  await expect(page.getByRole('heading',{name:'Chi tiết cảnh báo',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Đã kiểm tra',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('.alert-row').first().click();
  await page.getByRole('button',{name:'Đánh dấu hợp lệ',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/savings');
  await page.getByRole('button',{name:'Gợi ý kế hoạch AI',exact:true}).click();
  await expect(page.getByText(/Thu nhập 30 ngày gần nhất trừ dự báo/)).toBeVisible();
  await page.goto('/transactions');
  await page.getByRole('button',{name:'Thêm giao dịch',exact:true}).click();
  await page.getByLabel('Nội dung',{exact:true}).fill('Mua cơm trưa');
  await page.getByRole('button',{name:'Gợi ý danh mục từ AI',exact:true}).click();
  await expect(page.getByRole('button',{name:'Áp dụng: Ăn uống',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Áp dụng: Ăn uống',exact:true}).click();
  await expect(page.getByLabel('Danh mục',{exact:true})).not.toHaveValue('');
  await page.getByLabel('Danh mục',{exact:true}).selectOption({label:'Mua sắm'});
  await page.getByRole('button',{name:'Hủy',exact:true}).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator(".metric-value").first()).toBeVisible();
  await expect(page.locator(".metric").last()).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: "../docs/test-results/dashboard-1440.png",
    fullPage: true,
  });
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  for (const width of [375, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/",
      "/transactions",
      "/wallets",
      "/budgets",
      "/savings",
      "/forecast",
      "/anomalies",
      "/reports",
      "/settings",
      "/notifications",
    ]) {
      await page.goto(route);
      await expect(page.locator("h1")).toBeVisible();
      await expect(
        page.getByRole("status").filter({ hasText: "Đang tải dữ liệu" }),
      ).toHaveCount(0);
      await expect(page.getByRole("alert")).toHaveCount(0);
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);
    }
    await page.goto("/");
    await expect(page.locator(".metric-value").first()).toBeVisible();
    await expect(page.locator(".metric").last()).toHaveCSS("opacity", "1");
    await page.screenshot({
      path: `../docs/test-results/dashboard-${width}.png`,
      fullPage: true,
    });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/settings");
  await page.getByRole("button", { name: "Tối", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.goto("/");
  await expect(page.locator(".metric-value").first()).toBeVisible();
  await expect(page.locator(".metric").last()).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: "../docs/test-results/dashboard-dark.png",
    fullPage: true,
  });
});
