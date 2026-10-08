// Phân tích ván: đi qua các lỗi theo thứ tự ván (tổng quan → lỗi 1 → … → tổng kết),
// lời giải thích có mục đích và cách nghĩ. Dùng một ván đã phân tích sẵn (fixtures) để chạy nhanh.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { load } = require('./helpers/load');

const HIST = fs.readFileSync(path.join(__dirname, 'fixtures', 'review-game.json'), 'utf8');
const txt = el => el.textContent.replace(/\s+/g, ' ').trim();

function open() {
  const r = load({ fresh: true, storage: { xq_ai_history: HIST } });
  r.window.eval('showTab("may"); openReview(loadHistory()[0]);');
  const errs = () => [...r.window.eval('reviewErrors()')].map(p => p.k);
  return { ...r, errs, step: () => txt(r.document.querySelector('#reviewStep')), det: () => r.document.querySelector('#reviewDetail') };
}

test('mở phân tích ở trang tổng quan (không nhảy tới lỗi lớn nhất)', () => {
  const { document, errs, step, det } = open();
  assert.match(step(), /^Tổng quan/);
  const items = [...det().querySelectorAll('.tl-item')].map(b => +b.dataset.k);
  assert.ok(items.length >= 5);
  assert.deepEqual(items, errs());
  assert.deepEqual(items, [...items].sort((a, b) => a - b), 'dòng thời gian phải theo thứ tự ván');
  assert.ok(det().querySelector('.tl-star'), 'thiếu đánh dấu bước ngoặt');
  assert.match(document.querySelector('#reviewNextMistake').textContent, /Bắt đầu/);
});

test('đi qua từng lỗi theo thứ tự rồi tới tổng kết; lùi lại được tới tổng quan', () => {
  const { document, errs, step, window } = open();
  const list = errs(), next = () => document.querySelector('#reviewNextMistake').click();
  for (let i = 0; i < list.length; i++) {
    next();
    assert.equal(window.eval('review.idx'), list[i]);
    assert.match(step(), new RegExp(`^Lỗi ${i + 1}/${list.length}`));
  }
  next();
  assert.match(step(), /^Tổng kết/);
  assert.equal(document.querySelector('#reviewNextMistake').disabled, true, 'không quay vòng về lỗi đầu');
  for (let i = list.length - 1; i >= 0; i--) {
    document.querySelector('#reviewPrevMistake').click();
    assert.equal(window.eval('review.idx'), list[i]);
  }
  document.querySelector('#reviewPrevMistake').click();
  assert.match(step(), /^Tổng quan/);
});

test('mỗi lỗi có đoạn nối, lý do, mục đích và cách nghĩ của nước nên đi', () => {
  const { document, errs, det } = open();
  for (let i = 0; i < Math.min(6, errs().length); i++) {
    document.querySelector('#reviewNextMistake').click();
    const t = txt(det());
    assert.match(t, /Từ đầu ván|Kể từ lỗi trước/, 'thiếu đoạn nối');
    assert.match(t, /Vì sao chưa tốt/);
    assert.match(t, /Thế cờ: trước nước này .+ → sau nước này/);
    assert.match(t, /Mục đích:/);
    assert.match(t, /Cách nghĩ:/);
    assert.doesNotMatch(t, /undefined|NaN/);
  }
});

test('lọc "chỉ sai lầm lớn" bỏ các nước không chính xác', () => {
  const { window, errs, det } = open();
  const all = errs().length;
  const box = det().querySelector('#rvOnlyBig');
  box.checked = true; box.dispatchEvent(new window.Event('change'));
  const big = errs().length;
  assert.ok(big < all && big > 0, `${big} / ${all}`);
  assert.equal(window.localStorage.getItem('xq_review_big'), '1');
});

test('Coach.intent: ăn quân miễn phí, chiếu bí, cứu quân đều có mục đích và cách nghĩ', () => {
  const { T } = load();
  const { Coach, PUZZLES } = T;
  const mate = PUZZLES.find(p => p.type === 'mate');
  assert.equal(Coach.intent(mate.board, mate.solution)[0].key, 'mate');
  const cap = PUZZLES.find(p => p.id === 'free-horse');
  const it = Coach.intent(cap.board, cap.solution)[0];
  assert.equal(it.key, 'capture-free');
  assert.match(it.goal, /Pháo Đen cột/);
  assert.ok(it.think.length > 20);
});
