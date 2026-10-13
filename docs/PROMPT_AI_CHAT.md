# Prompt mở rộng FinSight: AI được huấn luyện và chat tư vấn riêng

Bạn là Senior Full-stack Engineer, Machine Learning Engineer và Software Architect. Hãy trực tiếp triển khai tính năng AI Chat tư vấn tài chính cá nhân trên dự án FinSight hiện tại, bao gồm code, database migration, pipeline huấn luyện, kiểm thử và tài liệu vận hành. Không dừng ở bản thiết kế hoặc giao diện mockup.

## 1. Bối cảnh cần giữ

- Frontend: React, TypeScript, Vite, Tailwind, Radix, TanStack Query.
- Backend: Java21, Spring Boot, JPA, Flyway, session cookie và CSRF.
- AI service: Python, FastAPI, scikit-learn, XGBoost; đã có dự báo, Isolation Forest và phân loại mô tả tiếng Việt.
- Database: XAMPP MariaDB10.4.28, database `finsight`, port3306. Giữ cấu hình XAMPP và dữ liệu hiện có.
- Website hiện chạy tại http://127.0.0.1:8088.

Đọc README, tài liệu kiến trúc, API, AI_MODEL_REPORT và code trước khi sửa. Tái sử dụng nghiệp vụ, authentication, design system và pipeline đang có. Không tạo một ứng dụng tách rời hoặc chuyển database trở lại Docker MySQL.

## 2. Trang chat riêng cho mỗi người dùng

Thêm mục “Chat tư vấn AI” trong sidebar, route `/ai-chat`, chỉ truy cập sau đăng nhập.

Giao diện gồm danh sách hội thoại bên trái và khung chat bên phải; trên mobile dùng drawer. Hỗ trợ tạo hội thoại mới, đặt tên/đổi tên, xóa, tìm kiếm, phân trang lịch sử, tiếp tục hội thoại sau reload và nút dừng phản hồi.

Hiển thị tin nhắn người dùng/trợ lý rõ ràng, thời gian, Markdown được sanitize, loading, lỗi, retry và trạng thái AI chưa cấu hình. Streaming nếu phù hợp kiến trúc. Retry phải tránh tạo trùng tin nhắn bằng clientMessageId/idempotency. Không hiển thị nội dung suy luận nội bộ của mô hình.

Có câu hỏi gợi ý: “Tháng này tôi chi nhiều nhất vào đâu?”, “Tôi còn bao nhiêu ngân sách?”, “Tôi nên tiết kiệm bao nhiêu mỗi tháng?”, “Dự báo chi tiêu 30 ngày tới”, “Có giao dịch nào cần xem lại?”.

## 3. Chat dựa trên dữ liệu thật

Luồng: Frontend → Spring Boot → FastAPI/LLM provider. Frontend không giữ API key và không gọi trực tiếp AI service hoặc database.

Xây dựng bộ công cụ đọc dữ liệu có phân quyền: tổng hợp dòng tiền theo kỳ, chi tiêu theo danh mục, số dư ví, tình trạng ngân sách, mục tiêu tiết kiệm, lịch sử và dự báo chi tiêu, cảnh báo bất thường.

Backend tính tiền, tổng và tỷ lệ bằng nghiệp vụ hiện có; LLM diễn giải kết quả. Không giao cho LLM tự cộng số tiền hoặc sinh SQL tùy ý. Mỗi câu trả lời sử dụng số liệu phải kèm kỳ thời gian, nguồn dữ liệu và thời điểm truy xuất. Phân biệt dữ liệu thực tế, dự báo và giả định của một kịch bản.

Thiếu dữ liệu phải nói rõ và hỏi thêm. Không bịa số dư, accuracy, confidence, nguồn tham khảo hoặc cam kết lợi nhuận. Phát hiện bất thường là tín hiệu cần xem lại, không phải kết luận gian lận.

## 4. Tích hợp mô hình hội thoại

Tạo interface provider để có thể cấu hình mô hình local qua Ollama hoặc dịch vụ LLM tương thích khi có cấu hình hợp lệ. Kiểm tra tài nguyên và môi trường thực tế trước khi chọn mô hình. Dùng engine thật để trả lời, không giả lập chatbot bằng các câu trả lời cố định.

Tách system prompt, lịch sử hội thoại, context tài chính có giới hạn và kết quả công cụ. Giới hạn token, số lần gọi công cụ, timeout, retry và rate limit theo người dùng. Không giữ transaction database mở trong lúc chờ LLM.

Không mặc định gửi dữ liệu tài chính cá nhân cho dịch vụ bên ngoài. Khi dùng provider bên ngoài, có lựa chọn và giải thích rõ trong cài đặt người dùng; chỉ gửi dữ liệu tối thiểu cần thiết. Thiếu model/key phải báo trạng thái chưa cấu hình, không giả vờ đã hoạt động.

## 5. Huấn luyện AI thật

Phân biệt rõ mô hình ML tài chính và LLM hội thoại. Tích hợp một API LLM không đồng nghĩa đã train chatbot.

Mở rộng và chạy lại pipeline huấn luyện dự báo, bất thường và phân loại tiếng Việt đang có. Dữ liệu tổng hợp phải được ghi nhãn là tổng hợp; không tự sử dụng dữ liệu/chat thật của người dùng để train. Nếu dùng dữ liệu thực tế cần có quyền sử dụng, loại thông tin nhận dạng và quản lý phiên bản dataset.

Chia train/validation/test theo thời gian và người dùng phù hợp từng bài toán; loại câu trùng hoặc gần trùng giữa các tập, chống sử dụng dữ liệu tương lai. Có baseline và chọn model bằng validation; test chỉ dùng đánh giá cuối.

Xuất metric đo thật: MAE/RMSE cho dự báo; precision/recall/F1 và false-positive rate cho bất thường; macro-F1 và confusion matrix cho phân loại. Lưu model artifact, seed, dataset hash, preprocessing, model version và báo cáo hạn chế.

Training chạy offline, không chạy trong request chat. Có lệnh tái tạo, kiểm tra artifact trước khi nạp và giữ model trước đó để phục hồi. Không đưa một model mới lên phục vụ chỉ vì training chạy xong; so sánh baseline và báo cáo kết quả.

Nếu fine-tune LLM tư vấn tiếng Việt: đánh giá tài nguyên trước, dùng bộ hội thoại được phép sử dụng và đã ẩn danh, có tập đánh giá độc lập và so sánh trước/sau. Không train LLM từ đầu hoặc gọi retrieval/context là fine-tuning. Nếu chưa thực hiện được, ghi đúng trạng thái; vẫn hoàn thành tích hợp chat với engine thật và pipeline ML tài chính.

## 6. Database và API

Tạo migration Flyway kế tiếp, không sửa V1/V2 đã áp dụng. Tối thiểu có `chat_conversations`, `chat_messages`, `chat_feedback`; lưu training runs vào metadata hiện có hoặc bảng riêng nếu cần.

Conversation có user_id, title, created_at, updated_at. Message có conversation_id, role, content, status, client_message_id, model_version, created_at và metadata nguồn dữ liệu cần thiết. Thiết kế FK, index, unique constraint chống retry trùng. Khi xóa tài khoản phải xử lý cả dữ liệu chat; không gây lỗi nghiệp vụ xóa tài khoản đang có.

API tối thiểu: tạo/liệt kê/đổi tên/xóa hội thoại, lấy tin nhắn có phân trang, gửi tin nhắn/nhận phản hồi và gửi feedback. Giữ chuẩn lỗi, cookie và CSRF hiện có. SSE/streaming phải hoạt động qua nginx và hỗ trợ hủy request; ghi rõ trạng thái phản hồi dang dở.

## 7. Quyền riêng tư và thao tác tài chính

Mọi truy vấn lấy userId từ principal trên Backend. Kiểm tra quyền sở hữu conversation, message và từng dữ liệu tài chính; không tin userId/conversationId do client hoặc LLM cung cấp. Cache, context và lịch sử phải cách ly giữa các tài khoản.

Tin nhắn và mô tả giao dịch là dữ liệu không tin cậy: chống prompt injection, công cụ chỉ được gọi theo allowlist đã kiểm tra quyền. Không đưa mật khẩu, token, service key hoặc dữ liệu người khác vào prompt/log.

Chat mặc định chỉ tư vấn và đọc dữ liệu. Nếu hỗ trợ tạo ngân sách hoặc mục tiêu, hiển thị bản xem trước và yêu cầu người dùng xác nhận rõ rồi mới gọi API nghiệp vụ. Không tự chuyển tiền, tự tạo giao dịch hoặc tự khóa ví từ kết quả AI.

Feedback có thể hỗ trợ đánh giá và tuyển chọn dataset sau này, nhưng không tự động lấy toàn bộ chat để train hoặc tự đổi model đang phục vụ.

## 8. Kiểm thử và nghiệm thu

Kiểm chứng hai tài khoản không xem/xóa/sửa hội thoại của nhau; câu trả lời có số liệu khớp kết quả Backend/SQL trong cùng kỳ; chat tiếp tục đúng sau reload; retry không tạo trùng; xóa tài khoản xử lý đúng các FK mới.

Thử dữ liệu trống, ngày/kỳ mơ hồ, thiếu model, timeout, AI lỗi, prompt injection, dừng streaming và nhiều request đồng thời. Tài chính hiện có vẫn hoạt động khi AI lỗi.

Chạy kiểm thử nghiệp vụ Backend, AI, giao diện và E2E phù hợp thay đổi. Kiểm tra responsive, light/dark, keyboard và trạng thái lỗi. Chạy pipeline train thật và lưu kết quả đánh giá có thể tái tạo; không ghi “đã train/đã test” nếu chưa chạy.

## 9. Kết quả bàn giao

Bàn giao code hoạt động, migration an toàn, cấu hình mẫu không chứa secrets, lệnh train/inference, tài liệu API, hướng dẫn chạy chat và báo cáo kiểm thử/metric thật. Cập nhật README và PROJECT_PLAN.

Triển khai theo thứ tự: kiểm tra repo → database/API chat → công cụ tài chính → provider AI → UI chat → huấn luyện/đánh giá → kiểm thử end-to-end. Làm đến khi có thể đăng nhập, mở trang chat riêng, hỏi về dữ liệu tài chính của mình và nhận câu trả lời từ AI thật. Báo rõ phần đã chạy và giới hạn còn lại; không đánh dấu hoàn tất bằng mock UI.
