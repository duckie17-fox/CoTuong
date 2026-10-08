// Sa trường: logic phòng đấu trên server (trọng tài) — dùng đúng luật ván của ứng dụng.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadRoomCore } = require('../tools/build-server');
const { RoomCore } = loadRoomCore();

const A = 'a'.repeat(20), B = 'b'.repeat(20), C = 'c'.repeat(20);
function setup(color = 'red') {
  const r = new RoomCore.Room(null), a = {}, b = {};
  assert.deepEqual({ ...r.join({ name: 'An', token: A, create: { color } }, a, 'ABC123') }, { changed: true });
  r.join({ name: 'Bình', token: B }, b);
  return { r, a, b };
}
const mv = (r, c, from, to) => r.handle({ type: 'move', from, to, n: r.st.moves.length }, c);

test('tạo phòng, vào phòng, người thứ ba vào xem; phòng không tồn tại bị từ chối', () => {
  const { r } = setup('black');
  assert.equal(r.seatOf(A), 'black');
  assert.equal(r.seatOf(B), 'red');
  const c = {};
  r.join({ name: 'Xem', token: C }, c);
  assert.equal(r.seatOf(C), null);
  const v = r.view(c, { red: true, black: false });
  assert.equal(v.you, 'spectator');
  assert.ok(!JSON.stringify(v).includes(A) && !JSON.stringify(v).includes(B), 'không được lộ token');
  assert.deepEqual({ ...new RoomCore.Room(null).join({ name: 'x', token: C }, {}, 'NOPE') }, { error: 'not_found', close: true });
  assert.equal(r.join({ name: 'x', token: C, create: { color: 'red' } }, {}, 'ABC123').error, 'exists');
});

test('chỉ nhận nước hợp lệ, đúng lượt, đúng số thứ tự; người xem không đi được', () => {
  const { r, a, b } = setup();
  assert.equal(mv(r, b, [3, 0], [4, 0]).error, 'not_your_turn');
  assert.equal(mv(r, a, [9, 0], [5, 0]).error, 'illegal');
  assert.equal(r.handle({ type: 'move', from: [7, 1], to: [7, 4], n: 5 }, a).error, 'stale');
  assert.equal(r.handle({ type: 'move', from: [7, 1], to: [17, 4], n: 0 }, a).error, 'bad_move');
  assert.ok(mv(r, a, [7, 1], [7, 4]).changed);
  assert.equal(mv(r, {token: C}, [2, 1], [2, 4]).error, 'spectator');
  assert.equal(JSON.stringify(r.st.moves), '[[7,1,7,4]]');
});

test('xin đi lại: bỏ đúng nước của người xin (1 hoặc 2 nửa nước)', () => {
  const { r, a, b } = setup();
  mv(r, a, [7, 1], [7, 4]);
  r.handle({ type: 'offer', kind: 'takeback' }, a);
  r.handle({ type: 'reply', accept: true }, b);
  assert.equal(r.st.moves.length, 0);
  mv(r, a, [7, 1], [7, 4]); mv(r, b, [0, 1], [2, 2]);
  r.handle({ type: 'offer', kind: 'takeback' }, a);        // đã tới lượt An: lùi 2
  assert.equal(r.st.offer.n, 2);
  r.handle({ type: 'reply', accept: true }, b);
  assert.equal(r.st.moves.length, 0);
  assert.equal(r.handle({ type: 'offer', kind: 'takeback' }, b).error, 'nothing_to_take_back');
});

test('đi một nước thì đề nghị cũ (hoà/đi lại) hết hiệu lực; từ chối được', () => {
  const { r, a, b } = setup();
  r.handle({ type: 'offer', kind: 'draw' }, a);
  assert.equal(r.handle({ type: 'reply', accept: true }, a).error, 'no_offer', 'không tự nhận đề nghị của mình');
  mv(r, a, [7, 1], [7, 4]);
  assert.equal(r.st.offer, null);
  r.handle({ type: 'offer', kind: 'draw' }, b);
  r.handle({ type: 'reply', accept: false }, a);
  assert.equal(r.st.result, null);
  r.handle({ type: 'offer', kind: 'draw' }, b);
  r.handle({ type: 'reply', accept: true }, a);
  assert.deepEqual({ ...r.st.result }, { winner: null, reason: 'agreed' });
  assert.equal(mv(r, b, [0, 1], [2, 2]).error, 'game_over');
});

test('đầu hàng, tái đấu đổi màu, lưu lịch sử ván', () => {
  const { r, a, b } = setup();
  mv(r, a, [7, 1], [7, 4]);
  r.handle({ type: 'resign' }, b);
  assert.deepEqual({ ...r.st.result }, { winner: 'red', reason: 'resign' });
  r.handle({ type: 'offer', kind: 'rematch' }, b);
  r.handle({ type: 'reply', accept: true }, a);
  assert.equal(r.st.game, 2);
  assert.equal(r.seatOf(A), 'black');
  assert.equal(r.seatOf(B), 'red');
  assert.equal(r.st.moves.length, 0);
  assert.equal(r.st.history.length, 1);
});

test('tải lại trạng thái đã lưu (server ngủ rồi thức dậy) vẫn đúng ván, đúng lượt', () => {
  const { r, a, b } = setup();
  const line = [[[7, 1], [7, 4]], [[0, 1], [2, 2]], [[7, 4], [3, 4]], [[0, 7], [2, 6]]];
  line.forEach(([f, t], i) => assert.ok(mv(r, i % 2 ? b : a, f, t).changed, `nước ${i}`));
  const saved = JSON.parse(JSON.stringify(r.st));
  const r2 = new RoomCore.Room(saved);
  assert.equal(r2.g.moves.length, 4);
  assert.equal(r2.g.turn(), 'red');
  assert.ok(r2.handle({ type: 'move', from: [9, 1], to: [7, 2], n: 4 }, a).changed);
});

test('chat: cắt độ dài, bỏ ký tự điều khiển, giữ tối đa 60 tin', () => {
  const { r, a } = setup();
  r.handle({ type: 'chat', text: 'x'.repeat(500) }, a);
  assert.equal(r.st.chat.at(-1).text.length, RoomCore.TEXT_MAX);
  assert.equal(r.handle({ type: 'chat', text: '   ' }, a).error, 'empty');
  for (let i = 0; i < 80; i++) r.handle({ type: 'chat', text: 'm' + i }, a);
  assert.equal(r.st.chat.length, 60);
  r.join({ name: '<script>' + 'n'.repeat(40), token: A }, a);
  assert.ok(!r.st.seats.red.name.includes('<') && r.st.seats.red.name.length <= RoomCore.NAME_MAX);
});
