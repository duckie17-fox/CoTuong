#!/usr/bin/env node
// Đấu hai bản build với nhau để đo thay đổi sức mạnh của máy (vd. trước/sau khi sửa hàm đánh giá).
//   node tools/match.js <A.html> <B.html> [số cặp ván=10] [ms mỗi nước=300] [hạt giống=1]
// Mỗi cặp: cùng một khai cuộc (vài nước đầu lấy ngẫu nhiên từ sách), A cầm Đỏ một ván, Đen một ván.
// Luật xử thắng/thua dùng Game của bản A (hai bản cùng luật). In điểm của B và ước lượng Elo.
const { load } = require('../test/helpers/load');
const path = require('path');

const [aPath, bPath, pairsArg = 10, msArg = 300, seedArg = 1] = process.argv.slice(2);
if (!aPath || !bPath) { console.error('Cách dùng: node tools/match.js A.html B.html [cặp] [ms] [seed]'); process.exit(1); }
const A = load({ dist: path.resolve(aPath) }).T, B = load({ dist: path.resolve(bPath) }).T;
const pairs = +pairsArg, ms = +msArg;
let seed = +seedArg * 2654435761 >>> 0;
const rnd = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; };

// Khai cuộc: đi ngẫu nhiên theo sách 2..6 nửa nước
const book = A.buildOpeningBook(A.OPENINGS);
function opening() {
  const g = A.Game.create(), n = 2 + Math.floor(rnd() * 5), moves = [];
  for (let i = 0; i < n; i++) {
    const o = book.get(A.Game.key(g.board(), g.turn())); if (!o || !o.length) break;
    const m = o[Math.floor(rnd() * o.length)].move; moves.push(m); g.play(m);
  }
  return moves;
}

function playGame(openingMoves, redEngine) {
  const g = A.Game.create();
  for (const m of openingMoves) g.play(m);
  while (!g.result && g.moves.length < 300) {
    const eng = (g.turn() === 'red') === (redEngine === 'A') ? A : B;
    const args = A.aiThinkArgs(g, { timeMs: ms, maxDepth: 40 });
    const r = eng.XQSearch.think(args);
    if (!r.move) break;
    g.play(r.move);
  }
  return g.result || { winner: null, reason: 'quá 300 nửa nước' };
}

let scoreB = 0, games = 0; const reasons = {};
for (let p = 0; p < pairs; p++) {
  const op = opening();
  for (const red of ['A', 'B']) {
    const res = playGame(op, red);
    const bColor = red === 'B' ? 'red' : 'black';
    const s = !res.winner ? 0.5 : res.winner === bColor ? 1 : 0;
    scoreB += s; games++;
    reasons[res.reason] = (reasons[res.reason] || 0) + 1;
    console.log(`cặp ${p + 1} · B cầm ${bColor === 'red' ? 'Đỏ' : 'Đen'}: ${s === 1 ? 'B thắng' : s === 0 ? 'A thắng' : 'hoà'} (${res.reason})`);
  }
}
const s = scoreB / games, elo = s <= 0 ? -Infinity : s >= 1 ? Infinity : -400 * Math.log10(1 / s - 1);
const se = Math.sqrt(Math.max(s * (1 - s), 0.0625) / games), lo = -400 * Math.log10(1 / Math.min(0.999, Math.max(0.001, s - 1.96 * se)) - 1), hi = -400 * Math.log10(1 / Math.min(0.999, Math.max(0.001, s + 1.96 * se)) - 1);
console.log(`\nB được ${scoreB}/${games} điểm (${(100 * s).toFixed(1)}%) · Elo B−A ≈ ${elo.toFixed(0)} [${lo.toFixed(0)}, ${hi.toFixed(0)}]`);
console.log(JSON.stringify({ scoreB, games, reasons }));
