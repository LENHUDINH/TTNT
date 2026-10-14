# Kết quả huấn luyện AI FinSight — 14/10/2026

## ML tài chính

Model được chọn: `random_forest_depth5`; version `synthetic-v2-f630a4ccb782`.
Dữ liệu: 20 tài khoản × 365 ngày tổng hợp và 320 mô tả giao dịch biên soạn. Không dùng dữ liệu cá nhân hay chat của người dùng.

| Chỉ số test | Kết quả |
|---|---:|
| MAE dự báo 30 ngày, theo sai số từng ngày | 146,242.47 đồng/ngày |
| RMSE dự báo 30 ngày | 351,948.99 đồng/ngày |
| Accuracy phân loại mô tả | 89.06% |
| Macro F1 phân loại | 89.34% |
| Precision bất thường | 50.00% |
| Recall bất thường | 60.42% |
| F1 bất thường | 54.72% |

Kiểm tra bổ sung trên 8 tài khoản tổng hợp với seed mới: MAE 30 ngày 148,370.25 đồng/ngày, so với trung bình trượt 307,366.04 đồng/ngày.
Cùng quy tắc sinh dữ liệu nên đây vẫn chưa phải đánh giá thực tế. Train lại cùng dataset tái lập kết quả, không phải bằng chứng model tốt hơn bản trước.

## Chatbot Qwen3

Base: `mlx-community/Qwen3-1.7B-4bit`; revision được ghim và SHA-256 trọng số đã xác minh.
Corpus giả lập: 148 train, 41 validation, 41 test; không trùng câu hỏi sau chuẩn hóa giữa các split.
QLoRA rank 8, 8 lớp cuối, khoảng 2,49 triệu tham số có thể học; batch size 1, gradient checkpointing, assistant-only loss, seed cố định.
Checkpoint được chọn bằng validation trước khi xem test. Những câu cùng chủ đề có thể có đáp án gần nhau; corpus nhỏ không đại diện cho người dùng thực.

Trạng thái: đã hoàn tất fine-tune.

| Đánh giá chatbot | Base | Sau QLoRA |
|---|---:|---:|
| Test loss trên token đáp án | 4.2528 | 0.1056 |
| Test perplexity | 70.3034 | 1.1114 |
| Đáp án qua kiểm tra cấu trúc | 12/41 | 41/41 |

Checkpoint chọn theo validation: `0000160_adapters.safetensors`, loss 0.1144.
Vượt kiểm tra cấu trúc tự động: Có. Adapter đứng riêng không được kích hoạt vì chưa qua kiểm tra nội dung.

## Đánh giá bản kết hợp tài liệu tham chiếu

Adapter đứng riêng bị từ chối sau khi đọc kiểm tra: một số định nghĩa sai dù JSON hợp lệ. Trọng số giữ cố định; thêm tra cứu tài liệu đã kiểm chứng, rồi đánh giá riêng trên một bộ câu hỏi được biên soạn mới.
Kiểm tra bằng serving validator: base 33/41, adapter + tài liệu 41/41. Cùng cách giải mã, không dùng grammar JSON; đây không phải tỷ lệ chính xác toàn ứng dụng.
Đọc kiểm tra ngữ nghĩa bởi coding assistant: đạt trong phạm vi bộ câu hỏi này. Chưa có đánh giá bởi chuyên gia độc lập hay bộ người dùng thực.
Bản phát hành chỉ áp dụng cho adapter kết hợp nguồn tham chiếu và kiểm tra số liệu của app. Có thể còn dài dòng hoặc nhắc thêm dữ liệu đã xác minh.
Đã kích hoạt trong app: Có.

## Phạm vi và bằng chứng

Loss thấp hơn không tự chứng minh câu trả lời tài chính đúng. Cần đọc đánh giá ngữ nghĩa và thử câu hỏi thực tế; cảnh báo bất thường không phải kết luận gian lận.
Dataset, logs, cấu hình, dependency lock, checksum, adapter và kết quả đầy đủ nằm trong thư mục run dưới `runtime/`. Tài liệu tái lập: `docs/PROFESSIONAL_AI_TRAINING.md`.
Nguồn: [MLX LM LoRA](https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/LORA.md), [base Qwen3](https://huggingface.co/mlx-community/Qwen3-1.7B-4bit).
