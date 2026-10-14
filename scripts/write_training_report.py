"""Render measured local training results to a concise Markdown report."""
from pathlib import Path
import argparse,json


def main():
 p=argparse.ArgumentParser();p.add_argument('--run-dir',required=True,type=Path);p.add_argument('--output',required=True,type=Path);a=p.parse_args();r=a.run_dir
 financial=json.loads((r/'financial-evaluation.json').read_text());stress=json.loads((r/'financial-stress-evaluation.json').read_text());dataset=json.loads((r/'chat-data'/'manifest.json').read_text())
 llm=json.loads((r/'llm-evaluation.json').read_text()) if (r/'llm-evaluation.json').exists() else None
 trained=(r/'adapter-integrity.json').exists()
 f30=financial['forecastTest']['30'];c=financial['classificationTest'];an=financial['anomalyTest']
 lines=['# Kết quả huấn luyện AI FinSight — 14/10/2026','',
 '## ML tài chính','',
 f"Model được chọn: `{financial['forecastSelected']}`; version `{financial['candidateVersion']}`.",
 'Dữ liệu: 20 tài khoản × 365 ngày tổng hợp và 320 mô tả giao dịch biên soạn. Không dùng dữ liệu cá nhân hay chat của người dùng.','',
 '| Chỉ số test | Kết quả |','|---|---:|',
 f"| MAE dự báo 30 ngày, theo sai số từng ngày | {f30['mae']:,.2f} đồng/ngày |",
 f"| RMSE dự báo 30 ngày | {f30['rmse']:,.2f} đồng/ngày |",
 f"| Accuracy phân loại mô tả | {100*c['accuracy']:.2f}% |",
 f"| Macro F1 phân loại | {100*c['macroF1']:.2f}% |",
 f"| Precision bất thường | {100*an['precision']:.2f}% |",
 f"| Recall bất thường | {100*an['recall']:.2f}% |",
 f"| F1 bất thường | {100*an['f1']:.2f}% |",'',
 f"Kiểm tra bổ sung trên 8 tài khoản tổng hợp với seed mới: MAE 30 ngày {stress['forecast']['30']['candidate']['mae']:,.2f} đồng/ngày, so với trung bình trượt {stress['forecast']['30']['movingAverage']['mae']:,.2f} đồng/ngày.",
 'Cùng quy tắc sinh dữ liệu nên đây vẫn chưa phải đánh giá thực tế. Train lại cùng dataset tái lập kết quả, không phải bằng chứng model tốt hơn bản trước.','',
 '## Chatbot Qwen3','',
 'Base: `mlx-community/Qwen3-1.7B-4bit`; revision được ghim và SHA-256 trọng số đã xác minh.',
 f"Corpus giả lập: {dataset['counts']['train']} train, {dataset['counts']['valid']} validation, {dataset['counts']['test']} test; không trùng câu hỏi sau chuẩn hóa giữa các split.",
 'QLoRA rank 8, 8 lớp cuối, khoảng 2,49 triệu tham số có thể học; batch size 1, gradient checkpointing, assistant-only loss, seed cố định.',
 'Checkpoint được chọn bằng validation trước khi xem test. Những câu cùng chủ đề có thể có đáp án gần nhau; corpus nhỏ không đại diện cho người dùng thực.','',
 f"Trạng thái: {'đã hoàn tất fine-tune' if trained else 'fine-tune đang chạy'}." ]
 if llm and 'candidate' in llm:
  b=llm['baseline'];candidate=llm['candidate'];best=llm['selected']
  lines+=['', '| Đánh giá chatbot | Base | Sau QLoRA |','|---|---:|---:|',
   f"| Test loss trên token đáp án | {b['testLoss']:.4f} | {candidate['testLoss']:.4f} |",
   f"| Test perplexity | {b['perplexity']:.4f} | {candidate['perplexity']:.4f} |",
   f"| Đáp án qua kiểm tra cấu trúc | {b['generation']['passed']}/{b['generation']['total']} | {candidate['generation']['passed']}/{candidate['generation']['total']} |",'',
   f"Checkpoint chọn theo validation: `{best['checkpoint']}`, loss {best['validationLoss']:.4f}.",
   f"Vượt kiểm tra cấu trúc tự động: {'Có' if llm.get('automatedActivationEligible',llm['activationEligible']) else 'Chưa'}. Adapter đứng riêng không được kích hoạt vì chưa qua kiểm tra nội dung."]
 if (r/'grounded-evaluation.json').exists():
  grounded=json.loads((r/'grounded-evaluation.json').read_text())
  lines+=['','## Đánh giá bản kết hợp tài liệu tham chiếu','',
   'Adapter đứng riêng bị từ chối sau khi đọc kiểm tra: một số định nghĩa sai dù JSON hợp lệ. Trọng số giữ cố định; thêm tra cứu tài liệu đã kiểm chứng, rồi đánh giá riêng trên một bộ câu hỏi được biên soạn mới.',
   f"Kiểm tra bằng serving validator: base {grounded['baseline']['passed']}/{grounded['baseline']['total']}, adapter + tài liệu {grounded['candidate']['passed']}/{grounded['candidate']['total']}. Cùng cách giải mã, không dùng grammar JSON; đây không phải tỷ lệ chính xác toàn ứng dụng.",
   f"Đọc kiểm tra ngữ nghĩa bởi coding assistant: {'đạt trong phạm vi bộ câu hỏi này' if grounded.get('semanticReview',{}).get('approved') else 'chưa đạt'}. Chưa có đánh giá bởi chuyên gia độc lập hay bộ người dùng thực.",
   'Bản phát hành chỉ áp dụng cho adapter kết hợp nguồn tham chiếu và kiểm tra số liệu của app. Có thể còn dài dòng hoặc nhắc thêm dữ liệu đã xác minh.',
   f"Đã kích hoạt trong app: {'Có' if grounded.get('deployment',{}).get('activated') else 'đang kiểm tra luồng thực tế'}."]
 lines+=['','## Phạm vi và bằng chứng','',
 'Loss thấp hơn không tự chứng minh câu trả lời tài chính đúng. Cần đọc đánh giá ngữ nghĩa và thử câu hỏi thực tế; cảnh báo bất thường không phải kết luận gian lận.',
 'Dataset, logs, cấu hình, dependency lock, checksum, adapter và kết quả đầy đủ nằm trong thư mục run dưới `runtime/`. Tài liệu tái lập: `docs/PROFESSIONAL_AI_TRAINING.md`.',
 'Nguồn: [MLX LM LoRA](https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/LORA.md), [base Qwen3](https://huggingface.co/mlx-community/Qwen3-1.7B-4bit).','']
 a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text('\n'.join(lines))
 print(a.output)

if __name__=='__main__':main()
