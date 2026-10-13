# Test plan and evidence

Automatic tests exercise meaningful behavioral risks:

- Backend JUnit/Spring/H2 MySQL mode: authentication/CSRF, session logout, foreign-owner denial, atomic transfer and rollback, duplicate/reused idempotency keys, expense edit/delete reconciliation, net edits on spent income, microsecond/trim canonical replay, budget threshold deduplication, savings reserve/refund, preventing archival of contributing wallets, concurrent overspend protection, AI outage independence, excluding transfers from reports.
- Frontend Vitest/Testing Library: registration password rejection before API, accessible login error, financial form decimal preservation and ID conversion.
- AI pytest: seed determinism, prior-only lags, candidate/future exclusion in anomaly features, chronological splits and validation-only selection, service authentication, serialized model load, finite recursive inference and cold start.
- Playwright against real native Backend/MySQL: register/login, wallets, income/expense, transfer, budget, goal/contribution, AI cold start, real demo trained inference, downloads, light/dark. 60 route/viewport combinations at 375/430/768/1024/1440/1920 check no overflow **after loading completes**.
- Axe WCAG2A/AA on settled Dashboard. Animations must complete before measuring contrast. Contrast issues were fixed with palette colors, not by disabling the rule.
- `scripts/smoke_test.py` against MySQL: raw HTTP authentication and CSRF, replay/409 behavior, failed transfer rollback, CSV rollback/valid import, Excel XML content and PDF header/font payload, real local SMTP delivery/reset single use/revocation, trained forecast/anomaly/classification/savings plan, deletion of only its own newly created QA account.

Evidence stored in docs/test-results: browser.json, api-smoke.json, screenshots. Detailed JUnit reports in backend/target/surefire-reports; local command logs in .cache (ignored). TEST_RESULTS.md records final actual counts.

Run:

```sh
.tools/apache-maven-3.9.9/bin/mvn -Dmaven.repo.local="$PWD/.cache/m2" -Ddebug=false -f backend/pom.xml test
cd frontend && npm test
cd ai-service && .venv/bin/python -m pytest tests -q
cd frontend && npm run test:e2e
ai-service/.venv/bin/python scripts/smoke_test.py
```

E2E mặc định dùng native services; E2E_BASE_URL=http://127.0.0.1:8088 kiểm thử bản Docker. Cần demo data. Tests create independent QA accounts; they never access personal data. Different database implementations are not assumed equivalent: H2 tests are complemented by real MySQL smoke and Docker deployment verification.

Environment defects handled: sandbox DNS requires approved network execution; Mockito's subclass mock maker avoids JVM self-attach restriction; H2 NON_KEYWORDS=MONTH matches the MySQL schema; longtext explicitly maps to Hibernate LONGVARCHAR. Tests are not disabled to bypass these defects.

Not yet validated: full screen reader workflow, all UI routes under Axe, production TLS, pentest, sustained load, distributed deployment, real-language generalization, pixel similarity to Stitch. Final passing counts do not imply these checks occurred.

Regression mới: profile/password concurrent updates preserve both fields, recurring execution advances exactly once, frontend retry retains key, and real MySQL 2×200 CSV requests reconcile 400 rows/400 debit.
