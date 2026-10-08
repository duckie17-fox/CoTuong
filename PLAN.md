# Cờ Tướng Nhập Môn

## Mục tiêu
Ứng dụng học và chơi cờ tướng cho người mới, chạy trên điện thoại và máy tính:
**Kỳ viện** (học luật, khai cuộc, chiến thuật, bài tập, đấu với máy + phân tích ván),
**Sa trường** (đấu với bạn bè qua mạng), **Tôi** (tài khoản, tiến độ, Elo).

Bản web: https://duckie17-fox.github.io/CoTuong/ · Server Sa trường: `wss://cotuong-online.ducgithub17.workers.dev`
· Bản Artifact (chỉ Kỳ viện): https://claude.ai/artifact/2Q3tvYxR3sbNeBAuW4yKKp

## Scope
### Trong phạm vi
- Một file HTML tự chứa build từ `src/` (dùng được làm Artifact, mở trực tiếp, hoặc GitHub Pages).
- Server Sa trường: Cloudflare Worker + Durable Object (`server/`), làm trọng tài bằng chính luật ván của app.
- **Spec v3** (`docs/spec-v3-giao-dien-tai-khoan.md`): giao diện 3 phần Kỳ viện / Sa trường / Tôi, chung một kiểu
  điều hướng cho điện thoại và máy tính; đăng ký/đăng nhập bằng tên đăng nhập + mật khẩu (có mã khôi phục);
  đồng bộ tiến độ nhiều máy; danh tính ở Sa trường; bạn bè + mời đấu; xếp hạng Elo.

### Ngoài phạm vi (cố tình không làm)
- Chế độ hai người cùng máy (người dùng đã bỏ).
- App trên App Store / CH Play, PWA cài đặt, offline.
- Đăng nhập Google / email, gửi email; đồng hồ thi đấu; ghép trận với người lạ.

## Quyết định lớn (chỉ những cái ảnh hưởng scope/hướng đi)
| Ngày | Quyết định | Lý do |
|---|---|---|
| 2026-10 | Bỏ chế độ hai người cùng máy | Người dùng không cần |
| 2026-10 | Đấu máy 10 cấp, mỗi cấp thắng cấp dưới ~75–85% | Người dùng chọn "10 cấp, bậc ~80%" |
| 2026-10 | Ký hiệu nước đi chỉ dùng `!! ! ?! ? ??` | Người dùng muốn đơn giản, dễ nhớ |
| 2026-10 | Online: Cloudflare Worker + DO, web trên GitHub Pages | Miễn phí, server làm trọng tài; người dùng chọn |
| 2026-10 | Chia app: Kỳ viện / Sa trường / Tôi, chung kiểu cho mobile và web | Người dùng yêu cầu |
| 2026-10 | Đăng nhập bằng tên đăng nhập + mật khẩu (không email) | Người dùng chọn; bù bằng mã khôi phục |
| 2026-10 | Thiết kế qua skill `design-instruction` → Claude in Figma | Người dùng cài skill này để thiết kế lại |

## Milestones
- [x] P0–P4: nền tảng repo/build/test/CI, sửa AI, trải nghiệm, sư phạm, hiệu chỉnh cấp máy (PR #1)
- [x] Phân tích ván theo luồng + ký hiệu chuẩn + phong cách chơi (PR #2)
- [x] Sa trường v1: phòng có mã/link, chat, xin hoà/đi lại/đầu hàng, tái đấu, deploy Cloudflare + Pages (PR #2)
- [ ] Spec v3 được duyệt
- [ ] Design Instruction (tiếng Anh) cho Claude in Figma → người dùng thiết kế trong Figma
- [ ] Server tài khoản: D1 (users, sessions, progress, friends, invites, games), Durable Object "Sảnh" (online + lời mời), Elo
- [ ] Giao diện mới theo bản thiết kế: khung 3 phần, Tôi, Đăng nhập/Đăng ký, Bạn bè, Xếp hạng; bố trí lại màn cũ
- [ ] Test (đơn vị, jsdom, e2e hai trình duyệt) → PR → deploy
