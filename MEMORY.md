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

## 2026-10-08 (phiên 2)
- **Spec v3 đã duyệt nguyên trạng** (giữ: mã khôi phục, Elo không xin đi lại, K=40→24 sau 20 ván, ≥5 ván mới xếp hạng, ≤10 ván Elo/ngày/cặp).
- **Bỏ bước Figma / design-instruction**: người dùng bảo "design luôn bằng html" → thiết kế thẳng trong code app (`src/`),
  xem trước qua Artifact thay cho Figma.
- **Khung 3 phần (đã làm):** `.app-header` dính trên cùng ở mọi kích thước (thanh trên + `.tabs[data-zone-tabs]`);
  Sa trường có thẻ con `.st-btn[data-stab]` / `[data-stpanel]`; Tôi = `section[data-zone-panel="toi"]` (cài đặt + chuyển tiến độ,
  thay cho menu ⚙️ cũ). Theme lưu `xq_theme` (light/dark/auto → bỏ `data-theme`).
- **Bảng phụ có thẻ:** `.side-panel[data-side-default]` > `.side-tab[data-side-tab]` + `.side-pane[data-side-pane]`;
  `sideTabFor(sel)` mở thẻ chứa phần tử, `sideTabNotify(sel)` hiện chấm đỏ. Thanh công cụ ván đã chuyển xuống **dưới** bàn cờ,
  không còn dính (sticky) → `revealBoard` giờ tính cả thanh công cụ phía dưới.
- Gotcha: `.tab-btn` giờ gồm cả thẻ Sa trường → chọn thẻ Kỳ viện bằng `.tab-btn[data-tab]`. Chat online nằm ở thẻ ẩn →
  e2e phải bấm `[data-side-tab="chat"]` trước khi bấm câu chat nhanh.
- Container phiên này cần `npm install` trước `npm test`; Chromium e2e: `CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

## 2026-10-08 (phiên 2, góp ý khung 3 phần)
- Người dùng: **bỏ cài đặt "Chữ trên quân cờ"** (luôn dùng chữ Hán); **review lại giao diện tối**;
  **wording dễ hiểu, không dùng emoji làm icon** cho nút/thẻ/tiêu đề → dùng icon SVG nét (inline) hoặc chỉ chữ.
- Người dùng không tìm thấy chỗ sửa quyền token Cloudflare → hướng dẫn phải kèm link trực tiếp + tên nút chính xác + cách khác (tạo token mới).
- Người dùng đã thêm quyền **D1 Edit** cho token Cloudflare (2026-10-08).
- **Icon:** `ICON_PATHS` + `icon(name)` trong `07-ui-common.js` (nét kiểu Lucide, sprite `<symbol id="i-…">` chèn đầu body).
  Trong shell.html viết thẳng `<svg class="ic"><use href="#i-…"></use></svg>`. Bước tư duy (`thinkStepsHTML`) nhận `ic` là **tên icon**.
  Nút có icon mà đổi chữ bằng JS → dùng `innerHTML` (vd. lưu `RESIGN_HTML`), không dùng `textContent`.
- Lời trên giao diện: "server"→"máy chủ", "Biên bản"→"Các nước đã đi", "Lật"→"Xoay bàn", "Trainer"→"Tự đi lại",
  "FEN"→"Sao chép thế cờ", "Sảnh"→"Rời phòng", "Tái đấu"→"Đấu ván nữa". Tiêu đề app chỉ còn "Cờ Tướng" (bỏ "Nhập Môn").
- Giao diện tối: bàn cờ có bộ màu riêng (gỗ/giấy dịu hơn, số cột sáng) qua biến `--b-*`, `--b-file-red/black`.
- Điện thoại: thanh công cụ ván xếp 1 hàng lưới, icon trên chữ (tránh nút rơi xuống dòng 2).

## 2026-10-08 — Server tài khoản (thiết kế)
- **API HTTP JSON** trong cùng Worker (`/api/*`), logic ở `server/src/accounts.js` (thuần Web API: Request/Response/crypto.subtle)
  → chạy được cả Cloudflare lẫn Node (test + `online-dev-server`). DB truy cập qua giao diện kiểu D1
  (`prepare().bind().first/all/run`, `batch`); ở Node dùng `tools/d1-shim.js` bọc `node:sqlite` (Node ≥22).
- **Bỏ Durable Object "Sảnh" ở bản đầu**: online = `last_seen` trong 2 phút (app gửi nhịp 60s), lời mời đấu/kết bạn lấy bằng
  hỏi định kỳ 15–20s khi app mở. Lý do: đơn giản, rẻ, gói miễn phí D1 đủ (5M đọc, 100k ghi/ngày) cho nhóm bạn bè. Cần thì thêm DO sau.
- **Elo do GameRoom ghi thẳng vào D1** khi ván xong (DO có `env.DB`); ghế gắn `user_id` khi join kèm phiên đăng nhập.
- **D1 trong CI:** `wrangler.toml` để `database_id` giữ chỗ; workflow tìm/tạo DB `cotuong` (`wrangler d1 list --json` / `d1 create`),
  thay id vào toml rồi `d1 migrations apply --remote` trước `wrangler deploy`.
- **Đã kiểm trên workerd thật** (`wrangler dev --persist-to`, sau `d1 migrations apply --local`): API + ván tính Elo qua WS chạy đúng.
  Proxy của container chặn telemetry/update của wrangler ("Request was cancelled") — bỏ qua được.
- Gotcha: lịch sử ván khi một bên rỗng vẫn phải sắp xếp lại (mergeKey không được trả nguyên bản chưa sort) — nếu không,
  bước cắt 512 KB sẽ cắt nhầm ván mới. Test gộp phải dùng chuỗi nước **không lặp thế** (lặp 3 lần → hoà, ván dừng sớm).
- Phòng: `seatFor(conn)` (token hoặc uid) thay `seatOf(token)` ở mọi chỗ; `st.report` (ván vừa xong) → adapter gọi
  `Accounts.recordGame` rồi `room.setElo(r)`; `markLeft/markBack` để tính "rời ván 5 phút"; lý do kết thúc mới `abandon`.

## 2026-10-08 — Giao diện tài khoản
- Module `src/js/29-account.js` (Account): gọi API qua `fetch(base()+path)`, base = địa chỉ máy chủ Sa trường đổi `ws→http`.
  Không có máy chủ hoặc đang trong Artifact → `available()=false`: nút đăng nhập tắt, trang Tôi chỉ đường sang bản web.
- Phiên hết hạn nhận biết bằng `error==='unauthorized'` (KHÔNG theo mã 401 — sai mật khẩu ở đổi mật khẩu cũng trả 401).
- Đồng bộ: `LS_HOOK` trong `safeLS_set` ghi `xq_sync_meta.t[key]` rồi hẹn gửi sau 5s; `applyRemote` bật cờ `applying` để không ghi đè thời điểm.
  Có thay đổi từ máy khác → thông báo nổi "Tải lại để xem" (không tự tải lại giữa chừng). Lần đăng nhập đầu: hai bên đều có tiến độ
  thì hỏi Gộp / Bỏ qua, xong thì tải lại trang (`Account.api.reload`, test thay bằng bộ đếm).
- Mời đấu: người mời tạo phòng ngay (`Online.enterRoom(code,{color,rated})`), người được mời thấy thông báo khi hỏi `/api/inbox`
  (20s, và khi quay lại tab — `visibilitychange`).
- Test jsdom tài khoản: `load({setup})` gắn `window.fetch` → `Accounts.handle` (D1 giả), `crypto` = Node webcrypto, `TextEncoder` của Node;
  PBKDF2 hạ còn 1000 vòng trong test. Đóng cửa sổ jsdom ở `test.after` (đóng giữa test làm timer còn chạy → lỗi sau khi test xong).
- Gotcha lặp lại: đừng `pkill -f` theo tên tệp test — giết luôn shell đang chạy.
- Người dùng xem bản web github.io (bản main cũ) và tưởng chưa sửa → nhắc: bản web chỉ đổi sau khi merge.
- **Góp ý vòng 3 (điện thoại khi đánh cờ):** thanh trên tự ẩn khi cuộn xuống trên điện thoại (`initAutoHideHeader`, lớp `body.hdr-hide`);
  bàn cờ tràn sát mép card (`.card .board-shell{margin-inline:-12px}`); đầu phòng đấu một dòng (nút chỉ icon trên điện thoại);
  nút ván online dùng chung `.board-toolbar` ngay dưới bàn; máy tính: bàn cờ co theo chiều cao màn hình
  (`min(580px, (100vh-330px)*0.92)`) để thấy cả bàn + thanh nút. Sảnh Sa trường bỏ đoạn mô tả, ẩn mục rỗng (Phòng gần đây/Ván đã đấu).
- **Góp ý vòng 4:** bỏ nút **Xoay bàn** (đấu máy + online; bàn tự quay theo màu của mình) và **Mời bạn** (hộp mời tự hiện khi đang chờ đối thủ).
  Màn ván đấu: thanh người chơi chung `setPlayerBar` (tên, cấp/Elo, quân đã ăn, sáng xanh + "tới lượt"/"đang nghĩ…");
  đang đánh chỉ có thanh nút chính (đấu máy: Đi lại/Gợi ý/Đầu hàng), xong ván mới hiện Ván mới/Phân tích/Sao chép thế cờ;
  kết quả theo góc nhìn người chơi ("Bạn thắng!"); đầu hàng online xác nhận 2 bước (bỏ confirm()); giữ màn hình sáng (Wake Lock) khi đang đánh online.
  Xem lại khai cuộc/ván danh thủ vẫn giữ nút xoay bàn (là màn xem, không phải đánh).
- PR #3 mở ngày 2026-10-08 cho toàn bộ spec v3 + góp ý giao diện.
- **2026-10-08: PR #3 merge + deploy xanh.** Workflow tạo D1 `cotuong` (id 1055ca1a-d0bf-4e94-b344-9bdd2b52dbef, vùng ENAM),
  `migrations apply --remote` tự chấp nhận khi không tương tác ("Using fallback value in non-interactive context: yes").
  Lần deploy sau `d1 list` sẽ tìm thấy DB có sẵn. Container không truy cập được github.io (curl trả 000) — giống workers.dev.
- Bỏ mục "Máy chủ (nâng cao)" khỏi giao diện (người dùng không hiểu mục đích). Vẫn đổi máy chủ được bằng ?server= trên link (dùng cho test/dev) hoặc xq_online_server cũ.
- **Đề xuất hạng đấu máy (chờ người dùng chọn):** 8 bậc tên quân cờ Tốt → Sĩ → Tượng → Mã → Pháo → Xe → Tướng → Kỳ vương,
  mỗi bậc (trừ Kỳ vương) chia III/II/I mỗi 50 điểm; dùng chung Elo (khởi điểm 1200 = Sĩ II). Mỗi cấp máy có Elo cố định ước tính
  (cấp 1: 900 … cấp 10: 2150), ghép máy cấp gần Elo người chơi nhất (hơi cao hơn). Ván xếp hạng với máy: không gợi ý, không đi lại.
  Elo giữa các cấp đo bằng self-play chênh quá lớn (80% ≈ +240) nên phải nén lại; hiệu chỉnh dần theo ván thật.

## 2026-10-08 — Đấu xếp hạng (spec v4, docs/spec-v4-dau-xep-hang.md)
- Người dùng chốt: Elo chung; chờ người 5–10s (chọn 8s) rồi ghép máy; máy mang nick giống người thật kiểu game thủ Việt;
  thêm nhiều cấp máy (20 cấp xếp hạng); đổi tên bậc → mình chọn bậc kiểu game Việt (Đồng → Thách Đấu), người dùng có thể đổi.
- Thiết kế: hàng chờ ghép trận trong D1 (`match_queue`, hỏi định kỳ), không dùng Durable Object; ván với máy chạy trên trình duyệt
  (dựng "phòng ảo" cùng dạng state với phòng online để dùng chung giao diện), máy chủ kiểm lại nước đi + kết quả khi nộp (`bot_games`).
- Tên cấp phòng tập đổi thành: Mới tập, Làm quen, Biết chơi, Khá, Vững vàng, Giỏi, Rất giỏi, Cao thủ, Kiện tướng, Đại kiện tướng (người dùng thấy tên thang Trung Quốc khó hiểu); mỗi cấp có elo ước tính để hiện "Ngang bậc …".
- Đấu xếp hạng (client): `Online.startSearch` hỏi `/api/match/join` mỗi 1,5s, quá 8s gọi `/api/match/bot`; ván với máy dùng `st.bot` +
  `send()` chặn lại xử lý cục bộ (`botHandle`), dựng state giống phòng online (`botRoomView`) rồi `apply()` → dùng chung toàn bộ giao diện.
  Ván dở lưu `xq_ranked_bot` (không đồng bộ, không xuất) để tải lại trang vào tiếp. Phòng xếp hạng: ẩn "Đấu ván nữa", hiện "Tìm trận mới".
- Thắng tự nhiên (chiếu bí…) được nhận dù < 10 nửa nước; chỉ "máy đầu hàng" mới cần ≥ 10 nửa nước và hơn ≥ 6 điểm quân.
- Kiểm nhanh 20 cấp máy bằng ladder.js (6 cặp ván, giới hạn 600ms): cấp 3 thắng cấp 1 71%, cấp 7 thắng cấp 5 100%.
- Tên cấp phòng tập (người dùng chọn kiểu "Võ tướng cổ", chê bản trước "phèn"): Tiểu Tốt, Ngũ Trưởng, Thập Trưởng, Bách Hộ, Thiên Hộ, Hiệu Úy, Tướng Quân, Đại Tướng, Thượng Tướng, Nguyên Soái.
- **Bắt buộc đăng nhập** (người dùng yêu cầu): màn `#authGate` che toàn app khi `available() && !signedIn()`; Artifact (không có máy chủ)
  không bị che. Mở link mời khi chưa đăng nhập → đăng nhập xong tự vào phòng (`accountchange` trong Online).
  Test e2e giờ phải đăng ký trước: helper `test/e2e/helpers.js` (`registerUI`, `chromiumPath`, `PAGE`); browser.e2e chạy kèm dev server.
  Rủi ro đã biết: máy chủ sập thì người chưa đăng nhập không vào được app (kể cả phần học).
- **2026-10-08: PR #4 merge + deploy xanh**: D1 cũ được tìm thấy, chỉ chạy 0002_ranked.sql; Worker có DB + ROOMS; Pages lên bản mới.
- Người dùng quyết định **không** thêm dòng "có thể được ghép với đối thủ máy" vào luật xếp hạng (2026-10-08). Đừng đề xuất lại.
- Điện thoại (≤767px): 3 mục chính chuyển xuống bottom nav cố định (.zone-switch position:fixed), thanh trên còn logo + tên + đồng bộ; ẩn thanh trên khi cuộn dùng top âm (--hdr-h) thay transform (transform làm hỏng position:fixed bên trong). Đã rà 320/360/390/412/768px: không tràn ngang.

## 2026-10-08 — Batch: bỏ đồng bộ, kết bạn nhanh, bàn to trên máy tính, nền + nhạc, ván song song
- Bỏ nút đồng bộ (gây rối) — dữ liệu vẫn tự đồng bộ ngầm; thẻ "Chuyển tiến độ" ẩn khi đã đăng nhập.
- Đối thủ rời ván: không xử thắng, không giới hạn thời gian (bỏ claim/ABANDON_MS, bỏ xử thua ván máy sau 2h).
- **Ván xếp hạng với máy song song**: người dùng muốn tìm trận mới khi còn ván dở, các ván cùng tồn tại (đã thử "đóng ván cũ thành bỏ dở" — người dùng bác). `/api/match/bot` luôn tạo ván mới; client lưu `xq_ranked_bot` là MẢNG ván dở (đọc được dạng object cũ), mỗi ván một nút "Vào tiếp".
- Nền: `body::before` (dấu vị trí quân kiểu bàn cờ, lặp 96px, màu --ink) + `body::after` (mây cát tường ở 2 góc, màu --gold), vẽ bằng CSS mask + SVG data URI để đổi màu theo theme. Phải để body nền trong suốt (chỉ html có nền), nếu không lớp z-index:-1 bị che.
- Nhạc nền: module `Music` (26-ux.js) tự sinh bằng Web Audio — ngũ cung Rê, tiếng gảy kiểu đàn tranh (triangle + bồi âm, nhấn dây, rung cuối nốt), thỉnh thoảng lướt dây, nền ngân trầm, vang bằng Convolver. Không tệp ngoài. Mặc định tắt (`xq_music`), nút nốt nhạc ở thanh trên + mục Cài đặt; bật lại sau tải trang thì chờ lần chạm đầu (luật autoplay). Tạm dừng khi ẩn tab. Đo bản ghi 45s: trung bình ≈ -29 dB (nhỏ, làm nền).
- **2026-10-08: PR #5 merge + deploy xanh** (không có migration mới).

## 2026-10-08 — Dọn giao diện cho người mới (feedback "khó dùng với người nontech")
- Người dùng chọn: **chỉ dọn gọn, giữ nguyên cấu trúc** tab và vị trí nội dung; nội dung nâng cao **giữ chỗ cũ**, chỉ gom nhóm. (Đã bác phương án thêm màn hình "Bắt đầu" và phương án tách mục "Nâng cao".)
- Mẫu dùng lại: `<details class="more-box">` — khối "xem thêm" có mũi tên xoay, dùng cho mọi đoạn giải thích dài (từ ngữ, nguồn, bàn phím, chuyển tiến độ bằng tay, bộ lọc bài tập, mục lục bài học).
- Chọn cấp máy: bỏ 10 thẻ radio 3 dòng → 10 chip 1 hàng (`.level-chip`), mô tả + "Ngang bậc X" chỉ hiện cho cấp đang chọn.
- Bài tập: `PZ_PAGE=24`, nút "Xem thêm bài (còn N)"; `pz.shown/shownKey` reset khi đổi bộ lọc.
- Tab điện thoại: đổi nhãn "Đấu với máy" → "Đấu máy" + giảm padding ≤420px → 5 tab vừa màn hình 390px, hết cuộn ngang.
- Trang Học luật trên điện thoại rút từ ~4036px xuống ~2600px.
- **Gotcha (2026-10-08)**: máy làm việc có thể bị khởi động lại giữa các lượt — commit đã push vẫn còn trên GitHub nhưng thư mục làm việc quay về bản cũ. Đầu mỗi lượt nên `git fetch` và so `git log origin/<nhánh>` với HEAD trước khi sửa/commit; lệch thì rebase lên remote rồi build lại.

## 2026-10-08 — Nhạc nền mới + rà UI/UX toàn bộ
- Người dùng muốn đổi nhạc → bài "Trúc lâm": tiêu (sine+triangle, vuốt nốt, rung cuối nốt, tiếng hơi qua bandpass Q=3) thổi các câu soạn sẵn
  trên điệu Vũ (La Đô Rê Mi Sol), ~52 nhịp/phút; cổ cầm gảy trầm theo câu; thỉnh thoảng bồi âm như chuông; vang 4,5s. Tiếng hơi lúc đầu quá to (phổ nhiễu rộng) → đã giảm.
- Cách rà UI: script playwright chụp ~20 màn × (390, 390 tối, 360, 768, 1366, 1366 tối, 1920) có đăng nhập qua online-dev-server; giao 3 trợ lý xem ảnh song song, tự kiểm lại lỗi họ báo trước khi sửa (vài lỗi họ báo sai, vd. thông báo nổi đè hộp thoại — thật ra z-index đã đúng).
- **Lỗi thật đã sửa**: báo "Tiến độ vừa được cập nhật từ máy khác" khi chỉ dùng 1 máy — do máy chủ gộp xong trả cùng dữ liệu khác thứ tự (union) hoặc thêm trường mặc định (`best:0` ở xq_daily). Giờ chỉ báo khi có thông tin mới thật (`hasNew`). Đồng thời: khoá nào trên máy đổi trong lúc chờ máy chủ thì giữ bản trên máy (trước đây có thể bị ghi đè mất).
- Chữ kết quả "Đen thắng — đối phương đầu hàng" gây hiểu nhầm khi chính mình đầu hàng → "Đen thắng — Đỏ đầu hàng".
- Nút 2 bước dùng chung `confirmTap(btn, run)`: lần 1 đổi thành nút đỏ "Chắc chắn?", bỏ qua lần bấm thứ hai trong 400ms (chống chạm đúp), 3s tự trở lại. Test e2e phải chờ 450ms giữa 2 lần bấm.
- `makeClickController.render()` tự bỏ quân đang chọn khi không còn được đi (hết ván/hết lượt).
- `revealBoard` trên điện thoại: cuộn < 60px thì thanh trên không tự ẩn → phải chừa chỗ cho nó (trước đây che thanh đối thủ ở màn 360px).
- Bài tập trên máy tính dùng chung bố cục 2 cột `.play-layout`; cột bàn + cột phải được canh giữa thành một cặp (`--bw`).
- Phân tích ván < 6 nước của mình: không chấm %, không đoán phong cách, không vẽ biểu đồ.
- Cấp máy mặc định cho người mới: 2 (trước là 5 — quá khó). Bài tập xếp dễ → khó. "Bài tiếp" chỉ nổi bật khi đã giải xong.
- **2026-10-09**: người dùng chê nhạc "Trúc lâm" (điệu Vũ, thứ) **hơi buồn** → đổi sang "Xuân phong": điệu Cung (ngũ cung trưởng trên Rê), 72 nhịp/phút, câu nhạc đi lên kết về chủ âm, thêm đàn tranh rải hợp âm khe khẽ, vang ngắn hơn. Tránh điệu thứ/chậm nếu làm nhạc tiếp.
- **Bố cục bài học** (người dùng: "phải cuộn xuống mới dùng được bàn cờ, không nắm được ngữ cảnh"): ≥768px chữ trái + bàn cờ phải `position:sticky`, cỡ bàn `--lbw` tính theo chiều cao màn (vừa một màn ở 1366×768); nhiều ví dụ → nút "Ví dụ 1/2" (một bàn mỗi lúc); câu hướng dẫn + "Làm lại" cùng hàng; tiêu đề bài nằm trong cột chữ; điện thoại: bàn cờ `order:-1` lên trước, tiêu đề thẻ "Bài n/19: Tên bài". Thẻ bài học đưa lên đầu tab, phần 7 loại quân và bảng tiến độ xuống dưới.
- **2026-10-09 (tiếp)**: người dùng thấy bàn cờ bài học nhỏ, chữ quá to → bàn chiếm ~56% bề ngang (`--lbw` tối đa 700px, tính theo chiều cao `(100vh - 270px)/1.12`), chữ cột trái 14.5px; câu hướng dẫn + "Làm lại" xuống dưới bàn; "Chọn bài khác" thành nút nhỏ góc phải hàng tiêu đề. Lưu ý `.board-shell{max-width:460px}` chung — phải gỡ cho `.lesson-demos`. Kết quả: 1366×768 bàn ~445px, 1920×1080 bàn 700px, đều vừa một màn kèm câu hướng dẫn.
- Người dùng gửi link YouTube muốn lấy nhạc: container không vào được YouTube; đã giải thích không tải nhạc YouTube vào app (điều khoản YouTube + bản quyền) và đưa 3 cách (nhạc có giấy phép do người dùng gửi file / nhúng trình phát YouTube / soạn lại theo mô tả) — đang chờ người dùng chọn.
- **2026-10-09 — nhạc "Kỳ đình"** (người dùng chọn: hợp đánh cờ, đủ 5 nhạc cụ đàn tranh/sáo trúc/đàn nhị/tỳ bà/cổ cầm, du dương, không u ám, tĩnh tâm). Điệu Cung trên Rê, 66 nhịp/phút; 4 đoạn mỗi đoạn một nhạc cụ dẫn (sáo → nhị → tỳ bà gảy vê → sáo), đàn tranh lướt dây mở đoạn + rải hợp âm, cổ cầm đệm trầm. Nhị = sawtooth + lowpass + peaking 1.1kHz + luyến 0.2s + rung 5.8Hz, kéo thấp 1 quãng tám; tỳ bà = triangle+square tắt nhanh, nốt ≥1.4 phách thì vê 75ms. Đã cân độ to giữa các đoạn (nhị 0.078, tỳ bà 0.09). Link YouTube người dùng gửi chỉ làm tham khảo phong cách — không dùng nhạc gốc.
- **2026-10-09: PR #6 merge + deploy xanh** (không có migration mới).
- **2026-10-09 — 2 phần để ngỏ đã làm**: thanh dưới (bottom nav) mở rộng tới ≤899px (máy tính bảng dọc), `isPhone()` giờ là ≤899px (thanh trên tự ẩn khi cuộn); 768–899 thu hẹp hàng nút dưới (`padding-inline: 50vw-260px`). `addNotationHelp()` (07-ui-common) gắn `NOTATION_HELP` (details "Cách đọc ký hiệu nước đi") sau mọi `.movelog` trừ `.demo-log` của bài học, và thay `#openingNotationHelp` ở tab Khai cuộc.
- **2026-10-09: PR #7 merge + deploy xanh** (không có migration mới).
- **2026-10-09 — chọn cấp máy** (người dùng: danh sách cấp "hơi thô"): thay 10 chip bằng thẻ lớn (nhóm, "Cấp n/10", tên, mô tả, "Ngang bậc" + nút ‹ ›) và thang 10 cột cao dần, tô màu theo nhóm `LEVEL_GROUPS` (1–3 Dễ, 4–6 Vừa sức, 7–8 Khó, 9–10 Cao thủ; class `lvl-easy/mid/hard/pro` — tránh `lvl-top` vì trùng hàng tiêu đề). Vẫn giữ radio `name="aiLevel"`; đặt cấp từ ngoài bằng sự kiện `levelset` trên `#aiLevelPicker`.
- Người dùng chê thang 10 cột "tốn diện tích minh hoạ mà không có ý nghĩa" → thu về một thẻ gọn (~120px): ‹ tên · Cấp n/10 · nhóm · ngang bậc / mô tả › + vạch mảnh 10 nấc bấm được (`.lvl-seg`). Bài học: tránh trang trí lớn không mang thông tin.
- Dòng thông tin cấp máy (người dùng: "dài dòng") → chỉ còn tên + nhãn nhóm màu + mô tả; "Cấp n/10 · ngang bậc…" chuyển vào tooltip (title) của khối chọn cấp.

## 2026-10-09 — Đợt rà UI/UX có hệ thống (người dùng: "lên plan review lại toàn bộ UI/UX")
- Người dùng chọn: báo cáo trước, duyệt từng mục rồi mới sửa; ưu tiên gọn > dễ cho người mới > bàn cờ to > nhất quán.
- Script chụp: scratchpad/review2.js (7 cỡ, ~40 màn/cỡ, đo pageH, bàn cờ vừa màn, chữ <12px, nút <40px). Chạy 1 tiến trình/cỡ song song cho nhanh (mỗi cỡ ~6–7 phút vì chờ ghép trận).
- Thông báo nổi tự tắt sau 5s — trợ lý xem ảnh tưởng nó "đứng lì" do chụp liên tiếp nhanh; chỉ giữ ý "che nút trong vài giây".
- Đã loại khỏi báo cáo/đánh dấu riêng các đề xuất đụng quyết định cũ: nhãn "Máy" cho đối thủ bot (người dùng từ chối), đổi tên cấp võ tướng, bỏ chữ Elo; "Kỳ viện/Sa trường" để mục C9 cho người dùng tự quyết.
- Trang báo cáo: Artifact riêng có `db` + `user`; collection `approvals`.

## 2026-10-09 — Sửa cả 37 mục báo cáo rà UI/UX (người dùng: "Xử lý hết")
- **C9 đã đổi theo yêu cầu**: nhãn "Kỳ viện"→"Học", "Sa trường"→"Chơi"; thẻ "Đấu máy" chuyển sang hàng thẻ của Chơi (cạnh "Đấu người" = Phòng đấu cũ).
  Mã nội bộ GIỮ NGUYÊN `kyvien`/`satruong` (localStorage xq_zone, test, e2e dùng). `PLAY_TABS=['may']` trong 24-tabs.js:
  panel `may` vẫn là section[data-panel] nhưng thuộc zone satruong; showTab('may') ẩn section[data-zone-panel=satruong];
  nhớ thẻ con của Chơi ở `xq_last_stab` (có thể là 'may'), thẻ của Học ở `xq_last_tab` (không bao giờ 'may').
  Gotcha: từ Phân tích ván online bấm Quay lại phải `showStab('phong')`, không `showZone('satruong')` (sẽ về Đấu máy).
- Cỡ bàn: desktop `--bw` theo `(100vh - --sticky-top - 30px)/1.1` (≈578px ở 1366×768); tablet 601–899 bàn rộng hết khung;
  ≥1500px khung 1440. Mở trang chi tiết (khai cuộc, danh thủ, bài tập, phân tích) gọi thêm `revealBoard()` để bàn vào tầm nhìn.
- `revealBoard(el, snap)`: snap=true (vào ván đấu máy/online) → điện thoại luôn cuộn sát + ẩn thanh trên. Tạo phòng chờ bạn thì KHÔNG snap
  (để thấy nút mời ở hàng tiêu đề).
- `confirmTap` giờ hiện thêm nút "Huỷ" (.btn-cancel) cạnh "Chắc chắn?", tự trở lại sau 4s.
- `wireDemoTabs(host, slots, labels)` (07-ui-common) dùng chung cho bài học và sát cục (một bàn, chuyển Ví dụ/Bài n).
- Bài học: tiêu đề + hàng ‹ [Bài n/19 ▾] Bài tiếp › cùng hàng; nút giữa mở danh sách bài (#lessonToc là div hidden, không còn details).
  Điện thoại: .lesson-foot position:fixed trên thanh dưới.
- Tiến độ (#progressDash) chuyển từ Học luật sang Tôi; `wdlText(w,d,l)` → "1 thắng · 1 thua". Đã bỏ #meStats.
- Phân tích ván: nhãn chỉ dùng chữ (clsTag bỏ ký hiệu !! ?! ??), tóm tắt 1 dòng (#reviewSummary .rv-sum), "Nhận xét cả ván" ở #reviewMore dưới bàn,
  biểu đồ #reviewChart nằm trong play-board (cột phải desktop), ẩn khi không có lỗi; bỏ nút #rvStart (dùng nút thanh công cụ).
- Nút phụ "Sao chép thế cờ / Đấu với máy từ thế này" gom vào `<details class="more-box tool-more">Thêm`.
- Thông báo nổi ≤899px hiện ở đầu màn; toast 3s.
