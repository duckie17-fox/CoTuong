# Spec v3 — Giao diện mới (mobile + web) và Tài khoản

**Trạng thái:** Bản nháp chờ duyệt · **Ngày:** 2026-10-08
**Phạm vi:** thiết kế lại giao diện toàn app cho điện thoại và máy tính; thêm đăng ký / đăng nhập
(tên đăng nhập + mật khẩu), đồng bộ tiến độ, danh tính ở Sa trường, bạn bè + mời đấu, xếp hạng Elo.

---

## 1. Mục tiêu và không làm

**Mục tiêu**
1. Một kiểu điều hướng và bố cục chung cho điện thoại (390px) và máy tính (1440px); nội dung tự xếp lại theo độ rộng.
2. Một tài khoản dùng trên nhiều máy: tiến độ học, bài tập, lịch sử ván đi theo tài khoản.
3. Đấu với bạn bè có danh tính, kết bạn, mời đấu trực tiếp, xếp hạng Elo.
4. Không bắt buộc đăng nhập: chưa có tài khoản vẫn học, giải bài, đấu máy, đấu với bạn bằng link như hiện tại.

**Không làm (lần này)**
- App trên App Store / CH Play, cài đặt PWA, chế độ offline.
- Đăng nhập Google / email; gửi email (không có email nên không có "quên mật khẩu qua email").
- Đồng hồ thi đấu, ghép trận với người lạ, chat riêng ngoài phòng đấu.

---

## 2. Cấu trúc điều hướng mới

**Ba phần chính: 🏯 Kỳ viện · ⚔️ Sa trường · 👤 Tôi.** Điện thoại và máy tính dùng **chung một kiểu điều hướng**,
chỉ khác độ rộng (nội dung tự xếp lại), không đổi vị trí hay cách dùng.

| Phần | Thẻ con | Nội dung |
|---|---|---|
| 🏯 Kỳ viện | Học luật · Khai cuộc · Chiến thuật · Bài tập · Đấu máy | Học, luyện, đấu với máy, phân tích ván (Chiến thuật gồm Sát cục, Tàn cuộc) |
| ⚔️ Sa trường | Phòng đấu · Bạn bè · Xếp hạng | Đấu với người, kết bạn, mời đấu, Elo |
| 👤 Tôi | (không có thẻ con) | Hồ sơ, Elo, thống kê, đồng bộ, cài đặt, tài khoản |

**Quy ước chung (mọi màn hình, mọi kích thước):**
1. **Thanh trên cùng** (cố định khi cuộn): logo 象 + tên app · ba nút phần **Kỳ viện / Sa trường / Tôi** · biểu tượng đồng bộ.
   Nút "Tôi" là avatar chữ cái khi đã đăng nhập, chữ "Đăng nhập" khi chưa.
   Điện thoại: ẩn tên app, ba nút phần chia đều chiều ngang (biểu tượng + chữ).
2. **Hàng thẻ con** ngay dưới thanh trên (cuộn ngang được nếu không đủ chỗ), gạch chân thẻ đang mở.
3. **Vùng nội dung** rộng tối đa 1100px, căn giữa; lề 16px (điện thoại) / 24px (máy tính).
4. **Màn có bàn cờ** dùng một bố cục: bàn cờ + **bảng phụ có thẻ** (Biên bản · Giải thích · Chat tuỳ màn).
   Rộng ≥ 900px: bảng phụ nằm bên phải bàn cờ (360px). Hẹp hơn: bảng phụ nằm ngay dưới bàn cờ — cùng thành phần, chỉ xếp lại.
   Thanh công cụ của ván (Đi lại, Gợi ý, Lật, Đầu hàng…) luôn nằm **ngay dưới bàn cờ**.
5. Danh sách dạng **lưới thẻ** tự giãn: 1 cột (hẹp) → 2–3 cột (rộng).
6. Hộp thoại (đăng nhập, xác nhận…) luôn ở **giữa màn**, rộng tối đa 440px, trên điện thoại chiếm gần hết chiều ngang.

```plantuml
@startuml
[*] --> KyVien
state "Kỳ viện" as KyVien {
  [*] --> HocLuat
  HocLuat --> KhaiCuoc
  KhaiCuoc --> ChienThuat
  ChienThuat --> BaiTap
  BaiTap --> DauMay
  state DauMay { [*] --> ChonCap
    ChonCap --> VanDau
    VanDau --> PhanTich }
}
state "Sa trường" as SaTruong {
  [*] --> PhongDau
  PhongDau --> BanBe
  BanBe --> XepHang
  PhongDau --> TrongPhong : tạo / vào phòng
  BanBe --> TrongPhong : mời đấu được nhận
}
state "Tôi" as Toi {
  [*] --> HoSo
  HoSo --> DoiMatKhau
  HoSo --> XoaTaiKhoan
}
KyVien --> SaTruong
SaTruong --> Toi
TrongPhong --> PhanTich : ván xong → Phân tích
KyVien --> DangNhap : bấm "Đăng nhập" / hành động cần tài khoản
SaTruong --> DangNhap
Toi --> DangNhap
DangNhap --> DangKy
DangKy --> MaKhoiPhuc : đăng ký thành công
MaKhoiPhuc --> HoSo : đã lưu mã
DangNhap --> QuenMatKhau
QuenMatKhau --> DangNhap : đặt lại bằng mã khôi phục
DangNhap --> HoSo : đăng nhập thành công → gộp tiến độ
@enduml
```

---

## 3. Màn hình

### 3.1 Khung app
- Theo quy ước ở mục 2. Phần đang mở tô màu nhấn (đỏ son `--accent`), luôn có chữ kèm biểu tượng.
- Huy hiệu số trên ⚔️ Sa trường khi có **lời mời đấu** hoặc **lời mời kết bạn** chưa xem.
- Biểu tượng đồng bộ ở thanh trên: ✓ đã đồng bộ · ⟳ đang đồng bộ · ⚠ lỗi (bấm để thử lại). Ẩn khi chưa đăng nhập.
- Giữ bộ màu hiện tại (giấy dó / gỗ / đỏ son / ngọc), có chế độ tối; font Be Vietnam Pro + Noto Serif.

### 3.2 Kỳ viện
Giữ nguyên nội dung và chức năng hiện có, chỉ bố trí lại theo quy ước chung:
- Danh sách (bài học, thế khai cuộc, bài tập, cấp máy) thành lưới thẻ.
- Màn có bàn cờ: bàn cờ + thanh công cụ ngay dưới + bảng phụ có thẻ (Biên bản · Giải thích / Gợi ý).
- Phân tích ván: biểu đồ thế cờ + dòng thời gian lỗi; giải thích từng lỗi nằm trong bảng phụ, thẻ "Giải thích".

### 3.3 Sa trường — Phòng đấu
| Thành phần | Kiểu | Quy tắc |
|---|---|---|
| Tạo phòng | Nút chính | Mở ngăn chọn: màu quân (Đỏ / Đen / Ngẫu nhiên, mặc định Đỏ), **Tính Elo** (công tắc) |
| Tính Elo | Công tắc | Mặc định **bật** nếu đã đăng nhập; **ẩn** nếu chưa đăng nhập. Bật thì ván chỉ tính khi đối thủ cũng đăng nhập |
| Vào phòng | Ô nhập + nút | Mã phòng 4–12 ký tự hoặc link mời; lỗi "Không có phòng này" |
| Bạn bè đang online | Danh sách ngang (avatar) | Chỉ hiện khi đã đăng nhập; bấm → mời đấu |
| Phòng gần đây | Danh sách | Như hiện tại |

**Trong phòng** giữ chức năng hiện có (bảng phụ có thẻ Biên bản · Chat), thêm:
- Tên + Elo của hai người (nếu đăng nhập), nhãn "Tính Elo" / "Giao hữu".
- Ván tính Elo: **không có xin đi lại**; xin hoà, đầu hàng vẫn có.
- ~~Xử thắng khi đối thủ rời 5 phút~~ — **bỏ** (2026-10-08, người dùng): ván không giới hạn thời gian.
- Kết thúc ván tính Elo: hiện thay đổi điểm, ví dụ "1216 (+16)".

### 3.4 Sa trường — Bạn bè (cần đăng nhập)
| Thành phần | Kiểu | Quy tắc |
|---|---|---|
| Tìm bạn | Ô nhập | Tìm theo tên đăng nhập (khớp từ đầu, ≥ 3 ký tự), tối đa 10 kết quả |
| Lời mời kết bạn | Danh sách | Mỗi dòng: Đồng ý / Từ chối |
| Danh sách bạn | Danh sách | Avatar chữ cái, tên hiển thị, @tên đăng nhập, Elo, chấm online; nút **Mời đấu**, menu ⋯ → Huỷ kết bạn |
| Trống | Trạng thái | "Chưa có bạn nào. Tìm theo tên đăng nhập để kết bạn." |

**Mời đấu:** người mời chọn màu + Tính Elo → hệ thống tạo phòng, người mời vào phòng ngay; người được mời (đang online)
thấy thông báo nổi "An mời bạn đấu một ván (tính Elo)" với **Vào phòng** / **Từ chối**; lời mời hết hạn sau 10 phút.
Không online thì lời mời nằm ở mục Bạn bè đến khi hết hạn.

### 3.5 Sa trường — Xếp hạng
- Hai thẻ: **Bạn bè** (mặc định nếu đã đăng nhập) · **Toàn bộ** (top 50).
- Mỗi dòng: hạng, avatar, tên, Elo, số ván. Dòng của mình được tô nổi; nếu ngoài top 50 thì ghim ở cuối.
- Chỉ xếp hạng người đã chơi ≥ 5 ván tính Elo (dưới 5 ván ghi "Chưa xếp hạng · còn N ván").

### 3.6 Đăng ký / Đăng nhập / Quên mật khẩu
Hộp thoại giữa màn (rộng tối đa 440px) trên mọi kích thước.

**Đăng ký**
| Trường | Kiểu | Bắt buộc | Quy tắc / lỗi |
|---|---|---|---|
| Tên đăng nhập | Ô nhập | Có | 3–20 ký tự `a-z 0-9 _ .`, không phân biệt hoa thường. Lỗi: "Tên đăng nhập 3–20 ký tự, chỉ gồm chữ không dấu, số, _ và ." · "Tên đăng nhập đã có người dùng" |
| Tên hiển thị | Ô nhập | Có | 1–24 ký tự, có dấu được. Mặc định = tên đăng nhập |
| Mật khẩu | Ô mật khẩu + nút hiện/ẩn | Có | ≥ 8 ký tự. Lỗi: "Mật khẩu cần ít nhất 8 ký tự" |
| Nhập lại mật khẩu | Ô mật khẩu | Có | Lỗi: "Hai mật khẩu chưa khớp" |
| Đăng ký | Nút chính | — | Tắt khi đang gửi (hiện vòng xoay) |

**Mã khôi phục** (ngay sau đăng ký): hiện 1 mã 16 ký tự (dạng `ABCD-EFGH-JKLM-NPQR`) với nút Sao chép / Tải về,
ô xác nhận "Tôi đã lưu mã này" (bắt buộc tích mới bấm **Tiếp tục**). Giải thích: "Không có email nên đây là cách duy nhất để
lấy lại tài khoản khi quên mật khẩu. Mã chỉ hiện một lần."

**Đăng nhập:** Tên đăng nhập, Mật khẩu, nút Đăng nhập, liên kết "Quên mật khẩu?" và "Chưa có tài khoản? Đăng ký".
Lỗi chung: "Sai tên đăng nhập hoặc mật khẩu" (không nói rõ sai cái nào). Sai 5 lần liên tiếp → khoá đăng nhập tài khoản đó
15 phút: "Đăng nhập sai nhiều lần, thử lại sau 15 phút."

**Quên mật khẩu:** Tên đăng nhập, Mã khôi phục, Mật khẩu mới, Nhập lại → thành công thì cấp **mã khôi phục mới**
(mã cũ hết hiệu lực) và đăng xuất mọi thiết bị khác.

**Sau khi đăng nhập lần đầu trên máy đã có tiến độ:** hộp thoại "Gộp tiến độ trên máy này vào tài khoản?" → **Gộp** (mặc định) /
**Bỏ qua, dùng tiến độ tài khoản**.

### 3.7 Tôi (Hồ sơ)
- Chưa đăng nhập: thẻ giới thiệu lợi ích + nút Đăng nhập / Đăng ký; bên dưới là Cài đặt và Xuất/nhập tiến độ (như hiện tại).
- Đã đăng nhập:
  - Đầu trang: avatar chữ cái (màu theo tên), tên hiển thị (sửa được), @tên đăng nhập, Elo, ngày tham gia.
  - Thống kê: tiến độ học (bài học, bài tập, chuỗi ngày), đấu máy (thắng/hoà/thua theo cấp), Sa trường (thắng/hoà/thua, Elo cao nhất).
  - Đồng bộ: trạng thái + "Lần đồng bộ cuối: …" + nút Đồng bộ ngay.
  - Cài đặt: âm thanh, giao diện (Sáng / Tối / Theo máy). Quân cờ luôn ghi chữ Hán.
  - Tài khoản: Đổi mật khẩu (mật khẩu cũ + mới), Tạo mã khôi phục mới, Đăng xuất, Đăng xuất mọi thiết bị, **Xoá tài khoản**
    (hộp thoại xác nhận, phải gõ lại tên đăng nhập + mật khẩu).

---

## 4. Quy tắc nghiệp vụ

### 4.1 Mật khẩu và phiên đăng nhập
- Trình duyệt băm mật khẩu bằng PBKDF2-SHA256, 600.000 vòng, muối = `"cotuong:" + tên đăng nhập (chữ thường)`, rồi mới gửi đi.
  Server băm tiếp kết quả đó với muối ngẫu nhiên riêng từng người (SHA-256) trước khi lưu. Server không bao giờ thấy mật khẩu gốc.
- Mã khôi phục lưu dạng băm (như mật khẩu).
- Phiên: token ngẫu nhiên 32 byte, lưu ở trình duyệt; server chỉ lưu bản băm; hạn 60 ngày, gia hạn khi dùng. Gửi qua header
  `Authorization: Bearer …` (trang web và server khác tên miền nên không dùng cookie).
- Chặn dò mật khẩu: 5 lần sai liên tiếp / tài khoản → khoá 15 phút; 30 lần sai / địa chỉ IP / giờ → chặn IP 1 giờ.

### 4.2 Đồng bộ tiến độ
- Đồng bộ khi: đăng nhập, mở app, và 5 giây sau mỗi thay đổi (gộp nhiều thay đổi thành một lần gửi).
- Gộp theo từng mục, không mất dữ liệu ở bên nào:

| Mục (localStorage) | Cách gộp |
|---|---|
| `xq_lessons_done`, `xq_puzzles_solved`, `xq_sc_solved`, `xq_tactics_seen`, `xq_eg_seen` | Hợp hai tập |
| `xq_srs` (ôn bài sai), `xq_trainer_best` | Theo từng khoá: lấy bản mới hơn / điểm cao hơn |
| `xq_daily` (chuỗi ngày) | Lấy chuỗi dài hơn, ngày gần nhất |
| `xq_ai_history`, `xq_online_history` | Hợp theo `id`, giữ bản có phân tích; tối đa 100 ván mỗi loại |
| `xq_ai_ladder`, `xq_ai_level` | Bản mới hơn |
| Cài đặt (`xq_sound`, `xq_theme`) | Bản mới hơn |
| `xq_last_tab`, `xq_zone`, `xq_online_server`, `xq_online_token` | Không đồng bộ (theo từng máy) |

- Giới hạn dữ liệu đồng bộ: 512 KB / tài khoản; vượt thì bỏ bớt ván cũ nhất (giữ ván đã phân tích).

### 4.3 Sa trường với tài khoản
- Đã đăng nhập: ghế trong phòng gắn với **tài khoản** (vào từ máy khác vẫn đúng ghế), tên lấy theo tên hiển thị.
- Chưa đăng nhập: như hiện tại (gắn với trình duyệt).
- Ván xong của người đã đăng nhập được lưu vào lịch sử tài khoản.

### 4.4 Elo
- Elo khởi điểm 1200. Hệ số K = 40 cho 20 ván tính Elo đầu tiên, sau đó K = 24.
- Ván chỉ tính khi: phòng bật "Tính Elo", **cả hai** người đã đăng nhập, khác tài khoản, ván có ít nhất **10 nửa nước**
  (đầu hàng sớm hơn thì không tính), không có xin đi lại (ván tính Elo không cho xin đi lại).
- Kết quả: thắng 1, hoà 0,5, thua 0.
- Hai người chỉ được tính tối đa 10 ván tính Elo với nhau mỗi ngày (chống cày điểm).

---

## 5. Dữ liệu (server, Cloudflare D1)

| Bảng | Cột chính |
|---|---|
| `users` | id, username (unique, chữ thường), display_name, pass_hash, pass_salt, recovery_hash, elo, rated_games, peak_elo, created_at, failed_logins, locked_until |
| `sessions` | token_hash (PK), user_id, created_at, expires_at, last_seen, user_agent |
| `progress` | user_id (PK), data (JSON), updated_at |
| `friends` | user_a, user_b, status (`pending`/`accepted`), requested_by, created_at |
| `invites` | id, from_user, to_user, room_code, color, rated, expires_at, status |
| `games` | id, room_code, game_no, red_user, black_user, moves (JSON), result, reason, rated, elo_red_before/after, elo_black_before/after, ended_at |
| `login_attempts` | ip, hour, count |

Trạng thái online + chuyển lời mời: một Durable Object "Sảnh" giữ kết nối của người đang mở app (đã đăng nhập).

---

## 6. Tình huống đặc biệt

| Tình huống | Xử lý |
|---|---|
| Mất mạng khi đang đồng bộ | Biểu tượng ⚠, tự thử lại; dữ liệu vẫn ở máy |
| Phiên hết hạn | Thông báo "Phiên đăng nhập đã hết hạn" + nút Đăng nhập lại; tiến độ trên máy giữ nguyên |
| Đăng nhập cùng lúc trên 2 máy | Được phép; đồng bộ gộp theo 4.2 |
| Đăng xuất | Hỏi "Giữ tiến độ trên máy này?" (mặc định giữ) |
| Hai người cùng tài khoản vào một phòng | Chỉ một ghế, máy sau vào cùng ghế (như vào lại) |
| Mời đấu người đã có lời mời chưa trả lời | Thay lời mời cũ |
| Xoá tài khoản | Xoá users/sessions/progress/friends/invites; ván đã đấu giữ lại nhưng tên đổi thành "Người chơi đã xoá" |
| Bản Artifact trên Claude | Không kết nối được server: ẩn đăng nhập/Sa trường, chỉ đường sang bản web |

---

## 7. Thứ tự làm

1. **Duyệt spec này** → tạo **Design Instruction** (tiếng Anh) để dán vào Claude in Figma.
2. Server: tài khoản, phiên, đồng bộ, bạn bè, lời mời, Elo (D1 + Durable Object) — làm song song với thiết kế.
3. Giao diện mới theo bản thiết kế đã duyệt: khung app 3 phần, Tôi, Đăng nhập/Đăng ký, Bạn bè, Xếp hạng; bố trí lại các màn cũ.
4. Test (đơn vị, giao diện, e2e hai trình duyệt) → PR → deploy.

**Bạn cần làm thêm khi tới bước 2:** không cần tạo gì mới — mình thêm D1 vào cấu hình, token Cloudflare hiện tại cần thêm quyền
**D1 Edit** (mình sẽ hướng dẫn khi tới đó).
