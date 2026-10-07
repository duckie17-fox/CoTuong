// Kiểm tra bài bắt quân / phòng thủ: kết quả không đổi so với bản tham chiếu, và đủ nhanh
// để chạy trên luồng chính mỗi lần người học đi thử một nước.
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load');

const { T } = load();
const { Engine, Solver } = T;
const tactical = T.PUZZLES.filter(p => ['capture', 'fork', 'defend'].includes(p.type));

test('materialSearch nhanh cho cùng kết quả với bản tham chiếu', () => {
  const sample = tactical.filter((_, i) => i % 3 === 0);
  for (const p of sample) {
    const opp = Engine.otherColor(p.turn), after = Engine.applyMove(p.board, p.solution);
    for (const d of [1, 2]) assert.equal(Solver.materialSearch(after, opp, d), Solver.materialSearchRef(after, opp, d), `${p.id} độ sâu ${d}`);
  }
  for (const p of sample.slice(0, 6)) {
    const opp = Engine.otherColor(p.turn), after = Engine.applyMove(p.board, p.solution);
    assert.equal(Solver.materialSearch(after, opp, 3), Solver.materialSearchRef(after, opp, 3), `${p.id} độ sâu 3`);
  }
});

test('kiểm tra một nước thử trong bài bắt quân: chậm nhất < 150ms', () => {
  let worst = 0, worstId = '';
  for (const p of tactical) {
    const legal = Engine.generateLegalMoves(p.board, p.turn).slice(0, 4).concat([p.solution]);
    for (const m of legal) {
      const t = process.hrtime.bigint();
      Solver.materialSearch(Engine.applyMove(p.board, m), Engine.otherColor(p.turn), 3);
      const ms = Number(process.hrtime.bigint() - t) / 1e6;
      if (ms > worst) { worst = ms; worstId = p.id; }
    }
  }
  assert.ok(worst < 150, `chậm nhất ${worst.toFixed(0)}ms (${worstId})`);
});
