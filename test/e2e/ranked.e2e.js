// Đấu xếp hạng trên trình duyệt thật: hai người bấm Tìm trận cùng lúc thì được ghép vào phòng Tính Elo;
// một mình thì sau 8 giây được ghép "người chơi" là máy, đánh, đầu hàng → bị trừ Elo; tải lại trang thì vào tiếp được ván dở.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const { start } = require('../../tools/online-dev-server');

const PAGE = 'file://' + path.join(__dirname, '..', '..', 'dist', 'co-tuong.html');
function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!fs.existsSync(base)) return undefined;
  for (const d of fs.readdirSync(base).filter(d => /^chromium-\d+$/.test(d)))
    for (const sub of ['chrome-linux/chrome', 'chrome-linux64/chrome']) { const p = path.join(base, d, sub); if (fs.existsSync(p)) return p; }
  return undefined;
}
async function clickSq(page, r, c) {
  const flipped = await page.evaluate(() => Online.state.widget.isFlipped());
  const box = await (await page.$('#olBoard svg')).boundingBox();
  const rr = flipped ? 9 - r : r, cc = flipped ? 8 - c : c;
  await page.mouse.click(box.x + box.width * (58 + cc * 64) / 628, box.y + box.height * (58 + rr * 64) / 692);
}
const text = (page, sel) => page.evaluate(s => document.querySelector(s).textContent.replace(/\s+/g, ' '), sel);

test('đấu xếp hạng: ghép hai người; một mình thì ghép máy, đầu hàng bị trừ Elo, tải lại vào tiếp ván dở', async () => {
  const srv = await start(0);
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  const errors = [];
  try {
    const url = PAGE + `?server=ws://localhost:${srv.port}`;
    const pages = [];
    async function user(name) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const p = await ctx.newPage(); pages.push(p);
      p.on('pageerror', e => errors.push(e.message));
      await p.goto(url);
      await p.evaluate(() => { Account.api.iterations = 1000; });
      await p.click('.zone-btn[data-zone="toi"]');
      await p.click('#meIntro [data-open-register]');
      await p.fill('#rgUser', name); await p.fill('#rgPass', 'matkhau123'); await p.fill('#rgPass2', 'matkhau123');
      await p.click('#dlgBody button[type=submit]');
      await p.waitForSelector('#rcCode'); await p.check('#rcOk'); await p.click('#rcNext');
      await p.waitForSelector('#meSigned:not([hidden])');
      await p.click('.zone-btn[data-zone="satruong"]');
      await p.waitForSelector('#olFindMatch');
      return p;
    }
    const A = await user('xh_an'), B = await user('xh_binh');
    assert.match(await text(A, '#olRankedMe'), /Vàng II\s*1200/);
    // hai người cùng tìm → cùng một phòng Tính Elo, khác màu
    await A.click('#olFindMatch'); await B.click('#olFindMatch');
    await A.waitForFunction(() => Online.state.room && Online.state.room.seats.red && Online.state.room.seats.black, null, { timeout: 15000 });
    await B.waitForFunction(() => Online.state.room && Online.state.room.seats.red && Online.state.room.seats.black, null, { timeout: 15000 });
    assert.equal(await A.evaluate(() => Online.state.code), await B.evaluate(() => Online.state.code));
    assert.notEqual(await A.evaluate(() => Online.state.room.you), await B.evaluate(() => Online.state.room.you));
    assert.equal(await A.evaluate(() => Online.state.room.rated), true);
    await A.click('#olLeave'); await B.click('#olLeave');

    // một mình → sau ~8 giây ghép máy (tên giống người, có Elo)
    const C = await user('xh_chi');
    await C.click('#olFindMatch');
    await C.waitForSelector('.ranked-search');
    await C.waitForFunction(() => Online.state.bot && Online.state.room, null, { timeout: 20000 });
    const opp = await C.evaluate(() => { const r = Online.state.room; return r.seats[r.you === 'red' ? 'black' : 'red']; });
    assert.ok(opp.name && !/máy|bot/i.test(opp.name), 'tên đối thủ giống người: ' + opp.name);
    assert.ok(opp.elo > 1100 && opp.elo < 1300);
    assert.equal(await C.evaluate(() => document.querySelector('#olKind').textContent), 'Tính Elo');
    // nếu mình cầm Đen thì chờ đối thủ đi trước
    const you = await C.evaluate(() => Online.state.room.you);
    if (you === 'black') await C.waitForFunction(() => Online.state.room.moves.length === 1, null, { timeout: 15000 });
    const n0 = await C.evaluate(() => Online.state.room.moves.length);
    if (you === 'red') { await clickSq(C, 6, 0); await clickSq(C, 5, 0); } else { await clickSq(C, 3, 0); await clickSq(C, 4, 0); }
    await C.waitForFunction(n => Online.state.room.moves.length === n + 2, n0, { timeout: 15000 });   // máy đáp lại
    // tải lại trang giữa ván → vào tiếp
    await C.reload();
    await C.click('.zone-btn[data-zone="satruong"]');
    await C.waitForSelector('#olResume');
    await C.click('#olResume');
    await C.waitForFunction(n => Online.state.room && Online.state.room.moves.length >= n + 2, n0);
    // đầu hàng (2 bước) → thua, bị trừ Elo
    await C.click('#olResign'); await C.click('#olResign');
    await C.waitForFunction(() => /Elo của bạn: \d+ \(-\d+\)/.test(document.querySelector('#olStatus').textContent), null, { timeout: 10000 });
    assert.equal(await C.evaluate(() => localStorage.getItem('xq_ranked_bot')), null);
    await C.click('#olLeave');
    await C.waitForFunction(() => /Vàng/.test(document.querySelector('#olRankedMe').textContent) && +document.querySelector('.ranked-elo').textContent < 1200);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    srv.close();
  }
});
