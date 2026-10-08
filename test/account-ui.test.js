// Giao diện tài khoản (jsdom): fetch giả nối thẳng vào server thật (Accounts.handle + D1 giả bằng node:sqlite).
const test = require('node:test');
const assert = require('node:assert/strict');
const nodeCrypto = require('crypto');
const { load } = require('./helpers/load');
const { loadRoomCore } = require('../tools/build-server');
const { createD1 } = require('../tools/d1-shim');
const { Accounts } = loadRoomCore();
const OPEN = [];   // đóng mọi cửa sổ jsdom khi xong (kể cả khi test lỗi) để tiến trình thoát
test.after(() => OPEN.forEach(w => { try { w.close(); } catch (e) {} }));

function backend() {
  const env = { DB: createD1() };
  const fetch = (url, opts = {}) => Accounts.handle(new Request(url, opts), env);
  const call = async (method, path, body, token) => {
    const headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = 'Bearer ' + token;
    const r = await fetch('http://api.test' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    return r.json();
  };
  return { env, fetch, call };
}
// Mở app như một "máy" mới, trỏ vào máy chủ giả
function device(be, storage = {}) {
  const r = load({ fresh: true, storage: Object.assign({ xq_online_server: 'ws://api.test' }, storage), setup(win) {
    win.fetch = be.fetch;
    Object.defineProperty(win, 'crypto', { value: nodeCrypto.webcrypto, configurable: true });
    win.TextEncoder = TextEncoder;
  } });
  OPEN.push(r.window);
  r.window.eval('Account.api.iterations = 1000; window.__reloads = 0; Account.api.reload = () => { window.__reloads++; };');
  return r;
}
async function until(fn, ms = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await new Promise(r => setTimeout(r, 10)); }
  throw new Error('quá thời gian chờ: ' + fn);
}
const fill = (doc, id, v) => { doc.getElementById(id).value = v; };
const submit = doc => doc.querySelector('#dlgBody form').dispatchEvent(new doc.defaultView.Event('submit', { cancelable: true }));
// "mật khẩu đã băm" như trình duyệt: PBKDF2 1000 vòng (khớp Account.api.iterations ở trên)
const ph = (u, p) => nodeCrypto.pbkdf2Sync(p, 'cotuong:' + u, 1000, 32, 'sha256').toString('hex');

async function registerViaUI(doc, username, name, pw = 'matkhau123') {
  doc.querySelector('[data-open-register]').click();
  assert.equal(doc.getElementById('dlg').hidden, false);
  fill(doc, 'rgUser', username); fill(doc, 'rgName', name); fill(doc, 'rgPass', pw); fill(doc, 'rgPass2', pw);
  submit(doc);
  await until(() => doc.getElementById('rcCode'));
  const code = doc.getElementById('rcCode').textContent;
  assert.equal(doc.getElementById('rcNext').disabled, true, 'phải tích "đã lưu mã" mới đi tiếp');
  doc.getElementById('rcOk').click();
  doc.getElementById('rcNext').click();
  return code;
}

test('đăng ký trên giao diện: kiểm tra ô nhập, hiện mã khôi phục, lưu tiến độ trên máy vào tài khoản', async () => {
  const be = backend();
  const { document: doc, window: win } = device(be, { xq_lessons_done: '["l1","l2"]' });
  assert.equal(doc.getElementById('meLabel').textContent, 'Đăng nhập');
  doc.querySelector('.zone-btn[data-zone="toi"]').click();
  assert.equal(doc.getElementById('meIntro').hidden, false);
  // lỗi nhập
  doc.querySelector('[data-open-register]').click();
  fill(doc, 'rgUser', 'A'); fill(doc, 'rgPass', '123'); fill(doc, 'rgPass2', '123');
  submit(doc);
  await until(() => doc.getElementById('rgUserErr').textContent);
  assert.match(doc.getElementById('rgUserErr').textContent, /3–20 ký tự/);
  assert.match(doc.getElementById('rgPassErr').textContent, /ít nhất 8 ký tự/);
  fill(doc, 'rgPass', 'matkhau123'); fill(doc, 'rgPass2', 'matkhau124'); fill(doc, 'rgUser', 'an_ui');
  submit(doc);
  await until(() => doc.getElementById('rgPass2Err').textContent);
  assert.match(doc.getElementById('rgPass2Err').textContent, /chưa khớp/);
  win.eval('Account.closeDialog()');
  // đăng ký thật
  const code = await registerViaUI(doc, 'An_UI', 'An');
  assert.match(code, /^\w{4}-\w{4}-\w{4}-\w{4}$/);
  await until(() => !doc.getElementById('meSigned').hidden);
  assert.equal(doc.getElementById('meName').textContent, 'An');
  assert.equal(doc.getElementById('meLabel').textContent, 'Tôi');
  assert.equal(doc.getElementById('meAvatar').textContent, 'AN');
  assert.equal(doc.getElementById('syncIcon').hidden, false);
  // tiến độ trên máy đã lên máy chủ
  const tok = win.localStorage.getItem('xq_auth');
  await until(async () => true);
  const prog = await be.call('GET', '/api/progress', null, tok);
  assert.ok(['l1', 'l2'].every(x => JSON.parse(prog.data.xq_lessons_done).includes(x)));
  // tên trùng
  const { document: d2, window: w2 } = device(be);
  d2.querySelector('[data-open-register]').click();
  fill(d2, 'rgUser', 'an_ui'); fill(d2, 'rgPass', 'matkhau123'); fill(d2, 'rgPass2', 'matkhau123');
  submit(d2);
  await until(() => d2.getElementById('rgUserErr').textContent);
  assert.equal(d2.getElementById('rgUserErr').textContent, 'Tên đăng nhập đã có người dùng');
});

test('đăng nhập ở máy thứ hai: hỏi gộp tiến độ; Gộp giữ cả hai; Bỏ qua dùng tiến độ tài khoản; sai mật khẩu báo lỗi chung', async () => {
  const be = backend();
  const reg = await be.call('POST', '/api/register', { username: 'binh_ui', passHash: ph('binh_ui', 'matkhau123') });
  await be.call('PUT', '/api/progress', { data: { xq_lessons_done: '["l1"]' }, t: {} }, reg.token);
  async function login(doc, pw) {
    doc.querySelector('[data-open-login]').click();
    fill(doc, 'lgUser', 'Binh_UI'); fill(doc, 'lgPass', pw);
    submit(doc);
  }
  // sai mật khẩu
  const A = device(be, { xq_puzzles_solved: '["p1"]' });
  await login(A.document, 'saimatkhau');
  await until(() => A.document.querySelector('.dlg-msg') && A.document.querySelector('.dlg-msg').textContent);
  assert.equal(A.document.querySelector('.dlg-msg').textContent, 'Sai tên đăng nhập hoặc mật khẩu');
  A.window.eval('Account.closeDialog()');
  // Gộp
  await login(A.document, 'matkhau123');
  await until(() => A.document.getElementById('mgMerge'));
  A.document.getElementById('mgMerge').click();
  await until(() => A.window.__reloads === 1);
  assert.ok(JSON.parse(A.window.localStorage.getItem('xq_lessons_done')).includes('l1'));
  assert.deepEqual(JSON.parse(A.window.localStorage.getItem('xq_puzzles_solved')), ['p1']);
  // Bỏ qua: tiến độ trên máy bị thay bằng tiến độ tài khoản
  const B = device(be, { xq_sc_solved: '["s9"]' });
  await login(B.document, 'matkhau123');
  await until(() => B.document.getElementById('mgSkip'));
  B.document.getElementById('mgSkip').click();
  await until(() => B.window.__reloads === 1);
  assert.equal(B.window.localStorage.getItem('xq_sc_solved'), null);
  assert.deepEqual(JSON.parse(B.window.localStorage.getItem('xq_puzzles_solved')), ['p1']);
});

test('đồng bộ: thay đổi trên máy được ghi thời điểm và gửi lên; quên mật khẩu bằng mã khôi phục; đăng xuất giữ tiến độ', async () => {
  const be = backend();
  const { document: doc, window: win } = device(be);
  const code = await registerViaUI(doc, 'chi_ui', 'Chi');
  await until(() => !doc.getElementById('meSigned').hidden);
  win.eval("safeLS_set('xq_puzzles_solved', JSON.stringify(['p7']))");
  assert.ok(JSON.parse(win.localStorage.getItem('xq_sync_meta')).t.xq_puzzles_solved, 'ghi thời điểm sửa');
  await until(() => win.eval('Account.state.sync') !== 'syncing');
  await win.eval('Account.sync()');
  const tok = win.localStorage.getItem('xq_auth');
  assert.deepEqual(JSON.parse((await be.call('GET', '/api/progress', null, tok)).data.xq_puzzles_solved), ['p7']);
  // đăng xuất, giữ tiến độ
  doc.querySelector('.zone-btn[data-zone="toi"]').click();
  doc.getElementById('meLogout').click();
  doc.getElementById('loKeep').click();
  await until(() => !win.localStorage.getItem('xq_auth'));
  assert.equal(doc.getElementById('meIntro').hidden, false);
  assert.deepEqual(JSON.parse(win.localStorage.getItem('xq_puzzles_solved')), ['p7']);
  // quên mật khẩu
  doc.querySelector('[data-open-login]').click();
  fill(doc, 'lgUser', 'chi_ui');
  doc.getElementById('lgForgot').click();
  assert.equal(doc.getElementById('fgUser').value, 'chi_ui');
  fill(doc, 'fgCode', code.toLowerCase()); fill(doc, 'fgPass', 'matkhaumoi1'); fill(doc, 'fgPass2', 'matkhaumoi1');
  submit(doc);
  await until(() => doc.getElementById('rcCode'));
  assert.notEqual(doc.getElementById('rcCode').textContent, code);
  doc.getElementById('rcOk').click(); doc.getElementById('rcNext').click();
  await until(() => win.localStorage.getItem('xq_auth'));
  assert.equal((await be.call('POST', '/api/login', { username: 'chi_ui', passHash: ph('chi_ui', 'matkhaumoi1') })).user.username, 'chi_ui');
});

test('bạn bè: tìm, kết bạn, lời mời kết bạn hiện huy hiệu; mời đấu tạo phòng; người được mời thấy thông báo', async () => {
  const be = backend();
  const other = await be.call('POST', '/api/register', { username: 'dao_ui', displayName: 'Đào', passHash: ph('dao_ui', 'matkhau123') });
  const { document: doc, window: win } = device(be);
  await registerViaUI(doc, 'duc_ui', 'Đức');
  await until(() => !doc.getElementById('meSigned').hidden);
  doc.querySelector('.zone-btn[data-zone="satruong"]').click();
  doc.querySelector('.st-btn[data-stab="banbe"]').click();
  assert.equal(doc.querySelector('[data-stpanel="banbe"] [data-need-login]').hidden, true);
  await until(() => /Chưa có bạn nào/.test(doc.getElementById('friendList').textContent));
  const box = doc.getElementById('friendSearch');
  box.value = 'dao'; box.dispatchEvent(new win.Event('input'));
  await until(() => doc.querySelector('#friendResults [data-add]'));
  assert.match(doc.getElementById('friendResults').textContent, /Đào/);
  doc.querySelector('#friendResults [data-add]').click();
  await until(() => /Đang chờ đồng ý/.test(doc.getElementById('friendOutgoing').textContent));
  // bên kia đồng ý
  const me = (await be.call('GET', '/api/me', null, win.localStorage.getItem('xq_auth'))).user;
  await be.call('POST', `/api/friends/${me.id}/accept`, null, other.token);
  doc.querySelector('.st-btn[data-stab="phong"]').click();
  doc.querySelector('.st-btn[data-stab="banbe"]').click();
  await until(() => doc.querySelector('#friendList [data-invite]'));
  // mời đấu
  doc.querySelector('#friendList [data-invite]').click();
  assert.match(doc.getElementById('dlgTitle').textContent, /Mời Đào đấu/);
  doc.getElementById('ivSend').click();
  await until(() => !doc.getElementById('olRoom').hidden);
  const inbox = await be.call('GET', '/api/inbox', null, other.token);
  assert.equal(inbox.invites.length, 1);
  assert.equal(inbox.invites[0].rated, true);
  assert.equal(inbox.invites[0].roomCode, win.eval('Online.state.code'));
  assert.deepEqual(JSON.parse(JSON.stringify(win.eval('Online.state.create'))), { color: 'red', rated: true });
  // người được mời (máy khác, đã đăng nhập) thấy thông báo nổi + huy hiệu
  const B = device(be, { xq_auth: other.token, xq_user: JSON.stringify(other.user) });
  await until(() => B.document.querySelector('#noticeStack [data-notice^="inv"]'));
  assert.match(B.document.getElementById('noticeStack').textContent, /Đức mời bạn đấu một ván \(tính Elo\)/);
  assert.equal(B.document.getElementById('zoneBadge').textContent, '1');
  B.document.querySelector('#noticeStack [data-notice^="inv"] [data-i="0"]').click();
  await until(() => B.window.eval('Online.state.code') === inbox.invites[0].roomCode);
});

test('xếp hạng hiện người đủ 5 ván; phiên hết hạn thì báo đăng nhập lại, tiến độ giữ nguyên', async () => {
  const be = backend();
  const { document: doc, window: win } = device(be, { xq_lessons_done: '["x"]' });
  await registerViaUI(doc, 'em_ui', 'Em');
  await until(() => !doc.getElementById('meSigned').hidden);
  doc.querySelector('.zone-btn[data-zone="satruong"]').click();
  doc.querySelector('.st-btn[data-stab="xephang"]').click();
  await until(() => doc.querySelector('#rankList .rank-row'));
  assert.match(doc.getElementById('rankList').textContent, /Chưa xếp hạng · còn 5 ván/);
  doc.querySelector('#rankScope [data-scope="all"]').click();
  await until(() => /Chưa có ai đủ 5 ván/.test(doc.getElementById('rankList').textContent));
  assert.ok(doc.querySelector('#rankList .rank-pin .rank-row.me'), 'dòng của mình được ghim');
  // phiên bị huỷ ở máy chủ
  await be.env.DB.prepare('DELETE FROM sessions').run();
  await until(() => win.eval('Account.state.sync') !== 'syncing');
  await win.eval('Account.sync()');
  await until(() => doc.querySelector('#noticeStack [data-notice="expired"]'));
  assert.equal(win.localStorage.getItem('xq_auth'), null);
  assert.ok(JSON.parse(win.localStorage.getItem('xq_lessons_done')).includes('x'));
  assert.equal(doc.getElementById('meLabel').textContent, 'Đăng nhập');
});

test('không có máy chủ (vd. bản Artifact): nút đăng nhập tắt, có lời giải thích', () => {
  const { document: doc, window: w } = load({ fresh: true, setup(win) { win.claude = { use: () => Promise.resolve(null) }; } });
  OPEN.push(w);
  doc.querySelector('.zone-btn[data-zone="toi"]').click();
  assert.equal(doc.getElementById('meAuthBtns').hidden, true);
  assert.match(doc.getElementById('meNoServer').textContent, /bản web/);
  assert.equal(doc.getElementById('meLabel').textContent, 'Tôi');
});

test('bắt buộc đăng nhập: chưa đăng nhập thì che app; đăng nhập xong mở; đăng xuất che lại; Artifact không che', async () => {
  const be = backend();
  const { document: doc, window: win } = device(be);
  assert.equal(doc.getElementById('authGate').hidden, false);
  assert.ok(doc.body.classList.contains('gated'));
  doc.querySelector('#authGate [data-open-register]').click();
  fill(doc, 'rgUser', 'gate_ui'); fill(doc, 'rgPass', 'matkhau123'); fill(doc, 'rgPass2', 'matkhau123');
  submit(doc);
  await until(() => doc.getElementById('rcCode'));
  doc.getElementById('rcOk').click(); doc.getElementById('rcNext').click();
  await until(() => doc.getElementById('authGate').hidden);
  assert.ok(!doc.body.classList.contains('gated'));
  doc.querySelector('.zone-btn[data-zone="toi"]').click();
  doc.getElementById('meLogout').click(); doc.getElementById('loKeep').click();
  await until(() => !doc.getElementById('authGate').hidden);
  const art = load({ fresh: true, setup(w) { w.claude = { use: () => Promise.resolve(null) }; } });
  OPEN.push(art.window);
  assert.equal(art.document.getElementById('authGate').hidden, true, 'Artifact không kết nối được máy chủ: không bắt đăng nhập');
});
