# Kết quả kiểm chứng

## Cập nhật AI Chat — 11/10/2026

Bản hiện tại dùng MariaDB XAMPP10.4.28, FlywayV3, Chat tư vấn AI tại `/ai-chat`, LLM Qwen3 local và ML tài chính `synthetic-v2-f630a4ccb782`.

| Bộ kiểm tra mới | Kết quả |
|---|---|
| Backend/JUnit | 29 passed; gồm18 tài chính +11 chat |
| Frontend/Vitest | 13 passed |
| Python/pytest | 34 passed; gồm17 pipeline +17 chat |
| API chat thật | Phân quyền hai tài khoản, exact money, retry/concurrent duplicate, feedback, cancel không ghi muộn: passed |
| Chat gọi ML thật | Forecast/anomaly READY từ V2; tài khoản trống INSUFFICIENT_DATA không dự báo giả: passed |
| Chrome Chat E2E | Dữ liệu thật, reload, feedback, quản lý hội thoại,5 widths, Axe light/dark: passed |
| Hồi quy tài chính | Auth/CSRF, chuyển ví/CSV rollback, exports, SMTP reset và ML mới: passed |

76 ca JUnit/Vitest/pytest;1 workflow Chrome chat, ngoài các script nghiệm thu API/ML. Bằng chứng: `chat-api.json`, `chat-ml-tools.json`, `chat-browser.json`, `chat-finance-regression.json`, `ml-training-v2.json`, cùng log/reports local. Xem [AI_CHAT](AI_CHAT.md) và [AI_MODEL_REPORT](AI_MODEL_REPORT.md).

LLM chưa fine-tune. ML dùng dữ liệu tổng hợp; classifier macro-F1≈0.8934 trên64 câu test riêng. Snapshot trong phần dưới là kết quả trước khi chuyển XAMPP và mở rộng chat, không mô tả cấu hình hiện tại.

## Bản kiểm chứng trước mở rộng — 10/10/2026

Bản được bàn giao chạy qua Docker/nginx: http://127.0.0.1:8088. MySQL 8.4, Spring Boot Java21, FastAPI có model được huấn luyện trong Linux image, React production build. 12 tài khoản demo đã seed vào database container qua API.

| Bộ kiểm tra | Kết quả thực tế |
|---|---|
| Spring/JUnit | 18 passed, 0 failures/errors |
| Frontend/Vitest 5.0.3 | 4 passed |
| AI/pytest | 9 passed |
| Browser/Playwright trên Docker cuối | 2 workflows passed |
| Responsive | 10 routes × 6 widths = 60 checks, sau khi data đã tải |
| Axe | Dashboard WCAG2A/AA: không còn violations trong lượt đo cuối |
| npm audit | 0 vulnerabilities sau khi vá Vitest |
| Native + Docker API smoke | Auth/CSRF, money rollback, replay, CSV, Excel/PDF, SMTP reset, inference: passed |
| MySQL canonical replay | Microsecond date + trimmed description, one ledger row: passed |
| MySQL concurrent CSV | 2×200 rows; expected/actual 400 transactions and balance4600 from5000: passed |
| Compose build/config/up | Passed; MySQL/AI/Mail healthy, Backend health API and nginx verified |

31 automated JUnit/Vitest/pytest test cases cộng 2 browser workflows (33 total), ngoài các API/regression checks. Không cộng mọi assertion thành số test phóng đại.

## Bằng chứng

- browser.json và dashboard PNGs: browser workflows, desktop/tablet/mobile, dark/light.
- api-smoke.json: full HTTP smoke qua Docker/nginx và Mailpit, gồm reset token single-use/revocation và QA account cleanup.
- compose-smoke.json, compose-status.json: deployment/inference/runtime trạng thái.
- mysql-replay.json: normalized same-key request does not duplicate.
- csv-concurrency-before-fix.json và csv-concurrency.json: giữ nguyên bằng chứng lỗi và kết quả sửa.
- npm-audit.json: metadata audit thực tế.
- backend/target/surefire-reports: JUnit detailed results.
- ai-service/artifacts/metadata.json và docs/AI_MODEL_REPORT.md: metrics ML, version, limitations.

## Lỗi đã tìm thấy và sửa

Build đầu: generic API return TypeScript, Java List ambiguity. Runtime: Hibernate longtext mapping, H2 MONTH keyword, JSON date arrays giữa Spring/FastAPI. Environment: Mockito attachment/sandbox, Java cũ giữ port8080 và JAR bị rebuild tại chỗ; runner hiện copy artifact riêng. UI: color contrast, animation chưa ổn định khi chụp/đo. Dependency audit: Vitest được nâng lên 5.0.3, các lỗ hổng được loại bỏ.

Quan trọng nhất: MySQL REPEATABLE_READ snapshot mở trước user lock đã làm mất cập nhật khi hai CSV đồng thời (400 ledger rows, balance4800 thay vì4600). Đã sửa isolation cho các controller có auth-read trước lock, rollback checked exceptions, kiểm tra lại trên MySQL thật. Account updates dùng pessimistic refresh; regression xác nhận profile/password đồng thời không ghi đè nhau. Form giữ idempotency key qua retry; CSV batch dùng fingerprint file.

## Các kiểm tra chưa làm / hạn chế

Không tuyên bố production-ready hay hoàn thành nghiên cứu accuracy ngoài dữ liệu giả lập. Anomaly precision0.50/recall0.604/F1≈0.547 trên held-out synthetic data; classifier templates lặp giữa accounts, chưa chứng minh generalization. Chưa có confidence intervals, load test/pentest, screen-reader audit đầy đủ, Axe tất cả màn hình, production TLS/Internet SMTP, distributed sessions, category-specific forecast hay pixel-level Stitch comparison. Các giới hạn được giữ rõ trong báo cáo và PROJECT_PLAN.

Sau QA đã dừng Vite/Spring/FastAPI/SMTP/MySQL native; dữ liệu native vẫn giữ nguyên trong runtime/mysql-data. Chỉ bản Docker/nginx đang chạy để bàn giao. Theme demo01 được khôi phục light theo tham chiếu Stitch. Không tạo commit/push remote; .env/runtime/cache/model binary đều bị Git ignore.
