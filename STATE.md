# STATE — cập nhật lần cuối: 2026-10-08

## Đang làm
Spec v3 **đã duyệt**; thiết kế thẳng bằng HTML (không Figma). **Khung 3 phần Kỳ viện / Sa trường / Tôi đã xong**
(thanh trên dính, thẻ con, bảng phụ có thẻ, trang Tôi với cài đặt + sáng/tối) — chờ người dùng xem và góp ý.

## Next step
1. Người dùng góp ý khung mới (Artifact + bản web sau khi merge).
2. Server tài khoản (spec mục 4–5): D1 + Durable Object "Sảnh". Token Cloudflare cần thêm quyền **D1 Edit** → hướng dẫn người dùng.
3. Giao diện đăng nhập/đăng ký, đồng bộ, Bạn bè, Xếp hạng nối với server (hiện là thẻ "cần tài khoản — sắp có").

## Blocker
- Nhánh có commit chưa merge vào main (server mặc định, báo lỗi mất kết nối, actions v5, spec v3, context kit, khung 3 phần).
  Chỉ PR khi người dùng bảo. Bản web chỉ đổi sau khi merge.

## Vừa xong
- Khung 3 phần + bảng phụ có thẻ; `npm test` 54/54, e2e 3/3.
