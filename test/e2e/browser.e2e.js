// Kiểm tra trên trình duyệt thật (Chromium qua playwright-core): bấm chuột đi quân, máy đáp
// trong Web Worker, hiệu ứng chạy, không lỗi console, không tràn ngang trên điện thoại.
//   npm run test:e2e        (đặt CHROMIUM_PATH nếu Chromium không nằm ở chỗ mặc định của Playwright)
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

const { PAGE, chromiumPath, registerUI } = require('./helpers');
const { start } = require('../../tools/online-dev-server');

for (const vp of [{ name: 'máy tính', width: 1200, height: 900 }, { name: 'điện thoại', width: 390, height: 844 }]) {
  test(`đấu với máy bằng chuột (${vp.name})`, async () => {
    const srv = await start(0);
    const browser = await chromium.launch({ executablePath: chromiumPath() });
    try {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await registerUI(page, PAGE + `?server=ws://localhost:${srv.port}`, 'may_' + vp.width);
      await page.click('.zone-btn[data-zone="satruong"]');   // Đấu máy nằm ở phần Chơi
      await page.click('.tab-btn[data-tab="may"]');
      await page.click('#aiStartBtn');
      await page.waitForTimeout(800);
      const box = await (await page.$('#aiBoard svg')).boundingBox();
      const at = (r, c) => ({ x: box.x + box.width * (58 + c * 64) / 628, y: box.y + box.height * (58 + r * 64) / 692 });
      let q = at(7, 1); await page.mouse.click(q.x, q.y);
      q = at(7, 4); await page.mouse.click(q.x, q.y);
      // chờ hiệu ứng xuất hiện (máy bận thì sự kiện bấm có thể được xử lý trễ vài chục ms)
      const anim = await page.waitForFunction(() => document.getAnimations().length >= 1, null, { timeout: 1000, polling: 10 }).then(() => true, () => false);
      assert.ok(anim, 'không có hiệu ứng đi quân');
      await page.waitForFunction(() => document.querySelectorAll('#aiLog .log-cell[data-ply]').length >= 2, null, { timeout: 15000 });
      assert.equal(await page.evaluate(() => AIEngine.mode()), 'worker');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'tràn ngang');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); srv.close(); }
  });
}
