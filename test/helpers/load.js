// Nạp bản build (dist/co-tuong.html) vào jsdom và trả về các module nội bộ để test.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const DIST = path.join(__dirname, '..', '..', 'dist', 'co-tuong.html');
const EXPORTS = ['Engine', 'Notation', 'Game', 'Solver', 'XQSearch', 'Coach', 'AIEngine',
  'PUZZLES', 'OPENINGS', 'MASTER_GAMES', 'TACTICS', 'ENDGAMES', 'ENDGAME_THEORY', 'SATCUC',
  'LESSONS', 'AI_LEVELS', 'XQ_WORKER_SRC', 'buildOpeningBook'];
const OPTIONAL = ['Fen', 'Progress', 'Sound', 'PuzzleCheck', 'aiThinkArgs', 'ruleLosingMoves', 'historyKeysOf', 'Learn', 'suggestAiLevel', 'playFromPosition', 'savedAiLevel'];

let cached = null;
function load({ fresh = false, storage, dist, setup, url = 'https://example.test/' } = {}) {
  if (cached && !fresh && !dist && !setup) return cached;
  let html = fs.readFileSync(dist || DIST, 'utf8');
  const exp = EXPORTS.map(n => `${n}`).join(',') + ',' +
    OPTIONAL.map(n => `${n}:typeof ${n}!=='undefined'?${n}:undefined`).join(',');
  const i = html.lastIndexOf('</script>');
  html = html.slice(0, i) + `;window.__T={${exp}};` + html.slice(i);
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(String(e && e.message || e)));
  vc.on('error', e => errors.push('console.error: ' + e));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url,
    beforeParse(win) {
      win.Element.prototype.scrollIntoView = function () {};
      win.scrollTo = () => {};
      win.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
      win.Worker = undefined; // chạy AI trên luồng chính trong test
      if (storage) for (const [k, v] of Object.entries(storage)) win.localStorage.setItem(k, v);
      if (setup) setup(win);
    },
  });
  const res = { window: dom.window, document: dom.window.document, T: dom.window.__T, errors };
  if (!fresh && !dist && !setup) cached = res;
  return res;
}
module.exports = { load };
