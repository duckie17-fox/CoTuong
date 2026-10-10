// Tự đi lại khai cuộc: đi phía đối xứng (vd. Pháo trái P8-5 thay Pháo phải P2-5) vẫn được tính đúng, máy đi theo hướng đó.
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load');

test('tự đi lại: nhận nước đi đối xứng trái ↔ phải', () => {
  const { window } = load({ fresh: true });
  const r = window.eval(`(()=>{
    const o=OPENINGS.find(x=>!x.isTrap && x.lines[0].moves[0].text==='P2-5');
    Math.random=()=>0.9;   // máy không tự đổi hướng
    startTrainer(o, RED, false);
    const exp=trainerExpected();
    trainerUserMove({from:[exp.from[0],8-exp.from[1]], to:[exp.to[0],8-exp.to[1]]});   // P8-5
    return {mine:trainer.mine, mistakes:trainer.mistakes, mirror:trainer.mirror, first:trainer.game.moves[0].text.short};
  })()`);
  assert.equal(r.first, 'P8-5');
  assert.equal(r.mistakes, 0);
  assert.equal(r.mine, 1);
  assert.equal(r.mirror, true);
});

test('bản đối xứng: ký hiệu và lời giải thích đổi theo (cột, trái/phải)', () => {
  const { window } = load({ fresh: true });
  assert.equal(window.eval(`mirrorCaption('Pháo ăn Tốt (P2-5), Xe bên phải ra cột 2; X1.1 giữ nguyên số bước; M8.7')`),
    'Pháo ăn Tốt (P8-5), Xe bên trái ra cột 8; X9.1 giữ nguyên số bước; M2.3');
  // mọi biến khai cuộc đều lật được trọn vẹn
  assert.equal(window.eval(`OPENINGS.flatMap(o=>o.lines.map(l=>{const a=l.moves.filter(m=>!m.error);return a.length-mirrorLine(a).length;})).filter(x=>x).length`), 0);
});
