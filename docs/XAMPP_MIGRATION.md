# Chuyển FinSight sang XAMPP

Ngày 10/10/2026, theo yêu cầu chuyển database sang XAMPP, database `finsight` đã chuyển từ Docker MySQL8.4 sang **XAMPP MariaDB10.4.28** trên máy này. XAMPP hiển thị dịch vụ là MySQL; server thực tế là MariaDB.

- Website: http://127.0.0.1:8088
- Quản lý database: [phpMyAdmin — finsight](http://localhost/phpmyadmin/index.php?route=/database/structure&db=finsight)
- Database: `finsight`; port3306.
- User Backend: `finsight_xampp`, chỉ có quyền trên `finsight.*`. Password nằm trong `.env`, quyền0600.
- Native JDBC: `jdbc:mariadb://127.0.0.1:3306/finsight`.
- Docker JDBC: `jdbc:mariadb://host.docker.internal:3306/finsight` qua Colima của máy này.

Backend dùng MariaDB Connector/J3.5.8. MySQL driver vẫn được giữ để có thể vận hành bản dự phòng. Không chỉnh Flyway V1/V2 đã áp dụng. Hibernate đã validate schema; Flyway xác nhận đủ2 migration thành công.

## Dữ liệu và sao lưu

Backend được dừng trong lúc dump/import để không có ghi đồng thời. Đã đối chiếu **số dòng và SHA-256 toàn bộ hàng theo thứ tự khóa chính của cả17 bảng**, với session UTC để so sánh TIMESTAMP độc lập múi giờ server. Dữ liệu ứng dụng, ID, mật khẩu BCrypt, tiền DECIMAL, lịch sử AI và Flyway đều khớp.

Snapshot trước chuyển chứa17 users,32 wallets,170 categories,13.609 transactions. Sau khi kiểm thử, một số lịch sử inference/audit và tài khoản E2E có thể tăng; báo cáo đối chiếu ghi snapshot trước khi mở lại ứng dụng.

MySQL8 collation `utf8mb4_0900_ai_ci` được đổi thành `utf8mb4_unicode_ci` để MariaDB10.4 hỗ trợ. Bản SQL gốc vẫn giữ nguyên. Lịch sử Flyway TIMESTAMP lưu cùng thời điểm; phpMyAdmin có thể hiển thị theo múi giờ XAMPP.

Backup tại `runtime/backups/20261010-234757/`:

- `finsight-mysql8.sql`: dump gốc.
- `finsight-xampp.sql`: dump tương thích MariaDB.
- `env.before`: cấu hình trước chuyển.

Các file có quyền0600 và bị Git ignore. Volume Docker `finsight_mysql_data` cũng được giữ; container MySQL cũ đã dừng. Các database khác của XAMPP và cấu hình XAMPP/phpMyAdmin không bị thay đổi.

## Chạy ứng dụng

Bật MySQL trong XAMPP Manager trước, rồi:

```sh
sh scripts/compose.sh up -d
sh scripts/compose.sh ps
```

Compose mặc định chạy frontend/backend/AI/mail, kết nối database XAMPP. MySQL Docker cũ thuộc profile `legacy-db`. Native launcher cũng dùng XAMPP; `stop_local.sh` chỉ dừng process của FinSight, không dừng XAMPP.

## Bằng chứng kiểm chứng

- [Snapshot và hash17 bảng](test-results/xampp-migration.json).
- [Kết nối Backend, Flyway và phpMyAdmin](test-results/xampp-connection.json).
- [API: auth, tiền, rollback, exports, SMTP reset và AI](test-results/xampp-api-smoke.json).
- [Hai CSV đồng thời:400 giao dịch, số dư4600](test-results/xampp-csv-concurrency.json).
- [Nginx, tài khoản đã chuyển và inference](test-results/xampp-compose-smoke.json).
- [Kiểm thử giao diện Chrome:2 luồng đều pass](test-results/xampp-browser.json).

## Phục hồi bản trước chuyển

Bản MySQL Docker giữ dữ liệu **tại thời điểm chuyển**. Nếu đã phát sinh dữ liệu mới trên XAMPP, cần chuyển phần dữ liệu đó trở lại trước khi quay về bản cũ để tránh mất cập nhật.

Để dùng snapshot cũ: dừng Backend, khởi động dịch vụ mysql với profile `legacy-db`, đổi `.env` DB_USER/DB_PASSWORD về LEGACY_DB_USER/LEGACY_DB_PASSWORD và CONTAINER_DB_URL về `jdbc:mysql://mysql:3306/finsight`, rồi recreate Backend. Dùng `env.before` làm tham chiếu riêng tư. Không xóa volume hoặc ghi đè các database khác của XAMPP.
