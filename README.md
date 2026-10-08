# Cờ Tướng Nhập Môn

Ứng dụng học cờ tướng chạy trong **một file HTML tự chứa**, chia làm ba phần (điện thoại và máy tính dùng chung
một kiểu điều hướng: thanh trên + hàng thẻ con; màn có bàn cờ thì bảng phụ có thẻ nằm bên phải hoặc ngay dưới bàn):

- **🏯 Kỳ viện**: học luật, khai cuộc, ván danh thủ, chiến thuật, sát cục, tàn cuộc, bài tập, đấu với máy (có phân tích ván).
- **⚔️ Sa trường**: đấu với bạn bè qua mạng — tạo phòng, gửi link mời, server làm trọng tài. Có tài khoản thì thêm Bạn bè (kết bạn, mời đấu) và Xếp hạng Elo.
- **👤 Tôi**: tài khoản (đăng ký/đăng nhập bằng tên đăng nhập + mật khẩu, mã khôi phục), Elo, thống kê, đồng bộ tiến độ nhiều máy, cài đặt.

Bản web (có Sa trường): https://duckie17-fox.github.io/CoTuong/ (sau khi làm các bước ở mục [Sa trường](#sa-trường-đấu-với-bạn-bè)).

File dùng được ngay: [`dist/co-tuong.html`](dist/co-tuong.html). Mở trực tiếp bằng trình duyệt,
hoặc dán làm Artifact.

## Tính năng chính

- **Học luật** (19 bài, có bàn cờ thử), **bảng tiến độ** của người học.
- **Khai cuộc** (16 thế, 31 nhánh, bẫy khai cuộc, chế độ tự đi lại lý thuyết) và **6 ván danh thủ** có máy chú giải.
- **Chiến thuật, sát cục (24 mẫu), tàn cuộc** (thực hành và lý thuyết).
- **Bài tập** (164 bài): chiếu bí 1–3 nước, bắt quân, bắt đôi, tìm nước cứu, sát cục.
  Có **bài hôm nay** (đếm chuỗi ngày) và **ôn bài sai** theo lịch lặp lại ngắt quãng.
- **Đấu với máy** 10 cấp (mỗi cấp thắng cấp ngay dưới khoảng 75–85% số ván, đo bằng `tools/ladder.js`). Có gợi ý, đi lại, phân tích ván,
  gợi ý lên/xuống cấp theo kết quả, bắt đầu từ **FEN** hoặc từ bất kỳ thế nào trong bài tập / ván danh thủ / ván đã đấu.
- Luật ván theo kiểu châu Á rút gọn: cấm chiếu mãi / đuổi mãi, hoà do lặp 3 lần, 60 nước không ăn quân, hết quân tấn công.
- Hiệu ứng đi quân, âm thanh (bật/tắt), điều khiển bàn cờ bằng bàn phím, xuất/nhập tiến độ sang máy khác.
- **Sa trường**: phòng có mã + link mời, người thứ ba vào xem, chat (có câu chat nhanh), xin hoà / xin đi lại / đầu hàng,
  tái đấu đổi màu, rớt mạng hay tải lại trang vẫn vào đúng ghế, ván đã đấu được lưu và mở được trong Phân tích ván.

## Cấu trúc

```
src/
  shell.html        khung trang (head, các tab, markup); chỗ chèn CSS/JS
  style.css         toàn bộ CSS
  js/order.json     thứ tự ghép các module
  js/NN-*.js        mã nguồn, chia theo phần (engine, ký hiệu, luật ván, solver,
                    XQSearch, coach, bàn cờ, bài học, AI, bài tập, khai cuộc, UX, học tập…)
  js/worker-shim.js phần nhận lệnh của Web Worker
  data/*.js         dữ liệu sinh sẵn (bài tập, nhánh khai cuộc, ván danh thủ, tàn cuộc, sát cục)
  js/28-online.js   Sa trường (giao diện + kết nối WebSocket)
  online.json       địa chỉ server Sa trường mặc định (CI tự gắn khi deploy)
server/             server Sa trường: Cloudflare Worker + Durable Object
  src/room.js       logic một phòng (trọng tài) — dùng lại Engine/Game của ứng dụng
  src/accounts.js   tài khoản, đồng bộ tiến độ, bạn bè, mời đấu, Elo (API /api/*, dữ liệu ở D1)
  src/worker.js     adapter Cloudflare (WebSocket Hibernation)
  migrations/*.sql  bảng D1 (users, sessions, progress, friends, invites, games, login_attempts)
  wrangler.toml     cấu hình Cloudflare
tools/
  build.js          ghép src/ → dist/co-tuong.html
  build-server.js   ghép server → server/dist/worker.js
  online-dev-server.js  server Sa trường + tài khoản chạy bằng Node (test, chơi trong mạng nhà)
  d1-shim.js        giả lập Cloudflare D1 bằng node:sqlite (Node ≥ 22)
  selfplay.js       cho các cấp máy tự đấu theo đúng luật của ứng dụng
  match.js          đấu hai bản build với nhau để đo thay đổi sức mạnh (điểm + Elo)
  ladder.js         đấu hai cấu hình cấp máy để hiệu chỉnh thang cấp
test/               test (node:test + jsdom) chạy trên chính bản build
test/e2e/           test trên Chromium thật (playwright-core)
```

Mã Web Worker (`XQ_WORKER_SRC`) được build **tự sinh** từ `04-xqsearch.js` + `worker-shim.js`,
nên không cần sửa tay hai bản XQSearch.

## Lệnh

```bash
npm install          # cài jsdom (test) và playwright-core (e2e)
npm run build        # tạo dist/co-tuong.html
npm test             # build + test nhanh (~1 phút)
npm run test:full    # thêm phần kiểm tốn thời gian (bí 3 nước, lãi quân)
npm run test:e2e     # test trên Chromium thật (đặt CHROMIUM_PATH nếu cần)
node tools/selfplay.js 4 5 10                     # cấp 4 đấu cấp 5, 10 ván
node tools/match.js cu.html moi.html 10 300       # bản cũ vs bản mới, 10 cặp ván, 300ms/nước
node tools/online-dev-server.js                   # server Sa trường chạy thử ở ws://localhost:8787
(cd server && npm install && npm run dev)         # chạy thử đúng bản Cloudflare (wrangler dev)
```

Sau khi sửa `src/`, hãy chạy `npm run build` rồi commit cả `dist/co-tuong.html`; CI sẽ báo lỗi nếu hai bên lệch nhau.

## Test kiểm những gì

- Trang khởi động không lỗi, đủ các tab, Worker chứa đúng XQSearch.
- Bộ sinh nước: perft chuẩn (44 / 1920 / 79666); XQSearch và Engine luôn ra cùng tập nước hợp lệ.
- Dữ liệu: mọi bài tập, nhánh khai cuộc, ván danh thủ, thế minh hoạ, sát cục, tàn cuộc lý thuyết
  đều là thế hợp lệ với đáp án / chuỗi nước đúng luật; bài chiếu bí ép bí đúng số nước và không có cách bí nhanh hơn.
- Luật chiếu mãi: máy chấm nước chiếu mãi là thua (giống luật ván), không chấm là hoà.
- Kiểm bài bắt quân đủ nhanh để chạy trên luồng chính (< 150ms mỗi nước thử) và cho cùng kết quả với bản tham chiếu.
- Giao diện: xuất/nhập tiến độ, đi quân bằng bàn phím, ôn bài sai, bắt đầu từ FEN, bảng tiến độ.
- E2E: bấm chuột đi quân trên Chromium, máy đáp trong Worker, có hiệu ứng, không lỗi console, không tràn ngang trên điện thoại.
- Sa trường: server chỉ nhận nước hợp lệ, đúng lượt; xin đi lại lùi đúng số nước; hoà / đầu hàng / tái đấu đổi màu;
  không lộ token; chat được làm sạch. E2E: hai trình duyệt riêng đánh với nhau qua server, chat, xin hoà, xin đi lại,
  tải lại trang vẫn đúng ghế, đầu hàng, mở phân tích ván. Có thể chạy e2e với chính bản Cloudflare:
  `ONLINE_E2E_PORT=8787 node --test test/e2e/online.e2e.js` khi đang chạy `wrangler dev`.

## Sa trường (đấu với bạn bè)

Server là một Cloudflare Worker (gói miễn phí là đủ cho nhóm bạn bè), trang web đăng trên GitHub Pages.
Mỗi khi merge vào `main`, GitHub Actions (`.github/workflows/deploy.yml`) tự đăng cả hai. Chỉ cần làm một lần:

1. **Tạo tài khoản Cloudflare** (miễn phí): https://dash.cloudflare.com/sign-up. Đăng nhập, mở mục
   **Workers & Pages** một lần để Cloudflare tạo tên miền con `…workers.dev` cho bạn.
2. **Lấy Account ID**: ở trang **Workers & Pages** (hoặc trang tổng quan tài khoản), cột bên phải có **Account ID** → sao chép.
3. **Tạo API token**: ảnh đại diện → **My Profile** → **API Tokens** → **Create Token** → chọn mẫu
   **Edit Cloudflare Workers** → **Continue to summary** → **Create Token** → sao chép (chỉ hiện một lần).
4. **Đưa vào GitHub**: repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**,
   tạo hai secret `CLOUDFLARE_API_TOKEN` và `CLOUDFLARE_ACCOUNT_ID`. Đừng dán token vào chat hay vào code.
5. **Bật GitHub Pages**: repo → **Settings** → **Pages** → **Build and deployment** → **Source: GitHub Actions**.
6. **Chạy deploy**: merge vào `main`, hoặc vào tab **Actions** → **Deploy** → **Run workflow**.
   Xong thì mở https://duckie17-fox.github.io/CoTuong/ → **⚔️ Sa trường** → tạo phòng → gửi link cho bạn.

Địa chỉ server được gắn tự động vào bản web. Muốn bản HTML tải về (hoặc chạy ở máy) cũng biết server,
ghi địa chỉ `wss://cotuong-online.<tên-miền-con>.workers.dev` vào `src/online.json` rồi build lại.
Bản Artifact trên Claude không kết nối ra ngoài được, nên ở đó Sa trường sẽ chỉ đường sang bản web.

Chơi trong mạng nhà không cần Cloudflare: chạy `node tools/online-dev-server.js` trên một máy, mở
`dist/co-tuong.html?server=ws://<IP-máy-đó>:8787` trên các máy cùng Wi-Fi.

## Tài khoản (máy chủ)

Theo `docs/spec-v3-giao-dien-tai-khoan.md`. Cùng Worker với Sa trường, dữ liệu ở Cloudflare D1 tên `cotuong`.
Workflow deploy tự tạo D1 lần đầu và tự chạy `migrations/` — token Cloudflare cần thêm quyền **D1 Edit**.

- Mật khẩu: trình duyệt băm PBKDF2 rồi mới gửi; máy chủ băm thêm SHA-256 với muối riêng. Không có email → **mã khôi phục**.
- Phiên: token gửi qua `Authorization: Bearer …`, hạn 60 ngày, gia hạn khi dùng.
- Sai mật khẩu 5 lần → khoá tài khoản 15 phút; 30 lần sai / IP / giờ → chặn IP.
- API chính: `POST /api/register|login|recover|logout|logout-all|password|recovery-code`, `GET|PATCH|DELETE /api/me`,
  `GET|PUT /api/progress` (gộp tiến độ), `GET /api/users?q=`, `GET|POST /api/friends`, `POST /api/friends/:id/accept`,
  `DELETE /api/friends/:id`, `POST /api/invites`, `POST /api/invites/:id/accept|decline`, `GET /api/inbox` (gọi định kỳ,
  cũng là nhịp "đang online"), `GET /api/leaderboard?scope=friends|all`, `GET /api/games`.
- Phòng đấu: gửi kèm `auth` (token phiên) khi vào phòng → ghế gắn tài khoản. Phòng "Tính Elo": không xin đi lại,
  không giới hạn thời gian (không có xử thắng khi đối thủ rời đi); ván ≥ 10 nửa nước giữa hai tài khoản khác nhau mới tính, tối đa 10 ván/ngày/cặp.
  Elo khởi điểm 1200, K = 40 cho 20 ván đầu rồi 24; đủ 5 ván mới có hạng.

Chạy thử tại máy: `node tools/online-dev-server.js 8787 tai-khoan.db` (bỏ tên tệp để dùng DB tạm trong RAM).
Kiểm trên runtime Cloudflare: `cd server && npx wrangler d1 migrations apply cotuong --local && npm run dev`.
