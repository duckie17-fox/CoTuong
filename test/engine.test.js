const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load');

const { T } = load();
const { Engine, XQSearch } = T;
const key = m => m.from + '>' + m.to;

test('perft từ thế xuất phát khớp số chuẩn (44 / 1920 / 79666)', () => {
  const start = Engine.initialBoard();
  assert.equal(XQSearch.perft(start, 'red', 1), 44);
  assert.equal(XQSearch.perft(start, 'red', 2), 1920);
  assert.equal(XQSearch.perft(start, 'red', 3), 79666);
});

test('XQSearch và Engine sinh cùng tập nước hợp lệ trên các thế ngẫu nhiên', () => {
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let game = 0; game < 30; game++) {
    let b = Engine.initialBoard(), turn = 'red';
    for (let ply = 0; ply < 80; ply++) {
      const a = Engine.generateLegalMoves(b, turn).map(key).sort();
      const x = XQSearch.legalMoves(b, turn).map(key).sort();
      assert.deepEqual(x, a, `ván ${game} nửa nước ${ply}`);
      if (!a.length) break;
      const mv = Engine.generateLegalMoves(b, turn)[Math.floor(rnd() * a.length)];
      b = Engine.applyMove(b, mv); turn = Engine.otherColor(turn);
    }
  }
});

test('máy tìm được chiếu bí 1 nước', () => {
  const p = T.PUZZLES.find(p => p.type === 'mate');
  const r = XQSearch.think({ board: p.board, turn: p.turn, timeMs: 500 });
  const after = Engine.applyMove(p.board, r.move);
  assert.equal(Engine.gameStatus(after, Engine.otherColor(p.turn)), 'checkmate');
});
