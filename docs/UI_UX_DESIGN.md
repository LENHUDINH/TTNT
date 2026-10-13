# UI/UX — Intelligent Wealth Architecture

Nguồn gốc: `docs/stitch/DESIGN.md` và `project-verified.json`. Các tokens được áp dụng trong `frontend/src/styles.css` (`:root`, `.dark`, `@theme`). Font Be Vietnam Pro đóng gói cục bộ qua Fontsource, không phụ thuộc CDN khi mở ứng dụng.

| Vai trò | Light | Dark |
|---|---|---|
| Background | #FAF8FF | #0B1120 |
| Card | #FFFFFF | #151E30 |
| Container low | #F2F3FF | #1E293B |
| Text | #131B2E | #EEF0FF |
| Secondary text | #3C4A42 | #A5B4AD |
| Primary | #006C49 | #4EDEA3 |
| Growth/chart | #10B981 | #10B981 |
| Secondary | #00687A | #57DFFE |
| AI | #494BD6 | #9699FF |
| Error | #BA1A1A | #FFB4AB |

Tokens light lấy từ `namedColors` Stitch; dark từ phần Dark Mode trong DESIGN.md. Điều chỉnh contrast có bằng chứng tại STITCH_INTEGRATION.md.

Typography: trang 25–28px/600, section 17–18px/600, metric 19–32px/700, số liệu bật tabular-nums. Khoảng cách theo lưới 8px, gutter 16–24px, card padding 18–24px. Card radius 16px, nút/input 10–12px, badge bo nhỏ, progress pill. Card shadow nhẹ; modal glass overlay blur 5px, focus trap/Escape/focus return do Radix.

Desktop ≥1280px: sidebar 260px và dashboard hai cột. Tablet 768–1279px: sidebar icon 76px, metrics hai cột. Mobile <768px: bottom navigation, drawer menu, cards một cột, transactions flex wrap, chart responsive. Các màn hình QA: 375, 430, 768, 1024, 1440, 1920px.

Loading/Error/Empty là component chung; dữ liệu đều dùng TanStack Query. Các form dùng label, Zod, lỗi role=alert, input aria-invalid. Radix Dialog có title/description, close label. Skip link và landmark navigation. Motion reducedMotion=user; chart animation tắt khi prefers-reduced-motion. Toast sau mutation, pending disable để tránh click lặp.

Theme lưu ở users.theme trên Backend, gồm light/dark/system. Không lưu session/token trong localStorage. Tooltip của charts do Recharts, dữ liệu đúng API. Các trạng thái AI: READY, INSUFFICIENT_DATA hoặc 503; không tạo forecast mẫu.

Accessibility đã chạy Axe WCAG2A/AA trên Dashboard. Đây là kiểm tra tự động, không thay cho kiểm tra đầy đủ bằng screen reader. Responsive tests chờ dữ liệu tải trước khi kiểm tra overflow.
