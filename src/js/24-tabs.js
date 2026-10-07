/* =========================================================================
   TABS — có aria-selected, role=tabpanel, điều hướng bằng phím mũi tên
   ========================================================================= */
const TAB_KEYS = $$('.tab-btn').map(b=>b.dataset.tab);
function showTab(key, focus){
  TAB_KEYS.forEach(k=>{
    const panel=$(`section[data-panel="${k}"]`), btn=$(`.tab-btn[data-tab="${k}"]`);
    const on = k===key;
    panel.hidden = !on;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', on?'true':'false');
    btn.tabIndex = on?0:-1;
    if(on && focus) btn.focus();
    if(on) btn.scrollIntoView({block:'nearest', inline:'nearest'});
  });
  safeLS_set('xq_last_tab', key);
  document.dispatchEvent(new CustomEvent('tabshown',{detail:key}));
}
function initTabs(){
  $$('.tab-btn').forEach(btn=>{
    const k=btn.dataset.tab;
    btn.id='tab-'+k;
    btn.setAttribute('aria-controls','panel-'+k);
    const panel=$(`section[data-panel="${k}"]`);
    panel.id='panel-'+k; panel.setAttribute('role','tabpanel'); panel.setAttribute('aria-labelledby','tab-'+k);
    btn.addEventListener('click',()=> showTab(k));
    btn.addEventListener('keydown',e=>{
      const i=TAB_KEYS.indexOf(k);
      let n=null;
      if(e.key==='ArrowRight') n=(i+1)%TAB_KEYS.length;
      else if(e.key==='ArrowLeft') n=(i-1+TAB_KEYS.length)%TAB_KEYS.length;
      else if(e.key==='Home') n=0; else if(e.key==='End') n=TAB_KEYS.length-1;
      if(n!==null){ e.preventDefault(); showTab(TAB_KEYS[n], true); }
    });
  });
}

