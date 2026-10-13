# FinSight AI

Hệ thống quản lý tài chính cá nhân tích hợp mô hình ML tự huấn luyện. React/TypeScript/Vite/Tailwind/Radix + Spring Boot Java 21 + MariaDB XAMPP/Flyway + FastAPI/sklearn/XGBoost. UI theo dự án Google Stitch FinSight AI Fintech Platform, 16 màn hình tham chiếu đã được xác minh và lưu.

## Chức năng

Đăng ký/đăng nhập, hồ sơ/mật khẩu/phiên/reset SMTP, ví giả lập, thu/chi/chỉnh sửa/xóa/lọc/phân trang, chuyển ví nguyên tử và idempotent, CSV import, Excel/PDF export, định kỳ, ngân sách/cảnh báo, tiết kiệm/đóng góp/hoàn tiền, dashboard, dự báo 1/7/30 ngày, cảnh báo Isolation Forest và feedback, phân loại mô tả tiếng Việt, kế hoạch tiết kiệm dựa trên dự báo. Trang `/ai-chat` có hội thoại riêng, lịch sử, feedback và tư vấn từ LLM local kết hợp số liệu Backend. Dữ liệu đi qua Backend và MariaDB XAMPP. Có empty/loading/error/insufficient-data, mobile/tablet/desktop, light/dark/system và reduced motion.

Tiền trong SQL/Java dùng DECIMAL/BigDecimal. Session cookie HttpOnly; CSRF token giữ trong memory; không lưu auth token vào localStorage. Không có ngân hàng thật hoặc tự khóa ví.

## Bản chạy trên máy này

Bản Docker/nginx đang chạy: **http://127.0.0.1:8088**. Database đã chuyển sang **XAMPP MariaDB 10.4.28**, cổng **3306**, tên **finsight**. Xem và quản lý tại **[phpMyAdmin](http://localhost/phpmyadmin/index.php?route=/database/structure&db=finsight)**. [Chi tiết chuyển dữ liệu và sao lưu](docs/XAMPP_MIGRATION.md).

Bản native đã kiểm chứng sử dụng Frontend5173, Backend8080, AI8000, SMTP inbox8025. Trạng thái kiểm chứng trước khi chuyển database xem [TEST_RESULTS](docs/TEST_RESULTS.md).

Tài khoản giả lập: `demo01@finsight.local` … `demo12@finsight.local`; mật khẩu chung **`DemoFinSight2026!`**. Đây là dữ liệu demo công khai, không dùng mật khẩu này cho tài khoản thật. 12 tháng lịch sử, seed riêng với dữ liệu huấn luyện.

Secrets local đã tạo ở `.env` (Git ignore, chmod 0600). Không đưa nội dung `.env` vào repository. `.env.example` là cấu hình mẫu; production phải tắt DEMO_ENABLED/RESET_TOKEN_LOG và cấu hình HTTPS/Secure cookie + SMTP riêng.

## Docker Compose

Yêu cầu Docker engine/Compose và MySQL của XAMPP đang chạy. Để chat, chạy Ollama local với model `qwen3:1.7b` bằng `sh scripts/run_ollama.sh` trong terminal riêng; lần đầu tải bằng `ollama pull qwen3:1.7b`. Máy này đã cài Docker CLI và Colima profile `finsight`, 2 CPU/2GB RAM, đĩa động 15GB. Script dùng socket profile đó và cấu hình CLI riêng trong `.cache/docker`, không cần Docker Desktop.

```sh
sh scripts/compose.sh up --build -d
sh scripts/compose.sh ps
# website http://127.0.0.1:8088
ai-service/.venv/bin/python scripts/seed_demo.py --base http://127.0.0.1:8088 --accounts 12
```

Khi engine thông thường đã có, cũng có thể dùng `docker compose up --build -d`. `.env` phải có DB_PASSWORD, MYSQL_ROOT_PASSWORD và AI_SERVICE_KEY. Backend kết nối XAMPP qua `host.docker.internal:3306`; user `finsight_xampp` chỉ có quyền trên `finsight`. Docker chỉ publish website 8088 và Mailpit 8026 vào loopback. AI models được huấn luyện lúc build image, không trong inference request. MySQL Docker cũ thuộc profile `legacy-db`, giữ volume làm bản dự phòng.

```sh
sh scripts/compose.sh down
```

Lệnh down giữ dữ liệu. Không thêm `-v` trừ khi có ý định xóa toàn bộ volume demo.

## Native development

Node ≥22.12, Java21, Maven≥3.6.3, Python≥3.11, MariaDB XAMPP. Máy này có Maven/Python cục bộ trong `.tools` và môi trường AI `.venv`; không thay Python hệ thống. Native Backend dùng `jdbc:mariadb://127.0.0.1:3306/finsight`.

```sh
cd frontend && npm ci && npm run build
cd ..
.tools/apache-maven-3.9.9/bin/mvn -s backend/settings.xml -Dmaven.repo.local="$PWD/.cache/m2" -f backend/pom.xml package
cd ai-service
.venv/bin/python -m training.train --output-dir ../runtime/ai-candidate
.venv/bin/python -m training.artifacts verify --candidate ../runtime/ai-candidate
.venv/bin/python -m training.artifacts activate --candidate ../runtime/ai-candidate --active-dir artifacts
cd ..
sh scripts/start_local.sh
```

Trên máy mới, tạo `.env` từ example với secrets riêng; tạo database/user tương ứng trong XAMPP; `python3.12 -m venv ai-service/.venv` rồi pip install requirements.lock. [DEPLOYMENT](docs/DEPLOYMENT.md) mô tả thiết lập. Native launcher kiểm tra XAMPP đã chạy; tránh chạy launcher khi các port đang có phiên ứng dụng.

## Dữ liệu và mô hình

```sh
ai-service/.venv/bin/python scripts/seed_demo.py --accounts 12
# Chỉ reset các tài khoản demo trong ứng dụng khi có chủ đích:
ai-service/.venv/bin/python scripts/seed_demo.py --accounts 12 --reset
```

Model/dataset tại ai-service/artifacts và datasets. Training tạo candidate offline; chỉ activate sau khi kiểm tra baseline, validation và checksum. Thư mục candidate phải chưa tồn tại; mỗi lần train dùng tên mới. `active-manifest.json` trỏ đến version bất biến và giữ model trước đó để rollback. CSV/joblib local bị Git ignore để có thể tái tạo từ seed; báo cáo evaluation được lưu. Report công bố metrics thật, gồm hạn chế precision và corpus giả lập; không có metric hoặc confidence giả.

Chat dùng LLM đã huấn luyện sẵn Qwen3 qua Ollama; không tuyên bố đã fine-tune LLM. Mô hình ML tài chính được huấn luyện lại bằng dữ liệu tổng hợp, không dùng chat/dữ liệu cá nhân để train. Xem [vận hành và kiểm chứng chat](docs/AI_CHAT.md) và [AI_MODEL_REPORT](docs/AI_MODEL_REPORT.md).

## Kiểm thử và tài liệu

Xem [TEST_PLAN](docs/TEST_PLAN.md), [PROJECT_PLAN](PROJECT_PLAN.md), [yêu cầu gốc](REQUIREMENTS.md), [kiến trúc](docs/ARCHITECTURE.md), [database/ERD](docs/DATABASE_DESIGN.md), [API](docs/API_DOCUMENTATION.md), [AI report](docs/AI_MODEL_REPORT.md), [UI/UX](docs/UI_UX_DESIGN.md), [Stitch](docs/STITCH_INTEGRATION.md).

Đây là prototype nghiên cứu đã triển khai nghiệp vụ thật. Không gọi là production-ready: dữ liệu AI là giả lập; chưa đánh giá production load/security, ngôn ngữ tiếng Việt ngoài corpus, distributed sessions hoặc độ tương đồng thiết kế bằng phép đo pixel.
