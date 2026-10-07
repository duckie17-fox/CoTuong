// Trải nghiệm: xuất/nhập tiến độ, chế độ hai người, điều khiển bàn cờ bằng bàn phím.
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load');

function keys(el, list, win) { for (const k of list) el.dispatchEvent(new win.KeyboardEvent('keydown', { key: k, bubbles: true })); }

test('xuất rồi nhập tiến độ khôi phục đúng dữ liệu', () => {
  const a = load({ fresh: true, storage: { xq_puzzles_solved: '["p1","p2"]', xq_lessons_done: '["tuong"]', xq_last_tab: 'may' } });
  const text = a.T.Progress.exportText();
  const obj = JSON.parse(text);
  assert.equal(obj.app, 'co-tuong-nhap-mon');
  assert.equal(obj.data.xq_puzzles_solved, '["p1","p2"]');
  assert.equal(obj.data.xq_last_tab, undefined, 'không mang theo tab đang mở');
  const b = load({ fresh: true });
  assert.equal(b.T.Progress.importText(text), Object.keys(obj.data).length);
  assert.equal(b.window.localStorage.getItem('xq_puzzles_solved'), '["p1","p2"]');
  assert.throws(() => b.T.Progress.importText('{"app":"khac","data":{}}'), /không phải mã tiến độ/);
  assert.throws(() => b.T.Progress.importText('rác'), /không đọc được/);
});

test('hai người cùng máy: đi quân bằng bàn phím, máy không tự đi', async () => {
  const { window, document } = load({ fresh: true });
  document.querySelector('.tab-btn[data-tab="may"]').click();
  document.querySelector('input[name="aiOpp"][value="human"]').click();
  document.querySelector('input[name="aiOpp"][value="human"]').dispatchEvent(new window.Event('change'));
  assert.equal(document.querySelector('#aiLevelPicker').closest('fieldset').hidden, true);
  document.querySelector('#aiStartBtn').click();
  const svg = document.querySelector('#aiBoard svg');
  assert.equal(svg.getAttribute('tabindex'), '0');
  svg.focus();
  // Pháo Đỏ (7,1) → (7,4): con trỏ bắt đầu ở (7,4)
  keys(svg, ['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'Enter', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'Enter'], window);
  await new Promise(r => setTimeout(r, 50));
  assert.equal(document.querySelectorAll('#aiLog .log-cell[data-ply]').length, 1);
  assert.match(document.querySelector('#aiStatus').textContent, /Đến lượt Đen/);
  // Đen đi Mã (0,1) → (2,2): bàn không lật, con trỏ đang ở (7,4)
  keys(svg, ['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'Enter',
    'ArrowDown', 'ArrowDown', 'ArrowRight', 'Enter'], window);
  await new Promise(r => setTimeout(r, 400));
  assert.equal(document.querySelectorAll('#aiLog .log-cell[data-ply]').length, 2);
  assert.match(document.querySelector('#aiStatus').textContent, /Đến lượt Đỏ/);
  // hoàn tác 1 nửa nước
  document.querySelector('#aiUndo').click();
  assert.equal(document.querySelectorAll('#aiLog .log-cell[data-ply]').length, 1);
  // lịch sử ghi là ván hai người
  const hist = JSON.parse(window.localStorage.getItem('xq_ai_history'));
  assert.equal(hist[0].twoPlayer, true);
  assert.equal(hist[0].level, 0);
});

test('bảng cài đặt: bật/tắt âm thanh được lưu', () => {
  const { window, document, T } = load({ fresh: true });
  document.querySelector('#soundToggle [data-sound="off"]').click();
  assert.equal(T.Sound.isOn(), false);
  assert.equal(window.localStorage.getItem('xq_sound'), 'off');
  assert.equal(document.querySelector('#soundToggle [data-sound="off"]').getAttribute('aria-pressed'), 'true');
});
