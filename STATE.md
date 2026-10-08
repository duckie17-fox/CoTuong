# STATE — cập nhật lần cuối: 2026-10-08

## Đang làm
**Đấu xếp hạng** (spec v4: docs/spec-v4-dau-xep-hang.md): ghép trận 8s → máy 20 cấp với nick giống người; bậc Đồng→Thách Đấu.

## Next step
1. Server: migration 0002 (match_queue, bot_games), API /api/match/*, kiểm ván máy, Elo; room.join cho phòng ghép (create.match).
2. Client: thẻ Đấu xếp hạng (bậc + Elo + Tìm trận), phòng ảo đấu máy giống người, huy hiệu bậc ở Tôi/Xếp hạng/ghế.
3. Test (đơn vị + giao diện + e2e) → build → Artifact → commit/push → hỏi người dùng tạo PR.

## Blocker
- Không có. (Người dùng vẫn cần thử bản thật đã deploy.)
