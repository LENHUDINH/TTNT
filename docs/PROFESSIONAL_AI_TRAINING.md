# Huấn luyện và đánh giá AI FinSight

Quy trình có hai pipeline độc lập. Model mới là ứng viên cho đến khi được
kiểm tra; train lại không mặc nhiên có nghĩa chất lượng tốt hơn.

## ML tài chính

- Dữ liệu tổng hợp: 20 tài khoản × 365 ngày; mô tả danh mục được biên soạn.
- Train, validation và test chia theo tài khoản và thời gian. Validation chọn
  model/cấu hình/ngưỡng; test dùng báo cáo cuối, không cập nhật tham số.
- Dự báo so sánh Random Forest, XGBoost, trung bình trượt và seasonal naive.
- Isolation Forest hiệu chỉnh ngưỡng trên validation; xem precision, recall,
  F1 và tỷ lệ cảnh báo sai. Không gọi điểm bất thường là xác suất gian lận.
- TF-IDF học vocabulary từ train; Logistic Regression chọn theo macro F1.
- Candidate có manifest/checksum, quality gates, activation và rollback.

Tại thư mục `ai-service`, dùng Python của `.venv`:

```sh
.venv/bin/python -m training.train --output-dir ../runtime/NEW_RUN/financial-candidate --dataset-dir ../runtime/NEW_RUN/financial-datasets
.venv/bin/python -m training.artifacts verify --candidate ../runtime/NEW_RUN/financial-candidate
```

`NEW_RUN` phải là thư mục mới cho mỗi lần chạy. Huấn luyện cùng dataset/seed
cho cùng model version không được báo cáo là cải thiện độ chính xác.

## Chatbot Qwen3 — QLoRA trên Apple Silicon

- Base model: `mlx-community/Qwen3-1.7B-4bit`, revision được ghim trong từng run.
- Môi trường MLX riêng, không thay dependencies của FastAPI.
- Corpus được biên soạn giả lập; không đọc DB, lịch sử chat hoặc thông tin cá nhân.
- 148 train, 41 validation, 41 test. Các câu hỏi giữa các split không trùng sau
  chuẩn hóa. Chủ đề có thể giống nhau; đây chưa phải benchmark thực tế độc lập.
- Assistant-only loss; mask prompt; base quantized 4-bit; LoRA rank 8 trên
  8 lớp cuối, seed cố định, gradient checkpointing, batch size 1.
- Cùng một chat template non-thinking cho baseline, train và candidate.
- Kiểm tra chiều dài token trước khi chọn max sequence length; không tự cắt
  mất câu trả lời. Lưu checkpoint, cấu hình, dependency lock và fingerprint.
- Chọn checkpoint theo toàn bộ validation. Chốt lựa chọn trước khi đánh giá
  test. So sánh baseline và candidate bằng test loss/perplexity và generation.
- Kiểm tra generation gồm JSON, tham chiếu fact đúng, không bịa số tài khoản
  và không thêm HTML/link. Đây là kiểm tra cấu trúc, không thay đánh giá ngữ nghĩa.
- Chỉ cân nhắc kích hoạt khi chất lượng không giảm và đã đọc kiểm tra câu trả
  lời. Nếu không đạt, lưu adapter nghiên cứu và giữ model hiện tại trong app.

Tạo corpus bằng môi trường AI:

```sh
cd ai-service
.venv/bin/python -m training.chat_dataset --output-dir ../runtime/NEW_RUN/chat-data
cd ..
```

Sau khi tải base model vào `runtime/NEW_RUN/base-model` và ghi revision vào
`base-model.json`, dùng môi trường MLX riêng:

```sh
runtime/llm-training-venv/bin/python scripts/train_chat_lora.py --run-dir runtime/NEW_RUN
runtime/llm-training-venv/bin/python scripts/evaluate_chat_lora.py --run-dir runtime/NEW_RUN
```

Các script không tự đưa model lên cloud, không bật telemetry service và không
kích hoạt model. Artifacts/venv/run logs nằm trong `runtime/`, bị Git ignore.

Nguồn kỹ thuật: [MLX LM LoRA](https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/LORA.md),
[base model](https://huggingface.co/mlx-community/Qwen3-1.7B-4bit).

## Kiểm tra bổ sung ML tài chính

Sau khi chốt candidate, có thể kiểm tra một nhóm tài khoản tổng hợp với seed
khác mà không refit hoặc thay ngưỡng:

```sh
cd ai-service
.venv/bin/python -m training.stress_evaluate --candidate ../runtime/NEW_RUN/financial-candidate --output ../runtime/NEW_RUN/financial-stress-evaluation.json
```

Đây là kiểm tra bổ sung từ cùng quy tắc sinh dữ liệu, chưa phải dữ liệu thực.

Docker Compose lưu `/app/artifacts` trong volume `ai_models`. Model đã kích
hoạt được giữ khi restart hoặc tạo lại container; `docker compose down` giữ
volume. Bản model và các pointer trước đó vẫn có thể dùng để rollback.

## Phục vụ adapter đã được đánh giá

`run_finetuned_chat.sh` yêu cầu kết quả tự động đạt và file review có checksum
đúng của adapter. Script từ chối model chưa được đánh giá hoặc đọc kiểm tra.

```sh
sh scripts/run_finetuned_chat.sh runtime/NEW_RUN
```

MLX phục vụ trên loopback cổng 11435. Chỉ khi đã duyệt model, cấu hình app dùng
`CHAT_PROVIDER=mlx`, `CHAT_FINE_TUNED=true`, `CHAT_MODEL` là tên bản model,
`CONTAINER_MLX_URL=http://host.docker.internal:11435`, rồi recreate dịch vụ AI.
Mô hình giữ số liệu qua các fact đã xác minh; adapter không có quyền sửa dữ liệu.
Nếu URL MLX nằm ngoài danh sách host local, app vẫn yêu cầu đồng ý gửi dữ liệu
như đối với provider bên ngoài. Ollama vẫn là lựa chọn mặc định cho máy mới.

Điều kiện chatbot được định trước khi chạy test cuối: validation loss giảm
ít nhất 10%, test loss thấp hơn baseline, tỷ lệ JSON/tham chiếu đúng ít nhất
95% và không thấp hơn baseline, toàn bộ câu tài chính test phải qua kiểm tra.
Việc kích hoạt còn yêu cầu đọc kiểm tra ngữ nghĩa các đáp án đã sinh.

## Đánh giá bản có tài liệu tham chiếu

Adapter đứng riêng và bản kết hợp tra cứu được đánh giá riêng. Không dùng các
câu sai của test cũ để cập nhật trọng số. Trọng số đã chọn giữ nguyên khi đánh
bản có nguồn tham chiếu trên một bộ câu hỏi mới:

```sh
runtime/llm-training-venv/bin/python scripts/evaluate_grounded_chat.py --run-dir runtime/NEW_RUN
ai-service/.venv/bin/python scripts/review_grounded_release.py --run-dir runtime/NEW_RUN
```

Bước chấm điểm chỉ kiểm tra cấu trúc bằng validator thực tế. Sau khi đọc từng
đáp án và đối chiếu nguồn, người vận hành mới ghi `grounded-model-review.json`
với checksum adapter, kết quả review và phạm vi sử dụng; `activationEligible`
trong `grounded-evaluation.json` chỉ được bật khi review đạt. Script phục vụ
kiểm tra cả hai file, checksum adapter và checksum tài liệu tham chiếu.

Bản ngày 14/10/2026 dùng dữ liệu giả lập nhỏ. Raw adapter bị từ chối do lỗi nội
dung; bản kết hợp nguồn tham chiếu được duyệt trong phạm vi bộ thử nghiệm bởi
coding assistant, chưa có đánh giá của chuyên gia độc lập hoặc người dùng thực.
