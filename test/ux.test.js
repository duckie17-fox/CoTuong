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

test('đấu với máy: đi quân bằng bàn phím, máy đáp, đi lại', async () => {
  const { window, document } = load({ fresh: true, storage: { xq_ai_level: '1' } });
  document.querySelector('.tab-btn[data-tab="may"]').click();
  document.querySelector('#aiStartBtn').click();
  const svg = document.querySelector('#aiBoard svg');
  assert.equal(svg.getAttribute('tabindex'), '0');
  svg.focus();
  // Pháo Đỏ (7,1) → (7,4): con trỏ bắt đầu ở (7,4)
  keys(svg, ['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'Enter', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'Enter'], window);
  const plies = () => document.querySelectorAll('#aiLog .log-cell[data-ply]').length;
  for (let i = 0; i < 100 && plies() < 2; i++) await new Promise(r => setTimeout(r, 50));
  assert.equal(plies(), 2, 'máy chưa đáp');
  assert.match(document.querySelector('#aiStatus').textContent, /Chạm quân/);
  document.querySelector('#aiUndo').click();
  assert.equal(plies(), 0);
  const hist = JSON.parse(window.localStorage.getItem('xq_ai_history'));
  assert.equal(hist[0].level, 1);
});

test('bảng cài đặt: bật/tắt âm thanh được lưu', () => {
  const { window, document, T } = load({ fresh: true });
  document.querySelector('#soundToggle [data-sound="off"]').click();
  assert.equal(T.Sound.isOn(), false);
  assert.equal(window.localStorage.getItem('xq_sound'), 'off');
  assert.equal(document.querySelector('#soundToggle [data-sound="off"]').getAttribute('aria-pressed'), 'true');
});
