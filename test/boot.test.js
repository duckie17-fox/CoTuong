const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load');

test('trang khởi động không lỗi JS', () => {
  const { T, errors } = load();
  assert.deepEqual(errors, []);
  assert.ok(T && T.Engine && T.XQSearch, 'thiếu module nội bộ');
});

test('mã Web Worker chứa đúng module XQSearch đang chạy trên trang', () => {
  const { T } = load();
  assert.match(T.XQ_WORKER_SRC, /const XQSearch = \(function\(\)\{/);
  assert.match(T.XQ_WORKER_SRC, /self\.onmessage=/);
  // chạy thử mã worker trong sandbox: phải định nghĩa được XQSearch.think
  const vm = require('vm');
  const ctx = { postMessage() {}, self: {} };
  vm.createContext(ctx); vm.runInContext(T.XQ_WORKER_SRC + ';this.XQ=XQSearch;', ctx);
  assert.equal(typeof ctx.XQ.think, 'function');
});

test('có đủ 5 tab và mỗi tab hiển thị được', () => {
  const { document } = load();
  const tabs = [...document.querySelectorAll('.tab-btn[data-tab]')];
  assert.ok(tabs.length >= 5);
  for (const t of tabs) {
    t.click();
    const panel = document.querySelector(`section[data-panel="${t.dataset.tab}"]`);
    assert.equal(panel.hidden, false, 'tab ' + t.dataset.tab);
    assert.equal(t.getAttribute('aria-selected'), 'true');
  }
});
