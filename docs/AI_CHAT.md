# Chat tư vấn AI riêng trong FinSight

Trang `/ai-chat` tích hợp vào sidebar và dùng phiên đăng nhập hiện có. Mỗi tài khoản có hội thoại, tin nhắn, feedback và lựa chọn quyền riêng tư riêng trong database XAMPP `finsight`. Flyway V3 thêm `chat_conversations`, `chat_messages`, `chat_feedback`, `chat_preferences`; không sửa V1/V2.

Giao diện hỗ trợ tạo/đổi tên/xóa/tìm hội thoại, phân trang, reload tiếp tục đúng hội thoại bằng URL `?id=`, câu hỏi gợi ý, kỳ tháng, feedback, retry cùng ID và dừng phản hồi. Desktop có hai cột; mobile dùng drawer. Markdown không thực thi HTML hoặc ảnh từ phản hồi AI. Tin nhắn có PENDING/COMPLETED/FAILED/CANCELLED.

## Engine và dữ liệu

Luồng Browser → Spring Boot → FastAPI → Ollama local. Backend tạo snapshot đọc của đúng chủ sở hữu: thu/chi theo kỳ, số dư, ngân sách, danh mục và mục tiêu. Tiền và phép tính sử dụng BigDecimal; số tiền gửi sang AI là chuỗi thập phân. Không gửi mật khẩu, email, user ID, token, raw mô tả giao dịch hoặc SQL vào prompt LLM.

Model chat hiện cấu hình `qwen3:1.7b`, chạy bằng Ollama trên host macOS8GB RAM, ngoài Colima2GB. Đây là model có sẵn, **chưa fine-tune LLM**. Pipeline ML tài chính riêng được train lại với version `synthetic-v2-f630a4ccb782`; xem [báo cáo thực đo](AI_MODEL_REPORT.md).

LLM nhận tham chiếu fact cùng quan hệ định tính đã tính sẵn; các giá trị số tài chính trong fact được giữ phía verifier. Tiền trong lịch sử cũng được đánh dấu để tránh sao chép sang kỳ hiện tại. LLM trả JSON với tham chiếu `{{fact:ID}}`. Ollama nhận JSON schema có grammar chỉ cho phép tham chiếu trong allowlist và không cho viết chữ số ngoài tham chiếu khi giải mã. Server tiếp tục kiểm tra ID/số liệu, thay tham chiếu bằng số liệu decimal đã kiểm chứng rồi mới lưu phản hồi. Câu hỏi cụ thể về số dư/danh mục cao nhất/dự báo/cảnh báo luôn kèm fact tương ứng. Nếu LLM chưa trích dẫn đủ trong lời diễn giải, server thêm mục bằng chứng từ snapshot đã kiểm chứng; không tự sinh số hoặc câu trả lời LLM giả. UI hiển thị các fact và nguồn cùng kỳ/thời điểm truy xuất. Cơ chế này giảm số liệu bịa nhưng không bảo đảm mọi nhận xét định tính của LLM đều đúng. Provider compatible dùng validation/retry, chưa được kiểm chứng với dịch vụ bên ngoài thật.

Khi hỏi dự báo/tiết kiệm/bất thường, FastAPI gọi đúng mô hình ML hiện có bằng dữ liệu chi tiêu có giới hạn do Backend cung cấp. Phân biệt ACTUAL, FORECAST và SCENARIO; trạng thái thiếu dữ liệu được giữ. Dự báo và anomaly dùng tối đa1000 giao dịch gần đây; có thể khác màn hình phân tích đầy đủ. Không diễn giải điểm anomaly là xác suất hay bằng chứng gian lận.

Chat chỉ đọc dữ liệu và tư vấn; không tự ghi giao dịch, chuyển tiền hoặc sửa ngân sách. Feedback không tự động đưa vào dataset hoặc đổi model phục vụ. Dữ liệu huấn luyện hiện là tổng hợp/corpus biên soạn, không lấy dữ liệu thật của tài khoản.

## Chạy local

Ollama đã cài trên máy này; weights đặt trong ignored `.cache/ollama/models` (khoảng1,4GB cho model đang dùng). Chạy engine ở terminal riêng:

```sh
sh scripts/run_ollama.sh
```

Lần đầu hoặc trên máy mới, tải model khi server đang chạy:

```sh
ollama pull qwen3:1.7b
```

Sau đó bật MySQL XAMPP và chạy:

```sh
sh scripts/compose.sh up --build -d
```

Native FastAPI dùng OLLAMA_URL=`http://127.0.0.1:11434`; Docker dùng CONTAINER_OLLAMA_URL=`http://host.docker.internal:11434`. `run_ollama.sh` bind loopback, tắt cloud, giới hạn một model/một generation và context4096. Không đăng ký launch-at-login. Đóng terminal engine thì chat báo chưa sẵn sàng; tài chính vẫn hoạt động.

Cấu hình `.env.example`: CHAT_PROVIDER, CHAT_MODEL, OLLAMA_URL/CONTAINER_OLLAMA_URL. Provider `compatible` có CHAT_API_URL trỏ tới API base tương thích `/chat/completions` và CHAT_API_KEY riêng trong `.env`0600. Không lưu key vào frontend. Provider bên ngoài hoặc model Ollama cloud yêu cầu người dùng bật externalConsent rõ ràng trước khi gửi context; mặc định tắt.

## REST API

| Method | Path dưới `/api/chat` | Payload / kết quả |
|---|---|---|
| GET | /status | configured, provider, model, external, externalConsent, message |
| GET/PUT | /preferences | externalConsent boolean |
| GET/POST | /conversations | search/page/size hoặc title; danh sách riêng |
| PATCH/DELETE | /conversations/{id} | đổi title / xóa cả tin nhắn và feedback |
| GET | /conversations/{id}/messages | page/size; thứ tự tăng dần, items/total/page/size |
| POST | /conversations/{id}/messages | content, clientMessageId, month YYYY-MM; trả assistant message |
| POST | /conversations/{id}/cancel | clientMessageId; đổi pending thành CANCELLED |
| POST | /messages/{id}/feedback | rating1 hoặc-1, comment tùy chọn |

Retry cùng clientMessageId/nội dung/kỳ trả cùng message, không tạo cặp trùng. FAILED có thể retry cùng ID; khác nội dung trả409. Giới hạn20 generation/10 phút/tài khoản, tối đa2 pending. Engine local phục vụ một generation; bận hoặc quá thời gian chờ sẽ báo lỗi có thể retry. AI overall timeout80s, Backend95s và nginx100s. Phiên trò chuyện không streaming token trong bản này; nút dừng hủy generation và guard UUID ngăn ghi kết quả muộn. Không giữ transaction/khóa user khi chờ LLM.

FK kết hợp conversation/message với user bảo vệ chủ sở hữu ngay trong SQL. Xóa tài khoản xóa cả chat/feedback/preferences. Không đổi auth/cookie/CSRF hoặc cấp quyền database ngoài `finsight`.

## Huấn luyện, kiểm thử và giới hạn

Lệnh candidate/verify/activate và rollback có trong [AI_MODEL_REPORT](AI_MODEL_REPORT.md). Model tài chính load một lần khi FastAPI khởi động; activate xong cần restart AI service. Chọn model bằng validation, kiểm tra baseline và checksum; giữ version cũ. Không train trong request chat.

Kiểm thử gồm29 Backend,13 frontend và34 Python (17 pipeline +17 chat), cùng kiểm tra thật bằng `scripts/test_chat_integration.py`, `scripts/test_chat_ml.py` và `frontend/e2e/chat.spec.ts`. [Chat API](test-results/chat-api.json), [chat gọi ML thật/cold start](test-results/chat-ml-tools.json), [Chrome E2E](test-results/chat-browser.json) và [hồi quy tài chính](test-results/chat-finance-regression.json) lưu kết quả thực. Chỉ coi kiểm thử runtime hoàn tất khi báo cáo và exit code xác nhận thành công.

Bản sao lưu XAMPP trước V3: `runtime/backups/20261011-001122-pre-chat/finsight-xampp.sql`, quyền0600. Không dùng backup này ghi đè dữ liệu mới nếu chưa xử lý các cập nhật sau thời điểm sao lưu.

LLM nhỏ ưu tiên khả năng chạy trên máy8GB, có thể diễn giải chưa đầy đủ hoặc yêu cầu retry. Corpus classifier giữ riêng64 câu test nhưng còn nhỏ; anomaly precision50% trên benchmark tổng hợp. Chưa fine-tune LLM, chưa đánh giá tư vấn trên dữ liệu tài chính thực, chưa có streaming token hoặc distributed rate limit. Tư vấn tập trung dữ liệu và quản lý thu/chi/ngân sách/tiết kiệm trong ứng dụng.

API Ollama sử dụng theo [tài liệu chính thức](https://github.com/ollama/ollama/blob/main/docs/api.md); cấu hình model tham chiếu [Qwen3 1.7B](https://ollama.com/library/qwen3:1.7b).
