// Sa trường trên trình duyệt thật: hai người (hai trình duyệt riêng) vào cùng phòng qua server chạy thử,
// đi quân bằng chuột, chat, xin hoà / từ chối, xin đi lại / đồng ý, đầu hàng, tải lại trang vẫn đúng ghế,
// mở phân tích ván. Server dùng đúng RoomCore như bản Cloudflare (tools/online-dev-server.js).
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
const plies = page => page.evaluate(() => document.querySelectorAll('#olLog .log-cell[data-ply]').length);
const text = (page, sel) => page.evaluate(s => document.querySelector(s).textContent.replace(/\s+/g, ' '), sel);

test('hai người đấu với nhau trong Sa trường', async () => {
  // ONLINE_E2E_PORT: chạy với server có sẵn (vd. `wrangler dev` của bản Cloudflare) thay cho server Node
  const srv = process.env.ONLINE_E2E_PORT ? { port: +process.env.ONLINE_E2E_PORT, close() {} } : await start(0);
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  const errors = [];
  try {
    const q = `?server=ws://localhost:${srv.port}`;
    const ctxA = await browser.newContext({ viewport: { width: 1200, height: 950 } });
    const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const A = await ctxA.newPage(), B = await ctxB.newPage();
    for (const p of [A, B]) { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); p.on('dialog', d => d.accept()); }

    // An tạo phòng, cầm Đỏ
    await A.goto(PAGE + q);
    await A.click('.zone-btn[data-zone="satruong"]');
    assert.equal(await A.evaluate(() => document.querySelector('.tabs').hidden), true, 'Sa trường không hiện thanh tab Kỳ viện');
    await A.fill('#olName', 'An');
    await A.click('#olCreate');
    await A.waitForSelector('#olInvite:not([hidden]) .ol-link');
    const link = await A.inputValue('#olInvite .ol-link');
    const code = link.match(/room=([A-Z0-9]+)/)[1];
    assert.match(await text(A, '#olStatus'), /chờ đối thủ/);

    // Bình mở link mời (chưa có tên → nhập tên rồi vào)
    await B.goto(PAGE + `?room=${code}&server=ws://localhost:${srv.port}`);
    await B.waitForSelector('#olLobby:not([hidden])');
    assert.equal(await B.inputValue('#olJoinCode'), code);
    await B.fill('#olName', 'Bình');
    await B.click('#olJoin');
    await B.waitForFunction(() => Online.state.room && Online.state.room.you === 'black');
    await A.waitForFunction(() => /Tới lượt bạn/.test(document.querySelector('#olStatus').textContent));
    assert.match(await text(A, '#olTop'), /Bình/);

    // Bình (Đen) không đi được khi chưa tới lượt
    await clickSq(B, 0, 1); await clickSq(B, 2, 2);
    assert.equal(await plies(B), 0);
    // An: Pháo đầu; Bình: lên Mã (bàn của Bình đã lật)
    await clickSq(A, 7, 1); await clickSq(A, 7, 4);
    await B.waitForFunction(() => document.querySelectorAll('#olLog .log-cell[data-ply]').length === 1);
    assert.equal(await B.evaluate(() => Online.state.widget.isFlipped()), true);
    await clickSq(B, 0, 1); await clickSq(B, 2, 2);
    await A.waitForFunction(() => document.querySelectorAll('#olLog .log-cell[data-ply]').length === 2);

    // chat
    // chat nằm ở thẻ riêng của bảng phụ; A chưa mở thẻ Chat thì thấy chấm báo tin mới
    await B.click('#olRoom [data-side-tab="chat"]');
    await B.click('.ol-chip >> nth=1');
    await A.waitForFunction(() => /Nước hay/.test(document.querySelector('#olChat').textContent));
    assert.equal(await A.evaluate(() => document.querySelector('#olRoom [data-side-tab="chat"] .side-dot').hidden), false);
    await A.click('#olRoom [data-side-tab="chat"]');
    await A.fill('#olChatInput', '<b>chào</b>');
    await A.press('#olChatInput', 'Enter');
    await B.waitForFunction(() => document.querySelector('#olChat').textContent.includes('<b>chào</b>'));

    // xin hoà → từ chối
    await A.click('#olDraw');
    await B.waitForSelector('.ol-offer-in');
    await B.click('.ol-offer-in [data-ol="decline"]');
    await A.waitForFunction(() => /từ chối hoà/.test(document.querySelector('#olChat').textContent));

    // xin đi lại → đồng ý: lùi cả nước của Bình lẫn của An
    await A.click('#olTakeback');
    await B.waitForSelector('.ol-offer-in');
    await B.click('.ol-offer-in [data-ol="accept"]');
    await A.waitForFunction(() => Online.state.room.moves.length === 0);

    // đi lại vài nước rồi Bình tải lại trang: vẫn đúng ghế Đen
    await clickSq(A, 7, 7); await clickSq(A, 7, 4);
    await B.waitForFunction(() => Online.state.room && Online.state.room.moves.length === 1);
    await B.reload();
    await B.waitForFunction(() => Online.state.room && Online.state.room.you === 'black');
    assert.match(await text(B, '#olBottom'), /Bình \(bạn\)/);
    assert.equal(await B.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'tràn ngang trên điện thoại');

    // Bình đầu hàng
    await B.click('#olResign');
    await A.waitForFunction(() => Online.state.room.result);
    assert.match(await text(A, '#olStatus'), /Đỏ thắng/);
    await A.waitForSelector('#olAfter:not([hidden])');

    // An mở phân tích ván: sang Kỳ viện, đúng tên đối thủ; quay lại thì về Sa trường
    await A.click('#olReview');
    await A.waitForSelector('#aiReviewCard:not([hidden])');
    assert.match(await text(A, '#reviewHead'), /Đấu với Bình/);
    assert.equal(await A.evaluate(() => document.querySelector('section[data-zone-panel="satruong"]').hidden), true);
    await A.click('#reviewBack');
    assert.equal(await A.evaluate(() => document.querySelector('section[data-zone-panel="satruong"]').hidden), false);
    assert.match(await text(A, '#olHistory'), /với Bình/);

    // tái đấu: đổi màu
    await A.click('#olRematch');
    await B.waitForSelector('.ol-offer-in');
    await B.click('.ol-offer-in [data-ol="accept"]');
    await A.waitForFunction(() => Online.state.room.game === 2 && Online.state.room.you === 'black');
  } finally {
    await browser.close(); srv.close();
  }
  assert.deepEqual(errors, []);
});
