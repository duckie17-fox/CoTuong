// Bấm "Nước tiếp" khi xem khai cuộc / ván danh thủ: trang không được tự cuộn (biên bản chỉ cuộn bên trong khung của nó)
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { PAGE, chromiumPath } = require('./helpers');

test('bấm Nước tiếp không làm trang giật', async () => {
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  try {
    for (const [w, h] of [[390, 844], [820, 1180]]) {
      const p = await browser.newPage({ viewport: { width: w, height: h } });
      await p.goto(PAGE);
      await p.evaluate(() => { document.body.classList.remove('gated'); document.querySelector('#authGate').hidden = true; });
      await p.evaluate(() => { showTab('khaicuoc'); openOpening(OPENINGS[0].id); });
      await p.waitForTimeout(500);
      // cho biên bản nằm trong tầm nhìn một phần như khi người dùng đang đọc
      for (let i = 0; i < 6; i++) {
        const y0 = await p.evaluate(() => scrollY);
        await p.click('#openingNext'); await p.waitForTimeout(150);
        assert.equal(await p.evaluate(() => scrollY), y0, `trang bị cuộn ở nước ${i + 1} (${w}px)`);
      }
      await p.close();
    }
  } finally { await browser.close(); }
});
