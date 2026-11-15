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

test('lần đầu mở app: hỏi bắt đầu từ đâu, chọn "đánh thử" thì vào Đấu máy cấp 1; mở lại không hỏi nữa', () => {
  const { document: doc, window: win } = load({ fresh: true, storage: { xq_onboarded: '' } });
  assert.equal(doc.getElementById('dlg').hidden, false);
  assert.equal(doc.querySelectorAll('[data-onb]').length, 3);
  doc.querySelector('[data-onb="may"]').click();
  assert.equal(doc.getElementById('dlg').hidden, true);
  assert.equal(doc.querySelector('section[data-panel="may"]').hidden, false);
  assert.equal(doc.querySelector('input[name="aiLevel"]:checked').value, '1');
  assert.equal(win.localStorage.getItem('xq_onboarded'), '1');
  const again = load({ fresh: true, storage: { xq_onboarded: '' , xq_lessons_done: '["tuong","si"]' } });
  assert.equal(again.document.getElementById('dlg').hidden, true, 'đã có tiến độ thì không hỏi');
});

test('bài tập trùng tên được đánh số; bài học có câu chốt trên bàn cờ', () => {
  const { document: doc, window: win } = load({ fresh: true });
  win.eval('showTab("baitap")');
  const names = [...doc.querySelectorAll('#puzzleGrid .puzzle-card h4')].map(h => h.textContent.trim());
  assert.equal(new Set(names).size, names.length, 'không còn hai thẻ cùng tên');
  assert.match(doc.querySelector('#dailyCard').textContent, /chuỗi ngày/i, 'người mới cũng thấy có chuỗi ngày');
  win.eval('showTab("hoc")');
  assert.match(doc.querySelector('.lesson-lead').textContent, /Tướng đi 1 bước/);
});
