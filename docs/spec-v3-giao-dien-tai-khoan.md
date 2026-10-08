# Spec v3 — Giao diện mới (mobile + web) và Tài khoản

**Trạng thái:** Bản nháp chờ duyệt · **Ngày:** 2026-10-08
**Phạm vi:** thiết kế lại giao diện toàn app cho điện thoại và máy tính; thêm đăng ký / đăng nhập
(tên đăng nhập + mật khẩu), đồng bộ tiến độ, danh tính ở Sa trường, bạn bè + mời đấu, xếp hạng Elo.

---

## 1. Mục tiêu và không làm

**Mục tiêu**
1. Dùng thoải mái bằng một tay trên điện thoại (390px) và tận dụng màn rộng trên máy tính (1440px).
2. Một tài khoản dùng trên nhiều máy: tiến độ học, bài tập, lịch sử ván đi theo tài khoản.
3. Đấu với bạn bè có danh tính, kết bạn, mời đấu trực tiếp, xếp hạng Elo.
4. Không bắt buộc đăng nhập: chưa có tài khoản vẫn học, giải bài, đấu máy, đấu với bạn bằng link như hiện tại.

**Không làm (lần này)**
- App trên App Store / CH Play, cài đặt PWA, chế độ offline.
- Đăng nhập Google / email; gửi email (không có email nên không có "quên mật khẩu qua email").
- Đồng hồ thi đấu, ghép trận với người lạ, chat riêng ngoài phòng đấu.

---

## 2. Cấu trúc điều hướng mới

Giữ hai khu **Kỳ viện** (học, luyện, đấu máy) và **Sa trường** (đấu với người), thêm **Tôi** (tài khoản).

| Mục | Nội dung | Thuộc |
|---|---|---|
| 📖 Học | 3 thẻ con: Luật · Khai cuộc · Chiến thuật (gồm Sát cục, Tàn cuộc) | Kỳ viện |
| 🧩 Bài tập | Bài hôm nay, ôn bài sai, danh sách bài theo chủ đề | Kỳ viện |
| 🤖 Đấu máy | Chọn cấp → ván → phân tích ván | Kỳ viện |
| ⚔️ Sa trường | 3 thẻ con: Phòng đấu · Bạn bè · Xếp hạng | Sa trường |
| 👤 Tôi | Hồ sơ, Elo, thống kê, đồng bộ, cài đặt (âm thanh, kiểu quân), đăng xuất | — |

- **Điện thoại (< 768px):** thanh điều hướng dưới cùng 5 mục (biểu tượng + chữ), cố định. Thanh trên cùng gọn:
  tên mục đang mở, nút ⚙️ cài đặt nhanh (nếu cần), ảnh đại diện / nút "Đăng nhập".
- **Máy tính (≥ 1024px):** thanh bên trái 240px: logo, nhóm **KỲ VIỆN** (Học, Bài tập, Đấu máy), nhóm **SA TRƯỜNG**
  (Phòng đấu, Bạn bè, Xếp hạng), cuối thanh là thẻ tài khoản (tên, Elo, trạng thái đồng bộ). Nội dung rộng tối đa 1100px.
- **Máy tính bảng (768–1023px):** thanh bên thu gọn chỉ còn biểu tượng (72px).
- Màn đang chơi (bàn cờ) trên điện thoại: bàn cờ chiếm hết chiều ngang, các nút thao tác thành **thanh công cụ dưới bàn**,
  biên bản và chat nằm trong **ngăn kéo vuốt lên** (bottom sheet) thay vì xếp dài phía dưới.

```plantuml
@startuml
[*] --> Shell
state Shell {
  [*] --> Hoc
  Hoc --> BaiTap
  BaiTap --> DauMay
  DauMay --> SaTruong
  SaTruong --> Toi
  state Hoc { [*] --> Luat
    Luat --> KhaiCuoc
    KhaiCuoc --> ChienThuat }
  state DauMay { [*] --> ChonCap
    ChonCap --> VanDau
    VanDau --> PhanTich }
  state SaTruong { [*] --> PhongDau
    PhongDau --> BanBe
    BanBe --> XepHang
    PhongDau --> TrongPhong : tạo / vào phòng
    BanBe --> TrongPhong : mời đấu được nhận
    TrongPhong --> PhanTich : ván xong → Phân tích }
  state Toi { [*] --> HoSo
    HoSo --> DoiMatKhau
    HoSo --> XoaTaiKhoan }
}
Shell --> DangNhap : bấm "Đăng nhập" / hành động cần tài khoản
DangNhap --> DangKy
DangKy --> MaKhoiPhuc : đăng ký thành công
MaKhoiPhuc --> Shell : đã lưu mã
DangNhap --> QuenMatKhau
QuenMatKhau --> DangNhap : đặt lại bằng mã khôi phục
DangNhap --> Shell : đăng nhập thành công → gộp tiến độ
@enduml
```

---

## 3. Màn hình

### 3.1 Khung app (Shell)
- Hiển thị theo mục 2. Mục đang mở được tô màu nhấn (đỏ son `--accent`), có nhãn chữ, không chỉ biểu tượng.
- Huy hiệu số trên ⚔️ Sa trường khi có **lời mời đấu** hoặc **lời mời kết bạn** chưa xem.
- Biểu tượng đồng bộ cạnh ảnh đại diện: ✓ đã đồng bộ · ⟳ đang đồng bộ · ⚠ lỗi (bấm để thử lại).
- Giữ bộ màu hiện tại (giấy dó / gỗ / đỏ son / ngọc), có chế độ tối; font Be Vietnam Pro + Noto Serif.

### 3.2 Học, Bài tập, Đấu máy (Kỳ viện)
Giữ nguyên nội dung và chức năng hiện có, chỉ bố trí lại:
- Danh sách (bài học, thế khai cuộc, bài tập, cấp máy) thành **lưới thẻ**: 1 cột trên điện thoại, 2–3 cột trên máy tính.
- Màn có bàn cờ dùng **một bố cục chung**: máy tính = bàn cờ bên trái (tối đa 560px) + cột phải 360px (biên bản / giải thích);
  điện thoại = bàn cờ trên, thanh công cụ ngay dưới bàn, phần còn lại trong ngăn kéo vuốt lên.
- Phân tích ván: biểu đồ thế cờ + dòng thời gian lỗi giữ như hiện tại; trên điện thoại phần giải thích từng lỗi nằm trong ngăn kéo.

### 3.3 Sa trường — Phòng đấu
| Thành phần | Kiểu | Quy tắc |
|---|---|---|
| Tạo phòng | Nút chính | Mở ngăn chọn: màu quân (Đỏ / Đen / Ngẫu nhiên, mặc định Đỏ), **Tính Elo** (công tắc) |
| Tính Elo | Công tắc | Mặc định **bật** nếu đã đăng nhập; **ẩn** nếu chưa đăng nhập. Bật thì ván chỉ tính khi đối thủ cũng đăng nhập |
| Vào phòng | Ô nhập + nút | Mã phòng 4–12 ký tự hoặc link mời; lỗi "Không có phòng này" |
| Bạn bè đang online | Danh sách ngang (avatar) | Chỉ hiện khi đã đăng nhập; bấm → mời đấu |
| Phòng gần đây | Danh sách | Như hiện tại |

**Trong phòng** giữ chức năng hiện có, thêm:
- Tên + Elo của hai người (nếu đăng nhập), nhãn "Tính Elo" / "Giao hữu".
- Ván tính Elo: **không có xin đi lại**; xin hoà, đầu hàng vẫn có.
- Đối thủ mất kết nối liên tục **5 phút** trong ván tính Elo → hiện nút "Xử thắng" cho người còn lại.
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
Máy tính: hộp thoại giữa màn (440px). Điện thoại: màn toàn trang.

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
  - Cài đặt: âm thanh, kiểu chữ quân (Hán / Việt), giao diện (Sáng / Tối / Theo máy).
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
| Cài đặt (`xq_sound`, `xq_piece_style`, giao diện) | Bản mới hơn |
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
- Kết quả: thắng 1, hoà 0,5, thua 0. Xử thắng do đối thủ bỏ đi 5 phút = thắng.
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
3. Giao diện mới theo bản thiết kế đã duyệt: khung app, Tôi, Đăng nhập/Đăng ký, Bạn bè, Xếp hạng; bố trí lại các màn cũ.
4. Test (đơn vị, giao diện, e2e hai trình duyệt) → PR → deploy.

**Bạn cần làm thêm khi tới bước 2:** không cần tạo gì mới — mình thêm D1 vào cấu hình, token Cloudflare hiện tại cần thêm quyền
**D1 Edit** (mình sẽ hướng dẫn khi tới đó).
