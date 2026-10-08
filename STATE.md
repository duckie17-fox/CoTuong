# STATE — cập nhật lần cuối: 2026-10-08

## Đang làm
Chờ người dùng **duyệt spec v3** (`docs/spec-v3-giao-dien-tai-khoan.md`): giao diện 3 phần Kỳ viện / Sa trường / Tôi
(chung một kiểu cho điện thoại và máy tính) + tài khoản (tên đăng nhập + mật khẩu, mã khôi phục, đồng bộ, bạn bè, Elo).

## Next step
1. Hỏi người dùng: spec v3 ổn chưa (đặc biệt: mã khôi phục, ván tính Elo không cho xin đi lại, K=40→24, đủ 5 ván mới xếp hạng)?
   Có link file Figma không?
2. Duyệt xong → chạy skill `design-instruction` ra `docs/design-instruction-v3.md` (tiếng Anh, khung 390px và 1440px)
   cho người dùng dán vào Claude in Figma.
3. Song song: làm server tài khoản (mục 4–5 của spec). Token Cloudflare hiện tại **chưa có quyền D1 Edit** → hướng dẫn người dùng thêm.

## Blocker
- Chưa có xác nhận spec v3 từ người dùng.
- Nhánh `claude/improvement-plan-xdtg8b` có commit **chưa merge vào main**: gắn server mặc định (`src/online.json`),
  báo lỗi khi không kết nối được server, nâng actions v5, spec v3, bộ file PLAN/STATE/MEMORY. Cần PR → merge (hỏi người dùng).

## Vừa xong (checkpoint gần nhất)
- Sa trường đã chạy thật: server deploy lên Cloudflare, web lên GitHub Pages (người dùng đã sửa quy tắc môi trường `github-pages` cho nhánh `main`).
- Viết spec v3 và sửa theo góp ý "điện thoại với máy tính chung 1 convention, 3 phần Kỳ viện/Sa trường/Tôi".
