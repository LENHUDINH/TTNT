# VAI TRÒ

Bạn là một Senior Software Architect, Full-stack Engineer,
Machine Learning Engineer, UI/UX Engineer, Database Architect,
DevOps Engineer và QA Automation Engineer.

Nhiệm vụ của bạn là phân tích, thiết kế, lập kế hoạch và
triển khai hoàn chỉnh dự án:

FinSight AI – Smart Personal Finance Management

Tên đề tài:
Hệ thống quản lý tài chính cá nhân tích hợp AI dự báo chi tiêu
và phát hiện giao dịch bất thường.

Đây là đồ án nghiên cứu AI kết hợp phát triển ứng dụng Web
theo kiến trúc Client–Server.

Mục tiêu xây dựng một ứng dụng quản lý tài chính cá nhân
hiện đại, có giao diện UI/UX chuyên nghiệp được thiết kế
bằng Google Stitch, có Backend thực tế, Database và các
mô hình Machine Learning được huấn luyện và đánh giá.

YÊU CẦU QUAN TRỌNG:

- Không chỉ tạo giao diện demo.
- Không chỉ tạo dữ liệu hardcode.
- Không chỉ gọi API AI bên ngoài.
- Phải tự huấn luyện các mô hình Machine Learning.
- Phải có hệ thống Backend và Database thực tế.
- Phải triển khai UI/UX dựa trên Google Stitch.
- Phải kiểm thử các chức năng sau khi triển khai.
- Không được tự nhận hoàn thành nếu chưa kiểm chứng.

====================================================
PHẦN 1. KIỂM TRA MÔI TRƯỜNG VÀ REPOSITORY
====================================================

Trước khi thực hiện:

1. Kiểm tra thư mục dự án hiện tại.
2. Kiểm tra các file và cấu trúc repository.
3. Kiểm tra Git status.
4. Xác định công nghệ đang được sử dụng.
5. Kiểm tra Node.js, npm, Java, Maven, Python và MySQL.
6. Kiểm tra các dependency đã cài đặt.
7. Kiểm tra khả năng kết nối Google Stitch MCP.
8. Kiểm tra các công cụ MCP mà Codex có thể sử dụng.
9. Kiểm tra các file cấu hình môi trường.
10. Xác định dự án đã có Backend/Frontend hay chưa.

Nếu repository chưa tồn tại:
- Khởi tạo dự án mới.
- Thiết kế cấu trúc thư mục.
- Khởi tạo Git.
- Tạo .gitignore.
- Tạo .env.example.
- Tạo README.md.

Nếu repository đã tồn tại:
- Giữ nguyên các chức năng đang hoạt động.
- Không tự ý xóa file.
- Không ghi đè code quan trọng.
- Phân tích ảnh hưởng trước khi sửa đổi.

Không yêu cầu người dùng làm thủ công những bước
mà Codex có thể thực hiện bằng công cụ hiện có.

====================================================
PHẦN 2. TÍCH HỢP GOOGLE STITCH MCP
====================================================

Google Stitch là nguồn thiết kế UI/UX chính thức
của dự án FinSight AI.

NHIỆM VỤ:

1. Kiểm tra Stitch MCP đã kết nối hay chưa.
2. Liệt kê các dự án Stitch có quyền truy cập.
3. Tìm dự án có tên "FinSight AI".
4. Truy xuất các màn hình đã được thiết kế.
5. Lấy thông tin thiết kế của từng màn hình.
6. Lấy mã giao diện nếu Stitch hỗ trợ.
7. Lấy hình ảnh và tài nguyên thiết kế nếu có.
8. Phân tích Design System của dự án.
9. Xác định các component dùng chung.
10. Lập bản đồ chuyển đổi Stitch → React.

Các màn hình cần kiểm tra:

- Login
- Register
- Forgot Password
- Dashboard
- Transactions
- Add Transaction
- Wallet Management
- Transfer Money
- Budget Management
- Savings Goals
- AI Spending Forecast
- AI Anomaly Detection
- Anomaly Detail
- Reports
- Settings
- Notifications

Nếu dự án Stitch có tên trùng nhau:
- Hiển thị danh sách để xác định đúng dự án.

Nếu một màn hình chưa tồn tại:
- Sử dụng Stitch MCP để tạo nếu công cụ hỗ trợ.
- Nếu không hỗ trợ, báo rõ màn hình còn thiếu.
- Không tự nhận đã truy xuất thành công.

Nếu Stitch MCP không khả dụng:
- Kiểm tra cấu hình.
- Chẩn đoán lỗi.
- Báo rõ nguyên nhân.
- Không giả lập kết quả từ Stitch.

QUY TẮC:

Stitch là nguồn tham chiếu thiết kế chính.

Không tự ý thay đổi màu sắc, layout hoặc phong cách
khi không có lý do kỹ thuật.

Ưu tiên độ tương đồng cao với thiết kế Stitch.

====================================================
PHẦN 3. PHÂN TÍCH DESIGN SYSTEM TỪ STITCH
====================================================

Trích xuất:

1. Color Palette.
2. Typography.
3. Spacing.
4. Border Radius.
5. Shadows.
6. Layout Grid.
7. Navigation.
8. Buttons.
9. Inputs.
10. Cards.
11. Tables.
12. Charts.
13. Modals.
14. Drawers.
15. Tooltips.
16. Notification Components.
17. Responsive Breakpoints.
18. Light Mode.
19. Dark Mode.

Tạo tài liệu:

docs/UI_UX_DESIGN.md
docs/STITCH_INTEGRATION.md

Tạo hệ thống Design Tokens.

Nếu Stitch chưa cung cấp thông số cụ thể,
sử dụng các giá trị mặc định sau làm phương án dự phòng:

Primary: #10B981
Primary Dark: #059669
Accent: #06B6D4
Dark Navy: #0F172A
Light Background: #F8FAFC
Dark Background: #0B1120
Success: #22C55E
Warning: #F59E0B
Danger: #EF4444

Typography:
Be Vietnam Pro hoặc Inter.

Phong cách:
Modern Premium Fintech SaaS Dashboard.

Không áp dụng giá trị mặc định để ghi đè thiết kế
đã được Stitch cung cấp.

====================================================
PHẦN 4. CÔNG NGHỆ BẮT BUỘC
====================================================

FRONTEND:

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Radix UI
- Motion for React
- React Router
- TanStack Query
- React Hook Form
- Zod
- Recharts
- Lucide React

BACKEND:

- Java 21
- Spring Boot
- Spring Security
- Spring Data JPA
- Hibernate
- RESTful API
- Maven
- Bean Validation

DATABASE:

- MySQL 8+
- Flyway Migration
- DECIMAL cho dữ liệu tiền tệ

AI SERVICE:

- Python 3.11+
- FastAPI
- Scikit-learn
- XGBoost
- Pandas
- NumPy
- Joblib
- Matplotlib

DEVOPS:

- Docker
- Docker Compose
- Environment Variables
- Git

Kiểm tra tính tương thích phiên bản trước khi cài đặt.

====================================================
PHẦN 5. KIẾN TRÚC HỆ THỐNG
====================================================

Sử dụng kiến trúc:

React Frontend
       |
       v
Spring Boot REST API
       |
       +----------> MySQL
       |
       +----------> FastAPI AI Service
                          |
                          v
                   Trained ML Models

YÊU CẦU:

- Frontend không gọi trực tiếp AI Service.
- Spring Boot xử lý xác thực và nghiệp vụ.
- MySQL lưu dữ liệu người dùng.
- FastAPI thực hiện AI inference.
- Các mô hình được huấn luyện trước.
- Không huấn luyện lại mỗi lần gọi API.
- Tách biệt dữ liệu giữa các tài khoản.
- Có xử lý lỗi khi AI Service không hoạt động.
- Các chức năng tài chính cơ bản vẫn sử dụng được
  khi dịch vụ AI bị gián đoạn.

CẤU TRÚC DỰ ÁN:

finsight-ai/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   ├── layout/
│   │   │   ├── charts/
│   │   │   └── finance/
│   │   ├── features/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/
├── backend/
│   └── src/main/java/com/finsight/
│       ├── auth/
│       ├── user/
│       ├── wallet/
│       ├── transaction/
│       ├── budget/
│       ├── savings/
│       ├── analytics/
│       ├── ai/
│       ├── security/
│       └── config/
├── ai-service/
│   ├── app/
│   │   ├── api/
│   │   ├── models/
│   │   ├── inference/
│   │   ├── preprocessing/
│   │   └── schemas/
│   ├── training/
│   ├── datasets/
│   ├── artifacts/
│   └── tests/
├── database/
├── docs/
├── docker-compose.yml
├── .env.example
└── README.md

====================================================
PHẦN 6. CHỨC NĂNG TÀI KHOẢN
====================================================

Triển khai:

- Đăng ký.
- Đăng nhập.
- Đăng xuất.
- Quản lý hồ sơ.
- Đổi mật khẩu.
- Quản lý phiên đăng nhập.
- Cài đặt tài khoản.
- Xóa tài khoản.

Bảo mật:

- BCrypt hoặc Argon2.
- Authentication và Authorization.
- Session cookie HttpOnly/Secure/SameSite
  hoặc cơ chế token an toàn tương đương.
- CSRF protection phù hợp với phương thức xác thực.
- CORS configuration.
- Rate limiting.
- Input validation.
- Không lưu mật khẩu dạng plaintext.
- Không lưu token nhạy cảm trong localStorage.

====================================================
PHẦN 7. QUẢN LÝ VÍ TÀI CHÍNH
====================================================

Chức năng:

- Tạo ví.
- Sửa thông tin ví.
- Xóa hoặc lưu trữ ví.
- Xem số dư.
- Xem lịch sử giao dịch.
- Chuyển tiền giữa các ví.
- Thống kê tài sản.

Các loại ví:

- Tiền mặt.
- Ngân hàng giả lập.
- Ví điện tử giả lập.
- Tiết kiệm.

Yêu cầu nghiệp vụ:

- Chuyển tiền phải được xử lý atomically.
- Không tính chuyển ví là thu nhập hoặc chi tiêu.
- Không tạo giao dịch trùng.
- Kiểm tra số dư hợp lệ.
- Bảo đảm tính nhất quán dữ liệu.

Không thực hiện chuyển tiền ngân hàng thật.

====================================================
PHẦN 8. QUẢN LÝ THU NHẬP VÀ CHI TIÊU
====================================================

Triển khai:

- Thêm thu nhập.
- Thêm chi tiêu.
- Chỉnh sửa giao dịch.
- Xóa giao dịch.
- Tìm kiếm.
- Lọc theo ngày.
- Lọc theo danh mục.
- Lọc theo ví.
- Sắp xếp.
- Phân trang.
- Import CSV.
- Export Excel/PDF.
- Giao dịch định kỳ.

Danh mục:

- Ăn uống.
- Mua sắm.
- Đi lại.
- Học tập.
- Giải trí.
- Nhà ở.
- Hóa đơn.
- Sức khỏe.
- Thu nhập.
- Khác.

Cho phép tạo danh mục tùy chỉnh.

Khi dữ liệu giao dịch thay đổi:

- Cập nhật số dư.
- Cập nhật Dashboard.
- Cập nhật ngân sách.
- Cập nhật báo cáo.
- Làm mới dữ liệu AI khi phù hợp.

====================================================
PHẦN 9. QUẢN LÝ NGÂN SÁCH
====================================================

Triển khai:

- Tạo ngân sách tháng.
- Ngân sách theo danh mục.
- Theo dõi mức sử dụng.
- Progress Bar.
- Cảnh báo vượt ngân sách.
- So sánh các tháng.
- AI dự báo khả năng vượt ngân sách.

Ngưỡng cảnh báo:

70%: Thông báo.
90%: Cảnh báo.
100%: Vượt ngân sách.

Không tạo thông báo trùng lặp liên tục.

====================================================
PHẦN 10. MỤC TIÊU TIẾT KIỆM
====================================================

Triển khai:

- Tạo mục tiêu.
- Chỉnh sửa mục tiêu.
- Xóa mục tiêu.
- Số tiền mục tiêu.
- Ngày hoàn thành.
- Theo dõi tiến độ.
- Lịch sử đóng góp.
- Thống kê mục tiêu.
- AI gợi ý kế hoạch tiết kiệm.

Không tự động chuyển tiền nếu người dùng
chưa xác nhận.

====================================================
PHẦN 11. AI DỰ BÁO CHI TIÊU
====================================================

Đây là mô hình AI chính thứ nhất.

Nghiên cứu:

1. Moving Average / Seasonal Naive.
2. Random Forest Regressor.
3. XGBoost Regressor.

Mục tiêu:

- Dự báo chi tiêu ngày tiếp theo.
- Dự báo 7 ngày.
- Dự báo 30 ngày.
- Dự báo cuối tháng.
- Dự báo nguy cơ vượt ngân sách.

FEATURES:

- Daily spending.
- Lag 1.
- Lag 7.
- Lag 14.
- Lag 30.
- Rolling mean 7.
- Rolling mean 30.
- Day of week.
- Month.
- Weekend indicator.
- Recurring expenses.

TRAINING:

- Thu thập hoặc tạo dataset.
- Data cleaning.
- Feature engineering.
- Chronological train/validation/test split.
- Backtesting.
- Baseline comparison.
- Hyperparameter tuning.
- Model evaluation.
- Model selection.
- Model serialization.

METRICS:

- MAE.
- RMSE.

Yêu cầu:

- Không data leakage.
- Không sử dụng dữ liệu tương lai.
- Không tạo metric giả.
- Không tuyên bố mô hình tốt nhất trước khi đánh giá.
- Lưu model version.
- Lưu training metadata.
- Hiển thị kết quả dự báo thực tế từ mô hình.

Nếu dữ liệu người dùng không đủ:
- Hiển thị trạng thái Insufficient Data.
- Không tạo dự báo giả.
- Có thể dùng baseline nếu được giải thích rõ.

====================================================
PHẦN 12. AI PHÁT HIỆN GIAO DỊCH BẤT THƯỜNG
====================================================

Đây là mô hình AI chính thứ hai.

Thuật toán:

Isolation Forest.

FEATURES:

- Transaction amount.
- Transaction hour.
- Day of week.
- Transaction category.
- Transaction frequency.
- Historical average spending.
- Amount ratio.
- Spending deviation.

Chức năng:

- Phân tích giao dịch.
- Tính anomaly score.
- Xác định giao dịch cần kiểm tra.
- Lưu cảnh báo.
- Hiển thị mức độ bất thường.
- Hiển thị thông tin giao dịch.
- Cho phép người dùng đánh dấu hợp lệ.
- Cho phép đánh dấu đã kiểm tra.
- Thống kê cảnh báo.

METRICS:

- Precision.
- Recall.
- F1-score.
- Confusion Matrix.
- False Positive Rate.

Yêu cầu:

- Có dữ liệu kiểm thử được gán nhãn.
- Điều chỉnh threshold.
- Giảm false positives.
- Không tự động khóa ví.
- Không kết luận giao dịch bất thường là gian lận.
- Không tự tạo lời giải thích thiếu căn cứ.

====================================================
PHẦN 13. AI PHÂN LOẠI GIAO DỊCH
====================================================

Đây là tính năng AI mở rộng.

Thuật toán:

TF-IDF + Logistic Regression.

Ví dụ:

"Mua cơm trưa" → Ăn uống.
"Đổ xăng" → Đi lại.
"Đóng học phí" → Học tập.
"Mua laptop" → Mua sắm.

Yêu cầu:

- Hỗ trợ tiếng Việt.
- Text preprocessing.
- Dataset có nhãn.
- Accuracy.
- Macro F1.
- Confusion Matrix.
- Cho phép sửa danh mục dự đoán.
- Lưu phản hồi để cải thiện mô hình.

Ưu tiên thực hiện sau hai mô hình AI chính.

====================================================
PHẦN 14. DATABASE DESIGN
====================================================

Thiết kế các bảng:

users
wallets
categories
transactions
transfers
budgets
savings_goals
savings_contributions
ai_predictions
anomaly_alerts
model_versions
notifications
audit_logs

Yêu cầu:

- Primary keys.
- Foreign keys.
- Indexes.
- Unique constraints.
- Timestamps.
- Flyway migrations.
- Transaction integrity.
- Data isolation.
- Không dùng FLOAT cho tiền tệ.
- Không lưu dữ liệu dư thừa không cần thiết.

Tạo ERD và tài liệu database.

====================================================
PHẦN 15. TRIỂN KHAI FRONTEND THEO STITCH
====================================================

Sử dụng thiết kế Google Stitch đã truy xuất
làm nguồn tham chiếu chính.

Frontend bắt buộc:

React + TypeScript + Tailwind CSS + shadcn/ui.

Yêu cầu:

- Chuyển thiết kế Stitch thành React Components.
- Component tái sử dụng.
- Clean architecture.
- Responsive.
- Light/Dark Mode.
- Accessible UI.
- Loading states.
- Error states.
- Empty states.
- Form validation.
- API integration.
- Không hardcode dữ liệu nghiệp vụ.

Các màn hình:

1. Authentication.
2. Dashboard.
3. Transactions.
4. Wallets.
5. Budgets.
6. Savings.
7. AI Forecast.
8. Anomaly Detection.
9. Reports.
10. Settings.

Ưu tiên:

Dashboard
→ Transactions
→ Wallets
→ Budgets
→ Savings
→ AI Forecast
→ Anomaly Detection
→ Reports
→ Settings.

====================================================
PHẦN 16. ANIMATION VÀ MICRO-INTERACTIONS
====================================================

Sử dụng Motion for React.

Triển khai:

- Page transitions.
- Sidebar transitions.
- Card entrance animations.
- Staggered animations.
- Hover effects.
- Button feedback.
- Modal transitions.
- Drawer transitions.
- Tab animations.
- Animated progress bars.
- Chart transitions.
- Number animations.
- Toast notifications.
- Skeleton loading.

Yêu cầu:

- Mượt mà.
- Không giật lag.
- Không lạm dụng hiệu ứng.
- Không gây layout shift.
- Hỗ trợ prefers-reduced-motion.
- Tối ưu trên mobile.

Animation phải nâng cao UX,
không làm giảm khả năng sử dụng.

====================================================
PHẦN 17. DASHBOARD
====================================================

Thiết kế sát Google Stitch.

Bao gồm:

- Tổng số dư.
- Thu nhập tháng.
- Chi tiêu tháng.
- Số tiền còn lại.
- Biểu đồ thu chi.
- Biểu đồ danh mục.
- Danh sách giao dịch gần đây.
- Tiến độ ngân sách.
- AI Insights.
- Dự báo chi tiêu.
- Cảnh báo bất thường.

Tất cả dữ liệu lấy từ Backend API.

====================================================
PHẦN 18. AI FORECAST DASHBOARD
====================================================

Triển khai:

- Forecast 7 days.
- Forecast 30 days.
- Month-end forecast.
- Historical spending chart.
- Predicted spending chart.
- Model information.
- MAE/RMSE.
- Forecast history.
- Budget risk warning.
- Insufficient data state.

Phân biệt dữ liệu thực tế và dự báo.

Không hiển thị độ tin cậy hoặc metric
nếu chưa được tính toán hợp lệ.

====================================================
PHẦN 19. ANOMALY DETECTION DASHBOARD
====================================================

Triển khai:

- Tổng giao dịch phân tích.
- Tổng cảnh báo.
- Cảnh báo chưa xử lý.
- Cảnh báo đã xử lý.
- Danh sách giao dịch bất thường.
- Mức độ bất thường.
- Chi tiết cảnh báo.
- Biểu đồ bất thường.
- Lịch sử cảnh báo.
- User feedback.

Không gọi cảnh báo là bằng chứng gian lận.

====================================================
PHẦN 20. RESPONSIVE DESIGN
====================================================

Desktop:
1440px, 1920px.

Tablet:
768px, 1024px.

Mobile:
375px, 430px.

Yêu cầu:

- Responsive grid.
- Collapsible sidebar.
- Mobile navigation.
- Mobile-friendly transaction cards.
- Responsive charts.
- Touch-friendly controls.
- Không horizontal overflow.
- Không mất chức năng trên mobile.

====================================================
PHẦN 21. LIGHT MODE / DARK MODE
====================================================

Hỗ trợ:

- Light.
- Dark.
- System preference.

Lưu tùy chọn người dùng.

Giữ màu sắc và component nhất quán
với thiết kế Stitch.

====================================================
PHẦN 22. TESTING
====================================================

BACKEND:

- Unit tests.
- Integration tests.
- Authentication tests.
- Transaction integrity tests.
- Authorization tests.

FRONTEND:

- Component tests.
- Form tests.
- Responsive tests.
- Accessibility checks.

AI:

- Training pipeline tests.
- Data leakage tests.
- Evaluation tests.
- Model loading tests.
- Inference API tests.

END-TO-END:

- Register/Login.
- Create wallet.
- Add income.
- Add expense.
- Transfer between wallets.
- Create budget.
- Create savings goal.
- Forecast spending.
- Detect anomalous transaction.
- Export reports.

Sau mỗi giai đoạn:

- Chạy build.
- Chạy test.
- Sửa lỗi.
- Kiểm tra chức năng.
- Cập nhật tiến độ.

====================================================
PHẦN 23. DỮ LIỆU DEMO
====================================================

Tạo bộ dữ liệu giả lập:

- 10–20 tài khoản demo.
- 6–12 tháng lịch sử.
- Thu nhập định kỳ.
- Chi tiêu hằng ngày.
- Chi phí định kỳ.
- Chi tiêu cuối tuần.
- Giao dịch bất thường có nhãn.

Yêu cầu:

- Reproducible random seed.
- Không sử dụng dữ liệu cá nhân thật.
- Tách training/test.
- Không dùng dữ liệu test để train.
- Có demo seeding script.
- Có chức năng reset demo data.

Demo phải sử dụng Backend và Database thật.

====================================================
PHẦN 24. TÀI LIỆU
====================================================

Tạo:

README.md
PROJECT_PLAN.md
REQUIREMENTS.md
ARCHITECTURE.md
DATABASE_DESIGN.md
API_DOCUMENTATION.md
AI_MODEL_REPORT.md
UI_UX_DESIGN.md
STITCH_INTEGRATION.md
TEST_PLAN.md
DEPLOYMENT.md

Tài liệu phải giải thích:

- Cấu trúc hệ thống.
- Kiến trúc Client–Server.
- Database.
- API.
- Thuật toán AI.
- Training pipeline.
- Evaluation metrics.
- Stitch integration.
- UI/UX design.
- Testing.
- Deployment.

====================================================
PHẦN 25. KẾ HOẠCH TRIỂN KHAI
====================================================

PHASE 1:
Repository Inspection & Requirements Analysis.

PHASE 2:
Google Stitch MCP Integration & UI/UX Analysis.

PHASE 3:
System Architecture & Database Design.

PHASE 4:
Frontend Design System & Application Shell.

PHASE 5:
Authentication & User Management.

PHASE 6:
Wallet & Transaction Management.

PHASE 7:
Budget & Savings Management.

PHASE 8:
Dashboard & Financial Analytics.

PHASE 9:
AI Dataset Preparation & Model Training.

PHASE 10:
FastAPI AI Service & Spring Boot Integration.

PHASE 11:
AI Forecast & Anomaly Detection UI.

PHASE 12:
Testing, Security & Performance Optimization.

PHASE 13:
Deployment & Documentation.

Tạo checklist chi tiết cho từng phase.

Mỗi phase cần có:

- Mục tiêu.
- Công việc.
- File cần tạo/sửa.
- Dependency.
- Acceptance Criteria.
- Test Cases.
- Trạng thái hoàn thành.

====================================================
PHẦN 26. QUY TẮC TRIỂN KHAI
====================================================

1. Kiểm tra code hiện tại trước khi sửa.
2. Không xóa chức năng đang hoạt động.
3. Không tạo dữ liệu hardcode thay Backend.
4. Không tạo nút không có chức năng.
5. Không tạo API giả trong bản hoàn thiện.
6. Không giả lập kết quả huấn luyện AI.
7. Không bịa metric.
8. Không bỏ qua lỗi build.
9. Không bỏ qua lỗi TypeScript.
10. Không bỏ qua lỗi Spring Boot.
11. Không bỏ qua lỗi Database.
12. Không bỏ qua lỗi AI Service.
13. Không tự ý thay đổi thiết kế Stitch.
14. Không commit secrets.
15. Không để API Key trong source code.
16. Không tự nhận đã kết nối Stitch nếu chưa xác minh.
17. Không tự nhận hoàn thành nếu chưa test.
18. Giữ code clean và dễ bảo trì.
19. Ưu tiên chức năng hoạt động trước mở rộng.
20. Cập nhật PROJECT_PLAN.md sau mỗi phase.

Nếu thiếu thông tin:
- Tự xác định phương án hợp lý khi có thể.
- Ghi lại giả định kỹ thuật.
- Chỉ hỏi người dùng khi cần quyết định quan trọng.

====================================================
PHẦN 27. YÊU CẦU KẾT QUẢ
====================================================

Kết quả cần có:

- React Frontend hoàn chỉnh.
- UI/UX đồng nhất với Google Stitch.
- Responsive Desktop/Tablet/Mobile.
- Light/Dark Mode.
- Animation.
- Java Spring Boot Backend.
- MySQL Database.
- Authentication.
- Wallet Management.
- Transaction Management.
- Budget Management.
- Savings Goals.
- Financial Dashboard.
- AI Spending Forecast.
- AI Anomaly Detection.
- FastAPI AI Service.
- Trained ML Models.
- Training Scripts.
- Model Evaluation Reports.
- API Documentation.
- Demo Dataset.
- Docker Compose.
- Testing.
- Deployment Guide.

====================================================
PHẦN 28. BẮT ĐẦU THỰC HIỆN
====================================================

Bây giờ hãy bắt đầu làm việc trong IDE.

THỨ TỰ:

1. Kiểm tra repository.
2. Kiểm tra Google Stitch MCP.
3. Truy cập dự án FinSight AI trên Stitch.
4. Phân tích toàn bộ thiết kế hiện có.
5. Kiểm tra môi trường phát triển.
6. Phân tích yêu cầu hệ thống.
7. Thiết kế kiến trúc.
8. Thiết kế Database.
9. Lập PROJECT_PLAN.md.
10. Xác định MVP.
11. Triển khai theo các phase đã định nghĩa.
12. Kiểm thử sau mỗi phase.
13. Cập nhật tiến độ.
14. Tiếp tục phase tiếp theo khi đủ điều kiện.

ƯU TIÊN QUAN TRỌNG:

- Đầu tiên xây dựng nền tảng chạy được.
- Sau đó triển khai UI/UX theo Stitch.
- Tiếp theo hoàn thiện Backend và Database.
- Sau đó huấn luyện AI và tích hợp.
- Cuối cùng kiểm thử và tối ưu toàn hệ thống.

Không dừng lại ở việc tạo tài liệu kế hoạch
nếu môi trường đã sẵn sàng triển khai.

Tuy nhiên, không được bỏ qua kiểm thử
hoặc tuyên bố hoàn thành các phần chưa thực hiện.

MỤC TIÊU CUỐI CÙNG:

Xây dựng FinSight AI thành một ứng dụng
quản lý tài chính cá nhân thông minh,
giao diện hiện đại theo Google Stitch,
có Backend thực tế, Database hoàn chỉnh,
AI được huấn luyện và đánh giá,
có khả năng chạy trên localhost
và đủ chất lượng để nghiên cứu,
trình diễn và bảo vệ đồ án tốt nghiệp.