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
  const items = [...det().querySelectorAll('.tl-phase .tl-item')].map(b => +b.dataset.k);
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
    assert.match(t, /Vì sao chưa tốt|Bỏ lỡ cơ hội gì/);
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

test('xếp hạng nước theo cơ hội thắng: !!, !, (không dấu), ?!, ?, ??', () => {
  const { window } = load();
  const c = o => window.eval(`classifyPly(${JSON.stringify(o)})`);
  const base = { inBook: false, sameAsBest: false, second: null };
  assert.equal(c({ ...base, inBook: true, best: 0, played: -900 }), 'book');
  assert.equal(c({ ...base, sameAsBest: true, best: 50, played: 50 }), 'best');
  assert.equal(c({ ...base, best: 50, played: 20 }), 'good');
  assert.equal(c({ ...base, best: 0, played: -80 }), 'inacc');
  assert.equal(c({ ...base, best: 0, played: -160 }), 'mistake');
  assert.equal(c({ ...base, best: 0, played: -300 }), 'blunder', 'thế cân bằng mà mất một Mã là sai lầm nghiêm trọng');
  // đang thắng đậm, bỏ lỡ chiếu bí nhưng vẫn hơn hẳn → chỉ "?!", không phải "??"
  assert.equal(c({ ...base, best: 29990, played: 900 }), 'inacc');
  // đang thắng đậm rồi đánh rơi hết → vẫn là "??"
  assert.equal(c({ ...base, best: 900, played: -100 }), 'blunder');
  // nước duy nhất: nước thứ hai kém hẳn
  assert.equal(c({ ...base, sameAsBest: true, best: 0, played: 0, second: -400 }), 'great');
  assert.equal(c({ ...base, sameAsBest: true, best: 0, played: 0, second: -400, sacrifice: true }), 'brilliant');
  assert.equal(c({ ...base, sameAsBest: true, best: 0, played: 0, second: -400, recapture: true }), 'best', 'ăn lại quân không tính là nước hay');
  assert.equal(c({ ...base, sameAsBest: true, best: 0, played: 0, second: -400, forced: true }), 'best', 'nước bắt buộc không tính là nước hay');
});

test('bảng ký hiệu, nước tốt có gợi ý tối ưu hơn, phân tích phong cách', () => {
  const { document, window, det } = open();
  const sum = document.querySelector('#reviewSummary');
  const legend = txt(sum.querySelector('.cls-legend'));
  for (const s of ['!!', '?!', '??', 'Sai lầm nặng', 'không có dấu', 'nước duy nhất', 'thí quân', 'cơ hội thắng']) assert.ok(legend.includes(s), s);
  // nước "tốt" khác nước máy chọn → có mục "Nước tối ưu hơn" với mục đích
  const good = [...window.eval('review.an.plies')].find(p => p.color === window.eval('review.rec.human') && p.cls === 'good' && p.bestMove);
  assert.ok(good, 'ván mẫu cần có nước "tốt"');
  assert.ok(det().querySelector(`.better-list .tl-item[data-k="${good.k}"]`), 'tổng quan thiếu danh sách nước tốt còn tối ưu hơn');
  window.eval(`reviewGo(${good.k})`);
  const t = txt(det());
  assert.match(t, /Nước tối ưu hơn/);
  assert.match(t, /Mục đích:/);
  assert.ok(document.querySelector('#rvShowBest'), 'thiếu nút xem nước tốt hơn');
  // phong cách + đề xuất thế khai cuộc mở được
  const st = txt(sum.querySelector('.style-box'));
  assert.match(st, /Phong cách của bạn/);
  assert.match(st, /Tấn công|Cân bằng|Chắc chắn/);
  assert.match(st, /Đề xuất cho bạn/);
  assert.doesNotMatch(st, /undefined|NaN/);
  assert.doesNotMatch(txt(sum.querySelector('.cls-chips')) + legend, /[★✓✗📖]/, 'chỉ dùng 5 ký hiệu !! ! ?! ? ??');
  const op = sum.querySelector('[data-op]');
  op.click();
  assert.equal(document.querySelector('#openingDetailCard').hidden, false);
});
