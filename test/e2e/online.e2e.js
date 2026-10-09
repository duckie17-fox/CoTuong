// Sa trường trên trình duyệt thật: hai người (hai trình duyệt riêng) vào cùng phòng qua server chạy thử,
// đi quân bằng chuột, chat, xin hoà / từ chối, xin đi lại / đồng ý, đầu hàng, tải lại trang vẫn đúng ghế,
// mở phân tích ván. Server dùng đúng RoomCore như bản Cloudflare (tools/online-dev-server.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { start } = require('../../tools/online-dev-server');

const { PAGE, chromiumPath, registerUI } = require('./helpers');
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

    // An đăng nhập rồi tạo phòng giao hữu (tắt Tính Elo để còn xin đi lại), cầm Đỏ
    await registerUI(A, PAGE + q, 'an_room', 'An');
    await A.click('.zone-btn[data-zone="satruong"]');
    assert.equal(await A.evaluate(() => document.querySelector('.tabs').hidden), true, 'phần Chơi không hiện thanh tab của phần Học');
    await A.evaluate(() => { document.querySelector('#olRated').checked = false; });
    await A.click('#olCreate');
    await A.waitForSelector('#olInvite:not([hidden]) .ol-link', { state: 'attached' });   // ô link ẩn, chỉ hiện khi không sao chép được
    const link = await A.inputValue('#olInvite .ol-link');
    const code = link.match(/room=([A-Z0-9]+)/)[1];
    assert.match(await text(A, '#olTop'), /Chờ đối thủ/);   // một dòng chờ ở thanh người chơi

    // Bình mở link mời khi chưa có tài khoản → bắt đăng nhập → tạo tài khoản xong vào thẳng phòng
    await registerUI(B, PAGE + `?room=${code}&server=ws://localhost:${srv.port}`, 'binh_room', 'Bình');
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
    await B.click('#olResign'); await B.waitForTimeout(450); await B.click('#olResign');   // xác nhận 2 bước (bấm đúp quá nhanh bị bỏ qua)
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

test('tài khoản trên trình duyệt thật: đăng ký, kết bạn, mời đấu, ván tính Elo', async () => {
  const srv = await start(0);
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  const errors = [];
  try {
    const url = PAGE + `?server=ws://localhost:${srv.port}`;
    const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const A = await ctxA.newPage(), B = await ctxB.newPage();
    for (const p of [A, B]) { p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => d.accept()); }
    async function register(p, user, name) {
      await registerUI(p, url, user, name);
      await p.click('.zone-btn[data-zone="toi"]');
      await p.waitForSelector('#meSigned:not([hidden])');
    }
    await register(A, 'an_e2e', 'An');
    await register(B, 'binh_e2e', 'Bình');
    assert.equal(await text(A, '#meName'), 'An');
    // An tìm và kết bạn với Bình
    await A.click('.zone-btn[data-zone="satruong"]');
    await A.click('.st-btn[data-stab="banbe"]');
    await A.fill('#friendSearch', 'binh');
    await A.click('#friendResults [data-add]');
    await A.waitForSelector('#friendOutgoing .person');
    // Bình đồng ý
    await B.click('.zone-btn[data-zone="satruong"]');
    await B.click('.st-btn[data-stab="banbe"]');
    await B.click('#friendRequests [data-accept]');
    await B.waitForSelector('#friendList [data-invite]');
    // An mời Bình đấu (tính Elo) → An vào phòng ngay
    await A.click('.st-btn[data-stab="phong"]'); await A.click('.st-btn[data-stab="banbe"]');
    await A.click('#friendList [data-invite]');
    await A.click('#ivSend');
    await A.waitForSelector('#olRoom:not([hidden])');
    await A.waitForFunction(() => Online.state.room && Online.state.room.rated);
    assert.equal(await text(A, '#olKind'), 'Tính Elo');
    // Bình thấy lời mời (hỏi hộp thư khi quay lại trang) → vào phòng
    await B.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await B.waitForSelector('#noticeStack [data-notice^="inv"]');
    await B.click('#noticeStack [data-notice^="inv"] [data-i="0"]');
    await B.waitForFunction(() => Online.state.room && Online.state.room.you === 'black');
    await A.waitForFunction(() => /Tới lượt bạn/.test(document.querySelector('#olStatus').textContent));
    assert.match(await text(A, '#olTop'), /Bình.*Elo 1200/);
    assert.equal(await A.evaluate(() => document.querySelector('#olTakeback').hidden), true, 'ván tính Elo không có nút xin đi lại');
    // 10 nửa nước: hai bên lần lượt tiến Tốt
    for (let i = 0; i < 10; i++) {
      const c = [0, 2, 4, 6, 8][i >> 1], red = i % 2 === 0, p = red ? A : B;
      await clickSq(p, red ? 6 : 3, c); await clickSq(p, red ? 5 : 4, c);
      await A.waitForFunction(n => document.querySelectorAll('#olLog .log-cell[data-ply]').length === n, i + 1);
    }
    await B.click('#olResign'); await B.waitForTimeout(450); await B.click('#olResign');   // xác nhận 2 bước (bấm đúp quá nhanh bị bỏ qua)
    await A.waitForFunction(() => /Elo của bạn: 1220 \(\+20\)/.test(document.querySelector('#olStatus').textContent));
    await B.waitForFunction(() => /Elo của bạn: 1180 \(-20\)/.test(document.querySelector('#olStatus').textContent));
    // trang Tôi cập nhật Elo
    await A.click('.zone-btn[data-zone="toi"]');
    await A.waitForFunction(() => document.querySelector('#meElo').textContent === '1220');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    srv.close();
  }
});
