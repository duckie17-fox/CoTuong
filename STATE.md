# STATE — cập nhật lần cuối: 2026-10-08

## Đang làm
**Server tài khoản đã xong** (chưa deploy — deploy khi merge vào main): `server/src/accounts.js` + D1 (`server/migrations/`),
phòng đấu gắn tài khoản + tính Elo. Tiếp theo: **giao diện tài khoản** trong app.

## Next step
1. Giao diện: Đăng ký/Đăng nhập/Quên mật khẩu (băm PBKDF2 ở trình duyệt), mã khôi phục, trang Tôi khi đã đăng nhập,
   đồng bộ tiến độ (5 giây sau thay đổi; ghi thời điểm sửa từng khoá), Bạn bè + mời đấu (hỏi `/api/inbox` mỗi ~20s),
   Xếp hạng, phòng "Tính Elo" (công tắc khi tạo phòng, Elo ở ghế, nút "Xử thắng").
2. Test jsdom + e2e (dev server đã có API) → PR khi người dùng bảo → deploy (workflow tự tạo D1).

## Blocker
- Nhánh có commit chưa merge vào main. Chỉ PR khi người dùng bảo. Server mới chỉ lên Cloudflare sau khi merge.

## Vừa xong
- Server tài khoản: 68 test đơn vị (14 test mới), e2e 3/3; đã chạy thử trên workerd (wrangler dev): API + ván tính Elo qua WebSocket OK.
