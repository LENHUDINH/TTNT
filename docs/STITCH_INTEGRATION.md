# Google Stitch → React

Đã xác minh MCP `list_projects`, `list_screens`, `list_design_systems`, `get_screen` vào 10/10/2026. Dự án duy nhất phù hợp: **FinSight AI Fintech Platform**, `projects/10184604479617457512`. Dự án khác là ứng dụng nhà thuốc, không sửa.

12 màn hình gốc: đăng nhập, đăng ký, quên mật khẩu, tổng quan, giao dịch, ví, ngân sách, tiết kiệm, dự báo AI, bất thường, báo cáo, cài đặt. Metadata trả về được lưu trong `docs/stitch/verified-screens.json`, toàn bộ HTML và ảnh trong `docs/stitch/reference/`. Dashboard được kiểm chứng riêng bằng `get_screen`. Một lượt gọi get_screen song song nhiều màn hình trả lỗi tool; không dùng lượt lỗi đó làm bằng chứng. Các tài nguyên đã tải thành công từ URLs do list_screens trả về.

Đã dùng `generate_screen_from_text` với Design System `assets/a6d535c86f1746cebfcb1789fcf01592` để tạo bốn màn hình còn thiếu, không sửa 12 màn hình gốc:

| Màn hình | Screen ID | React |
|---|---|---|
| Thêm giao dịch | 60ae2ab8577c426fa83420ca7b344177 | Editor + TransactionsPage |
| Chuyển tiền giữa ví | b1c5439be27d4eeb98afb99d06d2f004 | WalletsPage + Editor |
| Chi tiết cảnh báo | 4ca3ac83896143da9a8060f8f70ecc99 | AnomaliesPage + Radix Modal |
| Thông báo | 4669a2f84df240eea1e638bf5ae8a066 | NotificationsPage |

Tên/metadata/HTML/ảnh bổ sung đều lưu trong `additional-screens.json` và `reference/`. Stitch trả thông báo đã bổ sung đủ bốn màn hình và gợi ý tạo biến thể Dark/Mobile; các gợi ý đó chưa được gọi. Dark Mode và responsive của ứng dụng được triển khai theo các quy tắc trong Design System hiện có, không tuyên bố đã truy xuất bản Stitch mobile/dark riêng.

Ánh xạ: navigation → App shell/React Router; metric cards → Metrics; biểu đồ → Recharts; transaction rows → TransactionList; budget/savings → BudgetRows/GoalSummary; overlays → Radix Dialog; forms → React Hook Form + Zod; animation → Motion, có reduced motion.

Giữ palette được trả về, Be Vietnam Pro, nền tím rất nhạt, thẻ trắng, sidebar, bố cục tổng quan và phân cấp màu AI. Điều chỉnh vì yêu cầu kỹ thuật:

- Sidebar 260px theo Design System và các màn hình bổ sung; một số HTML gốc dùng 288px.
- Chữ trắng trên #10B981 có contrast 2.53:1. Kiểm tra Axe phát hiện vi phạm WCAG AA. CTA/navigation dùng Primary #006C49; hover #005236; chữ phụ dùng on_surface_variant #3C4A42 thay outline #6C7A71 khi cần. Tất cả đều thuộc palette Stitch.
- Không đưa số dư, người dùng, metric, % tăng trưởng, số điểm mẫu vào code. Không hiển thị FinSight Pro/đồng bộ giả.
- Thiết kế do Stitch sinh thêm có mô tả IP lạ, tạm khóa thẻ và scan hóa đơn. Dự án không có dữ liệu IP, không khóa ví và không yêu cầu OCR; các phần này không được triển khai thành nút giả. Cảnh báo chỉ giải thích thống kê lịch sử thực.

Chưa đo sai số ảnh pixel-by-pixel với Stitch; các ảnh QA chứng minh layout hoạt động, không chứng minh tương đồng tuyệt đối.

Phản hồi nguyên văn của công cụ và ba gợi ý bổ sung được lưu tại [GENERATION_RESPONSE.md](stitch/GENERATION_RESPONSE.md). Các gợi ý token/Tailwind export, dark variants và mobile390px chưa được gọi; không phải phần đã kiểm chứng.
