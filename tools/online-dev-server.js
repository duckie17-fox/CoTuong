#!/usr/bin/env node
// Server Sa trường chạy bằng Node (cùng RoomCore với bản Cloudflare) — để test e2e và chơi thử trong mạng nhà.
//   node tools/online-dev-server.js [cổng=8787]
// Mở ứng dụng với ?server=ws://localhost:8787 (hoặc đặt trong ⚙️ của Sa trường).
const http = require('http');
const { WebSocketServer } = require('ws');
const { loadRoomCore } = require('./build-server');

function start(port) {
  const { RoomCore } = loadRoomCore();
  const rooms = new Map();          // mã → {room, socks:Set}
  const server = http.createServer((req, res) => {
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
  function broadcast(r, skip) {
    if (!r.room.exists()) return;
    const online = { red: false, black: false, spectators: 0 };
    for (const ws of r.socks) { if (ws === skip || !ws.att.joined) continue; const s = r.room.seatOf(ws.att.token); if (s) online[s] = true; else online.spectators++; }
    for (const ws of r.socks) if (ws !== skip && ws.att.joined) ws.send(JSON.stringify(r.room.view(ws.att, online)));
  }
  function attach(ws, code) {
    const r = slot(code);
    ws.att = { code, token: null, name: null, joined: false };
    r.socks.add(ws);
    ws.on('message', (data, isBinary) => {
      const text = data.toString();
      if (text === 'ping') { ws.send('pong'); return; }
      if (isBinary || text.length > 4000) return;
      let msg; try { msg = JSON.parse(text); } catch (e) { return; }
      if (!msg || typeof msg !== 'object') return;
      const conn = { token: ws.att.token, name: ws.att.name };
      const res = msg.type === 'join' ? r.room.join(msg, conn, code) : !ws.att.joined ? { error: 'not_joined' } : r.room.handle(msg, conn);
      if (res.error) { ws.send(JSON.stringify({ type: 'error', error: res.error })); if (res.close) ws.close(4000, res.error); return; }
      if (msg.type === 'join') Object.assign(ws.att, { token: conn.token, name: conn.name, joined: true });
      broadcast(r);
    });
    ws.on('close', () => { r.socks.delete(ws); broadcast(r); if (!r.socks.size && !r.room.exists()) rooms.delete(code); });
  }
  return new Promise(res => server.listen(port, () => res({ port: server.address().port, close: () => { wss.clients.forEach(c => c.terminate()); server.close(); } })));
}

if (require.main === module) {
  start(+process.argv[2] || 8787).then(s => console.log(`Server Sa trường chạy thử: ws://localhost:${s.port}`));
}
module.exports = { start };
