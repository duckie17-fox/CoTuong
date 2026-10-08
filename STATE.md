# STATE — cập nhật lần cuối: 2026-10-08

## Đang làm
**Giao diện tài khoản** (`src/js/29-account.js` mới + sửa `28-online.js`, `shell.html`, `style.css`):
đăng ký/đăng nhập/quên mật khẩu (PBKDF2 ở trình duyệt), mã khôi phục, gộp tiến độ lần đầu, trang Tôi khi đã đăng nhập,
đồng bộ (ghi thời điểm sửa từng khoá qua hook trong `safeLS_set`), Bạn bè + mời đấu (hỏi `/api/inbox` 20s), Xếp hạng,
phòng Tính Elo (công tắc, Elo ở ghế, xử thắng). Server đã xong ở commit 51d7c72.

## Next step
1. Viết xong giao diện → test jsdom (fetch giả nối thẳng `Accounts.handle` + D1 giả) + e2e → build → Artifact → commit.

## Blocker
- Nhánh có commit chưa merge vào main. Chỉ PR khi người dùng bảo. Server mới chỉ lên Cloudflare sau khi merge.
