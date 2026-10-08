# STATE — cập nhật lần cuối: 2026-10-08

## Đang làm
Khung 3 phần đã sửa theo góp ý (bỏ chữ quân Việt, icon SVG thay emoji, lời dễ hiểu, giao diện tối, tiêu đề "Cờ Tướng").
Tiếp theo: **server tài khoản**.

## Next step
1. Server tài khoản (spec mục 4–5): D1 (users, sessions, progress, friends, invites, games, login_attempts) + Durable Object "Sảnh"; Elo.
   Token Cloudflare ĐÃ có quyền D1 Edit (người dùng xác nhận). Cần tạo DB D1 qua wrangler trong workflow deploy.
2. Giao diện đăng nhập/đăng ký, đồng bộ, Bạn bè, Xếp hạng nối với server (hiện là thẻ "cần tài khoản — sắp có").

## Blocker
- Nhánh có commit chưa merge vào main. Chỉ PR khi người dùng bảo. Bản web chỉ đổi sau khi merge.

## Vừa xong
- Góp ý giao diện vòng 1: `npm test` 54/54, e2e 3/3, Artifact đã cập nhật.
