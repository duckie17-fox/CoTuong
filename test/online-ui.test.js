// Sa trường (giao diện): chia hai khu, sảnh khi chưa có server, đọc mã phòng / link mời,
// ván online mở được trong Phân tích ván.
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load');

test('hai khu Kỳ viện / Sa trường: chuyển qua lại, nhớ khu đang mở', () => {
  const { window, document } = load({ fresh: true });
  const sa = () => document.querySelector('section[data-zone-panel="satruong"]');
  assert.equal(sa().hidden, true);
  document.querySelector('.zone-btn[data-zone="satruong"]').click();
  assert.equal(sa().hidden, false);
  assert.equal(document.querySelector('.tabs').hidden, true);
  assert.ok([...document.querySelectorAll('section[data-panel]')].every(s => s.hidden), 'các phần Kỳ viện phải ẩn');
  assert.equal(window.localStorage.getItem('xq_zone'), 'satruong');
  // mở một tab Kỳ viện (vd. từ nút phân tích) thì tự về Kỳ viện
  window.eval('showTab("baitap")');
  assert.equal(sa().hidden, true);
  assert.equal(document.querySelector('.tabs').hidden, false);
  assert.equal(document.querySelector('.zone-btn[data-zone="kyvien"]').getAttribute('aria-pressed'), 'true');
});

test('mở lại trang: vào thẳng Sa trường nếu lần trước đang ở đó', () => {
  const { document } = load({ fresh: true, storage: { xq_zone: 'satruong' } });
  assert.equal(document.querySelector('section[data-zone-panel="satruong"]').hidden, false);
});

test('server mặc định (src/online.json) đã gắn vào bản build: không báo lỗi, nút tạo phòng bật', () => {
  const cfg = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'online.json'), 'utf8'));
  const { document, window } = load({ fresh: true, storage: { xq_zone: 'satruong' } });
  if (cfg.server) {
    assert.equal(document.querySelector('#olNotice').textContent, '');
    assert.equal(document.querySelector('#olCreate').disabled, false);
    assert.match(window.eval('Online.inviteLink("AB12CD")'), /\?room=AB12CD$/, 'link mời không cần kèm server mặc định');
  } else {
    assert.match(document.querySelector('#olNotice').textContent, /Chưa cấu hình server/);
    assert.equal(document.querySelector('#olCreate').disabled, true);
  }
});

test('đọc mã phòng từ mã trần hoặc link mời; địa chỉ server', () => {
  const { window } = load({ fresh: true });
  const O = window.Online ?? window.eval('Online');
  assert.equal(O.parseCode(' k7m2qx '), 'K7M2QX');
  assert.equal(O.parseCode('https://duckie17-fox.github.io/CoTuong/?room=AB12CD&server=x'), 'AB12CD');
  assert.equal(O.parseCode('ab'), null);
  assert.equal(O.normServer('https://cotuong-online.abc.workers.dev/'), 'wss://cotuong-online.abc.workers.dev');
  assert.equal(O.normServer('ftp://x'), '');
  window.localStorage.setItem('xq_online_server', 'wss://srv.test');
  assert.match(O.inviteLink('AB12CD'), /^https:\/\/example\.test\/\?room=AB12CD&server=wss%3A%2F%2Fsrv\.test$/);
});

test('ván online đã lưu: hiện trong sảnh, mở Phân tích ván với tên đối thủ', () => {
  const rec = { id: 'ol-AB12CD-1', online: true, code: 'AB12CD', game: 1, human: 'red', oppName: 'Bình', date: Date.now(),
    moves: [[7, 1, 7, 4], [0, 1, 2, 2]], result: { winner: 'red', reason: 'resign' } };
  const { window, document } = load({ fresh: true, storage: { xq_zone: 'satruong', xq_online_history: JSON.stringify([rec]) } });
  assert.match(document.querySelector('#olHistory').textContent, /Thắng.*với Bình/);
  document.querySelector('[data-review="ol-AB12CD-1"]').click();
  assert.equal(document.querySelector('#aiReviewCard').hidden, false);
  assert.match(document.querySelector('#reviewHead').textContent, /Đấu với Bình/);
  window.eval('review.token++');
  document.querySelector('#reviewBack').click();
  assert.equal(document.querySelector('section[data-zone-panel="satruong"]').hidden, false);
});

test('server không kết nối được: thử vài lần rồi dừng, báo rõ thay vì quay vòng mãi', async () => {
  const { window, document } = load({ fresh: true, storage: { xq_zone: 'satruong', xq_online_name: 'An', xq_online_server: 'ws://127.0.0.1:9' } });
  // WebSocket giả: luôn đóng ngay, chưa từng mở
  window.WebSocket = class { constructor() { setTimeout(() => this.onclose && this.onclose({ code: 1006 }), 0); } send() {} close() {} };
  window.eval('Online.state.retry=2');   // như thể đã thử lại 2 lần mà chưa lần nào mở được
  document.querySelector('#olCreate').click();
  await new Promise(r => setTimeout(r, 300));
  assert.equal(window.eval('Online.state.conn'), 'blocked');
  assert.match(document.querySelector('#olStatus').textContent, /Không kết nối được server/);
});
