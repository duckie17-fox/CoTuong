# STATE — cập nhật lần cuối: 2026-10-08

## Đang làm
**Spec v3 đã làm xong phần chính** (chưa deploy): khung 3 phần, server tài khoản (D1), giao diện tài khoản
(đăng ký/đăng nhập/quên mật khẩu, mã khôi phục, gộp + đồng bộ tiến độ, trang Tôi, Bạn bè + mời đấu, Xếp hạng, phòng Tính Elo + xử thắng).
Chờ người dùng xem và quyết định tạo PR → merge → deploy.

## Next step
1. Người dùng xem Artifact (chỉ thấy giao diện; tài khoản cần bản web sau khi deploy) → góp ý.
2. Người dùng bảo thì tạo PR vào main → merge → workflow deploy tự tạo D1 + migrations + đưa server/web lên.
3. Sau deploy: nhờ người dùng thử đăng ký trên https://duckie17-fox.github.io/CoTuong/ (container không vào được workers.dev).

## Blocker
- Nhánh có nhiều commit chưa merge vào main. Chỉ PR khi người dùng bảo.

## Vừa xong
- Góp ý vòng 4: bỏ Xoay bàn + Mời bạn; làm lại màn đánh (thanh người chơi, quân đã ăn, nút theo trạng thái ván, giữ màn hình sáng); 74 test + e2e 4/4.
- Góp ý vòng 3: Sa trường gọn chữ, tối ưu màn đánh cờ trên điện thoại (thanh trên tự ẩn, bàn cờ to hơn, đầu phòng 1 dòng); 74 test + e2e 4/4.
- Giao diện tài khoản: 74 test đơn vị (6 test giao diện tài khoản mới), e2e 4/4 (thêm ván tính Elo hai trình duyệt từ đăng ký → kết bạn → mời → Elo).
