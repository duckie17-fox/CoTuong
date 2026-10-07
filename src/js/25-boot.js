/* =========================================================================
   BOOT
   ========================================================================= */
function initSettings(){
  const sel=$('#pieceStyleToggle');
  const sync=()=>{ $$('button',sel).forEach(b=>b.setAttribute('aria-pressed', b.dataset.style===Settings.pieceStyle?'true':'false')); };
  $$('button',sel).forEach(b=>b.addEventListener('click',()=>{ Settings.set('pieceStyle', b.dataset.style); sync(); buildLegend(); }));
  sync();
}
initTabs();
updateStickyTop(); window.addEventListener('resize', updateStickyTop);
initSettings();
buildLegend();
initOpenings();
initMasters();
renderLesson();
initAIGame();
AIEngine.init();
initTactics();
initPuzzles();
showTab(TAB_KEYS.includes(safeLS_get('xq_last_tab')) ? safeLS_get('xq_last_tab') : 'hoc');

