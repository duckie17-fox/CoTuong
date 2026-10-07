# Cờ Tướng Nhập Môn

Ứng dụng học cờ tướng chạy trong **một file HTML tự chứa**: học luật, khai cuộc, ván danh thủ,
chiến thuật, sát cục, tàn cuộc, bài tập và đấu với máy (có phân tích ván).

File dùng được ngay: [`dist/co-tuong.html`](dist/co-tuong.html). Mở trực tiếp bằng trình duyệt,
hoặc dán làm Artifact.

## Cấu trúc

```
src/
  shell.html        khung trang (head, các tab, markup); chỗ chèn CSS/JS
  style.css         toàn bộ CSS
  js/order.json     thứ tự ghép các module
  js/NN-*.js        mã nguồn, chia theo phần (engine, ký hiệu, luật ván, solver,
                    XQSearch, coach, bàn cờ, bài học, AI, bài tập, khai cuộc, …)
  js/worker-shim.js phần nhận lệnh của Web Worker
  data/*.js         dữ liệu sinh sẵn (bài tập, nhánh khai cuộc, ván danh thủ, tàn cuộc, sát cục)
tools/
  build.js          ghép src/ → dist/co-tuong.html
  selfplay.js       cho các cấp máy tự đấu theo đúng luật của ứng dụng
test/               test (node:test + jsdom) chạy trên chính bản build
```

Mã Web Worker (`XQ_WORKER_SRC`) được build **tự sinh** từ `04-xqsearch.js` + `worker-shim.js`,
nên không cần sửa tay hai bản XQSearch.

## Lệnh

```bash
npm install          # cài jsdom cho test
npm run build        # tạo dist/co-tuong.html
npm test             # build + chạy test nhanh (~vài giây)
npm run test:full    # thêm phần kiểm tốn thời gian (bí 3 nước, lãi quân)
node tools/selfplay.js 4 5 10   # cấp 4 đấu cấp 5, 10 ván
```

Sau khi sửa `src/`, hãy chạy `npm run build` rồi commit cả `dist/co-tuong.html`; CI sẽ báo lỗi nếu hai bên lệch nhau.

## Test kiểm những gì

- Trang khởi động không lỗi, đủ các tab, Worker chứa đúng XQSearch.
- Bộ sinh nước: perft chuẩn (44 / 1920 / 79666); XQSearch và Engine luôn ra cùng tập nước hợp lệ.
- Dữ liệu: mọi bài tập, nhánh khai cuộc, ván danh thủ, thế minh hoạ, sát cục, tàn cuộc lý thuyết
  đều là thế hợp lệ với đáp án / chuỗi nước đúng luật; bài chiếu bí ép bí đúng số nước và không có cách bí nhanh hơn.
