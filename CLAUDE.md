# Cờ Tướng Nhập Môn — hướng dẫn cho Claude

Cấu trúc, lệnh build/test và cách deploy: xem `README.md`. Sửa `src/` xong phải `npm run build` rồi commit cả `dist/`; chỉ commit khi `npm test` thoát mã 0.

---

## Context Kit — quy tắc checkpoint

### Đầu mỗi phiên (bắt buộc, làm trước khi nhận task)
1. Đọc STATE.md trước — đây là nguồn sự thật duy nhất về "đang làm gì / next step / blocker".
2. Nếu cần hiểu lý do đằng sau 1 quyết định cũ trước khi tiếp tục, đọc MEMORY.md.
3. Không cần đọc PLAN.md mỗi lần — chỉ đọc khi cần nhớ lại mục tiêu/scope tổng thể.

### Trong lúc làm việc — checkpoint SỚM, không đợi cuối phiên
Cập nhật STATE.md ngay khi (không đợi gộp lại cuối phiên):
- Vừa xong 1 subtask
- Chuẩn bị chuyển sang việc khác
- Cảm thấy context đang dài / sắp bị compact

Cập nhật MEMORY.md ngay khi:
- Vừa chốt 1 quyết định quan trọng (chọn approach A thay vì B)
- Vừa thử 1 cách không work — ghi lại lý do để không lặp lại ở phiên sau
- Vừa phát hiện 1 gotcha / constraint không rõ ràng ngay từ đầu

### Cuối phiên (bắt buộc, không được bỏ qua kể cả task nhỏ)
STATE.md phải phản ánh đúng thực tế hiện tại trước khi kết thúc phiên.

### Quy tắc viết từng file
- **STATE.md**: luôn ngắn, đọc được trong 5 giây, GHI ĐÈ (không append thêm dòng cũ)
- **MEMORY.md**: append đầy đủ, ghi nhớ toàn bộ — không tự xoá/archive
- **PLAN.md**: gần như bất biến, chỉ sửa khi scope thật sự đổi

### Không được làm
- Không note status vào PLAN.md
- Không note rải rác trong chat mà không đưa vào file
- Không gộp cả 3 file thành 1
