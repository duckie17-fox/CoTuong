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
initTabs();
updateStickyTop(); window.addEventListener('resize', updateStickyTop);
initSettings();
initUxSettings();
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
showTab(TAB_KEYS.includes(safeLS_get('xq_last_tab')) ? safeLS_get('xq_last_tab') : 'hoc');
if(Online.wantsZone() || lastZone==='satruong') showZone('satruong');
else if(lastZone==='toi') showZone('toi');

