#!/usr/bin/env node
// Ghép mã nguồn trong src/ thành MỘT file HTML tự chứa (dùng được làm Artifact / mở trực tiếp).
//   node tools/build.js            -> dist/co-tuong.html
//   node tools/build.js out.html   -> ghi ra đường dẫn khác
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const read = p => fs.readFileSync(path.join(SRC, p), 'utf8');

// JSON.stringify nhưng escape ký tự ngoài ASCII (giữ file an toàn với mọi bảng mã)
const asciiJSON = s => JSON.stringify(s).replace(/[\u007f-￿]/g, ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));

function build() {
  const order = JSON.parse(read('js/order.json'));
  const files = Object.fromEntries(order.map(f => [f, read('js/' + f)]));

  // Mã nguồn Web Worker = toàn bộ module XQSearch + phần nhận lệnh (worker-shim.js).
  // Sinh tự động để hai bản không bao giờ lệch nhau.
  const xq = files['04-xqsearch.js'].replace(/\s+$/, '');
  const workerSrc = xq + '\n\n' + read('js/worker-shim.js');
  const workerLine = 'const XQ_WORKER_SRC = ' + asciiJSON(workerSrc) + ';';

  let js = order.map(f => files[f].replace(/\n$/, '')).join('\n');
  js = js.replace(/\/\*@@DATA:([\w-]+)@@\*\//g, (_, name) => read('data/' + name + '.js').replace(/\n$/, ''));
  if (!js.includes('/*@@WORKER@@*/')) throw new Error('thiếu /*@@WORKER@@*/');
  js = js.replace('/*@@WORKER@@*/', () => workerLine);

  // Địa chỉ server Sa trường: biến môi trường ONLINE_SERVER, nếu không có thì src/online.json
  let onlineServer = process.env.ONLINE_SERVER;
  if (onlineServer == null) { try { onlineServer = JSON.parse(read('online.json')).server || ''; } catch (e) { onlineServer = ''; } }
  if (!js.includes("/*@@ONLINE_SERVER@@*/''")) throw new Error('thiếu /*@@ONLINE_SERVER@@*/');
  js = js.replace("/*@@ONLINE_SERVER@@*/''", () => JSON.stringify(onlineServer));

  const css = read('style.css').replace(/\n$/, '');
  return read('shell.html').replace('/*@@CSS@@*/', () => css).replace('/*@@JS@@*/', () => js);
}

if (require.main === module) {
  const out = process.argv[2] || path.join(ROOT, 'dist', 'co-tuong.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const html = build();
  fs.writeFileSync(out, html);
  console.log(`Đã build ${path.relative(process.cwd(), out)} (${(html.length / 1024).toFixed(0)} KB)`);
}
module.exports = { build };
