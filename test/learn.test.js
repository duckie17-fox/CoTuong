// Tính năng học tập: FEN, ôn bài sai, bài hôm nay, gợi ý cấp máy, chơi tiếp từ một thế cờ.
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load');

const DAY = 86400000;

test('FEN: thế xuất phát đúng chuẩn, đọc/ghi khứ hồi trên nhiều thế', () => {
  const { T } = load();
  const { Fen, Engine } = T;
  assert.equal(Fen.toFen(Engine.initialBoard(), 'red'), Fen.START);
  const back = Fen.parse(Fen.START);
  assert.deepEqual(back.board, Engine.initialBoard()); assert.equal(back.turn, 'red');
  for (const p of T.PUZZLES.slice(0, 60)) {
    const r = Fen.parse(Fen.toFen(p.board, p.turn));
    assert.deepEqual(r.board, p.board, p.id); assert.equal(r.turn, p.turn);
  }
  // đọc được ký hiệu E/H thay cho B/N
  assert.deepEqual(Fen.parse('rheakaehr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RHEAKAEHR b').board, Engine.initialBoard());
});

test('FEN: báo lỗi dễ hiểu với thế không hợp lệ', () => {
  const { T: { Fen } } = load();
  assert.throws(() => Fen.parse('abc'), /10 hàng/);
  assert.throws(() => Fen.parse('4k4/9/9/9/9/9/9/9/9/4K4 w'), /đối mặt/);
  assert.throws(() => Fen.parse('3k5/9/9/9/9/2b6/9/9/9/4K4 w'), /Tượng Đen không thể qua sông/);
  assert.doesNotThrow(() => Fen.parse('3k5/9/9/9/2b6/9/9/9/9/4K4 w'), 'Tượng ở bờ sông nhà là hợp lệ');
  assert.throws(() => Fen.parse('3k5/9/9/9/9/9/9/9/9/9 w'), /một Tướng/);
  assert.throws(() => Fen.parse('3k5/9/9/9/9/9/9/9/9/3RK4 b'.replace('b', 'w')), /không tới lượt đang bị chiếu/);
  assert.throws(() => Fen.parse('3k5/9/9/9/9/9/9/9/9/4X4 w'), /Ký tự lạ/);
});

test('ôn bài sai: sai thì vào danh sách ôn, đúng thì giãn dần, đúng ngay từ đầu thì không cần ôn', () => {
  const { T: { Learn } } = load({ fresh: true });
  const t0 = Date.UTC(2026, 0, 10, 12);
  Learn.record('a', 'fail', t0);
  Learn.record('b', 'ok', t0);
  assert.deepEqual([...Learn.due(t0)], ['a']);
  Learn.record('a', 'ok', t0 + 1000);           // lên hộp 1 → ôn lại sau 1 ngày
  assert.deepEqual([...Learn.due(t0 + 2000)], []);
  assert.deepEqual([...Learn.due(t0 + DAY + 2000)], ['a']);
  Learn.record('a', 'ok', t0 + DAY + 3000);      // hộp 2 → 3 ngày
  assert.deepEqual([...Learn.due(t0 + 2 * DAY)], []);
  assert.deepEqual([...Learn.due(t0 + 5 * DAY)], ['a']);
  Learn.record('a', 'help', t0 + 5 * DAY);       // dùng gợi ý: không lên hộp
  Learn.record('a', 'fail', t0 + 6 * DAY);       // sai lại: về hộp 0
  assert.deepEqual([...Learn.due(t0 + 6 * DAY)], ['a']);
});

test('bài hôm nay: cố định trong ngày; chuỗi ngày tăng khi làm liên tiếp, đứt khi bỏ một ngày', () => {
  const { T: { Learn } } = load({ fresh: true });
  const d1 = Date.UTC(2026, 2, 1, 9), d2 = d1 + DAY, d4 = d1 + 3 * DAY;
  const p1 = Learn.dailyPuzzle(d1);
  assert.equal(Learn.dailyPuzzle(d1).id, p1.id);
  assert.notEqual(p1.topic, 'satcuc');
  assert.equal(Learn.markDailyDone(p1.id, d1).streak, 1);
  const p2 = Learn.dailyPuzzle(d2);
  assert.equal(Learn.markDailyDone(p2.id, d2).streak, 2);
  assert.equal(Learn.streak(d2), 2);
  assert.equal(Learn.streak(d4), 0, 'bỏ một ngày thì chuỗi đứt');
  const p4 = Learn.dailyPuzzle(d4);
  assert.equal(Learn.markDailyDone(p4.id, d4).streak, 1);
});

test('gợi ý cấp máy theo các ván gần đây', () => {
  const { T: { suggestAiLevel } } = load();
  const g = (level, w) => ({ level, ladder: 2, human: 'red', result: { winner: w } });
  assert.equal(suggestAiLevel([g(3, 'red'), g(3, 'red')]).level, 4);
  assert.equal(suggestAiLevel([g(3, 'black'), g(3, 'black'), g(3, 'black')]).level, 2);
  assert.equal(suggestAiLevel([g(3, 'red'), g(3, 'black')]), null);
  assert.equal(suggestAiLevel([g(10, 'red'), g(10, 'red')]), null, 'cấp cao nhất thì không gợi ý lên');
  // ván cũ (thang 6 cấp, không có ladder): cấp 3 cũ tương ứng cấp 6 mới
  assert.equal(suggestAiLevel([{ level: 3, human: 'red', result: { winner: 'red' } }, { level: 3, human: 'red', result: { winner: 'red' } }]).level, 7);
  assert.equal(suggestAiLevel([Object.assign(g(3, 'red'), { start: {} }), g(3, 'red')]), null, 'ván từ thế cho trước không tính');
});

test('giao diện: xem đáp án → bài vào mục "Cần ôn"; chơi tiếp với máy từ bài tập', async () => {
  const { document, window, T } = load({ fresh: true });
  document.querySelector('.tab-btn[data-tab="baitap"]').click();
  const id = document.querySelector('#puzzleGrid .puzzle-card').dataset.id;
  document.querySelector(`#puzzleGrid .puzzle-card[data-id="${id}"]`).click();
  document.querySelector('#puzzleAnswerBtn').click();
  assert.deepEqual([...T.Learn.due()], [id]);
  document.querySelector('#puzzleBackBtn').click();
  const chip = document.querySelector('#puzzleFilters .chip[data-v="review"]');
  assert.ok(chip, 'thiếu chip Cần ôn'); chip.click();
  assert.deepEqual([...document.querySelectorAll('#puzzleGrid .puzzle-card')].map(c => c.dataset.id), [id]);
  // chơi tiếp từ thế của bài
  document.querySelector(`#puzzleGrid .puzzle-card[data-id="${id}"]`).click();
  document.querySelector('#puzzlePlayBtn').click();
  assert.equal(document.querySelector('section[data-panel="may"]').hidden, false);
  assert.equal(document.querySelector('#aiGameCard').hidden, false);
  const p = T.PUZZLES.find(x => x.id === id);
  const fen = T.Fen.toFen(p.board, p.turn);
  document.querySelector('#aiFenBtn').click();
  await new Promise(r => setTimeout(r, 20));
  assert.ok(document.querySelector('#aiStatus').textContent.includes(fen.split(' ')[0]), 'FEN ván không khớp thế bài tập');
  const hist = JSON.parse(window.localStorage.getItem('xq_ai_history') || '[]');
  assert.equal(hist.length, 0, 'chưa đi nước nào thì chưa lưu');
});

test('giao diện: bắt đầu ván từ FEN; FEN sai thì báo lỗi', () => {
  const { document } = load({ fresh: true });
  document.querySelector('.tab-btn[data-tab="may"]').click();
  document.querySelector('#fenInput').value = '4k4/9/9/9/9/9/9/9/9/4K4 w';
  document.querySelector('#fenStartBtn').click();
  assert.match(document.querySelector('#fenMsg').textContent, /đối mặt/);
  document.querySelector('#fenInput').value = '3k5/9/9/9/9/9/9/9/4R4/4K4 w';
  document.querySelector('#fenStartBtn').click();
  assert.equal(document.querySelector('#aiGameCard').hidden, false);
  assert.equal(document.querySelectorAll('#aiBoard .xq-piece').length, 3);
});

test('bảng tiến độ hiển thị ở tab Học luật', () => {
  const { document } = load({ fresh: true, storage: { xq_puzzles_solved: '["chariot-mate"]' } });
  document.querySelector('.tab-btn[data-tab="hoc"]').click();
  const txt = document.querySelector('#progressDash').textContent;
  assert.match(txt, /bài tập đã giải/);
  assert.match(txt, /1\/\d+/);
});

test('cấp đã lưu theo thang 6 cấp cũ được chuyển sang thang 10 cấp', () => {
  const { T, window } = load({ fresh: true, storage: { xq_ai_level: '3' } });
  assert.equal(T.AI_LEVELS.length, 10);
  assert.equal(T.savedAiLevel(), 6);
  assert.equal(window.localStorage.getItem('xq_ai_ladder'), '2');
  assert.equal(T.savedAiLevel(), 6, 'không chuyển đổi lần thứ hai');
  assert.ok(T.AI_LEVELS.every(l => typeof l.desc === 'string' && l.desc.length > 10));
});
