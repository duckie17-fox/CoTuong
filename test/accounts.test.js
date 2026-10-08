// Server tài khoản (spec v3): đăng ký/đăng nhập, chặn dò mật khẩu, mã khôi phục, đồng bộ tiến độ,
// bạn bè, mời đấu, xếp hạng; phòng "Tính Elo" ghi ván và Elo vào D1 (giả lập bằng node:sqlite).
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { loadRoomCore } = require('../tools/build-server');
const { createD1 } = require('../tools/d1-shim');
const { Accounts, RoomCore, Ranked } = loadRoomCore();

// "Mật khẩu đã băm ở trình duyệt": ở đây chỉ cần chuỗi hex 64 ký tự
const ph = pw => crypto.createHash('sha256').update('pw:' + pw).digest('hex');
const J = x => JSON.parse(JSON.stringify(x));

function server() {
  let t = Date.UTC(2026, 9, 8, 8, 0, 0);
  const env = { DB: createD1(), now: () => t };
  async function call(method, path, body, token, ip = '1.2.3.4') {
    const headers = { 'content-type': 'application/json', 'cf-connecting-ip': ip };
    if (token) headers.authorization = 'Bearer ' + token;
    const res = await Accounts.handle(new Request('https://x.test' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), env);
    return { status: res.status, body: await res.json() };
  }
  async function register(username, pw = 'matkhau123', displayName) {
    const r = await call('POST', '/api/register', { username, displayName, passHash: ph(pw) });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body;
  }
  return { env, call, register, tick: ms => { t += ms; }, now: () => t };
}

test('đăng ký: kiểm tra tên đăng nhập, không trùng (không phân biệt hoa thường), trả mã khôi phục và phiên', async () => {
  const s = server();
  assert.equal((await s.call('POST', '/api/register', { username: 'ab', passHash: ph('x') })).body.error, 'bad_username');
  assert.equal((await s.call('POST', '/api/register', { username: 'Có dấu', passHash: ph('x') })).body.error, 'bad_username');
  assert.equal((await s.call('POST', '/api/register', { username: 'an_nguyen', passHash: 'matkhau' })).body.error, 'bad_password');
  const a = await s.register('An_Nguyen', 'matkhau123', 'An Nguyễn');
  assert.match(a.recoveryCode, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(a.user.username, 'an_nguyen');
  assert.equal(a.user.displayName, 'An Nguyễn');
  assert.equal(a.user.elo, 1200);
  const dup = await s.call('POST', '/api/register', { username: 'AN_NGUYEN', passHash: ph('khac') });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.message, 'Tên đăng nhập đã có người dùng');
  const me = await s.call('GET', '/api/me', null, a.token);
  assert.equal(me.body.user.username, 'an_nguyen');
  assert.equal((await s.call('GET', '/api/me', null, 'sai'.repeat(10))).status, 401);
  // không lưu mật khẩu / mã khôi phục dạng gốc
  const row = await s.env.DB.prepare('SELECT * FROM users').first();
  assert.ok(!JSON.stringify(row).includes(ph('matkhau123')) && !JSON.stringify(row).includes(a.recoveryCode.replace(/-/g, '')));
});

test('đăng nhập: báo lỗi chung, sai 5 lần thì khoá 15 phút; quá 30 lần/giờ từ một IP thì chặn', async () => {
  const s = server();
  await s.register('binh');
  const bad = await s.call('POST', '/api/login', { username: 'binh', passHash: ph('sai') });
  assert.equal(bad.status, 401);
  assert.equal(bad.body.message, 'Sai tên đăng nhập hoặc mật khẩu');
  assert.equal((await s.call('POST', '/api/login', { username: 'khongco', passHash: ph('x') })).body.error, 'bad_credentials');
  for (let i = 0; i < 4; i++) await s.call('POST', '/api/login', { username: 'binh', passHash: ph('sai') });
  const locked = await s.call('POST', '/api/login', { username: 'binh', passHash: ph('matkhau123') });
  assert.equal(locked.status, 429);
  assert.equal(locked.body.error, 'locked');
  s.tick(15 * 60000 + 1);
  const ok = await s.call('POST', '/api/login', { username: 'BINH', passHash: ph('matkhau123') });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
  // IP khác bị chặn sau 30 lần sai trong một giờ
  for (let i = 0; i < 30; i++) await s.call('POST', '/api/login', { username: 'x' + i + 'yz', passHash: ph('x') }, null, '9.9.9.9');
  assert.equal((await s.call('POST', '/api/login', { username: 'binh', passHash: ph('matkhau123') }, null, '9.9.9.9')).body.error, 'ip_blocked');
  assert.equal((await s.call('POST', '/api/login', { username: 'binh', passHash: ph('matkhau123') }, null, '5.5.5.5')).status, 200);
});

test('quên mật khẩu bằng mã khôi phục: cấp mã mới, mã cũ hết hiệu lực, đăng xuất mọi máy', async () => {
  const s = server();
  const a = await s.register('chau');
  const r = await s.call('POST', '/api/recover', { username: 'chau', recoveryCode: a.recoveryCode.toLowerCase().replace(/-/g, ' '), newPassHash: ph('moi12345') });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.notEqual(r.body.recoveryCode, a.recoveryCode);
  assert.equal((await s.call('GET', '/api/me', null, a.token)).status, 401, 'phiên cũ phải bị huỷ');
  assert.equal((await s.call('POST', '/api/recover', { username: 'chau', recoveryCode: a.recoveryCode, newPassHash: ph('x') })).body.error, 'bad_recovery');
  assert.equal((await s.call('POST', '/api/login', { username: 'chau', passHash: ph('moi12345') })).status, 200);
  assert.equal((await s.call('POST', '/api/login', { username: 'chau', passHash: ph('matkhau123') })).status, 401);
});

test('đổi mật khẩu, tạo mã khôi phục mới, đổi tên hiển thị, đăng xuất, đăng xuất mọi thiết bị, xoá tài khoản', async () => {
  const s = server();
  const a = await s.register('dung');
  const t2 = (await s.call('POST', '/api/login', { username: 'dung', passHash: ph('matkhau123') })).body.token;
  assert.equal((await s.call('POST', '/api/password', { oldPassHash: ph('sai'), newPassHash: ph('moi') }, a.token)).status, 401);
  assert.equal((await s.call('POST', '/api/password', { oldPassHash: ph('matkhau123'), newPassHash: ph('moi') }, a.token)).status, 200);
  assert.equal((await s.call('GET', '/api/me', null, t2)).status, 401, 'máy khác bị đăng xuất');
  assert.equal((await s.call('GET', '/api/me', null, a.token)).status, 200, 'máy đang dùng vẫn giữ phiên');
  const rc = await s.call('POST', '/api/recovery-code', { passHash: ph('moi') }, a.token);
  assert.match(rc.body.recoveryCode, /^\w{4}-/);
  assert.equal((await s.call('PATCH', '/api/me', { displayName: '  Dũng <b>  ' }, a.token)).body.user.displayName, 'Dũng b');
  assert.equal((await s.call('PATCH', '/api/me', { displayName: '   ' }, a.token)).body.error, 'bad_display');
  await s.call('POST', '/api/logout', null, a.token);
  assert.equal((await s.call('GET', '/api/me', null, a.token)).status, 401);
  const t3 = (await s.call('POST', '/api/login', { username: 'dung', passHash: ph('moi') })).body.token;
  const t4 = (await s.call('POST', '/api/login', { username: 'dung', passHash: ph('moi') })).body.token;
  await s.call('POST', '/api/logout-all', null, t3);
  assert.equal((await s.call('GET', '/api/me', null, t4)).status, 401);
  const t5 = (await s.call('POST', '/api/login', { username: 'dung', passHash: ph('moi') })).body.token;
  assert.equal((await s.call('DELETE', '/api/me', { username: 'dung', passHash: ph('sai') }, t5)).status, 401);
  assert.equal((await s.call('DELETE', '/api/me', { username: 'dung', passHash: ph('moi') }, t5)).status, 200);
  assert.equal((await s.call('POST', '/api/login', { username: 'dung', passHash: ph('moi') })).status, 401);
  assert.equal((await s.call('POST', '/api/register', { username: 'dung', passHash: ph('x') })).status, 201, 'tên được dùng lại');
});

test('phiên hết hạn sau 60 ngày không dùng; dùng thì được gia hạn', async () => {
  const s = server();
  const a = await s.register('emma');
  s.tick(50 * 86400000);
  assert.equal((await s.call('GET', '/api/me', null, a.token)).status, 200);
  s.tick(50 * 86400000);
  assert.equal((await s.call('GET', '/api/me', null, a.token)).status, 200, 'đã gia hạn ở lần dùng trước');
  s.tick(61 * 86400000);
  assert.equal((await s.call('GET', '/api/me', null, a.token)).status, 401);
});

test('gộp tiến độ: hợp tập, lấy bản mới hơn, giữ ván có phân tích, không đồng bộ khoá theo máy', () => {
  const A = { data: {
    xq_lessons_done: '["a","b"]', xq_trainer_best: '{"x":50,"y":90}', xq_srs: '{"p1":{"box":1,"last":100},"p2":{"box":0,"last":500}}',
    xq_ai_history: JSON.stringify([{ id: 'g1', date: 10, moves: [1] }, { id: 'g2', date: 20, moves: [1], analysis: { accuracy: 80 } }]),
    xq_daily: '{"lastDone":"2026-10-07","streak":3,"best":5}', xq_sound: 'on', xq_zone: 'toi', xq_ai_level: '4',
  }, t: { xq_sound: 100, xq_ai_level: 300 } };
  const B = { data: {
    xq_lessons_done: '["b","c"]', xq_trainer_best: '{"x":70,"y":40}', xq_srs: '{"p1":{"box":3,"last":900},"p2":{"box":5,"last":10}}',
    xq_ai_history: JSON.stringify([{ id: 'g2', date: 20, moves: [1] }, { id: 'g3', date: 30, moves: [] }]),
    xq_daily: '{"lastDone":"2026-10-08","streak":1,"best":1}', xq_sound: 'off', xq_online_token: 'bimat', xq_ai_level: '7',
  }, t: { xq_sound: 200, xq_ai_level: 200 } };
  const m = J(Accounts.mergeProgress(A, B)).data;
  assert.deepEqual(JSON.parse(m.xq_lessons_done).sort(), ['a', 'b', 'c']);
  assert.deepEqual(JSON.parse(m.xq_trainer_best), { x: 70, y: 90 });
  const srs = JSON.parse(m.xq_srs);
  assert.equal(srs.p1.box, 3); assert.equal(srs.p2.box, 0);
  const h = JSON.parse(m.xq_ai_history);
  assert.deepEqual(h.map(r => r.id), ['g3', 'g2', 'g1']);
  assert.ok(h[1].analysis, 'giữ bản có phân tích');
  const d = JSON.parse(m.xq_daily);
  assert.equal(d.lastDone, '2026-10-08'); assert.equal(d.best, 5);
  assert.equal(m.xq_sound, 'off', 'cài đặt: bản sửa sau thắng');
  assert.equal(m.xq_ai_level, '4', 'bản cũ hơn không ghi đè bản mới hơn');
  assert.equal(m.xq_zone, undefined); assert.equal(m.xq_online_token, undefined);
});

test('API tiến độ: gộp với bản trên máy chủ, giới hạn 512 KB', async () => {
  const s = server();
  const a = await s.register('giang');
  assert.deepEqual((await s.call('GET', '/api/progress', null, a.token)).body.data, {});
  await s.call('PUT', '/api/progress', { data: { xq_puzzles_solved: '["p1"]' }, t: {} }, a.token);
  const r = await s.call('PUT', '/api/progress', { data: { xq_puzzles_solved: '["p2"]' }, t: {} }, a.token);
  assert.deepEqual(JSON.parse(r.body.data.xq_puzzles_solved).sort(), ['p1', 'p2']);
  assert.deepEqual(JSON.parse((await s.call('GET', '/api/progress', null, a.token)).body.data.xq_puzzles_solved).sort(), ['p1', 'p2']);
  // quá lớn: bỏ bớt ván cũ (giữ ván đã phân tích)
  const big = Array.from({ length: 100 }, (_, i) => ({ id: 'g' + i, date: i, moves: Array(600).fill([9, 9, 9, 9]), analysis: i === 0 ? { a: 1 } : undefined }));
  const r2 = await s.call('PUT', '/api/progress', { data: { xq_ai_history: JSON.stringify(big) }, t: {} }, a.token);
  assert.equal(r2.status, 200);
  const kept = JSON.parse(r2.body.data.xq_ai_history);
  assert.ok(kept.length < 100 && kept.some(g => g.id === 'g0') && kept.some(g => g.id === 'g99'));
  assert.ok(JSON.stringify(r2.body).length <= 512 * 1024 + 100);
});

test('bạn bè: tìm theo tên, gửi lời mời, đồng ý, online, huỷ; mời đấu chỉ với bạn, lời mời hết hạn 10 phút', async () => {
  const s = server();
  const a = await s.register('hoa', 'matkhau123', 'Hoa');
  const b = await s.register('hoang', 'matkhau123', 'Hoàng');
  await s.register('hoai_an');
  const found = (await s.call('GET', '/api/users?q=HOA', null, a.token)).body.users;
  assert.deepEqual(found.map(u => u.username), ['hoai_an', 'hoang'], 'không có chính mình, khớp từ đầu');
  assert.deepEqual((await s.call('GET', '/api/users?q=ho', null, a.token)).body.users, [], 'cần ít nhất 3 ký tự');
  assert.equal((await s.call('POST', '/api/friends', { username: 'hoa' }, a.token)).body.error, 'self');
  assert.equal((await s.call('POST', '/api/friends', { username: 'hoang' }, a.token)).body.relation, 'sent');
  assert.equal((await s.call('POST', '/api/invites', { to: b.user.id }, a.token)).body.error, 'not_friends');
  let fb = (await s.call('GET', '/api/friends', null, b.token)).body;
  assert.deepEqual(fb.incoming.map(u => u.username), ['hoa']);
  assert.equal((await s.call('GET', '/api/inbox', null, b.token)).body.friendRequests, 1);
  assert.equal((await s.call('POST', `/api/friends/${a.user.id}/accept`, null, b.token)).body.relation, 'friend');
  fb = (await s.call('GET', '/api/friends', null, b.token)).body;
  assert.equal(fb.friends[0].username, 'hoa');
  assert.equal(fb.friends[0].online, true);
  s.tick(3 * 60000);
  await s.call('GET', '/api/inbox', null, b.token);
  assert.equal((await s.call('GET', '/api/friends', null, b.token)).body.friends[0].online, false, 'không hoạt động 2 phút → không online');
  // mời đấu
  const inv = (await s.call('POST', '/api/invites', { to: b.user.id, color: 'black', rated: true }, a.token)).body.invite;
  assert.match(inv.roomCode, /^[A-Z2-9]{6}$/);
  assert.equal(inv.rated, true);
  const inv2 = (await s.call('POST', '/api/invites', { to: b.user.id, color: 'red' }, a.token)).body.invite;
  let box = (await s.call('GET', '/api/inbox', null, b.token)).body;
  assert.deepEqual(box.invites.map(i => i.id), [inv2.id], 'lời mời mới thay lời mời cũ');
  assert.equal(box.invites[0].from.displayName, 'Hoa');
  assert.equal((await s.call('POST', `/api/invites/${inv2.id}/decline`, null, b.token)).body.invite.status, 'declined');
  assert.equal((await s.call('GET', '/api/inbox', null, a.token)).body.sent[0].status, 'declined', 'người mời biết bị từ chối');
  const inv3 = (await s.call('POST', '/api/invites', { to: b.user.id }, a.token)).body.invite;
  s.tick(11 * 60000);
  assert.equal((await s.call('POST', `/api/invites/${inv3.id}/accept`, null, b.token)).status, 404, 'hết hạn');
  // huỷ kết bạn
  await s.call('DELETE', `/api/friends/${a.user.id}`, null, b.token);
  assert.deepEqual((await s.call('GET', '/api/friends', null, a.token)).body.friends, []);
});

test('Elo: K=40 cho 20 ván đầu, K=24 sau đó; ván chỉ tính khi đủ điều kiện', () => {
  assert.equal(Accounts.kFactor(0), 40);
  assert.equal(Accounts.kFactor(20), 24);
  assert.equal(Accounts.eloChange(1200, 1200, 1, 40), 20);
  assert.equal(Accounts.eloChange(1200, 1200, 0.5, 40), 0);
  assert.equal(Accounts.eloChange(1200, 1400, 1, 24), 18);
});

// Phòng tính Elo: chạy RoomCore như adapter (ghi ván qua Accounts.recordGame)
async function roomSetup(s, rated = true) {
  const a = await s.register('khoa', 'matkhau123', 'Khoa');
  const b = await s.register('lan', 'matkhau123', 'Lan');
  const ua = (await Accounts.sessionUser(s.env.DB, a.token, s.now())).user, ub = (await Accounts.sessionUser(s.env.DB, b.token, s.now())).user;
  const room = new RoomCore.Room(null), ca = { user: ua }, cb = { user: ub };
  room.join({ token: 'a'.repeat(20), name: 'bất kỳ', create: { color: 'red', rated } }, ca, 'ELO123');
  room.join({ token: 'b'.repeat(20), name: 'x' }, cb);
  const settle = async () => { if (room.st.report) room.setElo(await Accounts.recordGame(s.env.DB, room.st.report, s.now())); };
  const play = async (c, from, to) => { const r = room.handle({ type: 'move', from, to, n: room.st.moves.length }, c, { now: s.now(), online: { red: true, black: true } }); await settle(); return r; };
  return { a, b, room, ca, cb, settle, play };
}
// 10 nửa nước không lặp thế: hai bên lần lượt tiến 5 con Tốt
const SHUFFLE = [0, 2, 4, 6, 8].flatMap(c => [[[6, c], [5, c]], [[3, c], [4, c]]]);
async function shuffle(p, red, black, n, room) { const s0 = room.st.moves.length; for (let i = s0; i < s0 + n; i++) { const [f, t] = SHUFFLE[i]; const r = await p(i % 2 ? black : red, f, t); assert.ok(r.changed, JSON.stringify(r)); } }

test('phòng tính Elo: ghế theo tài khoản, không xin đi lại, ghi Elo khi xong ván', async () => {
  const s = server();
  const { a, room, ca, cb, settle, play } = await roomSetup(s);
  assert.equal(room.st.seats.red.name, 'Khoa', 'tên lấy theo tên hiển thị');
  assert.equal(room.seatFor({ token: 'z'.repeat(20), uid: a.user.id }), 'red', 'vào từ máy khác vẫn đúng ghế');
  const v = J(room.view({ token: 'b'.repeat(20) }, { red: true, black: true }));
  assert.equal(v.rated, true); assert.equal(v.seats.red.elo, 1200); assert.equal(v.seats.red.username, 'khoa');
  await shuffle(play, ca, cb, 2, room);
  assert.equal(room.handle({ type: 'offer', kind: 'takeback' }, ca).error, 'rated_no_takeback');
  await shuffle(play, ca, cb, 8, room);
  room.handle({ type: 'resign' }, cb); await settle();
  assert.equal(room.st.elo.red.after, 1220); assert.equal(room.st.elo.black.after, 1180);
  assert.equal(room.st.seats.red.elo, 1220);
  const me = (await s.call('GET', '/api/me', null, a.token)).body.user;
  assert.equal(me.elo, 1220); assert.equal(me.wins, 1); assert.equal(me.ratedGames, 1);
  const games = (await s.call('GET', '/api/games', null, a.token)).body.games;
  assert.equal(games.length, 1); assert.equal(games[0].rated, true); assert.equal(games[0].eloAfter, 1220);
  // tái đấu (đổi màu): ván ngắn dưới 10 nửa nước → không tính
  room.handle({ type: 'offer', kind: 'rematch' }, ca); room.handle({ type: 'reply', accept: true }, cb);
  assert.equal(room.st.elo, null);
  room.handle({ type: 'resign' }, cb); await settle();
  assert.equal(room.st.elo, null);
  assert.equal((await s.call('GET', '/api/me', null, a.token)).body.user.elo, 1220);
  assert.equal((await s.call('GET', '/api/games', null, a.token)).body.games.length, 2, 'ván không tính vẫn vào lịch sử');
});

test('phòng tính Elo: không có xử thắng (ván không giới hạn thời gian); tối đa 10 ván tính Elo/ngày giữa hai người', async () => {
  const s = server();
  const { room, ca, cb, settle, play } = await roomSetup(s);
  await shuffle(play, ca, cb, 10, room);
  room.markLeft('black', s.now());
  s.tick(60 * 60000);
  assert.equal(room.handle({ type: 'claim' }, ca, { now: s.now(), online: { red: true, black: false } }).error, 'unknown', 'không còn xử thắng');
  assert.equal(J(room.view({ token: 'a'.repeat(20) }, { red: true, black: false })).seats.black.awaySince, undefined);
  room.handle({ type: 'resign' }, cb); await settle();
  assert.equal(room.st.elo.red.after, 1220);
  // giới hạn mỗi ngày
  for (let g = 2; g <= 11; g++) {
    room.handle({ type: 'offer', kind: 'rematch' }, ca); room.handle({ type: 'reply', accept: true }, cb);
    const red = room.st.seats.red.uid === ca.uid ? ca : cb, black = red === ca ? cb : ca;
    await shuffle(play, red, black, 10, room);
    room.handle({ type: 'resign' }, black); await settle();
    if (g <= 10) assert.ok(room.st.elo, 'ván ' + g + ' được tính');
    else assert.equal(room.st.elo, null, 'ván thứ 11 trong ngày không tính');
  }
});

test('phòng không bật Elo hoặc đối thủ chưa đăng nhập: không tính Elo, vẫn cho xin đi lại', async () => {
  const s = server();
  const { room, ca, cb, settle, play } = await roomSetup(s, false);
  await shuffle(play, ca, cb, 1, room);
  assert.ok(room.handle({ type: 'offer', kind: 'takeback' }, ca).changed);
  // phòng tính Elo nhưng khách chưa đăng nhập
  const r2 = new RoomCore.Room(null), guest = {};
  r2.join({ token: 'c'.repeat(20), create: { color: 'red', rated: true } }, { user: ca.user || (await Accounts.sessionUser(s.env.DB, (await s.call('POST', '/api/login', { username: 'khoa', passHash: ph('matkhau123') })).body.token, s.now())).user }, 'GUEST1');
  r2.join({ token: 'd'.repeat(20), name: 'Khách' }, guest);
  assert.equal(r2.st.seats.black.name, 'Khách');
  for (let i = 0; i < 10; i++) { const [f, t] = SHUFFLE[i]; r2.handle({ type: 'move', from: f, to: t, n: i }, i % 2 ? guest : { token: 'c'.repeat(20) }); }
  r2.handle({ type: 'resign' }, guest);
  const r = await Accounts.recordGame(s.env.DB, r2.st.report, s.now());
  assert.equal(r.rated, false);
  // không đăng nhập ai cả → không có gì để ghi
  const r3 = new RoomCore.Room(null);
  r3.join({ token: 'e'.repeat(20), name: 'A', create: { color: 'red', rated: true } }, {}, 'NOACC1');
  assert.equal(r3.st.rated, false, 'chưa đăng nhập thì không bật được Tính Elo');
});

test('xếp hạng: bạn bè / toàn bộ, chỉ xếp hạng người đủ 5 ván, dòng của mình ghim khi ngoài danh sách', async () => {
  const s = server();
  const a = await s.register('minh');
  const b = await s.register('nam');
  await s.call('POST', '/api/friends', { username: 'nam' }, a.token);
  await s.call('POST', `/api/friends/${a.user.id}/accept`, null, b.token);
  await s.env.DB.prepare('UPDATE users SET rated_games=6, elo=1300 WHERE username=?').bind('nam').run();
  const fr = (await s.call('GET', '/api/leaderboard?scope=friends', null, a.token)).body;
  assert.deepEqual(fr.list.map(x => [x.username, x.rank, x.me]), [['nam', 1, false], ['minh', null, true]]);
  const all = (await s.call('GET', '/api/leaderboard?scope=all', null, a.token)).body;
  assert.deepEqual(all.list.map(x => x.username), ['nam']);
  assert.equal(all.me.username, 'minh'); assert.equal(all.me.rank, null, 'chưa đủ 5 ván');
});

test('CORS và lỗi: OPTIONS trả 204, đường dẫn lạ 404, không có DB thì 503', async () => {
  const s = server();
  const o = await Accounts.handle(new Request('https://x.test/api/login', { method: 'OPTIONS' }), s.env);
  assert.equal(o.status, 204);
  assert.match(o.headers.get('access-control-allow-headers'), /authorization/);
  assert.equal((await s.call('GET', '/api/khongco')).status, 404);
  assert.equal(await Accounts.handle(new Request('https://x.test/room/ABC'), s.env), null);
  assert.equal((await Accounts.handle(new Request('https://x.test/api/me'), {})).status, 503);
  assert.equal((await s.call('POST', '/api/login', null)).status, 401);
});

test('đấu xếp hạng: ghép hai người Elo gần nhau; quá chênh thì không ghép; hết giờ thì ghép máy', async () => {
  const s = server();
  const a = await s.register('xh_an'), b = await s.register('xh_binh'), c = await s.register('xh_chi');
  await s.env.DB.prepare('UPDATE users SET elo=1700 WHERE username=?').bind('xh_chi').run();
  assert.equal((await s.call('POST', '/api/match/join', null, a.token)).body.status, 'waiting');
  assert.equal((await s.call('POST', '/api/match/join', null, c.token)).body.status, 'waiting', 'chênh 500 Elo: không ghép');
  const mb = (await s.call('POST', '/api/match/join', null, b.token)).body;
  assert.equal(mb.status, 'matched');
  const ma = (await s.call('POST', '/api/match/join', null, a.token)).body;
  assert.equal(ma.status, 'matched'); assert.equal(ma.roomCode, mb.roomCode); assert.notEqual(ma.color, mb.color);
  // người chờ quá 15 giây không còn trong hàng
  s.tick(20000);
  const d = await s.register('xh_dung');
  assert.equal((await s.call('POST', '/api/match/join', null, d.token)).body.status, 'waiting');
  // hết giờ chờ → máy cấp gần Elo, nick giống người
  const bot = (await s.call('POST', '/api/match/bot', null, d.token)).body;
  assert.equal(bot.status, 'bot');
  assert.equal(bot.game.level, Ranked.botLevelFor(1200));
  assert.ok(Math.abs(bot.game.botElo - Ranked.BOT_LEVELS[bot.game.level - 1].elo) <= 30);
  assert.ok(bot.game.botName.length >= 3 && !/máy|bot/i.test(bot.game.botName));
  // gọi lại khi đang có ván dở → trả lại đúng ván đó
  assert.equal((await s.call('POST', '/api/match/bot', null, d.token)).body.game.id, bot.game.id);
});

test('ván xếp hạng với máy: kiểm tra nước đi và kết quả, cộng/trừ Elo, ván dở không bị xử thua', async () => {
  const s = server();
  const a = await s.register('bot_an');
  const start = async () => (await s.call('POST', '/api/match/bot', null, a.token)).body.game;
  // nước đi sai luật → từ chối
  let g = await start();
  assert.equal((await s.call('POST', `/api/match/bot/${g.id}/finish`, { moves: [[9, 0, 5, 0]], reason: 'resign', winner: g.color }, a.token)).body.error, 'bad_game');
  // tự nhận "máy đầu hàng" khi không hơn quân → từ chối
  const SEQ = [0, 2, 4, 6, 8].flatMap(c => [[6, c, 5, c], [3, c, 4, c]]);
  assert.equal((await s.call('POST', `/api/match/bot/${g.id}/finish`, { moves: SEQ, reason: 'resign', winner: g.color }, a.token)).body.error, 'bad_result');
  // mình đầu hàng → thua, bị trừ Elo
  const other = g.color === 'red' ? 'black' : 'red';
  const lose = (await s.call('POST', `/api/match/bot/${g.id}/finish`, { moves: SEQ.slice(0, 4), reason: 'resign', winner: other }, a.token)).body;
  assert.equal(lose.result, 'loss'); assert.ok(lose.elo.delta < 0);
  assert.equal(lose.user.losses, 1); assert.equal(lose.user.ratedGames, 1);
  // nộp lại không tính hai lần
  assert.equal((await s.call('POST', `/api/match/bot/${g.id}/finish`, { moves: SEQ, reason: 'resign', winner: other }, a.token)).body.already, true);
  // chiếu bí thật (Pháo + Pháo) → thắng, được cộng Elo
  g = await start();
  const eloBefore = (await s.call('GET', '/api/me', null, a.token)).body.user.elo;
  await s.env.DB.prepare('UPDATE bot_games SET color=? WHERE id=?').bind('red', g.id).run();
  const MATE = [[7, 1, 7, 4], [2, 1, 2, 6], [7, 4, 3, 4], [0, 8, 1, 8], [7, 7, 5, 7], [2, 6, 6, 6], [5, 7, 5, 4]];   // Đỏ chiếu bí sau 7 nửa nước
  const win = (await s.call('POST', `/api/match/bot/${g.id}/finish`, { moves: MATE, reason: 'checkmate', winner: 'red' }, a.token)).body;
  assert.equal(win.result, 'win', JSON.stringify(win));
  assert.ok(win.user.elo > eloBefore);
  assert.equal(win.user.wins, 1);
  // không giới hạn thời gian: ván dở để lâu vẫn còn, không bị xử thua; chưa xong thì không mở ván mới
  g = await start();
  const before = (await s.call('GET', '/api/me', null, a.token)).body.user;
  s.tick(48 * 3600000);
  const inbox = (await s.call('GET', '/api/inbox', null, a.token)).body;
  assert.equal(inbox.user.elo, before.elo);
  assert.equal((await start()).id, g.id, 'vẫn là ván dở cũ');
});

test('bậc hạng và cấp máy', () => {
  assert.equal(Ranked.tierOf(1200).label, 'Vàng II');
  assert.equal(Ranked.tierOf(850).label, 'Đồng III');
  assert.equal(Ranked.tierOf(1000).label, 'Bạc III');
  assert.equal(Ranked.tierOf(1599).label, 'Kim Cương I');
  assert.equal(Ranked.tierOf(2500).label, 'Thách Đấu');
  assert.equal(Ranked.BOT_LEVELS.length, 20);
  assert.equal(Ranked.botLevelFor(600), 1);
  assert.equal(Ranked.botLevelFor(1200), 7);   // 700+6·85 = 1210
  assert.equal(Ranked.botLevelFor(3000), 20);
  const names = new Set(Array.from({ length: 200 }, (_, i) => Ranked.botNick(i * 7919 + 1)));
  assert.ok(names.size > 150, 'nick đa dạng');
});
