#!/usr/bin/env node
// Server Sa trường + tài khoản chạy bằng Node (cùng RoomCore/Accounts với bản Cloudflare; D1 giả lập bằng node:sqlite)
// — để test e2e và chơi thử trong mạng nhà.
//   node tools/online-dev-server.js [cổng=8787] [tệp-db=:memory:]
// Mở ứng dụng với ?server=ws://localhost:8787 (hoặc nhập ở mục "Máy chủ (nâng cao)" của Sa trường).
const http = require('http');
const { WebSocketServer } = require('ws');
const { loadRoomCore } = require('./build-server');

function start(port, opts = {}) {
  const { RoomCore, Accounts } = loadRoomCore();
  let DB = null;
  try { DB = opts.db || require('./d1-shim').createD1(opts.dbFile || ':memory:'); }
  catch (e) { console.warn('Không có node:sqlite (cần Node ≥ 22) — chạy không có tài khoản.'); }
  const env = { DB, now: opts.now };
  const now = () => (opts.now ? opts.now() : Date.now());
  const rooms = new Map();          // mã → {room, socks:Set}
  const server = http.createServer(async (req, res) => {
    try {
      const chunks = []; for await (const c of req) chunks.push(c);
      const body = Buffer.concat(chunks);
      const r = new Request('http://localhost' + req.url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
      const out = await Accounts.handle(r, env);
      if (out) {
        res.writeHead(out.status, Object.fromEntries(out.headers));
        res.end(Buffer.from(await out.arrayBuffer()));
        return;
      }
    } catch (e) { console.error(e); }
    res.writeHead(req.url === '/' ? 200 : 404, { 'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': '*' });
    res.end(req.url === '/' ? 'Co Tuong online server: OK' : 'Not found');
  });
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    const m = req.url.match(/^\/room\/([A-Z0-9]{4,12})$/);
    if (!m) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, ws => attach(ws, m[1]));
  });
  function slot(code) { if (!rooms.has(code)) rooms.set(code, { room: new RoomCore.Room(null), socks: new Set() }); return rooms.get(code); }
  function online(r, skip) {
    const o = { red: false, black: false, spectators: 0 };
    for (const ws of r.socks) { if (ws === skip || !ws.att.joined) continue; const s = r.room.seatFor(ws.att); if (s) o[s] = true; else o.spectators++; }
    return o;
  }
  function broadcast(r, skip) {
    if (!r.room.exists()) return;
    const o = online(r, skip);
    for (const ws of r.socks) if (ws !== skip && ws.att.joined) ws.send(JSON.stringify(r.room.view(ws.att, o)));
  }
  async function settle(r) {
    if (!r.room.st || !r.room.st.report) return;
    let res = null;
    if (DB) { try { res = await Accounts.recordGame(DB, r.room.st.report, now()); } catch (e) { console.error(e); } }
    r.room.setElo(res);
  }
  function attach(ws, code) {
    const r = slot(code);
    ws.att = { code, token: null, name: null, uid: null, joined: false };
    r.socks.add(ws);
    let queue = Promise.resolve();   // xử lý tuần tự như Durable Object
    ws.on('message', (data, isBinary) => { queue = queue.then(() => onMessage(data, isBinary)).catch(e => console.error(e)); });
    async function onMessage(data, isBinary) {
      const text = data.toString();
      if (text === 'ping') { ws.send('pong'); return; }
      if (isBinary || text.length > 4000) return;
      let msg; try { msg = JSON.parse(text); } catch (e) { return; }
      if (!msg || typeof msg !== 'object') return;
      const conn = { token: ws.att.token, name: ws.att.name, uid: ws.att.uid };
      let res;
      if (msg.type === 'join') {
        if (msg.auth && DB) { const s = await Accounts.sessionUser(DB, msg.auth, now()); if (s) conn.user = s.user; }
        res = r.room.join(msg, conn, code);
      } else res = !ws.att.joined ? { error: 'not_joined' } : r.room.handle(msg, conn, { now: now(), online: online(r) });
      if (res.error) { ws.send(JSON.stringify({ type: 'error', error: res.error })); if (res.close) ws.close(4000, res.error); return; }
      if (msg.type === 'join') Object.assign(ws.att, { token: conn.token, name: conn.name, uid: conn.uid || null, joined: true });
      if (res.changed) await settle(r);
      broadcast(r);
    }
    ws.on('close', () => {
      queue = queue.then(() => {
        r.socks.delete(ws);
        if (r.room.exists() && ws.att.joined) { const seat = r.room.seatFor(ws.att); if (seat && !online(r)[seat]) r.room.markLeft(seat, now()); }
        broadcast(r);
        if (!r.socks.size && !r.room.exists()) rooms.delete(code);
      });
    });
  }
  return new Promise(res => server.listen(port, () => res({ port: server.address().port, db: DB, close: () => { wss.clients.forEach(c => c.terminate()); server.close(); } })));
}

if (require.main === module) {
  start(+process.argv[2] || 8787, { dbFile: process.argv[3] }).then(s => console.log(`Server Sa trường chạy thử: ws://localhost:${s.port} (API: http://localhost:${s.port}/api/)`));
}
module.exports = { start };
