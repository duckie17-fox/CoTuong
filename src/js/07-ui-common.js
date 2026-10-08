/* =========================================================================
   UI COMMON — tiện ích giao diện dùng chung
   ========================================================================= */
const $ = (sel,root)=> (root||document).querySelector(sel);
const $$ = (sel,root)=> Array.from((root||document).querySelectorAll(sel));
function esc(s){ return String(s).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }
const COLOR_VN = {red:'Đỏ', black:'Đen'};

// Biên bản ván cờ dạng bảng 2 cột (Đỏ | Đen). opts.onPick(plyIndex) để bấm xem lại nước.
function renderMoveLog(el, moves, opts){
  opts = opts || {};
  if(!moves.length){ el.innerHTML='<div class="log-empty">Chưa có nước đi nào.</div>'; return; }
  const startBlack = moves[0].color==='black';
  let html='<ol class="log-list">';
  let ply=0, n=1;
  const cell=(m,i)=>{
    if(!m) return '<span class="log-cell empty">…</span>';
    const cls=['log-cell', i===opts.active?'active':'', opts.marks&&opts.marks[i]?('mark-'+opts.marks[i]):''].join(' ');
    const tip=esc(m.text.long + (m.captured?` — ăn ${VN_NAME[m.captured]}`:'') + (m.check?' — chiếu':''));
    return `<button type="button" class="${cls}" data-ply="${i}" title="${tip}">${esc(m.text.short)}${m.captured?'<small>×</small>':''}${m.check?'<small>+</small>':''}${opts.badges&&opts.badges[i]?opts.badges[i]:''}</button>`;
  };
  if(startBlack){ html+=`<li><span class="log-n">${n}.</span>${cell(null)}${cell(moves[0],0)}</li>`; ply=1; n++; }
  for(;ply<moves.length;ply+=2,n++){
    html+=`<li><span class="log-n">${n}.</span>${cell(moves[ply],ply)}${cell(moves[ply+1],ply+1)}</li>`;
  }
  html+='</ol>';
  el.innerHTML=html;
  if(opts.onPick) $$('.log-cell[data-ply]',el).forEach(b=>b.addEventListener('click',()=>opts.onPick(+b.dataset.ply)));
  if(opts.scroll!==false){
    const act=$('.log-cell.active',el);
    if(act) act.scrollIntoView({block:'nearest'}); else el.scrollTop=el.scrollHeight;
  }
}

// Bộ điều khiển chọn/đi quân dùng chung cho các bàn tương tác
// cfg: {widget, getBoard(), canMove(color) , turn(), onMove(move), extraMeta()}
function makeClickController(cfg){
  const st={selected:null, legalDest:[]};
  function render(){
    const b=cfg.getBoard();
    const meta=Object.assign({selected:st.selected, legalDest:st.legalDest}, cfg.extraMeta?cfg.extraMeta():{});
    cfg.widget.setBoard(b, meta);
  }
  function clear(){ st.selected=null; st.legalDest=[]; }
  function click(r,c){
    const b=cfg.getBoard(), turn=cfg.turn();
    if(!cfg.canMove(turn)) return;
    if(st.selected){
      const hit=st.legalDest.find(d=>d[0]===r&&d[1]===c);
      if(hit){ const mv={from:st.selected,to:[r,c]}; clear(); cfg.onMove(mv); return; }
    }
    const p=b[r][c];
    if(p && p.color===turn && !(st.selected && st.selected[0]===r && st.selected[1]===c)){
      st.selected=[r,c];
      st.legalDest=(cfg.legalMoves?cfg.legalMoves():Engine.generateLegalMoves(b,turn))
        .filter(m=>m.from[0]===r&&m.from[1]===c).map(m=>m.to);
      if(cfg.onSelect) cfg.onSelect(st.legalDest.length);
    } else clear();
    render();
  }
  return {click, render, clear, state:st};
}

function statusBanner(el, kind, html){
  el.innerHTML = html ? `<div class="status-banner status-${kind}" role="status">${html}</div>` : '';
}

/* Cuộn để bàn cờ hiện đủ (dưới thanh tab và thanh nút đang dính ở trên) */
function stickyTop(){ const v=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sticky-top'))||0; return v; }
function revealBoard(el){
  if(!el) return;
  const shell = el.closest ? (el.closest('.board-shell')||el) : el;
  // thanh công cụ nằm ngay dưới bàn cờ: cố gắng hiện cả hai
  const tb = shell.nextElementSibling && shell.nextElementSibling.classList.contains('board-toolbar') ? shell.nextElementSibling : null;
  // thanh người chơi phía trên bàn (đấu máy, Sa trường) cũng phải thấy
  const above = shell.previousElementSibling && shell.previousElementSibling.classList.contains('ol-player') ? shell.previousElementSibling : null;
  const rs=shell.getBoundingClientRect(), ra=above ? above.getBoundingClientRect() : rs;
  const r={top:ra.top, bottom:rs.bottom, height:rs.bottom-ra.top};
  // điện thoại: cuộn xuống thì thanh trên tự ẩn (xem initAutoHideHeader) → bàn cờ được sát mép trên
  const top = (isPhone() && r.top>0 ? 0 : stickyTop())+4, extra=tb?tb.offsetHeight+6:0;
  // trừ thanh dưới (bottom nav trên điện thoại)
  const nav=document.querySelector('.zone-switch'), navH = nav && getComputedStyle(nav).position==='fixed' ? nav.offsetHeight : 0;
  const vh=(window.innerHeight||document.documentElement.clientHeight)-navH;
  if(r.top>=top && r.bottom+extra<=vh) return;              // đã thấy đủ
  if(r.top>=top && r.height+extra>vh-top && r.top<vh*0.35) return; // bàn cao hơn màn hình nhưng đang ở vị trí tốt
  window.scrollBy({top:r.top-top, behavior:'smooth'});
}
function isPhone(){ try{ return !!(window.matchMedia && matchMedia('(max-width:767px)').matches); }catch(e){ return false; } }
// Điện thoại: cuộn xuống thì ẩn thanh trên (nhường chỗ cho bàn cờ), cuộn lên thì hiện lại
function initAutoHideHeader(){
  let lastY=window.scrollY||0;
  window.addEventListener('scroll',()=>{
    const y=window.scrollY||0, d=y-lastY; lastY=y;
    const dlg=document.getElementById('dlg');
    if(!isPhone() || y<60 || (dlg && !dlg.hidden)){ document.body.classList.remove('hdr-hide'); return; }
    if(d>4) document.body.classList.add('hdr-hide'); else if(d<-4) document.body.classList.remove('hdr-hide');
  }, {passive:true});
}
function updateStickyTop(){
  const head=document.querySelector('.app-header');
  const sticky = head && getComputedStyle(head).position==='sticky';
  document.documentElement.style.setProperty('--sticky-top', (sticky?head.offsetHeight:0)+'px');
  if(head) document.documentElement.style.setProperty('--hdr-h', head.offsetHeight+'px');
}

/* Trình bày phân tích theo quy trình tư duy: mỗi bước một câu hỏi + câu trả lời ngắn */
function thinkStepsHTML(steps){
  return `<ol class="think-steps">${steps.filter(Boolean).map(st=>`<li class="${st.cls||''}"><span class="ts-ic">${icon(st.ic)}</span><div><b class="ts-q">${st.q}</b>${st.html}</div></li>`).join('')}</ol>`;
}
// Quy điểm của máy ra lời thường (thang điểm: Tốt ≈ 30, Sĩ/Tượng ≈ 120, Mã/Pháo ≈ 280, Xe ≈ 600)
function lossWords(loss){
  return loss<40 ? 'gần như không thiệt' : loss<100 ? 'thiệt nhỏ, cỡ 1–2 Tốt' : loss<250 ? 'thiệt đáng kể, cỡ vài Tốt hoặc một Sĩ/Tượng'
    : loss<550 ? 'thiệt lớn, cỡ mất một Mã hoặc Pháo' : 'thiệt rất lớn, cỡ mất một Xe trở lên';
}
// Thế cờ theo góc nhìn một bên: v > 0 là bên đó đang hơn. who: tên bên đó ("Bạn"/"Đỏ"), opp: tên bên kia
function evalWords(v, who, opp){
  if(v>=1900) return `${who} có đòn thắng`;
  if(v<=-1900) return `${opp} có đòn thắng`;
  const a=Math.abs(v), side = v>0 ? who : opp;
  if(a<40) return 'hai bên ngang nhau';
  return `${side} ${a<100?'hơn một chút':a<250?'hơn rõ (cỡ vài Tốt)':a<550?'hơn nhiều (cỡ một Mã/Pháo)':'hơn rất nhiều (cỡ một Xe)'}`;
}


/* ---------- Icon nét (SVG) dùng chung — không dùng emoji làm icon ---------- */
const ICON_PATHS = {
  music:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  musicOff:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="m2 2 20 20"/>',
  academy:'<path d="M3 22h18"/><path d="M6 18v-7"/><path d="M10 18v-7"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M12 2 21 7H3z"/>',
  swords:'<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/><path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="m5 14 4 4"/><path d="m7 17-3 3"/><path d="m3 19 2 2"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  trophy:'<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.7V17c0 .6-.5 1-1 1.2C7.8 18.8 7 20.2 7 22"/><path d="M14 14.7V17c0 .6.5 1 1 1.2 1.2.6 2 2 2 3.8"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>',
  undo:'<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  bulb:'<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>',
  flip:'<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>',
  flag:'<path d="M4 22V4"/><path d="M4 4h13l-2 4 2 4H4"/>',
  left:'<path d="m15 18-6-6 6-6"/>',
  right:'<path d="m9 18 6-6-6-6"/>',
  back:'<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  prevErr:'<path d="M19 20 9 12l10-8z"/><path d="M5 19V5"/>',
  nextErr:'<path d="m5 4 10 8-10 8z"/><path d="M19 5v14"/>',
  play:'<path d="m7 4 13 8-13 8z"/>',
  copy:'<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  folder:'<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z"/>',
  link:'<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/>',
  repeat:'<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  shuffle:'<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/>',
  trash:'<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  alert:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  star:'<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  chart:'<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  target:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  question:'<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  book:'<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  scale:'<path d="M12 3v18"/><path d="M5 21h14"/><path d="M3 7h18"/><path d="m6 7-3 7a3 3 0 0 0 6 0z"/><path d="m18 7-3 7a3 3 0 0 0 6 0z"/>',
  down:'<path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
  flame:'<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1-2.1-.2-4.1 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.4 1.4 1.4 2.8 2.5 2.8z"/>',
  calendar:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  chat:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  plus:'<path d="M12 5v14"/><path d="M5 12h14"/>',
  login:'<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/>',
  sync:'<path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M3 21v-5h5"/>',
  draw:'<circle cx="12" cy="12" r="10"/><path d="M8 10h8"/><path d="M8 14h8"/>',
  note:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/>',
};
// icon('undo') → <svg> dùng symbol trong sprite (chèn một lần vào đầu body)
function icon(name, cls){ return `<svg class="ic${cls?' '+cls:''}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`; }
(function injectIconSprite(){
  const sym=Object.entries(ICON_PATHS).map(([k,p])=>`<symbol id="i-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</symbol>`).join('');
  document.body.insertAdjacentHTML('afterbegin', `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">${sym}</svg>`);
})();

/* ---------- Thanh người chơi trên/dưới bàn cờ (đấu máy, Sa trường) ---------- */
const CAPTURE_ORDER = ['R','C','H','E','A','S'];
// Các quân `color` đã ăn được (loại quân của đối phương), xếp theo giá trị
function capturedBy(moves, color){
  return moves.filter(m=>m.color===color && m.captured).map(m=>m.captured).sort((a,b)=>CAPTURE_ORDER.indexOf(a)-CAPTURE_ORDER.indexOf(b));
}
// p: {color, name, sub, active, captured:[loại], note, me}
function playerBarHTML(p){
  const opp = p.color==='red' ? 'black' : 'red';
  const caps = (p.captured||[]).map(t=>`<span class="cap cap-${opp}" title="${VN_NAME[t]}">${PIECE_CHAR[opp][t]}</span>`).join('');
  return `<span class="turn-dot turn-${p.color}"></span>
    <span class="pb-main"><span class="ol-pname">${esc(p.name)}${p.me?' <small>(bạn)</small>':''}</span>${p.sub?`<small class="pb-sub">${p.sub}</small>`:''}</span>
    <span class="pb-caps" aria-label="Quân đã ăn">${caps}</span>
    ${p.note?`<span class="ol-turn">${p.note}</span>`:''}`;
}
function setPlayerBar(el, p){ el.innerHTML=playerBarHTML(p); el.classList.toggle('pb-active', !!p.active); }
