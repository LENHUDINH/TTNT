# Deployment / vận hành localhost

Chat riêng tại `/ai-chat` cần engine Ollama local bên cạnh các container. Chạy `sh scripts/run_ollama.sh` trong terminal riêng, tải model `qwen3:1.7b` lần đầu. Xem [AI_CHAT](AI_CHAT.md) về provider, quyền riêng tư và các lệnh kiểm chứng. Các mô hình ML có pipeline candidate/verify/activate riêng; không train trong request chat.

## Cấu hình đã chuẩn bị

Database hiện tại nằm trong XAMPP MariaDB10.4.28, port3306. Xem tại [phpMyAdmin](http://localhost/phpmyadmin/index.php?route=/database/structure&db=finsight). Backend native dùng `DB_URL=jdbc:mariadb://127.0.0.1:3306/finsight`; Docker dùng `CONTAINER_DB_URL=jdbc:mariadb://host.docker.internal:3306/finsight`. Tài khoản `finsight_xampp`, password nằm trong `.env`0600; chỉ có quyền trên database finsight. [Sao lưu và chuyển database](XAMPP_MIGRATION.md).

Docker/Colima: profile finsight sử dụng Virtualization.Framework trên Apple Silicon, 2CPU/2GB/15GB dynamic disk; Docker endpoint `$HOME/.colima/finsight/docker.sock`. Runtime profile do Colima lưu ngoài workspace; code/cache dự án không chứa credential engine. Scripts compose sử dụng DOCKER_CONFIG cục bộ với CLI plugins Homebrew.

Dockerfile backend Java21, ai Python3.12 + libgomp, frontend Node24/nginx. Maven settings mirror dependencies về Maven Central, tránh tải từ các repository phụ trong parent POM. Model training diễn ra trong image build để Linux có artifacts phù hợp runtime. Không copy joblib từ macOS rồi giả định mọi ABI giống nhau.

Compose network chỉ có frontend và mail UI publish loopback. Nginx proxy giữ cookie/CSRF same-origin. Bật MySQL trong XAMPP trước khi khởi động Backend; Spring/Flyway xác thực schema. AI health check xác minh model đã load. Native và Docker hiện cùng dùng database XAMPP; không chạy đồng thời hai Backend để tránh trùng tác vụ định kỳ. MySQL Docker cũ nằm trong profile `legacy-db`, volume được giữ làm dự phòng.

## Thiết lập máy mới

1. Cài Node24, Java21/Maven3.9, Python3.12, Docker engine/Compose và XAMPP.
2. Sao chép .env.example → .env; tạo secrets mạnh riêng cho DB root/app và service key, chmod0600. Không dùng example strings.
3. Tạo database finsight utf8mb4_unicode_ci và user riêng trong XAMPP, cấu hình password trong `.env`. Bật MySQL XAMPP; Docker: `docker compose up --build -d`; kiểm tra `docker compose ps`, GET /api/health ở8088. AI training trong image có thể cần vài phút.
4. Cài venv theo requirements.lock để chạy seeding/test scripts; seed 10–20 synthetic accounts qua Backend. API demo cần DEMO_ENABLED=true; tắt khi dùng tài khoản thật.
5. Native: tạo database `finsight` charset utf8mb4 và user giới hạn quyền vào database đó, cấu hình DB_URL/DB_USER/DB_PASSWORD, npm ci, Maven package, Python training, chạy run_ai/run_backend và Vite.

`scripts/start_local.sh` kiểm tra XAMPP đã chạy; không khởi động hay dừng database dùng chung của XAMPP. Khi build jar trong lúc server chạy, runner copy JAR sang file riêng trong runtime để tránh classloader đọc artifact đang bị ghi đè.

## Email và cookie

SMTP native mặc định local sink; xem `http://127.0.0.1:8025/docs` để đọc mail demo. Compose sử dụng Mailpit UI `http://127.0.0.1:8026`. Mã reset hash trong DB, hết hạn15 phút, single-use, reset vô hiệu hóa các phiên. Nếu SMTP chưa cấu hình, endpoint báo503, không tự nhận đã gửi.

Production cần SMTP_HOST/PORT/USER/PASSWORD/AUTH/TLS đúng nhà cung cấp, MAIL_FROM đã xác minh. Cần HTTPS và COOKIE_SECURE=true, FRONTEND_ORIGIN chính xác. Các thiết lập này chưa được kiểm chứng với dịch vụ SMTP Internet/TLS production.

## Backup / stop

Backup MySQL bằng mysqldump với credential file 0600, không đưa password vào command line. Stop Compose dùng `down` giữ volume; không xóa volume tùy tiện. Native stop chỉ các process do launcher lưu PID. Không tự bật launch-at-login.

CI đề nghị: JUnit + real MySQL smoke, Vitest/TypeScript, pytest/train benchmark, Playwright + Axe, Compose build/up/health. Bản hiện tại có các test và bằng chứng local; chưa có CI remote vì chưa cung cấp repository remote.
