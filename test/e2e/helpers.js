// Tiện ích chung cho test trên trình duyệt thật.
const fs = require('fs');
const path = require('path');

const PAGE = 'file://' + path.join(__dirname, '..', '..', 'dist', 'co-tuong.html');
function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!fs.existsSync(base)) return undefined;
  for (const d of fs.readdirSync(base).filter(d => /^chromium-\d+$/.test(d)))
    for (const sub of ['chrome-linux/chrome', 'chrome-linux64/chrome']) { const p = path.join(base, d, sub); if (fs.existsSync(p)) return p; }
  return undefined;
}
// App bắt buộc đăng nhập: mở trang rồi tạo tài khoản qua màn chào (PBKDF2 hạ vòng lặp cho nhanh)
async function registerUI(page, url, username, displayName) {
  await page.goto(url);
  await page.evaluate(() => { Account.api.iterations = 1000; });
  await page.click('#authGate [data-open-register]');
  await page.fill('#rgUser', username);
  if (displayName) await page.fill('#rgName', displayName);
  await page.fill('#rgPass', 'matkhau123'); await page.fill('#rgPass2', 'matkhau123');
  await page.click('#dlgBody button[type=submit]');
  await page.waitForSelector('#rcCode'); await page.check('#rcOk'); await page.click('#rcNext');
  await page.waitForSelector('#authGate', { state: 'hidden' });
}
module.exports = { PAGE, chromiumPath, registerUI };
