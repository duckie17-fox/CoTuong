# Spec v4 — Đấu xếp hạng (ghép trận, máy thế chỗ khi vắng người)

**Trạng thái:** người dùng đã chốt hướng (2026-10-08) · bổ sung cho spec v3 (Elo, phòng Tính Elo).

## Quyết định của người dùng
- **Elo chung** cho ván với người và ván xếp hạng với máy. Thắng được cộng, thua/hoà bị trừ theo công thức Elo.
- Bấm **Đấu xếp hạng** → tìm người có Elo chênh ≤ 200 trong **5–10 giây** (chọn 8 giây) → không có ai thì ghép **máy**
  ở cấp có Elo gần mình nhất, nhỉnh hơn một chút.
- Máy mang **tên giống nick thật** kiểu game thủ Việt (không ghi là máy).
- **Nhiều cấp máy hơn**: 20 cấp xếp hạng (luyện tập ở Kỳ viện vẫn 10 cấp).
- Đổi tên bậc (không dùng tên quân cờ).

## Bậc hạng (theo Elo, mỗi bậc chia III → II → I)
| Bậc | Elo |
|---|---|
| Đồng | dưới 1000 |
| Bạc | 1000–1149 |
| Vàng | 1150–1299 (người mới 1200 = Vàng II) |
| Bạch Kim | 1300–1449 |
| Kim Cương | 1450–1599 |
| Tinh Anh | 1600–1799 |
| Cao Thủ | 1800–1999 |
| Đại Cao Thủ | 2000–2199 |
| Thách Đấu | từ 2200 (không chia nấc) |
Bậc Đồng chia nấc: III < 900, II 900–949, I 950–999. Các bậc khác chia đều 3 nấc.

## Máy xếp hạng (20 cấp)
- Elo cố định: cấp n = 700 + (n−1)·85 (cấp 1 = 700 … cấp 20 = 2315). Thông số tìm nước nội suy từ 10 cấp luyện tập
  (độ sâu, nhiễu, tỉ lệ sơ suất, thời gian). Elo máy là ước tính — hiệu chỉnh theo ván thật sau.
- Ghép: cấp có Elo ≥ Elo người chơi gần nhất (nếu vượt cấp 20 thì cấp 20).
- Hiển thị: tên nick ngẫu nhiên, Elo ≈ Elo máy ± 30, đánh như người: nghĩ 1–6 giây, chào/cảm ơn bằng câu chat nhanh,
  từ chối/đồng ý hoà theo thế cờ, đầu hàng khi thua quá rõ.

## Luật ván xếp hạng
- Không gợi ý, không xin đi lại (như phòng Tính Elo).
- Ván với máy: máy chủ phát lại toàn bộ nước đi để kiểm tra hợp lệ; kết quả tự nhiên (chiếu bí, lặp, 60 nước…) phải khớp;
  người chơi đầu hàng = thua; máy "đầu hàng" chỉ nhận khi người chơi hơn rõ về quân; hoà thoả thuận chỉ nhận sau ≥ 60 nửa nước
  và quân hai bên gần bằng nhau.
- **Không giới hạn thời gian** (người dùng chốt 2026-10-08): ván dở với máy được giữ để vào tiếp bất cứ lúc nào; chưa xong ván dở thì không mở được ván xếp hạng mới (không né thua được). Thua/đầu hàng vẫn bị trừ Elo.
- Tối đa 30 ván xếp hạng với máy mỗi ngày. Thắng chỉ tính khi ván ≥ 10 nửa nước (đầu hàng sớm vẫn bị trừ).
- Hai người được ghép: vào cùng phòng Tính Elo (luật như phòng Tính Elo của spec v3).
