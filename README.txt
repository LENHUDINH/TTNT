FINSIGHT AI — HƯỚNG DẪN CÀI ĐẶT VÀ CHẠY WEB
Dành cho giảng viên kiểm tra đồ án | Cập nhật: 13/10/2026

Đề tài: Hệ thống quản lý tài chính cá nhân tích hợp AI dự báo chi tiêu
và phát hiện giao dịch bất thường.
Mã nguồn: https://github.com/LENHUDINH/TTNT

1. CÁCH CHẠY VÀ PHẦN MỀM CẦN CÓ
============================================================
Hướng dẫn chính dành cho Windows dùng PowerShell; macOS dùng Terminal.
Chạy React, Spring Boot và FastAPI bằng Docker; database dùng XAMPP.
Không cần chép dự án vào htdocs. Không cần cài riêng Java, Node.js, Python.

Cần cài:
- Docker Desktop, mở ứng dụng và chờ Docker Engine sẵn sàng.
  Windows sử dụng Linux containers; hoàn tất yêu cầu WSL 2 nếu trình cài yêu cầu.
  https://www.docker.com/products/docker-desktop/
- XAMPP: https://www.apachefriends.org/
- Git nếu tải bằng lệnh: https://git-scm.com/downloads
- Ollama nếu kiểm tra chatbot: https://ollama.com/download

Cần Internet cho lần đầu tải thư viện, Docker images và model Qwen3.
Nên chuẩn bị máy RAM 16 GB và khoảng 20 GB đĩa trống để chạy demo thoải mái;
đây là mức đề xuất, chưa phải cấu hình tối thiểu được đo kiểm.

2. LẤY MÃ NGUỒN
============================================================
Mở PowerShell/Terminal tại nơi muốn lưu dự án, chạy từng dòng:

git clone https://github.com/LENHUDINH/TTNT.git
cd TTNT

Hoặc vào GitHub > Code > Download ZIP, giải nén, mở terminal tại thư mục
chứa docker-compose.yml. Nếu đã có mã nguồn thì không cần clone lần nữa.
Các lệnh docker compose bên dưới đều chạy tại thư mục này.

3. TẠO DATABASE TRONG XAMPP — CHỈ LÀM LẦN ĐẦU
============================================================
Mở XAMPP Control Panel/Manager, bật MySQL và Apache.
MySQL trong XAMPP thường là MariaDB. Dự án đã kiểm chứng với MariaDB 10.4.28.
Apache phục vụ phpMyAdmin; website FinSight được phục vụ bởi Docker.

Truy cập http://localhost/phpmyadmin, đăng nhập bằng tài khoản quản trị
XAMPP của máy, chọn tab SQL.

Chọn một mật khẩu riêng chỉ gồm chữ và số, dài ít nhất 24 ký tự.
Thay THAY_MAT_KHAU_DB_RIENG trong SQL dưới đây bằng mật khẩu vừa chọn:

CREATE DATABASE IF NOT EXISTS finsight
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'finsight_xampp'@'%' IDENTIFIED BY 'THAY_MAT_KHAU_DB_RIENG';
GRANT ALL PRIVILEGES ON finsight.* TO 'finsight_xampp'@'%';

Dùng database mới để kiểm tra. Nếu tên database hoặc user đã tồn tại,
kiểm tra cấu hình hiện có trước; không xóa database hay tạo lại tài khoản.
User này chỉ có quyền trên finsight. Ký hiệu % cho phép kết nối từ Docker;
giữ cổng database trong phạm vi máy/Docker, không mở ra Internet.

Không phải import file SQL: Backend sẽ tự tạo các bảng bằng Flyway khi
khởi động lần đầu. Dữ liệu demo sẽ được tạo ở bước 6.

4. TẠO FILE CẤU HÌNH .env
============================================================
Windows PowerShell (chỉ chạy khi chưa có file .env):

Copy-Item .env.example .env
notepad .env

macOS Terminal (chỉ chạy khi chưa có file .env):

cp .env.example .env
open -e .env

Trong .env, sửa các dòng sau. Giữ nguyên tên biến, không thêm dấu cách
quanh dấu =. Các giá trị THAY_... là chỗ trống cần tự thay:

DB_USER=finsight_xampp
DB_PASSWORD=THAY_MAT_KHAU_DB_RIENG
MYSQL_ROOT_PASSWORD=THAY_CHUOI_NGAU_NHIEN_RIENG
CONTAINER_DB_URL=jdbc:mariadb://host.docker.internal:3306/finsight
AI_SERVICE_KEY=THAY_CHUOI_NGAU_NHIEN_IT_NHAT_32_KY_TU
DEMO_ENABLED=true
COOKIE_SECURE=false
CHAT_PROVIDER=ollama
CHAT_MODEL=qwen3:1.7b
CONTAINER_OLLAMA_URL=http://host.docker.internal:11434

DB_PASSWORD phải trùng mật khẩu SQL ở bước 3. AI_SERVICE_KEY dùng chung
cho Backend và AI, được Compose tự truyền tới cả hai dịch vụ.
MYSQL_ROOT_PASSWORD là biến dành cho cấu hình MySQL Docker dự phòng;
đặt một chuỗi riêng để Compose đọc cấu hình. Biến này không thay đổi
mật khẩu root của XAMPP và không cần điền mật khẩu root thật.
Giữ các dòng còn lại theo .env.example. Lưu đúng tên .env, không phải .env.txt.
File .env là cấu hình riêng của máy, không gửi kèm bài nộp hoặc đưa lên GitHub.

5. KHỞI ĐỘNG WEBSITE
============================================================
Đảm bảo Docker Desktop và MySQL XAMPP đang chạy, sau đó:

docker compose up --build -d
docker compose ps

Lệnh đầu build và chạy hệ thống. Lần đầu có thể lâu do tải thư viện và
huấn luyện mô hình ML ngay trong quá trình build image AI.
Các dịch vụ cần thấy: frontend, backend, ai, mail; ai có trạng thái healthy.
Backend có thể cần thêm thời gian để kết nối database và tạo bảng.

Kiểm tra trên trình duyệt:
- Website: http://127.0.0.1:8088
- Backend: http://127.0.0.1:8088/api/health
- Database: http://localhost/phpmyadmin, chọn finsight.
- Hộp thư thử nghiệm: http://127.0.0.1:8026

Dùng nhất quán địa chỉ 127.0.0.1:8088 để đăng nhập và demo.
Nếu API health chưa trả lời thành công, xem mục xử lý lỗi trước khi seed.

6. TẠO DỮ LIỆU VÀ TÀI KHOẢN DEMO
============================================================
Sau khi Backend sẵn sàng, chạy hai lệnh sau tại thư mục gốc dự án.
Lệnh đầu sao chép script vào container AI; lệnh sau dùng Python đã có
trong container để tạo dữ liệu qua API Backend, không cần Python trên máy:

docker compose cp scripts/seed_demo.py ai:/tmp/finsight_seed_demo.py
docker compose exec -e PYTHONPATH=/app ai python /tmp/finsight_seed_demo.py --base http://backend:8080 --accounts 12

Chờ script hoàn tất và hiển thị kết quả từng tài khoản. Dữ liệu là giả lập,
có khoảng 12 tháng lịch sử để kiểm tra biểu đồ, dự báo và cảnh báo AI.

Đăng nhập:
- Email: demo01@finsight.local
- Mật khẩu: DemoFinSight2026!
- Các tài khoản khác: demo02@finsight.local đến demo12@finsight.local,
  cùng mật khẩu demo ở trên.

Tài khoản demo chỉ có sau khi seed thành công trên database của máy này.
Có thể tự đăng ký tài khoản mới, nhưng tài khoản mới chưa có đủ lịch sử
để chạy đầy đủ chức năng dự báo. Không cần seed lại mỗi lần mở web.
Nếu chạy lại script và thấy already seeded thì dữ liệu cũ vẫn được giữ.

7. BẬT CHATBOT AI QWEN3
============================================================
Phần quản lý tài chính và mô hình ML có thể chạy trước khi cài Ollama.
Để kiểm tra chatbot, cài và mở Ollama, sau đó chạy:

ollama pull qwen3:1.7b
ollama list

Danh sách cần có qwen3:1.7b. Giữ Ollama chạy trong lúc sử dụng chat.
Nếu chưa có dịch vụ Ollama chạy nền, mở terminal riêng và chạy:

ollama serve

Nếu báo cổng 11434 đã được sử dụng, kiểm tra ứng dụng Ollama đã chạy;
không cần mở thêm server. Trong web, đăng nhập và mở /ai-chat, tạo hội thoại.
Ví dụ: "Tóm tắt chi tiêu tháng này của tôi" hoặc "Tôi nên tiết kiệm thế nào?".
Lần trả lời đầu có thể chậm do tải model vào bộ nhớ; tốc độ phụ thuộc máy.
Qwen3 là mô hình có sẵn, không cần fine-tune để chạy demo.

8. TRÌNH TỰ KIỂM TRA ĐỀ XUẤT
============================================================
1) Đăng nhập demo01, xem Dashboard và biểu đồ thu chi.
2) Xem ví, thêm một giao dịch nhỏ, kiểm tra số dư và danh sách giao dịch.
3) Xem ngân sách, mục tiêu tiết kiệm và lịch sử giao dịch.
4) Mở chức năng dự báo chi tiêu, thử các mốc 1/7/30 ngày.
5) Xem cảnh báo giao dịch bất thường và phân loại mô tả giao dịch.
6) Mở chat AI, hỏi về dữ liệu tài khoản, xem lịch sử hội thoại.
7) Nếu kiểm tra quên mật khẩu, đọc thư thử nghiệm tại cổng 8026;
   cấu hình demo gửi thư vào Mailpit, không gửi đến hộp thư Internet.

Mô hình dự báo: Random Forest/XGBoost được so sánh trong pipeline.
Phát hiện bất thường: Isolation Forest.
Phân loại mô tả: TF-IDF + Logistic Regression.
Chat tư vấn: Qwen3 qua Ollama, kết hợp dữ liệu do Backend cung cấp.
Dữ liệu huấn luyện và demo là dữ liệu tổng hợp; cảnh báo không phải
kết luận gian lận, các kết quả dùng để minh họa đồ án.

9. DỪNG VÀ CHẠY LẠI
============================================================
Dừng các container của dự án:

docker compose down

Lệnh này không dừng XAMPP và không xóa database finsight trong XAMPP.
Lần sau: bật Docker Desktop, MySQL XAMPP và Ollama nếu cần chat, rồi chạy:

docker compose up -d

Mở lại http://127.0.0.1:8088. Không cần tạo database hoặc seed lại.
Nếu sửa .env, chạy docker compose up -d để áp dụng cấu hình mới.

10. XỬ LÝ LỖI THƯỜNG GẶP
============================================================
- Không nhận lệnh docker / không kết nối Docker daemon:
  Kiểm tra Docker Desktop đã cài và đang chạy; mở terminal mới.
  Windows: kiểm tra đang dùng Linux containers.

- Báo thiếu DB_PASSWORD hoặc AI_SERVICE_KEY:
  Kiểm tra .env nằm cạnh docker-compose.yml, đúng tên và đã điền giá trị.

- Không mở được web, 502 Bad Gateway hoặc Backend khởi động lại:
  docker compose ps
  docker compose logs --tail=100 backend ai frontend
  Chờ Backend khởi động xong; kiểm tra lỗi kết nối XAMPP trong log.

- Access denied for user / Host is not allowed to connect:
  Kiểm tra user finsight_xampp@%, quyền finsight.* và DB_PASSWORD.
  Mật khẩu phải trùng SQL; không thay DB_USER bằng root để bỏ qua lỗi.

- Connection refused / timeout tới database:
  Bật MySQL XAMPP, kiểm tra cổng thực tế trong cấu hình XAMPP.
  Nếu cổng khác 3306, sửa CONTAINER_DB_URL rồi docker compose up -d.
  Nếu MariaDB chỉ lắng nghe loopback và Docker không truy cập được,
  nhờ quản trị máy cấu hình bind-address cho kết nối Docker và giới hạn
  firewall tương ứng; không tắt toàn bộ firewall hoặc mở DB ra Internet.

- Seed trả lỗi 403:
  Kiểm tra DEMO_ENABLED=true rồi chạy docker compose up -d.
  Seed trả lỗi 429: script sẽ chờ và thử lại; tránh chạy nhiều script cùng lúc.

- Chat lỗi kết nối hoặc không tìm thấy model:
  Kiểm tra Ollama đang chạy, ollama list có đúng qwen3:1.7b.
  Kiểm tra kết nối từ container:
  docker compose exec ai python -c "import urllib.request; print(urllib.request.urlopen('http://host.docker.internal:11434/api/tags', timeout=10).read().decode())"
  Nếu host truy cập được nhưng container không truy cập được: cấu hình
  OLLAMA_HOST=0.0.0.0:11434 cho Ollama rồi khởi động lại ứng dụng.
  Windows: Quit Ollama, thêm biến môi trường người dùng trong Settings,
  rồi mở lại Ollama. macOS: chạy launchctl setenv OLLAMA_HOST 0.0.0.0:11434
  rồi Quit và mở lại Ollama. Giới hạn firewall cho truy cập từ Docker/máy
  cục bộ vì cấu hình này cho Ollama lắng nghe trên các giao diện mạng.

- Cổng 8088 đã có ứng dụng khác:
  Dừng đúng phiên FinSight cũ hoặc ứng dụng đang chiếm cổng rồi chạy lại.
  Không chạy đồng thời Backend native và Backend Docker trên cùng database.

11. GHI CHÚ BÀN GIAO
============================================================
Đây là web chạy bằng mã nguồn, không cần file .exe hay .apk.
Khi nộp Drive, đặt README.txt này ở thư mục gốc, bên cạnh report/ và slides/;
mã nguồn tải từ GitHub ở đầu tài liệu hoặc được gửi kèm trong thư mục code/.
Các lệnh phải chạy trong thư mục mã nguồn, không phải thư mục báo cáo.

Hướng dẫn được đối chiếu với docker-compose.yml, Dockerfile, .env.example
và scripts/seed_demo.py trong dự án. Chưa cài thử trên máy Windows của
giảng viên; thiết lập mạng XAMPP/Docker có thể cần điều chỉnh theo máy.
Các script .sh trong scripts/ có đường dẫn riêng cho máy macOS phát triển;
hướng dẫn này sử dụng docker compose trực tiếp để tránh phụ thuộc đó.

Tài liệu tham khảo cấu hình bên ngoài:
https://docs.docker.com/desktop/features/networking/
https://docs.ollama.com/faq
