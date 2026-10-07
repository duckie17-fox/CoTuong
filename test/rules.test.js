// Luật chiếu mãi: máy phải hiểu đúng như Game (bên chiếu mãi thua), không coi là hoà.
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load');

const { T } = load();
const { Engine, Game, XQSearch } = T;
const B = p => { const b = Array.from({ length: 10 }, () => Array(9).fill(null)); for (const [r, c, t, col] of p) b[r][c] = { type: t, color: col }; return b; };
const mv = (a, b, c, d) => ({ from: [a, b], to: [c, d] });
const same = (x, y) => x.from + '' === y.from + '' && x.to + '' === y.to + '';

// Tướng Đen bị nhốt giữa (0,3) và (1,3); Xe Đỏ chiếu luân phiên từ (0,0) và (1,0).
const S0 = B([[1, 3, 'G', 'black'], [1, 4, 'A', 'black'], [2, 3, 'A', 'black'], [0, 0, 'R', 'red'], [9, 5, 'G', 'red']]);
const CYCLE = [mv(0, 0, 1, 0), mv(1, 3, 0, 3), mv(1, 0, 0, 0), mv(0, 3, 1, 3)];

test('Game: Đỏ chiếu mãi tới lần lặp thứ 3 thì Đỏ thua', () => {
  const g = Game.create(S0, 'red');
  for (let i = 0; i < 8 && !g.result; i++) g.play(CYCLE[i % 4]);
  assert.deepEqual([g.result.winner, g.result.reason], ['black', 'perpetual-check']);
});

test('XQSearch: nước tiếp tục chiếu mãi bị chấm là thua, không phải hoà', () => {
  const g = Game.create(S0, 'red');
  for (const m of CYCLE) g.play(m); // về lại S0 lần thứ 2, Đỏ đi
  const args = T.aiThinkArgs(g, { timeMs: 800, rootScores: true });
  const r = XQSearch.think(Object.assign({}, args, { excludeMoves: [] }));
  const rep = r.rootScores.find(s => same(s.move, CYCLE[0]));
  assert.ok(rep, 'thiếu điểm của nước lặp');
  assert.ok(rep.score <= -XQSearch.RULE_WIN / 2, `điểm nước chiếu mãi = ${rep.score}`);
  assert.ok(!same(r.move, CYCLE[0]), 'máy vẫn chọn nước chiếu mãi');
});

test('Bộ lọc gốc: loại nước mà chính nó tạo lần lặp thứ 3 bị xử thua', () => {
  // Bắt đầu ngay sau nước chiếu thứ 2 (Đen đi) để lần lặp thứ 3 rơi vào nước của Đỏ
  let start = Engine.cloneBoard(S0);
  for (const m of CYCLE.slice(0, 3)) start = Engine.applyMove(start, m);
  const g = Game.create(start, 'black');
  const seq = [CYCLE[3], CYCLE[0], CYCLE[1], CYCLE[2], CYCLE[3], CYCLE[0], CYCLE[1]];
  for (const m of seq) g.play(m);
  assert.equal(g.result, null);
  const losing = T.ruleLosingMoves(g);
  assert.ok(losing.some(m => same(m, CYCLE[2])), 'không phát hiện nước bị xử thua');
  const r = XQSearch.think(T.aiThinkArgs(g, { timeMs: 500 }));
  assert.ok(!same(r.move, CYCLE[2]));
  g.play(r.move);
  assert.ok(!g.result || g.result.winner !== 'black', 'Đỏ vẫn bị xử thua: ' + JSON.stringify(g.result));
});
