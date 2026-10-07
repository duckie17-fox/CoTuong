#!/usr/bin/env node
// Hiệu chỉnh thang cấp độ máy: đấu hai cấu hình cấp với nhau trên cùng bản build.
//   node tools/ladder.js <levels.json> <i> <j> [số cặp ván=10] [seed=1]
// levels.json: mảng [{maxDepth,timeMs,noise,blunder,book}, ...]; i, j là chỉ số trong mảng.
// Mỗi cặp ván dùng cùng một khai cuộc ngẫu nhiên (2–6 nửa nước từ sách), đổi màu.
// In điểm của cấu hình j (cấu hình được kỳ vọng mạnh hơn).
const fs = require('fs');
const path = require('path');
const { load } = require('../test/helpers/load');
const { T } = load();
const { Game, XQSearch } = T;

const [file, iArg, jArg, pairsArg = 10, seedArg = 1] = process.argv.slice(2);
const L = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
const A = L[+iArg], B = L[+jArg], pairs = +pairsArg;
let seed = (+seedArg * 2654435761) >>> 0;
const rnd = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; };
const book = T.buildOpeningBook(T.OPENINGS);

function opening() {
  const g = Game.create(), n = 2 + Math.floor(rnd() * 5), moves = [];
  for (let k = 0; k < n; k++) {
    const o = book.get(Game.key(g.board(), g.turn())); if (!o || !o.length) break;
    const m = o[Math.floor(rnd() * o.length)].move; moves.push(m); g.play(m);
  }
  return moves;
}
function move(g, cfg) {
  if (cfg.book) { const o = book.get(Game.key(g.board(), g.turn())); if (o && o.length) return o[Math.floor(rnd() * o.length)].move; }
  return XQSearch.think(T.aiThinkArgs(g, { timeMs: cfg.timeMs, maxDepth: cfg.maxDepth, noise: cfg.noise, blunder: cfg.blunder, rng: rnd })).move;
}
let scoreB = 0, games = 0;
for (let p = 0; p < pairs; p++) {
  const op = opening();
  for (const bRed of [true, false]) {
    const g = Game.create(); for (const m of op) g.play(m);
    while (!g.result && g.moves.length < 300) { const mv = move(g, (g.turn() === 'red') === bRed ? B : A); if (!mv) break; g.play(mv); }
    const res = g.result || { winner: null };
    const bColor = bRed ? 'red' : 'black';
    scoreB += !res.winner ? 0.5 : res.winner === bColor ? 1 : 0; games++;
  }
}
console.log(JSON.stringify({ i: +iArg, j: +jArg, scoreB, games, pct: Math.round(100 * scoreB / games) }));
