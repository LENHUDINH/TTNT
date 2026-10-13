# REST API

Base native: `http://127.0.0.1:8080/api`. Frontend accesses same-origin `/api` via Vite/nginx. JSON amounts may be decimal strings; Backend parses BigDecimal. IDs are server-owned; no request accepts a userId to choose an owner.

Private AI chat endpoints, provider configuration and grounding contract are documented in [AI_CHAT](AI_CHAT.md). `/api/chat/*` uses the same authenticated cookie/CSRF rules; no client supplies an owner ID.

Authentication flow:

1. GET `/auth/csrf`, retain session cookie and response `token`/`headerName`.
2. POST `/auth/register` (`email`, `password`, `name`), then `/auth/login` (`email`, `password`). Password 10–72 characters; BCrypt also limits UTF-8 to 72 bytes.
3. Login changes session ID and rotates CSRF. GET `/auth/csrf` again. Cookies must remain enabled.
4. Every POST/PUT/PATCH/DELETE includes `X-CSRF-TOKEN`. No auth token in localStorage. Missing auth returns 401; missing CSRF 403.

| Method | Endpoint | Input / behavior |
|---|---|---|
| GET | /health | Startup health |
| GET | /auth/me | Current profile (password hash excluded) |
| POST | /auth/logout | Invalidate session, remove JSESSIONID, 204 |
| PUT | /auth/profile | name, theme=light/dark/system |
| POST | /auth/password | currentPassword, newPassword; revoke other sessions |
| GET | /auth/sessions | Hashed IDs, createdAt, lastAccess, current |
| DELETE | /auth/sessions/{id} | Revoke only own session |
| DELETE | /auth/account | email, password; erase only own account and children |
| POST | /auth/forgot | email; send a 15-minute reset code by configured SMTP |
| POST | /auth/reset | token, password; single-use hash lookup; revoke all sessions |
| GET/POST | /wallets | Create: name,type,initialBalance |
| PUT | /wallets/{id} | name,type,initialBalance (initialBalance ignored on edit) |
| DELETE | /wallets/{id} | Archive (balance 0, no active recurring/contributions) |
| GET/POST | /categories | Create: name; unique per user |
| GET | /transactions | search,categoryId,walletId,from,to,sort,page,size (max100) |
| POST | /transactions | walletId,categoryId,type,amount,description,occurredAt; Idempotency-Key |
| PUT/DELETE | /transactions/{id} | Edit/reverse original balance; invalidate affected AI |
| GET/POST | /transfers | fromWalletId,toWalletId,amount,note; Idempotency-Key; atomic |
| GET/POST | /budgets | categoryId,month=YYYY-MM,amount |
| PUT/DELETE | /budgets/{id} | Edit/delete own budget |
| GET/POST | /savings | name,targetAmount,dueDate |
| PUT/DELETE | /savings/{id} | Delete refunds all contributions to original wallets |
| POST | /savings/{id}/contributions | walletId,amount,note; explicit user confirmation |
| GET | /dashboard?month=YYYY-MM | Wallet/asset totals, daily income/expense, category totals, recent, budgets, goals |
| GET/POST | /recurring | walletId,categoryId,type,amount,description,nextDate,intervalDays (1–366) |
| DELETE | /recurring/{id} | Disable schedule, retain history |
| GET | /notifications | Own notifications only |
| PATCH | /notifications/{id}/read | Mark read |
| POST | /notifications/read-all | Mark own notifications read |
| GET | /reports/export?format=xlsx\|pdf&month=YYYY-MM | Binary attachment; omit month for all |
| POST | /reports/import-csv | Multipart file; Idempotency-Key batch; max2MB/1000 rows; atomic |
| GET | /ai/models | Actual metadata of loaded trained models |
| POST | /ai/forecast?horizon=1\|7\|30 | READY or INSUFFICIENT_DATA; persist prediction with version |
| GET | /ai/forecast/history | Historical results, stale flag after changes |
| POST | /ai/anomalies/analyze | Analyze owned past expenses; persist new deduplicated alerts |
| GET | /ai/anomalies | Alert + source transaction, own user only |
| PATCH | /ai/anomalies/{id} | status=VALID/REVIEWED |
| POST | /ai/classify | text; suggestion/UNKNOWN from TF-IDF classifier |
| POST | /ai/classification-feedback | description,categoryId; owned category required |
| POST | /ai/savings-plan | Trained forecast + recent income; no automatic contribution |
| POST | /demo/seed | transactions[]; enabled flag and demoNN account required |
| POST | /demo/reset | Clears only current demo account financial data |

Wallet types CASH/BANK/EWALLET/SAVINGS. Transaction types INCOME/EXPENSE. occurredAt ISO local time in Asia/Ho_Chi_Minh, e.g. `2026-10-10T09:00:00`; future manual transactions rejected. Sorting: dateDesc/dateAsc/amountDesc/amountAsc. Page starts at zero.

Example transaction:

```json
{"walletId":1,"categoryId":1,"type":"EXPENSE","amount":"65000.00","description":"Mua cơm trưa","occurredAt":"2026-10-10T12:00:00"}
```

Idempotency-Key is mandatory for creates of transactions/transfers. Repeat with same normalized payload returns the original resource. Description is trimmed and date precision normalized to MySQL microseconds. Reuse with a different payload gives 409. Categories/budgets also have natural uniqueness at database level.

CSV header: `walletId,categoryId,type,amount,description,occurredAt`. All references validated against the current user. Invalid row aborts all rows. Excel descriptions written as strings, never formulas. PDF includes a licensed embedded Unicode font.

Errors use `{"message":"..."}` (validation can return a list). Typical codes: 400 invalid fields/insufficient balance, 401 unauthenticated, 403 CSRF/disabled demo, 404 absent/foreign owner resource, 409 duplicate/key mismatch, 429 auth rate limit (Retry-After:60), 503 AI/SMTP unavailable. AI unavailable never prevents financial CRUD.

Internal FastAPI exposes /forecast,/anomalies,/classify,/models with X-Service-Key. It is not exposed to the browser. Its OpenAPI is at /docs only on the private service. Service key read from environment, not source.

Frontend giữ Idempotency-Key của form qua retry. CSV dùng SHA256 file làm batch key, hạn chế nhập lại cùng file sau lỗi phản hồi. Hai lần nhập CSV khác nhau có khóa khác nhau và vẫn phải bảo toàn tổng số dư khi chạy đồng thời.
