# Cờ Tướng Nhập Môn

Ứng dụng học cờ tướng chạy trong **một file HTML tự chứa**: học luật, khai cuộc, ván danh thủ,
chiến thuật, sát cục, tàn cuộc, bài tập và đấu với máy (có phân tích ván).

File dùng được ngay: [`dist/co-tuong.html`](dist/co-tuong.html). Mở trực tiếp bằng trình duyệt,
hoặc dán làm Artifact.

## Tính năng chính

- **Học luật** (19 bài, có bàn cờ thử), **bảng tiến độ** của người học.
- **Khai cuộc** (16 thế, 31 nhánh, bẫy khai cuộc, chế độ tự đi lại lý thuyết) và **6 ván danh thủ** có máy chú giải.
- **Chiến thuật, sát cục (24 mẫu), tàn cuộc** (thực hành và lý thuyết).
- **Bài tập** (164 bài): chiếu bí 1–3 nước, bắt quân, bắt đôi, tìm nước cứu, sát cục.
  Có **bài hôm nay** (đếm chuỗi ngày) và **ôn bài sai** theo lịch lặp lại ngắt quãng.
- **Đấu với máy** nhiều cấp (mỗi cấp thắng cấp ngay dưới khoảng 70% số ván). Có gợi ý, đi lại, phân tích ván,
  gợi ý lên/xuống cấp theo kết quả, bắt đầu từ **FEN** hoặc từ bất kỳ thế nào trong bài tập / ván danh thủ / ván đã đấu.
- Luật ván theo kiểu châu Á rút gọn: cấm chiếu mãi / đuổi mãi, hoà do lặp 3 lần, 60 nước không ăn quân, hết quân tấn công.
- Hiệu ứng đi quân, âm thanh (bật/tắt), điều khiển bàn cờ bằng bàn phím, xuất/nhập tiến độ sang máy khác.

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
tools/
  build.js          ghép src/ → dist/co-tuong.html
  selfplay.js       cho các cấp máy tự đấu theo đúng luật của ứng dụng
  match.js          đấu hai bản build với nhau để đo thay đổi sức mạnh (điểm + Elo)
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
