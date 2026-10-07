#!/usr/bin/env node
// Cho hai cấp máy tự đấu, xử thắng/thua bằng đúng luật của ứng dụng (Game).
//   node tools/selfplay.js <cấpA> <cấpB> [số ván] [giới hạn ms mỗi nước]
// Ví dụ: node tools/selfplay.js 4 5 10
const { load } = require('../test/helpers/load');
const { T } = load();
const { Game, XQSearch } = T;

const [la = 3, lb = 4, games = 6, capMs = 0] = process.argv.slice(2).map(Number);
const level = id => T.AI_LEVELS.find(l => l.id === id);
const book = T.buildOpeningBook(T.OPENINGS);
const historyKeys = (g => {
  const keys = [XQSearch.keyOf(g.start, g.startTurn)];
  for (let i = 0; i < g.boards.length - 1; i++) keys.push(XQSearch.keyOf(g.boards[i], i % 2 === 0 ? 'black' : 'red'));
  return keys;
});

function aiMove(g, L) {
  if (L.book) { const o = book.get(Game.key(g.board(), g.turn())); if (o && o.length) return o[Math.floor(Math.random() * o.length)].move; }
  const r = XQSearch.think({ board: g.board(), turn: g.turn(), timeMs: capMs ? Math.min(L.timeMs, capMs) : L.timeMs,
    maxDepth: L.maxDepth, noise: L.noise, blunder: L.blunder, historyKeys: historyKeys(g), game: g });
  return r.move;
}

const tally = {}; let scoreA = 0;
for (let i = 0; i < games; i++) {
  const g = Game.create();
  const red = i % 2 ? lb : la, black = i % 2 ? la : lb;
  while (!g.result && g.moves.length < 400) {
    const mv = aiMove(g, level(g.turn() === 'red' ? red : black));
    if (!mv) break; g.play(mv);
  }
  const res = g.result || { winner: null, reason: 'quá 400 nửa nước' };
  const winLv = res.winner ? (res.winner === 'red' ? red : black) : null;
  if (winLv === la) scoreA += 1; else if (winLv === null) scoreA += 0.5;
  const k = (winLv ? 'L' + winLv + ' thắng' : 'hoà') + ' / ' + res.reason; tally[k] = (tally[k] || 0) + 1;
  console.log(`ván ${i + 1}: Đỏ=L${red} Đen=L${black} ${g.moves.length} nửa nước → ${winLv ? 'L' + winLv + ' thắng' : 'hoà'} (${res.reason})`);
}
console.log(`\nL${la} vs L${lb}: L${la} được ${scoreA}/${games} điểm`);
console.log(tally);
