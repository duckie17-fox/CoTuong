/* =========================================================================
   ĐIỀU HƯỚNG — ba phần (Học / Chơi / Tôi), mỗi phần một hàng thẻ con.
   Mã nội bộ vẫn là kyvien / satruong (giữ dữ liệu đã lưu). Thẻ "Đấu máy" (panel "may")
   nằm ở hàng thẻ của phần Chơi dù là một section[data-panel].
   Điện thoại và máy tính dùng chung một kiểu; chỉ khác độ rộng.
   ========================================================================= */
const TAB_KEYS = $$('.tab-btn[data-tab]').map(b=>b.dataset.tab);
const ST_KEYS = $$('.st-btn').map(b=>b.dataset.stab);
const ZONES = ['kyvien','satruong','toi'];

// Hàng thẻ dùng chung: aria-selected, phím mũi tên / Home / End
function wireTabRow(btns, keyOf, onPick){
  const keys=btns.map(keyOf);
  btns.forEach(btn=>{
    const k=keyOf(btn);
    btn.addEventListener('click',()=> onPick(k));
    btn.addEventListener('keydown',e=>{
      const i=keys.indexOf(k);
      let n=null;
      if(e.key==='ArrowRight') n=(i+1)%keys.length;
      else if(e.key==='ArrowLeft') n=(i-1+keys.length)%keys.length;
      else if(e.key==='Home') n=0; else if(e.key==='End') n=keys.length-1;
      if(n!==null){ e.preventDefault(); onPick(keys[n], true); }
    });
  });
}
function markTabRow(btns, keyOf, key, focus){
  btns.forEach(btn=>{
    const on=keyOf(btn)===key;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', on?'true':'false');
    btn.tabIndex = on?0:-1;
    if(on && focus) btn.focus();
    if(on) btn.scrollIntoView({block:'nearest', inline:'nearest'});
  });
}

const PLAY_TABS=['may'];   // các panel thuộc phần Chơi
const tabKey = b=>b.dataset.tab||b.dataset.stab;
function showTab(key, focus){
  const play=PLAY_TABS.includes(key);
  setZoneUI(play?'satruong':'kyvien');
  const zp=$('section[data-zone-panel="satruong"]'); if(play && zp) zp.hidden=true;
  TAB_KEYS.forEach(k=>{ $(`section[data-panel="${k}"]`).hidden = k!==key; });
  markTabRow($$('.tab-btn'), tabKey, key, focus);
  if(play){ currentStab=key; safeLS_set('xq_last_stab', key); }
  else safeLS_set('xq_last_tab', key);
  document.dispatchEvent(new CustomEvent('tabshown',{detail:key}));
}
function initTabs(){
  $$('.tab-btn[data-tab]').forEach(btn=>{
    const k=btn.dataset.tab, panel=$(`section[data-panel="${k}"]`);
    btn.id='tab-'+k; btn.setAttribute('aria-controls','panel-'+k);
    panel.id='panel-'+k; panel.setAttribute('role','tabpanel'); panel.setAttribute('aria-labelledby','tab-'+k);
  });
  wireTabRow($$('[data-zone-tabs="kyvien"] .tab-btn'), tabKey, showTab);
  wireTabRow($$('[data-zone-tabs="satruong"] .tab-btn'), tabKey, showStab);
  $$('[data-goto-stab]').forEach(b=>b.addEventListener('click',()=>showStab(b.dataset.gotoStab)));
  initSidePanels();
}

/* ---------- Thẻ con của Sa trường ---------- */
let currentStab = safeLS_get('xq_last_stab') || 'phong';
function showStab(key, focus){
  if(PLAY_TABS.includes(key)){ showTab(key, focus); return; }
  if(!ST_KEYS.includes(key)) key='phong';
  currentStab=key; safeLS_set('xq_last_stab', key);
  setZoneUI('satruong');
  const zp=$('section[data-zone-panel="satruong"]'); if(zp) zp.hidden=false;
  PLAY_TABS.forEach(k=>{ const p=$(`section[data-panel="${k}"]`); if(p) p.hidden=true; });
  $$('[data-stpanel]').forEach(p=>{ p.hidden = p.dataset.stpanel!==key; });
  markTabRow($$('.tab-btn'), tabKey, key, focus);
  document.dispatchEvent(new CustomEvent('zoneshown',{detail:'satruong'}));
}

/* ---------- Ba phần ---------- */
let currentZone='kyvien';
function setZoneUI(z){
  if(z===currentZone && document.body.dataset.zone===z) return;
  currentZone=z; document.body.dataset.zone=z;
  $$('.zone-btn').forEach(b=>b.setAttribute('aria-pressed', b.dataset.zone===z?'true':'false'));
  $$('[data-zone-tabs]').forEach(t=>{ t.hidden = t.dataset.zoneTabs!==z; });
  $$('section[data-zone-panel]').forEach(p=>{ p.hidden = p.dataset.zonePanel!==z; });
  if(z!=='kyvien') TAB_KEYS.forEach(k=>{ $(`section[data-panel="${k}"]`).hidden=true; });
  safeLS_set('xq_zone', z);
  updateStickyTop();
}
function showZone(z){
  if(z==='kyvien'){ const t=safeLS_get('xq_last_tab'); showTab(TAB_KEYS.includes(t) && !PLAY_TABS.includes(t) ? t : 'hoc'); return; }
  if(z==='satruong'){ showStab(currentStab); return; }
  setZoneUI(z);
  document.dispatchEvent(new CustomEvent('zoneshown',{detail:z}));
}
function initZones(){
  $$('.zone-btn').forEach(b=>b.addEventListener('click',()=>{ showZone(b.dataset.zone); window.scrollTo(0,0); }));
}

/* ---------- Bảng phụ có thẻ cạnh bàn cờ (Biên bản · Giải thích · Chat…) ---------- */
function sidePanelShow(panel, key){
  $$('.side-tab',panel).forEach(b=>{
    const on=b.dataset.sideTab===key;
    b.classList.toggle('active',on); b.setAttribute('aria-selected',on?'true':'false'); b.tabIndex=on?0:-1;
    if(on){ const d=$('.side-dot',b); if(d) d.hidden=true; }
  });
  $$('.side-pane',panel).forEach(p=>{ p.hidden = p.dataset.sidePane!==key; });
  panel.dataset.sideOpen=key;
}
// Gọi từ nơi khác: mở thẻ theo id phần tử bên trong (vd. sideTabFor('#olChat'))
function sideTabFor(sel){
  const el=$(sel), pane=el && el.closest('.side-pane');
  if(pane) sidePanelShow(pane.closest('.side-panel'), pane.dataset.sidePane);
}
// Báo có nội dung mới ở thẻ đang không mở (chấm đỏ)
function sideTabNotify(sel){
  const el=$(sel), pane=el && el.closest('.side-pane'); if(!pane) return;
  const panel=pane.closest('.side-panel');
  if(panel.dataset.sideOpen===pane.dataset.sidePane) return;
  const d=$(`.side-tab[data-side-tab="${pane.dataset.sidePane}"] .side-dot`,panel); if(d) d.hidden=false;
}
function initSidePanels(){
  $$('.side-panel').forEach(panel=>{
    const tabs=$$('.side-tab',panel);
    if(tabs.length<2) panel.classList.add('single');
    wireTabRow(tabs, b=>b.dataset.sideTab, (k,focus)=>{ sidePanelShow(panel,k); if(focus) $(`.side-tab[data-side-tab="${k}"]`,panel).focus(); });
    sidePanelShow(panel, panel.dataset.sideDefault || tabs[0].dataset.sideTab);
  });
}
