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
  const tb = shell.previousElementSibling && shell.previousElementSibling.classList.contains('board-toolbar') ? shell.previousElementSibling : null;
  const r=shell.getBoundingClientRect();
  const top=stickyTop()+(tb?tb.offsetHeight+6:0)+4;
  const vh=window.innerHeight||document.documentElement.clientHeight;
  if(r.top>=top && r.bottom<=vh) return;              // đã thấy đủ
  if(r.top>=top && r.height>vh-top && r.top<vh*0.35) return; // bàn cao hơn màn hình nhưng đang ở vị trí tốt
  window.scrollBy({top:r.top-top, behavior:'smooth'});
}
function updateStickyTop(){
  const tabs=document.querySelector('.tabs');
  const sticky = tabs && getComputedStyle(tabs).position==='sticky';
  document.documentElement.style.setProperty('--sticky-top', (sticky?tabs.offsetHeight:0)+'px');
}

/* Trình bày phân tích theo quy trình tư duy: mỗi bước một câu hỏi + câu trả lời ngắn */
function thinkStepsHTML(steps){
  return `<ol class="think-steps">${steps.filter(Boolean).map(st=>`<li class="${st.cls||''}"><span class="ts-ic" aria-hidden="true">${st.ic}</span><div><b class="ts-q">${st.q}</b>${st.html}</div></li>`).join('')}</ol>`;
}
function lossWords(loss){ return loss<100?'chênh lệch nhỏ':loss<250?'mất lợi thế đáng kể':loss<600?'thiệt hại lớn (tương đương mất một quân nhỏ)':'thiệt hại rất lớn'; }

