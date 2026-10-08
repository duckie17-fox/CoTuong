# MEMORY — Cờ Tướng Nhập Môn

> File này trả lời câu "tại sao lại làm thế này" — cái mất đi khi context bị compact.
> Append-only, ghi nhớ đầy đủ — không tự xoá/archive.

## Quyết định & lý do

### Cách làm việc với người dùng
- Người dùng nói tiếng Việt, xưng "mình"; trả lời bằng tiếng Việt, ngắn gọn, ít thuật ngữ.
- Người dùng muốn **Artifact luôn được cập nhật** sau mỗi thay đổi giao diện (publish `dist/co-tuong.html` lên
  https://claude.ai/artifact/2Q3tvYxR3sbNeBAuW4yKKp, capability `downloads`).
- Chỉ tạo PR / merge khi người dùng bảo. PR #1, #2 đã merge. Sau khi PR merge: dựng lại nhánh làm việc từ `origin/main`.
- Có điểm chưa rõ thì hỏi (người dùng nói "Nếu có gì chưa rõ thì hỏi mình").

### Kỹ thuật
- **Build:** `src/` → `dist/co-tuong.html` bằng `tools/build.js` (một file tự chứa). CI kiểm `dist/` khớp `src/` → luôn
  `npm run build` rồi commit cả `dist/`. Mã Web Worker (`XQ_WORKER_SRC`) tự sinh từ `04-xqsearch.js` + `worker-shim.js`.
- **Địa chỉ server Sa trường** chèn lúc build qua `/*@@ONLINE_SERVER@@*/''`: biến môi trường `ONLINE_SERVER`, nếu không có
  thì `src/online.json`. Workflow deploy tự lấy URL từ log `wrangler deploy`.
- **Server = trọng tài:** `server/src/room.js` (RoomCore) dùng lại đúng `00-engine.js`, `01-notation.js`, `02-game.js`
  (ghép bởi `tools/build-server.js`), nên luật ván ở server và app không bao giờ lệch.
  `tools/online-dev-server.js` chạy cùng RoomCore bằng Node để test e2e.
- **Durable Object dùng SQLite** (`new_sqlite_classes`) vì gói miễn phí Cloudflare chỉ có loại này; dùng WebSocket Hibernation
  + `setWebSocketAutoResponse('ping','pong')` để không tốn tiền khi người chơi đang nghĩ.
- **Người chơi Sa trường v1** nhận diện bằng token ngẫu nhiên trong localStorage (`xq_online_token`), không gửi token cho ai.
- **Xếp hạng nước đi** theo mức tụt "cơ hội thắng" `winChance(cp)=2/(1+e^(-0.003cp))-1`: <0.03 tốt nhất, <0.1 tốt,
  <0.2 `?!`, <0.3 `?`, còn lại `??`; "nước duy nhất" (nước thứ 2 kém ≥0.25) → `!`, kèm thí quân → `!!`.
  Bỏ lỡ đòn thắng mà vẫn đang hơn → chỉ `?!`. Ngưỡng nhỏ hơn Lichess vì người mới mất một Mã khi cân bằng là lỗi nặng.
- **Thang cấp máy** đo bằng `tools/ladder.js`; LEVEL_MEASURED {2:83,3:84,4:75,5:84,6:84,7:96,8:85,9:85,10:74}.
- **Spec v3 (chờ duyệt):** mật khẩu băm PBKDF2-SHA256 600k vòng **ở trình duyệt** rồi server băm thêm SHA-256 + muối riêng —
  vì Worker gói miễn phí giới hạn ~10ms CPU/request, không chạy nổi PBKDF2 đủ mạnh ở server. Phiên dùng Bearer token
  (web `github.io` và server `workers.dev` khác tên miền → cookie bị chặn). Không email → có **mã khôi phục** để lấy lại mật khẩu.

## Gotcha / bài học
- `pkill -f <mẫu>` có thể giết chính shell đang chạy lệnh (mẫu khớp dòng lệnh của nó) → tìm PID bằng `ps | awk` với mẫu không khớp chính lệnh.
- Không dùng `npm test | grep` trong chuỗi `&&` để quyết định commit: grep thành công che mất test thất bại → chạy `npm test > log; echo $?`.
- jsdom: thiếu `scrollIntoView` (đã stub trong `test/helpers/load.js`); mảng tạo trong jsdom khác realm → so bằng `JSON.stringify` hoặc `[...x]`.
- Re-render bàn cờ giữa mousedown và mouseup làm hỏng click → chỉ vẽ lại khi focus bằng bàn phím (`:focus-visible`).
- E2E kiểm hiệu ứng đúng mốc 60ms bị lỗi khi máy bận → dùng `waitForFunction` chờ tối đa 1s.
- Thông báo chat dưới bàn cờ từng che kết quả ván → chat dùng dòng riêng (`#olToast`), kết quả ván luôn ưu tiên.
- Lúc khởi động, `showTab()` ghi đè `xq_zone` → phải đọc khu đã lưu **trước** khi gọi `showTab`.
- Artifact trên Claude không kết nối ra ngoài được → Sa trường trong Artifact dừng thử lại sau 2 lần và chỉ sang bản web.
- Container phiên Claude **không truy cập được `*.workers.dev`** (proxy chặn) → không tự kiểm server thật; nhờ người dùng mở URL.
- GitHub Pages: môi trường `github-pages` từng chặn nhánh `main` ("not allowed to deploy… protection rules") → người dùng
  phải thêm `main` trong Settings → Environments → github-pages.
- Lần đầu người dùng lỡ tạo app `cotuong` qua "Create application → Import repository" trên Cloudflare → không cần, đã hướng dẫn xoá.
  Token tự sinh kiểu `round-night-a7ab` không xem lại được chuỗi bí mật → phải tự tạo token mẫu "Edit Cloudflare Workers".
- Token Cloudflare mẫu "Edit Cloudflare Workers" **không có quyền D1** → khi làm tài khoản cần thêm "D1 Edit".
