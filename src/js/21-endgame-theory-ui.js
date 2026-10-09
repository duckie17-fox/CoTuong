/* =========================================================================
   UI TÀN CUỘC LÝ THUYẾT
   Dữ liệu ENDGAME_THEORY sinh tự động từ bảng tàn cuộc (tools/make-endgames.js).
   Mỗi thế: kết luận lý thuyết, thống kê máy đã tính, một thế đại diện để bạn
   tự đánh (máy phòng thủ) và chuỗi nước tối ưu của hai bên.
   ========================================================================= */
const EG_GROUPS = [
  {id:'don',  name:'Một quân đấu Tướng trơ'},
  {id:'ma',   name:'Mã'},
  {id:'phao', name:'Pháo'},
  {id:'tot',  name:'Tốt'},
  {id:'xe',   name:'Xe'},
  {id:'nguon',name:'Thế lớn (theo sách)'},
];
let egFilter='all';
function egSeen(){ return safeJSON('xq_eg_seen',[]); }
function egBadge(it,compact){
  const res = it.result==='win' ? '<span class="badge badge-easy">Thắng</span>' : '<span class="badge badge-mid">Hoà</span>';
  const ver = it.verified ? '<span class="badge badge-verified" title="Máy đã tính hết mọi thế của loại tàn cuộc này">Máy kiểm chứng</span>'
                          : '<span class="badge badge-source" title="Thế quá lớn để tính hết; kết luận theo sách tàn cuộc">Theo sách</span>';
  return compact ? res : res+ver;
}
function renderEndgameTheoryList(){
  const host=$('#egTheory'); if(!host || typeof ENDGAME_THEORY==='undefined') return;
  const seen=egSeen();
  const chips=[{id:'all',name:'Tất cả'}].concat(EG_GROUPS).map(g=>
    `<button class="chip ${egFilter===g.id?'on':''}" data-eg-filter="${g.id}" aria-pressed="${egFilter===g.id}">${esc(g.name)}</button>`).join('');
  const groups=EG_GROUPS.filter(g=>egFilter==='all'||egFilter===g.id).map(g=>{
    const items=ENDGAME_THEORY.filter(x=>x.group===g.id);
    if(!items.length) return '';
    return `<h4 class="eg-group-h">${esc(g.name)}</h4><div class="topic-grid">${items.map(it=>
      `<button class="opening-card topic-card topic-row ${seen.includes(it.key)?'seen':''}" data-eg="${it.key}">
        <h4>${esc(it.title)}</h4><span class="tr-end">${seen.includes(it.key)?'<span class="solved-check" title="Đã xem"><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-check"></use></svg></span>':''}${egBadge(it,true)}</span></button>`).join('')}</div>`;
  }).join('');
  host.innerHTML=`<div class="chip-row" role="group" aria-label="Lọc theo nhóm">${chips}</div>${groups}`;
  $$('[data-eg-filter]',host).forEach(b=>b.addEventListener('click',()=>{ egFilter=b.dataset.egFilter; renderEndgameTheoryList(); }));
  $$('[data-eg]',host).forEach(b=>b.addEventListener('click',()=>openEndgameTheory(b.dataset.eg)));
}
function egStatsHtml(it){
  if(!it.verified || !it.stats) return `<div class="eg-stats eg-stats-src"><b>Theo sách.</b> Thế này có quá nhiều quân để máy tính hết mọi khả năng, nên kết luận được ghi theo sách tàn cuộc. Bạn vẫn có thể tự đánh thử với máy.</div>`;
  const s=it.stats, fmt=n=>n.toLocaleString('vi-VN');
  let h=`<div class="eg-stats"><b>Máy đã kiểm chứng.</b> Bảng tàn cuộc đã tính <b>${fmt(s.n)}</b> thế loại này (Đỏ đi trước): Đỏ thắng <b>${String(s.winPct).replace('.',',')}%</b>.`;
  if(s.std && s.filtWinPct!=null) h+=` Riêng khi ${esc(s.std)}: Đỏ thắng <b>${String(s.filtWinPct).replace('.',',')}%</b>${s.sampled?' (ước tính trên mẫu '+fmt(s.filtN)+' thế)':''}.`;
  const rate = s.std && s.filtWinPct!=null ? s.filtWinPct : s.winPct;
  if(it.result==='draw') h+= rate<=10 ? ' → Phần lớn là <b>hoà</b>: bên mạnh chỉ thắng khi bên yếu đứng sai.' : ' → Thắng được khi bên yếu chưa đứng vững, còn phòng thủ đúng thì <b>thường hoà</b>.';
  else h+= rate>=95 ? ' → Gần như <b>luôn thắng</b>, miễn là bạn biết cách.' : ' → Thường thắng, trừ vài thế bên yếu đã đứng rất tốt.';
  return h+'</div>';
}
function openEndgameTheory(key){
  const list=ENDGAME_THEORY, idx=list.findIndex(x=>x.key===key), it=list[idx];
  const seen=egSeen(); if(!seen.includes(key)){ seen.push(key); safeLS_set('xq_eg_seen',JSON.stringify(seen)); }
  $('#tacticListCard').hidden=true; $('#tacticDetailCard').hidden=false;
  const pos = it.position ? it.position.pieces : it.pieces;
  const board = mkBoard(pos.map(p=>[p[0],p[1],p[2],p[3]]));
  const dtmMoves = it.position && it.result==='win' ? Math.ceil(it.position.dtm/2) : null;
  const caption = it.result==='win'
    ? (dtmMoves ? `Bạn cầm Đỏ. Đánh hay nhất thì thắng trong ${dtmMoves} nước; máy giữ Đen và chống cự lâu nhất có thể.` : 'Bạn cầm Đỏ, máy giữ Đen. Hãy tìm cách thắng.')
    : 'Bạn cầm Đỏ, máy giữ Đen. Thử xem bạn có phá được không — nếu bên yếu phòng thủ đúng thì đây là thế hoà.';
  $('#tacticContent').innerHTML = `
    <div class="lesson-head"><h3>${esc(it.title)}</h3>${egBadge(it)}</div>
    <div class="lesson-body"><div class="lesson-text">
      ${egStatsHtml(it)}
      <p><b>Vì sao?</b> ${esc(it.why)}</p>
      ${it.position && it.position.pvText && it.result==='win' ? `<p class="hint-text">Mẹo: bấm "Xem lời giải" để xem cả hai bên đánh tối ưu (${it.position.pvText.length} nửa nước). Để ý <b>quân nào khoá đường, quân nào chiếu</b>, đừng chỉ nhớ nước.</p>`:''}
      <p class="sources">Nguồn kết luận: ${esc(it.source||'')}</p>
    </div><div class="lesson-demos"><div class="lesson-demo-slot"></div></div></div>
    <div class="lesson-foot"><button class="btn btn-outline" id="tacPrev" ${idx===0?'disabled':''}><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-left"></use></svg>Trước</button><span class="hint-text">Tàn cuộc lý thuyết ${idx+1}/${list.length}</span><button class="btn btn-jade" id="tacNext" ${idx===list.length-1?'disabled':''}>Tiếp<svg class="ic" aria-hidden="true" focusable="false"><use href="#i-right"></use></svg></button></div>`;
  initLessonDemo($('.lesson-demo-slot',$('#tacticContent')), {
    board, toMove:RED, mode:'endgame', result:it.result, defender:'engine', thinkMs:700,
    pv: it.position ? it.position.pv : undefined, caption });
  $('#tacPrev').addEventListener('click',()=>openEndgameTheory(list[idx-1].key));
  $('#tacNext').addEventListener('click',()=>openEndgameTheory(list[idx+1].key));
  $('#tacticDetailCard').scrollIntoView({block:'start'});
}

/* Tự sinh bởi tools/make-satcuc.js (danh mục tools/satcuc-catalog.js + thế luyện tools/gen-patterns.js) — không sửa tay */
/*@@DATA:satcuc@@*/

