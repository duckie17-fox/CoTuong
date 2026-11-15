/* =========================================================================
   BOOT
   ========================================================================= */
function initSettings(){
  // Giao diện Sáng / Tối / Theo máy (xq_theme; "Theo máy" = bỏ thuộc tính data-theme)
  const th=$('#themeToggle');
  const applyTheme=v=>{
    if(v==='light'||v==='dark') document.documentElement.dataset.theme=v; else delete document.documentElement.dataset.theme;
    $$('button',th).forEach(b=>b.setAttribute('aria-pressed', b.dataset.themeSet===(v||'auto')?'true':'false'));
  };
  $$('button',th).forEach(b=>b.addEventListener('click',()=>{ safeLS_set('xq_theme', b.dataset.themeSet); applyTheme(b.dataset.themeSet); }));
  applyTheme(safeLS_get('xq_theme'));
}
// Lần đầu mở app (chưa có tiến độ, chưa đăng nhập): hỏi một câu để chọn chỗ bắt đầu
function initOnboarding(hadProgress){
  if(safeLS_get('xq_onboarded')) return;
  safeLS_set('xq_onboarded','1');
  if(hadProgress || Account.signedIn() || Online.wantsZone()) return;
  const opts=[
    {k:'hoc', ic:'book', t:'Mình chưa biết chơi', d:'Học luật từ bài 1: quân cờ đi thế nào, thắng thua ra sao.'},
    {k:'baitap', ic:'target', t:'Mình biết luật rồi', d:'Luyện bài tập chiếu bí, ăn quân từ dễ đến khó.'},
    {k:'may', ic:'swords', t:'Mình muốn đánh thử', d:'Đấu với máy ở cấp dễ nhất, có gợi ý và được đi lại.'},
  ];
  Account.openDialog(`<div class="dlg-head"><h2 id="dlgTitle">Bạn muốn bắt đầu từ đâu?</h2><button type="button" class="dlg-x" data-dlg-close aria-label="Đóng">${icon('x')}</button></div>
    <div class="onb-list">${opts.map(o=>`<button type="button" class="onb-opt" data-onb="${o.k}">${icon(o.ic)}<span><b>${o.t}</b><small>${o.d}</small></span></button>`).join('')}</div>
    <p class="hint-text small">Chọn gì cũng đổi được sau, mọi phần đều mở sẵn.</p>`, body=>{
    $$('[data-onb]',body).forEach(b=>b.addEventListener('click',()=>{
      const k=b.dataset.onb;
      Account.closeDialog();
      if(k==='may'){ showTab('may'); $('#aiLevelPicker').dispatchEvent(new CustomEvent('levelset',{detail:1})); }
      else showTab(k);
      window.scrollTo(0,0);
    }));
  });
}
const hadProgress=Account.hasLocalProgress();   // đo trước khi mở bài 1 (mở bài là tính đã xem)
initTabs();
updateStickyTop(); window.addEventListener('resize', updateStickyTop);
initAutoHideHeader();
initSettings();
initUxSettings();
addNotationHelp(); { const oh=document.getElementById('openingNotationHelp'); if(oh) oh.outerHTML=NOTATION_HELP; }
buildLegend();
initOpenings();
initMasters();
renderLesson();
initAIGame();
AIEngine.init();
initTactics();
initPuzzles();
initLearn();
const lastZone=safeLS_get('xq_zone');
initZones();
initOnline();
initAccount();
showZone('kyvien');
if(Online.wantsZone()) showStab('phong');
else if(lastZone==='satruong') showZone('satruong');
else if(lastZone==='toi') showZone('toi');
initOnboarding(hadProgress);

