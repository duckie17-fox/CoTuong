#!/usr/bin/env node
// Ghép server Sa trường: luật ván của ứng dụng (Engine, Notation, Game) + RoomCore + Accounts + adapter.
//   node tools/build-server.js   → server/dist/worker.js (ES module cho Cloudflare)
// loadRoomCore() dùng cho test / server chạy thử bằng Node (cùng mã, không cần Cloudflare).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const CORE = ['src/js/00-engine.js', 'src/js/01-notation.js', 'src/js/02-game.js', 'server/src/room.js', 'server/src/accounts.js'];

function coreSource() { return CORE.map(read).join('\n'); }
function build() { return '// Tự sinh bởi tools/build-server.js — đừng sửa tay.\n' + coreSource() + '\n' + read('server/src/worker.js'); }
function loadRoomCore() {
  const ctx = { console, crypto: globalThis.crypto, TextEncoder, Response, Request, Headers, URL, btoa };
  vm.createContext(ctx);
  vm.runInContext(coreSource() + '\n;globalThis.__out={RoomCore, Game, Engine, Accounts};', ctx);
  return ctx.__out;
}

if (require.main === module) {
  const out = path.join(ROOT, 'server', 'dist', 'worker.js');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, build());
  console.log(`Đã build ${path.relative(process.cwd(), out)}`);
}
module.exports = { build, loadRoomCore };
