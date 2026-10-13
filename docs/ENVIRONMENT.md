# Kiểm tra môi trường — 10/10/2026

Workspace ban đầu có các thư mục rỗng và hai tài liệu Stitch; chưa có mã ứng dụng. Git của thư mục cha trỏ tới home, đã khởi tạo repository riêng và không sửa repository cha.

Node 24.21.0, npm 11.19.0, Java 21.0.6 đã có. Python hệ thống 3.9.6 không đáp ứng yêu cầu. Đã cài Python 3.12.13 và Maven 3.9.9 trong `.tools/`; dependencies Python trong `ai-service/.venv`, npm trong `frontend/node_modules`. Đã cài MySQL 8.4.11 và libomp bằng Homebrew. MySQL cho dự án sử dụng datadir riêng `runtime/mysql-data`, socket `runtime/mysql.sock`, TCP 127.0.0.1:3307. Secrets tạo ngẫu nhiên, ghi `.env` với quyền 0600, Git bỏ qua.

Docker Desktop ban đầu thiếu, CLI symlink hỏng. Đã cài Docker CLI 29.9.0, Compose 5.6.0, Colima 0.10.3 qua Homebrew. Profile finsight dùng Virtualization.Framework, 2CPU/2GB/15GB dynamic disk. Socket thực tế ~/.colima/finsight/docker.sock; COLIMA_HOME không chuyển runtime socket vào workspace. Build/health cần xem TEST_RESULTS.md để biết kết quả cuối.

Network trong sandbox không phân giải DNS; tải dependency và bind localhost dùng quyền do hệ thống xét duyệt. MySQL khởi tạo trong sandbox gặp SIGSEGV; cùng executable khởi tạo ngoài sandbox thành công. Không sử dụng H2 thay MySQL trong ứng dụng; H2 chỉ cho integration tests nhanh.

Phiên bản tương thích đã đối chiếu tài liệu chính thức:

- Spring Boot 3.5.16 và Java 21: https://docs.spring.io/spring-boot/3.5/system-requirements.html
- Vite và Node: https://vite.dev/guide/
- sklearn/Python: https://scikit-learn.org/stable/install
- XGBoost/OpenMP: https://xgboost.readthedocs.io/en/stable/install.html

Backend runner copy JAR vào runtime trước khi chạy. Lượt QA cuối đã phát hiện JVM cũ vẫn chiếm 8080 vì command thực tế là /usr/bin/java, không khớp bộ lọc ban đầu. Đã xác minh PID + working directory rồi dừng đúng tiến trình. Không dùng kết quả test khi server đang xung đột hoặc artifact bị ghi đè làm kết quả cuối.
