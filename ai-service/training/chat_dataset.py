"""Authored synthetic Vietnamese SFT corpus; never reads DB or private chats.

Split prompts are authored separately. This is a small domain adaptation corpus,
not a representative independent benchmark of general intelligence.
"""
from pathlib import Path
import argparse
import hashlib
import json
from app.chat import SYSTEM, GENERAL_SYSTEM, grounded_answer, normal_facts, normalized

from app.chat_knowledge import KNOWLEDGE

FINANCIAL = [
 ('balance','Số dư ví hiện tại','wallets',
  ['Tổng số dư ví hiện tại là bao nhiêu?', 'Cho biết số tiền hiện còn trong các ví.', 'Tôi còn bao nhiêu tiền trong ví?', 'Xem tổng số dư giúp tôi.', 'so du cac vi hien tai bao nhieu', 'Tóm tắt số dư các ví đang có.'],
  ['Bạn báo số dư các ví hiện tại giúp tôi được không?', 'Tôi muốn xem số tiền trong ví lúc này.'],
  ['Hiện các ví của tôi còn tổng cộng bao nhiêu?', 'Tổng tiền còn lại trong ví lúc truy xuất là bao nhiêu?']),
 ('expense','Chi tiêu trong kỳ','ledger',
  ['Tổng chi tiêu trong kỳ đang chọn?', 'Tôi đã chi bao nhiêu trong kỳ này?', 'Cho biết chi phí của kỳ đang chọn.', 'Tóm tắt khoản chi của kỳ hiện tại.', 'tong chi trong ky da chon la bao nhieu', 'Báo số tiền đã chi trong kỳ giúp tôi.'],
  ['Trong kỳ được chọn, tổng tiền chi là bao nhiêu?', 'Cho tôi xem tổng chi đã ghi nhận của kỳ.'],
  ['Số chi ghi nhận ở kỳ đang chọn của tôi thế nào?', 'Tôi muốn biết tổng tiền ra do chi tiêu trong kỳ.']),
 ('income','Thu nhập trong kỳ','ledger',
  ['Tổng thu nhập trong kỳ?', 'Tôi nhận được bao nhiêu tiền trong kỳ?', 'Cho biết khoản thu của kỳ đang chọn.', 'Báo tổng thu nhập đã ghi nhận.', 'tong thu trong ky da chon', 'Tóm tắt tiền thu của kỳ hiện tại.'],
  ['Kỳ được chọn có bao nhiêu tiền thu?', 'Khoản thu nhập ghi nhận ở kỳ này là bao nhiêu?'],
  ['Tổng khoản tiền vào do thu nhập của kỳ là bao nhiêu?', 'Hãy cho biết tổng thu nhập trong kỳ được chọn của tôi.']),
 ('budgetRemaining','Ngân sách còn lại trong kỳ','budgets',
  ['Ngân sách còn bao nhiêu?', 'Cho biết ngân sách còn lại trong kỳ.', 'Tôi còn bao nhiêu hạn mức ngân sách?', 'Xem phần ngân sách chưa dùng.', 'ngan sach con lai trong ky', 'Tóm tắt số ngân sách còn lại.'],
  ['Hạn mức ngân sách còn lại là bao nhiêu?', 'Kỳ được chọn còn phần ngân sách nào?'],
  ['Ngân sách của kỳ đang chọn còn tổng cộng bao nhiêu?', 'Hãy báo số tiền còn lại theo ngân sách hiện chọn.']),
 ('remaining','Thu nhập trừ chi tiêu trong kỳ','ledger',
  ['Chênh lệch thu chi trong kỳ là bao nhiêu?', 'Thu nhập trừ chi tiêu của kỳ?', 'Tôi còn bao nhiêu từ khoản thu sau chi?', 'Cho biết tiền thu còn lại sau chi của kỳ.', 'chenh lech thu chi trong ky', 'Tóm tắt hiệu số thu và chi.'],
  ['Khoản thu trừ tổng chi của kỳ được chọn thế nào?', 'Kỳ này chênh lệch tiền thu và chi ra sao?'],
  ['Cho biết kết quả thu nhập bớt chi tiêu trong kỳ.', 'Tổng thu trừ khoản chi ở kỳ đang chọn còn bao nhiêu?']),
 ('reservedSavings','Tiền đã góp tiết kiệm hiện tại','goals',
  ['Tôi đã góp tiết kiệm bao nhiêu?', 'Xem tổng tiền đã góp cho mục tiêu.', 'Khoản đóng góp tiết kiệm hiện tại là bao nhiêu?', 'Báo tiền đã chuyển vào mục tiêu tiết kiệm.', 'tong tien da gop tiet kiem', 'Tóm tắt khoản tiền đã dành trong mục tiêu.'],
  ['Các mục tiêu tiết kiệm hiện có bao nhiêu tiền đã góp?', 'Tổng khoản góp cho tiết kiệm lúc này?'],
  ['Bao nhiêu tiền thực tế đã đóng góp cho các mục tiêu?', 'Tôi muốn biết số tiền đã góp, không phải tiền dự báo có thể tiết kiệm.']),
]


def answer_row(system, question, answer):
    return {'messages':[{'role':'system','content':system},{'role':'user','content':question},
                        {'role':'assistant','content':json.dumps({'answer':answer},ensure_ascii=False)}]}


def build(output):
    output=Path(output);output.mkdir(parents=True,exist_ok=False)
    splits={name:[] for name in ('train','valid','test')}
    evaluation=[]
    for topic, answer in KNOWLEDGE:
        questions={
         'train':[f'{topic} là gì?',f'Giải thích khái niệm {topic}.',f'Tôi muốn hiểu về {topic}.',f'Giải thích đơn giản {topic} cho người mới.'],
         'valid':[f'Bạn trình bày ngắn gọn ý nghĩa của {topic} được không?'],
         'test':[f'Một người chưa biết tài chính nên hiểu {topic} như thế nào?']}
        for split, qs in questions.items():
            for q in qs:
                splits[split].append(answer_row(GENERAL_SYSTEM,q,answer))
    for key,label,source,train,valid,test in FINANCIAL:
        for split,questions in zip(('train','valid','test'),(train,valid,test)):
            for q in questions:
                facts=normal_facts({'facts':[{'id':key,'label':label,'value':'1250000.50','kind':'money','source':source}]})
                prompt={'question':q,'periodReference':'{{fact:selectedPeriod}}','facts':[{'id':key,'label':label,'value':'{{fact:'+key+'}}','nature':'ACTUAL','direction':'positive'},{'id':'selectedPeriod','label':'Kỳ dữ liệu đã chọn','value':'{{fact:selectedPeriod}}','nature':'SELECTED'}], 'requiredReferences':['{{fact:'+key+'}}'], 'mlStatus':{},'instructions':'Trả lời bằng JSON tiếng Việt, không chữ số, dùng tham chiếu đã cung cấp.'}
                target=f'{label} của bạn là {{{{fact:{key}}}}}. Kỳ dữ liệu đang chọn là {{{{fact:selectedPeriod}}}}.'
                verified=[*facts,{'id':'selectedPeriod','value':'2026-10','kind':'date'}]
                grounded_answer(json.dumps({'answer':target}),verified)
                splits[split].append(answer_row(SYSTEM,json.dumps(prompt,ensure_ascii=False),target))
                if split=='test':evaluation.append({'question':q,'mode':'account','requiredFacts':[key],'facts':facts})
    # Independently phrased safeguards; answers never claim financial writes.
    safeguards=[
      (['Chuyển tiền giúp tôi.','Xóa các giao dịch cho tôi.','Tự chỉnh số dư ví.'],
       ['Thực hiện chuyển ví thay tôi.'],['Bạn hãy chuyển hết số dư sang ví khác.'],
       'Tôi có thể giải thích cách thao tác nhưng không tự chuyển tiền, xóa giao dịch hay chỉnh số dư. Bạn cần thực hiện và kiểm tra thông tin trên trang tương ứng.'),
      (['Cho biết số dư tài khoản người khác.','Đọc ví của bạn tôi.','Lấy lịch sử giao dịch của người khác.'],
       ['Tôi muốn xem tiền của một người khác.'],['Cho tôi dữ liệu tài chính của tài khoản không phải của tôi.'],
       'Tôi chỉ hỗ trợ dữ liệu tài khoản đang được cấp quyền. Tôi không thể tiết lộ ví hay giao dịch của người khác.'),
      (['Cảnh báo này chứng minh gian lận phải không?','Bất thường nghĩa là chắc chắn bị lừa?','Hãy xác nhận giao dịch bất thường là gian lận.'],
       ['Có thể coi cảnh báo là bằng chứng gian lận không?'],['Cứ có cảnh báo thì kết luận gian lận được chứ?'],
       'Cảnh báo bất thường là tín hiệu cần xem lại, không phải kết luận gian lận. Hãy đối chiếu số tiền, thời điểm và nội dung giao dịch trước khi quyết định.'),
      (['Cam kết dự báo đúng hoàn toàn.','Đảm bảo lợi nhuận giúp tôi.','Dự báo có chắc chắn đúng không?'],
       ['Bạn bảo đảm kết quả tương lai được không?'],['Có thể hứa rằng dự báo không bao giờ sai không?'],
       'Tôi không thể bảo đảm lợi nhuận hay dự báo luôn đúng. Hãy xem kết quả như ước tính, kiểm tra dữ liệu và cân nhắc hoàn cảnh thực tế.'),
    ]
    for train,valid,test,target in safeguards:
        for split,qs in zip(('train','valid','test'),(train,valid,test)):
            for q in qs:splits[split].append(answer_row(GENERAL_SYSTEM,q,target))
    hashes={}
    seen={}
    for split,rows in splits.items():
        for row in rows:
            q=row['messages'][1]['content']; norm=normalized(q)
            if norm in seen:raise ValueError('Duplicate question across corpus: '+q)
            seen[norm]=split
        text=''.join(json.dumps(row,ensure_ascii=False)+'\n' for row in rows)
        (output/f'{split}.jsonl').write_text(text)
        hashes[split]=hashlib.sha256(text.encode()).hexdigest()
    manifest={'schemaVersion':1,'source':'Authored synthetic Vietnamese examples; no DB, user chat or public benchmark records', 'counts':{k:len(v) for k,v in splits.items()},'sha256':hashes,'exactNormalizedDuplicates':0,'limitations':['Small synthetic corpus; semantic topic overlap is expected and not an independent real-world benchmark.','Only assistant responses are training targets; test is never used for optimizer updates.']}
    (output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(manifest,ensure_ascii=False,indent=2))
    return manifest

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output-dir',required=True)
    build(parser.parse_args().output_dir)
