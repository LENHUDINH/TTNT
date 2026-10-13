# FinSight AI — Project Plan

Cập nhật 11/10/2026. Yêu cầu gốc: REQUIREMENTS.md. Kết quả và hạn chế phải đối chiếu docs/test-results và AI_MODEL_REPORT.md; không đánh dấu toàn bộ đề tài hoàn chỉnh chỉ dựa vào build.

MVP nghiên cứu: auth → wallets/ledger/transfer → budgets/goals → dashboard/reports → offline trained forecast/anomalies → actual inference UI. Mở rộng: classification, recurring, CSV, exports, sessions, SMTP reset, AI savings plan đã được triển khai. Không có ngân hàng thật, OCR, tự khóa ví hoặc gọi API LLM bên ngoài.

## Phase 1: Repository Inspection & Requirements Analysis

- Mục tiêu/công việc: Kiểm tra môi trường, tạo Git riêng, giữ lại tài liệu tham chiếu.
- File tạo/sửa: `docs/ENVIRONMENT.md, .gitignore, REQUIREMENTS.md`.
- Dependency: .tools Maven/Python; Node/Java hiện có.
- Acceptance Criteria: Repository riêng, không sửa home Git; môi trường đáp ứng phiên bản.
- Test Cases: git status, java/mvn/node/python version.
- Trạng thái: **Đã xác minh**.

## Phase 2: Google Stitch MCP Integration & UI/UX Analysis

- Mục tiêu/công việc: List/get dự án và thiết kế; tải HTML/ảnh; tạo 4 màn hình thiếu.
- File tạo/sửa: `docs/stitch/, STITCH_INTEGRATION.md, UI_UX_DESIGN.md`.
- Dependency: Stitch MCP đã kết nối.
- Acceptance Criteria: 16 màn hình có metadata và resource thật; đúng project/design system.
- Test Cases: list_projects/list_screens/get_screen; kiểm tra HTML/ảnh.
- Trạng thái: **Đã xác minh**.

## Phase 3: System Architecture & Database Design

- Mục tiêu/công việc: Client–Server, JPA entities, constraints, Flyway, tiền DECIMAL.
- File tạo/sửa: `docs/ARCHITECTURE.md, DATABASE_DESIGN.md, backend/model/, db/migration/, database/`.
- Dependency: Spring Boot, MySQL 8.4.
- Acceptance Criteria: Migration + Hibernate validate; FK/unique/index; ownership và atomic transfer.
- Test Cases: Flyway trên MySQL; H2 integration + API smoke.
- Trạng thái: **Đã xác minh V1/V2 trên MySQL native và Docker**.

## Phase 4: Frontend Design System & Application Shell

- Mục tiêu/công việc: React/Vite/TS/Tailwind/Radix/shadcn patterns; Router, Motion, theme.
- File tạo/sửa: `frontend/src/app/, components/ui/, styles.css`.
- Dependency: React, Radix, Motion, TanStack Query.
- Acceptance Criteria: Navigation có chức năng, responsive, state loading/error/empty, reduced motion.
- Test Cases: TypeScript/build, component tests, browser screenshots/Axe.
- Trạng thái: **Đã xác minh responsive/Axe và ảnh sau tải dữ liệu**.

## Phase 5: Authentication & User Management

- Mục tiêu/công việc: BCrypt, session fixation + CSRF rotation, profile/password/sessions/delete/reset SMTP.
- File tạo/sửa: `backend/auth/, security/; frontend/pages/Auth.tsx, Settings.tsx; scripts/mail_sink.py`.
- Dependency: Spring Security, Spring Mail.
- Acceptance Criteria: Cookie HttpOnly; user isolation; reset single-use, session revoked.
- Test Cases: Backend security tests; real SMTP/API smoke.
- Trạng thái: **Đã xác minh**.

## Phase 6: Wallet & Transaction Management

- Mục tiêu/công việc: CRUD wallet/transaction, atomically transfer, idempotency, CSV, exports, recurring.
- File tạo/sửa: `backend/transaction/, analytics/; frontend/pages/Finance.tsx`.
- Dependency: FinanceService, MySQL, POI/OpenPDF/CSV.
- Acceptance Criteria: Số dư nhất quán; chuyển ví không thu/chi; CSV lỗi rollback; export có nội dung.
- Test Cases: Integration concurrency/rollback/edit/replay; API smoke + browser.
- Trạng thái: **Đã xác minh; archive reserve guard được bổ sung và test**.

## Phase 7: Budget & Savings Management

- Mục tiêu/công việc: Ngân sách tháng/category, 70/90/100 dedup; goals/contributions/refunds.
- File tạo/sửa: `FinanceService, FinanceController; Finance.tsx`.
- Dependency: Wallet/transaction ledger.
- Acceptance Criteria: Progress theo API; không tự chuyển tiền; reserve không mất tài sản.
- Test Cases: Budget thresholds, savings refunds; browser tạo/đóng góp.
- Trạng thái: **Đã xác minh**.

## Phase 8: Dashboard & Financial Analytics

- Mục tiêu/công việc: Thu/chi/day/category, asset/reserve totals, reports/month comparisons.
- File tạo/sửa: `FinanceService.dashboard; charts/, finance/cards; ReportsPage`.
- Dependency: Dữ liệu Backend thật.
- Acceptance Criteria: Không hardcode số dư/%; charts/AI insights nguồn API.
- Test Cases: API amount checks; browser + screenshot.
- Trạng thái: **Đã xác minh**.

## Phase 9: AI Dataset Preparation & Model Training

- Mục tiêu/công việc: 20 synthetic accounts ×365 ngày; temporal/user holdout; tuning + baselines.
- File tạo/sửa: `ai-service/training/, datasets/, artifacts/, docs/AI_MODEL_REPORT.md`.
- Dependency: sklearn/XGBoost/Pandas/NumPy/Joblib/Matplotlib.
- Acceptance Criteria: Metrics thật; selection chỉ validation; model version + artifacts; không leakage.
- Test Cases: 9 pytest kiểm tra pipeline/feature/evaluation/loading/inference.
- Trạng thái: **Đã huấn luyện và đánh giá**.

## Phase 10: FastAPI AI Service & Spring Boot Integration

- Mục tiêu/công việc: Models load once; private key; ISO JSON dates; cold start và service failure.
- File tạo/sửa: `ai-service/app/; backend/ai/; scripts/smoke_test.py`.
- Dependency: Trained artifacts + Java RestClient.
- Acceptance Criteria: Frontend chỉ gọi Spring; inference thật; tài chính hoạt động khi AI lỗi.
- Test Cases: API smoke forecast/anomaly/classify/savings-plan; backend failure test.
- Trạng thái: **Đã xác minh**.

## Phase 11: AI Forecast & Anomaly Detection UI

- Mục tiêu/công việc: 1/7/30 ngày, cuối tháng, metrics/history/risk; anomalies/detail/review; classification suggestions.
- File tạo/sửa: `frontend/pages/Intelligence.tsx; editor; SavingsPage`.
- Dependency: Model metadata và AI Backend endpoints.
- Acceptance Criteria: Actual/prediction tách; cảnh báo không gian lận; feedback lưu; không fake confidence.
- Test Cases: Browser cold start + demo trained inference; API smoke.
- Trạng thái: **Đã xác minh luồng chính**.

## Phase 12: Testing, Security & Performance Optimization

- Mục tiêu/công việc: Bộ test security/ownership/ledger/AI/UI; responsive/Axe; lazy route/chart chunks.
- File tạo/sửa: `backend/src/test/, ai-service/tests/, frontend/e2e/, docs/test-results/`.
- Dependency: JUnit/Vitest/pytest/Playwright/Axe.
- Acceptance Criteria: Build không lỗi; test pass; 60 page/viewport checks đã chờ dữ liệu.
- Test Cases: 18 backend + 4 frontend + 9 AI + 2 browser workflows + real API smoke.
- Trạng thái: **Đã xác minh; 18 JUnit, 4 Vitest, 9 pytest, E2E native/Docker; npm audit 0**.

## Phase 13: Deployment & Documentation

- Mục tiêu/công việc: Dockerfiles/Compose, isolated Colima, README/run scripts và tài liệu bằng chứng.
- File tạo/sửa: `Dockerfiles, docker-compose.yml, scripts/, README.md, docs/`.
- Dependency: Docker/Colima, private MySQL/AI network.
- Acceptance Criteria: Compose build/up/health + chạy ứng dụng qua nginx; tài liệu dùng đúng kết quả.
- Test Cases: Native localhost health đã pass; Compose đang build và cần smoke.
- Trạng thái: **Đã xác minh Docker/nginx và image cuối; tài liệu + bằng chứng hoàn tất**.

## Checklist kết thúc

- [x] Stitch MCP và 16 screens đã xác minh, tham chiếu được lưu.
- [x] Native React/Spring/MySQL/FastAPI hoạt động.
- [x] 12 tài khoản demo có 12 tháng lịch sử, seed khác training.
- [x] Models trained/serialized, metrics thật, limitations ghi rõ.
- [x] Auth/CSRF/owner isolation, transfer/CSV rollback, exports được test.
- [x] SMTP reset thật trong localhost, single-use và session revocation được test.
- [x] Kiểm chứng migration V2 và guard archive; có regression test.
- [x] Responsive/Axe và ảnh hoàn chỉnh, cả native và Docker.
- [x] Docker build/up/health + smoke qua nginx; image cuối đã được xác minh.
- [x] README/deployment instructions và tổng hợp bằng chứng.

## Cập nhật database theo yêu cầu 10/10/2026

- Đã chuyển `finsight` sang XAMPP MariaDB10.4.28, port3306; phpMyAdmin quản lý trực tiếp.
- Đã đối chiếu đủ17 bảng bằng số dòng và SHA-256 ở UTC; giữ SQL gốc, `.env` trước chuyển và volume MySQL Docker cũ.
- Backend dùng MariaDB JDBC, Flyway V1/V2 và Hibernate schema validate thành công. Native/Docker cùng kết nối XAMPP.
- API smoke, CSV concurrency và2 luồng giao diện Chrome trên MariaDB đã pass. Bằng chứng và vận hành: [XAMPP_MIGRATION](docs/XAMPP_MIGRATION.md).

## Mở rộng AI Chat — 11/10/2026

- Thêm `/ai-chat`, hội thoại/tin nhắn/feedback riêng theo tài khoản, sidebar và quyền riêng tư trong Settings.
- Flyway V3 thêm4 bảng vào MariaDB XAMPP; giữ V1/V2 và dữ liệu tài chính, sao lưu trước migration.
- LLM local Qwen3 qua Ollama; số liệu là fact Backend tính bằng BigDecimal, validation và render tham chiếu trước khi lưu. Chỉ đọc; không tự tạo giao dịch/chuyển tiền.
- Pipeline ML offline phiên bản `synthetic-v2-f630a4ccb782`; classifier macro-F1≈0.8934 trên64 câu test giữ riêng; version/checksum/activate/rollback thật, không dùng dữ liệu người dùng để train.
- Kiểm thử29 Backend,13 frontend,34 Python; bằng chứng runtime chat, ML tools và giao diện ở [AI_CHAT](docs/AI_CHAT.md).
- LLM hội thoại dùng weights có sẵn; chưa fine-tune LLM. Bản này trả trọn phản hồi, có hủy generation và guard kết quả muộn, chưa streaming token.

## Các giới hạn nghiên cứu còn lại

Không gọi prototype này là production-ready. Dataset giả lập; anomaly precision hiện 50% cần cải thiện trên corpus đa dạng; classifier dùng corpus320 câu biên soạn; lexical audit và64 câu test riêng chưa chứng minh tổng quát hóa trên tiếng Việt thực tế. Chưa có confidence intervals, screen-reader audit, load test/penetration test, SMTP Internet delivery, distributed sessions/rate limit, production TLS, category-specific forecast models hay visual pixel comparison. Những phần này phải được ghi là chưa đánh giá, không che bằng metric giả.
