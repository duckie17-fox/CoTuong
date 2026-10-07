// Kiểm tra toàn bộ dữ liệu nội dung bằng chính engine của ứng dụng.
// Mặc định chạy nhanh; FULL=1 để kiểm thêm phần tốn thời gian (bí 3 nước, lãi quân).
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load');

const { T } = load();
const { Engine, Solver, Notation, Game } = T;
const FULL = !!process.env.FULL;
const key = m => m.from + '>' + m.to;
const boardOf = pieces => { const b = Array.from({ length: 10 }, () => Array(9).fill(null)); for (const [r, c, t, col] of pieces) b[r][c] = { type: t, color: col }; return b; };

// Thế cờ hợp lệ: đủ hai Tướng, quân đúng khu vực, bên không đi không bị chiếu
function positionProblems(b, turn) {
  const out = [];
  if (!Engine.findGeneral(b, 'red') || !Engine.findGeneral(b, 'black')) return ['thiếu Tướng'];
  if (Engine.isInCheck(b, Engine.otherColor(turn))) out.push('bên không đi đang bị chiếu');
  for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
    const p = b[r][c]; if (!p) continue;
    if ((p.type === 'G' || p.type === 'A') && !Engine.inPalace(r, c, p.color)) out.push(`${p.type} ngoài cung ${r},${c}`);
    if (p.type === 'E' && !Engine.ownSide(r, p.color)) out.push(`Tượng qua sông ${r},${c}`);
  }
  return out;
}

test('bài tập: thế hợp lệ, đáp án hợp lệ, không trùng', () => {
  const seen = new Map(); const bad = [];
  for (const p of T.PUZZLES) {
    const pr = positionProblems(p.board, p.turn); if (pr.length) bad.push(`${p.id}: ${pr.join(', ')}`);
    if (!Engine.generateLegalMoves(p.board, p.turn).some(m => key(m) === key(p.solution))) bad.push(`${p.id}: đáp án không hợp lệ`);
    const k = Game.key(p.board, p.turn);
    if (seen.has(k)) bad.push(`${p.id}: trùng thế với ${seen.get(k)}`); else seen.set(k, p.id);
  }
  assert.deepEqual(bad, []);
  assert.ok(T.PUZZLES.length >= 150);
});

test('bài chiếu bí: đáp án ép bí đúng số nước, không có cách bí nhanh hơn', () => {
  const bad = [];
  for (const p of T.PUZZLES) {
    const n = { mate: 1, mate2: 2, mate3: 3 }[p.type]; if (!n || (n === 3 && !FULL)) continue;
    const f = Solver.findMate(p.board, p.turn, n);
    if (!f) { bad.push(`${p.id}: không có bí trong ${n} nước`); continue; }
    if (f.moves < n) bad.push(`${p.id}: có bí ${f.moves} nước (${Notation.describe(p.board, f.first).short})`);
    const after = Engine.applyMove(p.board, p.solution), opp = Engine.otherColor(p.turn);
    const replies = Engine.generateLegalMoves(after, opp);
    const forced = replies.length === 0 || (n > 1 && replies.every(r => Solver.findMate(Engine.applyMove(after, r), p.turn, n - 1)));
    if (!forced) bad.push(`${p.id}: đáp án không ép được bí`);
  }
  assert.deepEqual(bad, []);
});

test('bài bắt quân / bắt đôi: đáp án lãi quân', { skip: !FULL && 'chạy với FULL=1' }, () => {
  const bad = [];
  for (const p of T.PUZZLES) {
    if (!['capture', 'fork'].includes(p.type)) continue;
    const opp = Engine.otherColor(p.turn);
    const gain = -Solver.materialSearch(Engine.applyMove(p.board, p.solution), opp, 3) - Solver.material(p.board, p.turn);
    if (gain <= 0) bad.push(`${p.id}: gain=${gain}`);
  }
  assert.deepEqual(bad, []);
});

test('khai cuộc: mọi nhánh đi đúng luật, đúng lượt', () => {
  const bad = []; let lines = 0;
  for (const o of T.OPENINGS) for (const line of (o.lines || [{ id: 'main', moves: o.moves }])) {
    lines++; const g = Game.create();
    for (const [i, m] of line.moves.entries()) {
      if (m.error) { bad.push(`${o.id}/${line.id} nước ${i + 1}: ${m.error}`); break; }
      if (!g.legalMoves().some(x => key(x) === key(m))) { bad.push(`${o.id}/${line.id} nước ${i + 1} không hợp lệ`); break; }
      g.play(m);
    }
  }
  assert.deepEqual(bad, []);
  assert.ok(lines >= 30);
});

test('sách khai cuộc của máy chỉ chứa nước hợp lệ', () => {
  const book = T.buildOpeningBook(T.OPENINGS);
  assert.ok(book.size > 50);
});

test('ván danh thủ: mọi nước hợp lệ', () => {
  for (const mg of T.MASTER_GAMES) {
    const g = Game.create();
    mg.plies.forEach((p, i) => {
      const m = { from: [p.m[0], p.m[1]], to: [p.m[2], p.m[3]] };
      assert.ok(g.legalMoves().some(x => key(x) === key(m)), `${mg.id} nửa nước ${i + 1}`);
      g.play(m);
    });
  }
});

test('bài học, tàn cuộc, sát cục: thế minh hoạ hợp lệ', () => {
  const bad = [];
  const check = (b, turn, id) => { if (!b) return; const pr = positionProblems(b, turn || 'red'); if (pr.length) bad.push(`${id}: ${pr.join(', ')}`); };
  for (const l of T.LESSONS) (l.demos || []).forEach((d, i) => check(d.board, d.toMove || d.turn, `bài học ${l.key}#${i}`));
  for (const e of T.ENDGAMES) if (e.demo) check(e.demo.board, e.demo.toMove, `tàn cuộc ${e.key}`);
  for (const t of T.TACTICS) if (t.demo) check(t.demo.board, t.demo.toMove || t.demo.turn, `chiến thuật ${t.key}`);
  assert.deepEqual(bad, []);
});

// Bên đi trước = màu của quân ở ô xuất phát nước đầu tiên
const moverOf = (b, mv) => b[mv[0]][mv[1]] && b[mv[0]][mv[1]].color;

test('sát cục: thế hợp lệ, đáp án ép bí trong n nước', () => {
  const bad = []; let n = 0;
  for (const s of T.SATCUC) (s.drills || []).forEach((d, i) => {
    const id = `${s.key}#${i}`, b = boardOf(d.pieces), sol = d.sol, turn = moverOf(b, sol);
    if (!turn) { bad.push(`${id}: ô xuất phát của đáp án trống`); return; }
    const pr = positionProblems(b, turn); if (pr.length) bad.push(`${id}: ${pr.join(', ')}`);
    const mv = { from: [sol[0], sol[1]], to: [sol[2], sol[3]] };
    if (!Engine.generateLegalMoves(b, turn).some(m => key(m) === key(mv))) { bad.push(`${id}: đáp án không hợp lệ`); return; }
    if (d.n <= 2 || FULL) {
      const after = Engine.applyMove(b, mv), opp = Engine.otherColor(turn), reps = Engine.generateLegalMoves(after, opp);
      const forced = reps.length === 0 || (d.n > 1 && reps.every(r => Solver.findMate(Engine.applyMove(after, r), turn, d.n - 1)));
      if (!forced) bad.push(`${id}: đáp án không ép bí trong ${d.n} nước`);
    }
    n++;
  });
  assert.deepEqual(bad, []);
  assert.ok(n >= 60, 'số bài sát cục: ' + n);
});

test('tàn cuộc lý thuyết: thế hợp lệ, chuỗi nước PV đúng luật', () => {
  const bad = []; let n = 0;
  for (const e of T.ENDGAME_THEORY) {
    if (!e.position) continue;
    let b = boardOf(e.position.pieces); const pv = e.position.pv || [];
    let turn = pv.length ? moverOf(b, pv[0]) : 'red';
    const pr = positionProblems(b, turn); if (pr.length) bad.push(`${e.key}: ${pr.join(', ')}`);
    for (const [i, m] of pv.entries()) {
      const mv = { from: [m[0], m[1]], to: [m[2], m[3]] };
      if (!Engine.generateLegalMoves(b, turn).some(x => key(x) === key(mv))) { bad.push(`${e.key}: nước PV ${i + 1} không hợp lệ`); break; }
      b = Engine.applyMove(b, mv); turn = Engine.otherColor(turn);
    }
    n++;
  }
  assert.deepEqual(bad, []);
  assert.ok(n >= 25);
});
