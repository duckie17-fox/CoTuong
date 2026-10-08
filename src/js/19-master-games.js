/* =========================================================================
   VÁN DANH THỦ — xem từng nước, đánh giá của máy, chú giải, chế độ "Đoán nước"
   Dữ liệu MASTER_GAMES (data-games-gen.js) sinh bởi tools/make-games.js.
   ========================================================================= */
const ms = { g:null, game:null, pos:0, widget:null, ctl:null, guess:false, side:'both', right:0, total:0, feedback:'' };

function masterEvalText(e){ return evalWords(e,'Đỏ','Đen'); }
function masterKeyPlies(g){
  const keys=[];
  g.plies.forEach((p,k)=>{
    const prev=k?g.plies[k-1].e:0;
    if(g.notes[k] || Math.abs(p.e-prev)>=150 || p.l>=150) keys.push(k);
  });
  return keys;
}
function renderMasterList(){
  const el=$('#masterGrid'); if(!el || typeof MASTER_GAMES==='undefined') return;
  el.innerHTML=MASTER_GAMES.map(g=>`<button class="opening-card topic-card" data-master="${g.id}">
    <div class="puzzle-top"><span class="badge ${g.result==='1-0'?'badge-hard':g.result==='0-1'?'badge-mid':'badge-easy'}">${g.year}</span>
      <span class="badge ${g.verified>=2?'badge-verified':'badge-source'}">${g.verified>=2?'✓ 2 nguồn':'1 nguồn'}</span></div>
    <h4>${esc(g.red)} – ${esc(g.black)}</h4><span class="han-sm">${esc(g.redHan)} – ${esc(g.blackHan)}</span>
    <p>${esc(g.resultText)} · ${Math.ceil(g.plies.length/2)} nước · ${esc(g.event)}</p></button>`).join('');
  $$('[data-master]',el).forEach(b=>b.addEventListener('click',()=>openMaster(b.dataset.master)));
}
function showOpeningSub(id){
  $$('#openingListCard [data-osub]').forEach(b=>{ const on=b.dataset.osub===id; b.classList.toggle('on',on); b.setAttribute('aria-selected',on); });
  $$('#openingListCard [data-opanel]').forEach(p=>p.hidden=p.dataset.opanel!==id);
  safeLS_set('xq_open_sub',id);
}
function openMaster(id){
  const g=MASTER_GAMES.find(x=>x.id===id); ms.g=g;
  ms.game=Game.create();
  for(const p of g.plies) ms.game.play({from:[p.m[0],p.m[1]],to:[p.m[2],p.m[3]]});
  ms.pos=0; ms.right=0; ms.total=0; ms.feedback='';
  $('#openingListCard').hidden=true; $('#masterCard').hidden=false;
  $('#masterTitle').innerHTML=`${esc(g.red)} <span class="han-sm">${esc(g.redHan)}</span> – ${esc(g.black)} <span class="han-sm">${esc(g.blackHan)}</span>`;
  $('#masterHead').innerHTML=`<b>${g.year}</b> · ${esc(g.event)} · <b>${esc(g.resultText)}</b><br>${esc(g.famous)}`;
  $('#masterSources').innerHTML=`Nguồn biên bản (${g.verified>=2?'đã đối chiếu khớp từng nước ở hai nguồn':'một nguồn, đã kiểm mọi nước hợp lệ'}): ${g.sources.map(([t,u])=>`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`).join(' · ')}. Đánh giá và chú giải tự động là của máy (tìm kiếm có giới hạn thời gian), có thể khác nhận định của danh thủ.`;
  if(!ms.widget){
    ms.widget=createBoardWidget($('#masterBoard'),{onSquareClick:(r,c)=>ms.ctl.click(r,c), label:'Bàn cờ ván danh thủ'});
    ms.ctl=makeClickController({
      widget:ms.widget,
      getBoard:()=>masterBoard(),
      turn:()=>ms.pos%2===0?RED:BLACK,
      canMove:(t)=>masterGuessing() && t===(ms.pos%2===0?RED:BLACK),
      onMove:masterGuessMove,
      extraMeta:()=>masterMeta(),
    });
  }
  ms.widget.setFlipped(false);
  masterRender();
  $('#masterCard').scrollIntoView({block:'start'});
}
function masterBoard(){ return ms.pos===0 ? ms.game.start : ms.game.boards[ms.pos-1]; }
function masterGuessing(){
  if(!ms.guess || ms.pos>=ms.g.plies.length) return false;
  const c=ms.pos%2===0?'red':'black';
  return ms.side==='both' || ms.side===c;
}
function masterMeta(){
  const m={lastMove: ms.pos>0 ? ms.game.moves[ms.pos-1] : null};
  const b=masterBoard(), t=ms.pos%2===0?RED:BLACK;
  if(Engine.isInCheck(b,t)) m.checkSq=Engine.findGeneral(b,t);
  if(!masterGuessing() && ms.pos>0){
    const p=ms.g.plies[ms.pos-1];
    if(p.b && p.l>=60) m.arrows=[{from:[p.b[0],p.b[1]],to:[p.b[2],p.b[3]]}];
  }
  return m;
}
function masterExplain(k){
  const g=ms.g, p=g.plies[k], m=ms.game.moves[k];
  const before = k===0 ? ms.game.start : ms.game.boards[k-1];
  const who = m.color===RED ? g.red : g.black;
  const head=`<div class="rv-head"><b>${Math.floor(k/2)+1}${m.color===RED?'.':'...'} ${esc(m.text.short)}</b> <span class="hint-text">(${esc(who)}, ${m.color===RED?'Đỏ':'Đen'} · ${esc(m.text.long)})</span></div>`;
  const steps=[
    g.notes[k] && {ic:'📝', q:'Chú giải', cls:'ts-q-row', html:g.notes[k]},
    {ic:'👀', q:'Trước nước này: đối phương đang doạ gì?', html:esc(Coach.threatText(before,m.color))},
    {ic:'🔎', q:`${esc(who)} làm gì?`, html:esc(Coach.plainMove(before,m))+'.'},
  ];
  if(p.l<=40) steps.push({ic:'✅', q:'Máy đánh giá', cls:'ts-good', html:'Ngang với lựa chọn của máy.'});
  else {
    const bm={from:[p.b[0],p.b[1]],to:[p.b[2],p.b[3]]};
    const bt=Notation.describe(before,bm), bw=Coach.whyGood(before,bm);
    steps.push({ic:p.l>=150?'⚠️':'💡', q:p.l>=150?'Máy không đồng ý':'Máy có lựa chọn khác', cls:p.l>=150?'ts-bad':'', html:`Máy thích <b>${esc(bt.short)}</b> (mũi tên xanh)${bw.length?' vì nó '+esc(bw.join('; ')):''}; ${lossWords(p.l)}.`});
    if(p.l>=150) steps.push({ic:'🧠', q:'Tự hỏi', cls:'ts-q-row', html:'Danh thủ thấy gì mà chọn nước khác? Đôi khi đó là kế hoạch dài hơn tầm tính của máy, đôi khi đó thật sự là sai lầm — thử tự tính vài nước tiếp theo.'});
  }
  return head+thinkStepsHTML(steps)+`<p class="hint-text small">Sau nước này: ${masterEvalText(p.e)}.</p>`;
}
function masterRender(){
  const g=ms.g, n=g.plies.length, pos=ms.pos;
  ms.ctl.clear(); ms.ctl.render();
  renderMoveLog($('#masterLog'), ms.game.moves.slice(0, masterGuessing()||ms.guess ? pos : n), {active:pos-1, onPick:(k)=>{ if(ms.guess && k>=pos) return; ms.pos=k+1; ms.feedback=''; masterRender(); revealBoard($('#masterBoard')); }});
  $('#masterProgress').textContent=`Nước ${Math.ceil(pos/2)} / ${Math.ceil(n/2)}`+(ms.guess&&ms.total?` · đoán đúng ${ms.right}/${ms.total}`:'');
  $('#masterPrev').disabled=pos===0;
  $('#masterNext').disabled=pos>=n;
  const det=$('#masterDetail');
  let html=ms.feedback;
  if(masterGuessing()) html+=`<p class="rv-text">🎯 Đến lượt <b>${esc(pos%2===0?g.red:g.black)}</b> (${pos%2===0?'Đỏ':'Đen'}). Bạn sẽ đi nước nào? Hãy tự hỏi: đối phương vừa doạ gì, có nước Chiếu – Ăn – Doạ nào không? Rồi đi thử trên bàn. (Bấm "Nước tiếp" để bỏ qua.)</p>`;
  else if(pos>0) html+=masterExplain(pos-1);
  else html+=`<p class="hint-text">Thế xuất phát. Bấm <b>Nước tiếp →</b> để xem từng nước, hoặc bật <b>Đoán nước</b> để tự đoán trước.</p>`;
  if(pos>=n) html+=`<p class="rv-text"><b>Kết thúc: ${esc(g.resultText)}.</b>${ms.guess&&ms.total?` Bạn đoán đúng ${ms.right}/${ms.total} nước (${Math.round(100*ms.right/ms.total)}%).`:''}</p>`;
  det.innerHTML=html;
  masterChart();
}
function masterChart(){
  const g=ms.g, n=g.plies.length, W=600, H=110, pad=6;
  const shown = ms.guess ? ms.pos : n;
  const vals=[0].concat(g.plies.map(p=>p.e)).slice(0,shown+1);
  const x=i=>pad+(W-2*pad)*i/Math.max(1,n), y=v=>H/2-(H/2-pad)*Math.max(-1,Math.min(1,v/800));
  const path=vals.map((v,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const keys=masterKeyPlies(g).filter(k=>k<shown).map(k=>`<circle class="dot dot-key" cx="${x(k+1)}" cy="${y(vals[k+1])}" r="4.5" data-k="${k}"><title>Nước then chốt ${Math.floor(k/2)+1}</title></circle>`).join('');
  $('#masterChart').innerHTML=`<svg viewBox="0 0 ${W} ${H}" class="eval-svg" role="img" aria-label="Biểu đồ đánh giá của máy theo từng nước (phía trên: Đỏ hơn)">
    <line x1="0" x2="${W}" y1="${H/2}" y2="${H/2}" class="mid"/><path d="${path}" class="line"/>${keys}
    <line class="cursor" x1="${x(ms.pos)}" x2="${x(ms.pos)}" y1="0" y2="${H}"/></svg>
    <div class="chart-legend"><span>▲ Đỏ hơn</span><span>● nước then chốt</span><span>▼ Đen hơn</span></div>`;
  $$('.dot-key',$('#masterChart')).forEach(d=>d.addEventListener('click',()=>{ ms.pos=+d.dataset.k+1; ms.feedback=''; masterRender(); revealBoard($('#masterBoard')); }));
}
function masterGuessMove(mv){
  const k=ms.pos, p=ms.g.plies[k], real={from:[p.m[0],p.m[1]],to:[p.m[2],p.m[3]]};
  const same=(a,b)=>a.from+''===b.from+''&&a.to+''===b.to+'';
  const before=masterBoard();
  const tried=Notation.describe(before,mv).short, realTxt=Notation.describe(before,real).short;
  ms.total++;
  if(same(mv,real)){ ms.right++; ms.feedback=`<p class="rv-text ok-text">✔ Chính xác! Bạn đi giống danh thủ: <b>${esc(realTxt)}</b>.</p>`; }
  else if(p.b && same(mv,{from:[p.b[0],p.b[1]],to:[p.b[2],p.b[3]]})) ms.feedback=`<p class="rv-text">👍 <b>${esc(tried)}</b> là nước máy đánh giá cao nhất — rất tốt! Danh thủ chọn <b>${esc(realTxt)}</b>.</p>`;
  else ms.feedback=`<p class="rv-text">Bạn đi <b>${esc(tried)}</b>, danh thủ chọn <b>${esc(realTxt)}</b>. Xem phần giải thích bên dưới để hiểu vì sao.</p>`;
  ms.pos++;
  // sau nước đoán, tự đi luôn các nước của bên không cần đoán
  masterAutoAdvance();
}
function masterAutoAdvance(){
  const n=ms.g.plies.length;
  const needGuess=()=> ms.side==='both' || ms.side===(ms.pos%2===0?'red':'black');
  masterRender();
  if(ms.guess && ms.pos<n && !needGuess()){
    const tk=ms.tk={};
    setTimeout(()=>{ if(ms.tk!==tk) return; ms.pos++; masterRender(); }, 900);
  }
}
function initMasters(){
  renderMasterList();
  $$('#openingListCard [data-osub]').forEach(b=>b.addEventListener('click',()=>showOpeningSub(b.dataset.osub)));
  showOpeningSub(safeLS_get('xq_open_sub')==='master'?'master':'open');
  $('#masterBackBtn').addEventListener('click',()=>{ ms.tk=null; $('#masterCard').hidden=true; $('#openingListCard').hidden=false; });
  $('#masterPrev').addEventListener('click',()=>{ ms.tk=null; if(ms.pos>0){ ms.pos--; ms.feedback=''; masterRender(); } });
  $('#masterNext').addEventListener('click',()=>{ ms.tk=null; if(ms.pos<ms.g.plies.length){ ms.pos++; ms.feedback=''; masterAutoAdvance(); } });
  $('#masterFlip').addEventListener('click',()=>ms.widget.setFlipped(!ms.widget.isFlipped()));
  $('#masterKey').addEventListener('click',()=>{ if(ms.guess) return; const keys=masterKeyPlies(ms.g); const nx=keys.find(k=>k+1>ms.pos) ; ms.pos = nx!=null ? nx+1 : (keys.length?keys[0]+1:ms.pos); ms.feedback=''; masterRender(); revealBoard($('#masterBoard')); });
  $('#masterGuess').addEventListener('change',e=>{ ms.guess=e.target.checked; ms.feedback=''; if(ms.guess){ ms.right=0; ms.total=0; } masterAutoAdvance(); });
  $('#masterSide').addEventListener('change',e=>{ ms.side=e.target.value; ms.widget.setFlipped(ms.side==='black'); masterAutoAdvance(); });
}

