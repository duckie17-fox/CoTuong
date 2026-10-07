// Kiểm tra trên trình duyệt thật (Chromium qua playwright-core): bấm chuột đi quân, máy đáp
// trong Web Worker, hiệu ứng chạy, không lỗi console, không tràn ngang trên điện thoại.
//   npm run test:e2e        (đặt CHROMIUM_PATH nếu Chromium không nằm ở chỗ mặc định của Playwright)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const PAGE = 'file://' + path.join(__dirname, '..', '..', 'dist', 'co-tuong.html');
function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!fs.existsSync(base)) return undefined;
  for (const d of fs.readdirSync(base).filter(d => /^chromium-\d+$/.test(d)))
    for (const sub of ['chrome-linux/chrome', 'chrome-linux64/chrome']) { const p = path.join(base, d, sub); if (fs.existsSync(p)) return p; }
  return undefined;
}

for (const vp of [{ name: 'máy tính', width: 1200, height: 900 }, { name: 'điện thoại', width: 390, height: 844 }]) {
  test(`đấu với máy bằng chuột (${vp.name})`, async () => {
    const browser = await chromium.launch({ executablePath: chromiumPath() });
    try {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto(PAGE);
      await page.click('.tab-btn[data-tab="may"]');
      await page.click('#aiStartBtn');
      await page.waitForTimeout(800);
      const box = await (await page.$('#aiBoard svg')).boundingBox();
      const at = (r, c) => ({ x: box.x + box.width * (58 + c * 64) / 628, y: box.y + box.height * (58 + r * 64) / 692 });
      let q = at(7, 1); await page.mouse.click(q.x, q.y);
      q = at(7, 4); await page.mouse.click(q.x, q.y);
      await page.waitForTimeout(60);
      assert.ok(await page.evaluate(() => document.getAnimations().length) >= 1, 'không có hiệu ứng đi quân');
      await page.waitForFunction(() => document.querySelectorAll('#aiLog .log-cell[data-ply]').length >= 2, null, { timeout: 15000 });
      assert.equal(await page.evaluate(() => AIEngine.mode()), 'worker');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'tràn ngang');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}
