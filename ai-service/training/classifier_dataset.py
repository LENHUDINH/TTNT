"""Small, authored Vietnamese benchmark: held-out descriptions, no user/chat data.

Every phrase is written for one split. Repeated transactions are deliberately NOT
used to evaluate text generalization. Cross-split near duplicates are rejected.
"""
import hashlib
import re
import unicodedata
from difflib import SequenceMatcher

import pandas as pd

# Deliberately different phrasing per split; no template expansion by date/number.
# This is still a synthetic, authored corpus, not a representative language study.
PHRASES = {
    "Ăn uống": {
        "train": """Mua cơm trưa|Cà phê sáng|Ăn tối|Bánh mì thịt|Phở bò ở quán|Đặt bún chả|Trà sữa trân châu|Mua rau củ nấu ăn|Hải sản cho bữa tiệc|Nước ép cam|Bánh sinh nhật|Ăn buffet cuối tuần|Gạo và trứng cho gia đình|Sữa tươi và sữa chua|Cơm văn phòng|Tiền ăn sáng|Gọi pizza giao tận nơi|Thịt gà làm bữa tối|Cà phê với đồng nghiệp|Mì cay cùng bạn|Bữa ăn nhà hàng|Bún bò Huế|Mua trái cây tươi|Đồ uống ở quán trà""",
        "validation": """Bữa trưa ở căng tin|Tối nay ăn lẩu với nhóm bạn|Ly cà phê mang về văn phòng|Mua thực phẩm cho cả tuần|Bánh ngọt dùng với trà|Giao đồ ăn đến nhà|Thanh toán suất phở sau giờ làm|Trà chanh trong buổi gặp mặt""",
        "test": """Chi cho bữa sáng bằng bánh mì|Góp tiền ăn tối chung|Rau tươi phục vụ việc nấu nướng|Suất cơm đặt lúc nghỉ trưa|Hóa đơn nhà hàng hải sản|Mua đồ uống khi đi dạo|Tiền bún cho buổi sáng hôm nay|Sữa chua làm món tráng miệng""",
    },
    "Mua sắm": {
        "train": """Mua laptop|Mua áo|Siêu thị|Giày thể thao mới|Túi xách da|Điện thoại thay máy cũ|Quần jeans|Đồng hồ đeo tay|Tai nghe không dây|Mỹ phẩm dưỡng da|Mua balô đi làm|Váy dự tiệc|Bàn phím máy tính|Màn hình cho laptop|Áo khoác mùa đông|Mua đồ dùng cá nhân|Nước hoa nữ|Kính râm|Đơn hàng quần áo online|Mua sạc dự phòng|Dép và tất|Thiết bị điện tử|Phụ kiện điện thoại|Kem chống nắng""",
        "validation": """Sắm một đôi giày chạy bộ|Áo sơ mi để mặc đi làm|Đổi điện thoại sang máy mới|Mỹ phẩm trang điểm mua tại cửa hàng|Đặt túi xách trên mạng|Mua thiết bị cho góc máy tính|Chi tiền chọn quần ở trung tâm thương mại|Thanh toán món đồ trong siêu thị""",
        "test": """Mua quà là chiếc đồng hồ|Chi cho áo mặc mùa lạnh|Tai nghe dùng khi làm việc|Sắm balô đựng laptop|Tiền mua giày tặng em gái|Lấy kem dưỡng da theo đơn hàng|Trả tiền phụ kiện ở cửa hàng điện tử|Quần áo đặt qua ứng dụng""",
    },
    "Đi lại": {
        "train": """Đổ xăng|Vé xe buýt|Đi taxi|Phí gửi xe|Đặt xe công nghệ|Vé tàu về quê|Bảo dưỡng xe máy|Thay dầu xe|Phí cầu đường|Vé máy bay công tác|Sửa lốp xe|Nạp thẻ xe buýt|Thuê xe tự lái|Bãi đậu ô tô|Xe khách liên tỉnh|Bắt Grab đi làm|Mua vé metro|Tiền đi lại|Phí vận chuyển hàng|Gọi xe ra sân bay|Đổ dầu diesel|Rửa xe ô tô|Phí cao tốc|Thay phanh xe máy""",
        "validation": """Chi tiền xăng cho chuyến đi|Thanh toán cuốc taxi về nhà|Vé xe khách thăm gia đình|Bảo dưỡng phương tiện định kỳ|Gửi xe tại tòa nhà làm việc|Tiền thuê ô tô đi tỉnh|Đi tàu điện đến văn phòng|Lệ phí qua trạm cầu đường""",
        "test": """Nạp nhiên liệu trên đường về quê|Chi phí gọi xe khi trời mưa|Trả tiền chuyến buýt cuối ngày|Vé tàu hỏa đi công tác|Sửa chiếc xe đang bị thủng lốp|Đặt chuyến bay đến Đà Nẵng|Tiền gửi ô tô suốt buổi tối|Mua thẻ đi metro hằng tháng""",
    },
    "Học tập": {
        "train": """Đóng học phí|Mua sách|Khóa học|Lệ phí thi tiếng Anh|Sách giáo khoa|Học lập trình Python|Lớp học ngoại ngữ|Mua vở và bút|Gia sư toán|Đăng ký khóa học online|Học đàn piano|Tiền lớp bồi dưỡng|Mua tài liệu ôn thi|Học phí đại học|Khóa luyện IELTS|Phí đào tạo kỹ năng|Sách tham khảo|Lớp tiếng Nhật|Dụng cụ học tập|Học lái xe|Lệ phí chứng chỉ nghề|Mua giáo trình|Trả tiền khóa học Excel|Học thiết kế đồ họa""",
        "validation": """Chi cho lớp luyện thi cuối tuần|Giáo trình dùng ở trường đại học|Đăng ký học ngoại ngữ buổi tối|Thanh toán phí đào tạo nghề|Mua sách phục vụ nghiên cứu|Tiền gia sư cho con|Đóng lệ phí thi chứng chỉ|Vở ghi chép cho học kỳ mới""",
        "test": """Trả học phí kỳ hai cho trường|Khóa bồi dưỡng kiến thức lập trình|Mua tài liệu để chuẩn bị bài kiểm tra|Tiền học thêm môn toán|Sách đọc nâng cao kỹ năng|Đăng ký lớp giao tiếp tiếng Anh|Lệ phí dự thi ngoại ngữ quốc tế|Chi tiền mua đồ cho việc học""",
    },
    "Giải trí": {
        "train": """Xem phim|Vé hòa nhạc|Du lịch|Vé công viên|Chơi bowling|Đăng ký Netflix|Mua trò chơi điện tử|Karaoke cùng bạn|Vé bảo tàng|Đi nghỉ dưỡng|Thuê sân bóng|Vé xem bóng đá|Phí câu lạc bộ giải trí|Đi cắm trại|Vé triển lãm|Chơi game online|Đi dã ngoại cuối tuần|Show ca nhạc|Vé khu vui chơi|Tài khoản Spotify|Xem kịch tại nhà hát|Tour du lịch biển|Mua sách truyện giải trí|Vé biểu diễn nghệ thuật""",
        "validation": """Chi cho buổi xem phim ở rạp|Vé vào khu vui chơi trẻ em|Đặt tour nghỉ dưỡng hè|Buổi hòa nhạc của ban nhạc yêu thích|Thanh toán dịch vụ nghe nhạc|Đi chơi karaoke sau giờ làm|Mua game để chơi cùng bạn|Vé tham quan bảo tàng lịch sử""",
        "test": """Đăng ký xem phim trực tuyến|Tiền đi dã ngoại với đồng nghiệp|Giải trí bằng bowling tối thứ bảy|Mua vé cổ vũ bóng đá|Cắm trại trên núi vào ngày nghỉ|Chi phí chơi ở công viên|Vé xem vở kịch mới|Thanh toán chuyến du lịch gia đình""",
    },
    "Nhà ở": {
        "train": """Tiền thuê nhà|Sửa nhà|Mua nội thất|Thuê căn hộ|Mua bàn ghế|Tiền đặt cọc phòng trọ|Sửa mái nhà|Thay cửa sổ|Sơn tường phòng ngủ|Mua giường mới|Phí quản lý chung cư|Lắp điều hòa|Sửa đường ống|Tiền môi giới thuê nhà|Dọn vệ sinh căn hộ|Mua tủ quần áo|Bảo trì nhà ở|Sửa khóa cửa|Mua rèm cửa|Thuê phòng trọ|Mua sofa phòng khách|Đóng phí căn hộ|Chống thấm mái|Lắp kệ bếp""",
        "validation": """Thanh toán tiền căn hộ đang thuê|Đặt cọc chỗ ở mới|Chi tiền sửa chữa phòng khách|Mua đồ nội thất cho nhà|Chi phí vận hành khu căn hộ|Thuê thợ thay mái bị dột|Tiền sơn lại tường nhà|Bổ sung tủ cho phòng ngủ""",
        "test": """Trả tiền thuê nơi ở hằng tháng|Sửa cửa ra vào căn nhà|Bàn ghế mới dành cho phòng khách|Chi phí chống thấm căn hộ|Thanh toán thợ bảo trì nhà|Rèm trang trí cửa sổ phòng ngủ|Dịch vụ dọn dẹp nơi đang ở|Lắp giường cho phòng trọ""",
    },
    "Hóa đơn": {
        "train": """Hóa đơn điện|Tiền nước|Internet|Cước điện thoại|Gói mạng di động|Thanh toán tiền điện|Phí truyền hình cáp|Cước wifi|Nạp tiền sim|Tiền gas|Phí dịch vụ ngân hàng|Hóa đơn nước tháng này|Trả cước internet|Gia hạn tên miền|Phí thuê máy chủ|Cước viễn thông|Phí đăng ký dịch vụ|Đóng tiền rác|Phí vệ sinh khu phố|Hóa đơn điện thoại|Gói dữ liệu 4G|Thanh toán dịch vụ số|Trả cước truyền hình|Tiền tiện ích hằng tháng""",
        "validation": """Đóng tiền sử dụng điện kỳ này|Thanh toán cước mạng ở nhà|Gói dữ liệu di động cho tháng mới|Tiền sử dụng nước sinh hoạt|Cước liên lạc bằng điện thoại|Gia hạn dịch vụ truyền hình|Phí thu gom rác của khu dân cư|Nạp thêm tiền vào thuê bao""",
        "test": """Trả hóa đơn điện sau khi nhận thông báo|Cước internet được trừ định kỳ|Đóng phí nước dùng trong gia đình|Mua gói mạng cho chiếc sim|Thanh toán cước truyền hình gia đình|Phí vệ sinh theo thông báo khu phố|Tiền gas để duy trì sinh hoạt|Gia hạn dịch vụ máy chủ trên mạng""",
    },
    "Sức khỏe": {
        "train": """Mua thuốc|Khám bệnh|Phí nha khoa|Khám sức khỏe định kỳ|Tiền viện phí|Thuốc cảm cúm|Chụp X quang|Xét nghiệm máu|Mua vitamin|Tiêm vaccine|Điều trị răng|Khám mắt|Bảo hiểm y tế|Tư vấn tâm lý|Thuốc theo đơn|Vật lý trị liệu|Phí bệnh viện|Khám da liễu|Mua khẩu trang y tế|Nhổ răng khôn|Khám tai mũi họng|Kính thuốc cận thị|Chăm sóc sức khỏe|Khám nhi khoa""",
        "validation": """Chi tiền mua thuốc ở nhà thuốc|Kiểm tra sức khỏe tại bệnh viện|Thanh toán khám răng|Tiêm phòng theo lịch hẹn|Phí xét nghiệm trong đợt khám|Thuốc bổ theo hướng dẫn bác sĩ|Khám chuyên khoa mắt|Đi trị liệu sau chấn thương""",
        "test": """Mua thuốc điều trị bệnh theo toa|Tiền khám cho bé ở phòng nhi|Bệnh viện thu phí chụp phim|Thanh toán buổi tư vấn sức khỏe|Chi phí làm xét nghiệm tổng quát|Nha khoa làm sạch và kiểm tra răng|Đóng bảo hiểm phục vụ chữa bệnh|Mua kính điều chỉnh thị lực""",
    },
}


def normalize_phrase(text):
    value = unicodedata.normalize("NFKD", text.casefold().replace("đ", "d"))
    value = "".join(c for c in value if not unicodedata.combining(c))
    value = re.sub(r"\d+", " # ", value)
    return " ".join(re.findall(r"[a-z#]+", value))


def near_duplicate(left, right):
    """Conservative reproducible heuristic; not a semantic plagiarism detector."""
    a, b = normalize_phrase(left), normalize_phrase(right)
    if a == b:
        return True
    aa, bb = set(a.split()), set(b.split())
    jaccard = len(aa & bb) / max(len(aa | bb), 1)
    return jaccard >= .75 or SequenceMatcher(None, a, b).ratio() >= .82


def split_leakage(frame):
    violations = []
    records = list(frame.itertuples(index=False))
    for i, left in enumerate(records):
        for right in records[i + 1:]:
            if left.split != right.split and near_duplicate(left.text, right.text):
                violations.append({"leftId": left.phraseId, "rightId": right.phraseId})
    return violations


def classification_dataset():
    rows = []
    for category, splits in PHRASES.items():
        for split, phrases in splits.items():
            for text in phrases.split("|"):
                rows.append({"phraseId": hashlib.sha256(text.encode()).hexdigest()[:16],
                             "category": category, "split": split, "text": text,
                             "normalized": normalize_phrase(text)})
    frame = pd.DataFrame(rows)
    if frame.normalized.duplicated().any():
        raise ValueError("Authored corpus contains duplicate normalized phrases")
    leakage = split_leakage(frame)
    if leakage:
        raise ValueError(f"Cross-split near-duplicate phrases: {leakage}")
    return frame
