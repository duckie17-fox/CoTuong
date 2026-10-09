/* =========================================================================
   UI BÀI TẬP — lọc theo chủ đề/độ khó, hỗ trợ chiếu bí 1–2 nước, bắt quân, bắt đôi
   ========================================================================= */
const DIFF_LABEL = {1:['Dễ','badge-easy'],2:['Trung bình','badge-mid'],3:['Khó','badge-hard']};
const pz = { widget:null, ctl:null, active:null, board:null, stage:0, locked:false, hint:false, arrows:null, last:null, filter:{topic:'all',diff:'all'}, shown:null, shownKey:null };

function getSolvedPuzzles(){ return safeJSON('xq_puzzles_solved',[]); }
function markPuzzleSolved(id){
  const done=getSolvedPuzzles();
  if(!done.includes(id)){ done.push(id); safeLS_set('xq_puzzles_solved', JSON.stringify(done)); }
}
function puzzleList(){
  if(pz.filter.topic==='review'){ const ids=Learn.due(); return ids.map(id=>PUZZLES.find(p=>p.id===id)).filter(p=>p && (pz.filter.diff==='all'||String(p.difficulty)===pz.filter.diff)); }
  return PUZZLES.filter(p=>(pz.filter.topic==='all'||p.topic===pz.filter.topic)&&(pz.filter.diff==='all'||String(p.difficulty)===pz.filter.diff))
    .map((p,i)=>[p,i]).sort((a,b)=>a[0].difficulty-b[0].difficulty || a[1]-b[1]).map(x=>x[0]);   // dễ trước cho người mới
}
function renderPuzzleFilters(){
  const el=$('#puzzleFilters');
  const chip=(group,val,label,count)=>`<button type="button" class="chip ${pz.filter[group]===val?'on':''}" data-g="${group}" data-v="${val}" aria-pressed="${pz.filter[group]===val}">${esc(label)}${count!=null?` <small>${count}</small>`:''}</button>`;
  const due=Learn.due().length;
  const on = pz.filter.topic!=='all' || pz.filter.diff!=='all';
  el.innerHTML = `<details class="more-box" id="pzFilterBox" ${on?'open':''}><summary>Chọn loại bài${on?' (đang lọc)':''}</summary>
    <div class="chip-row">${chip('topic','all','Tất cả',PUZZLES.length)}${due||pz.filter.topic==='review'?chip('topic','review','Cần ôn lại',due):''}${Object.entries(PUZZLE_TOPICS).map(([k,v])=>chip('topic',k,v,PUZZLES.filter(p=>p.topic===k).length)).join('')}</div>
    <div class="chip-row">${chip('diff','all','Mọi độ khó')}${[1,2,3].map(d=>chip('diff',String(d),DIFF_LABEL[d][0])).join('')}</div></details>`;
  $$('.chip',el).forEach(b=>b.addEventListener('click',()=>{ pz.filter[b.dataset.g]=b.dataset.v; renderPuzzleGrid(); }));
}
const PZ_PAGE=24;   // chỉ hiện một ít bài, bấm "Xem thêm" mới hiện tiếp (tránh đổ hàng trăm ô cùng lúc)
function renderPuzzleGrid(){
  renderPuzzleFilters();
  const solved = getSolvedPuzzles();
  const list=puzzleList();
  if(pz.shown==null || pz.shownKey!==JSON.stringify(pz.filter)){ pz.shown=PZ_PAGE; pz.shownKey=JSON.stringify(pz.filter); }
  const shown=Math.min(pz.shown, list.length);
  $('#puzzleProgressTxt').textContent = `Đã giải ${solved.filter(id=>PUZZLES.some(p=>p.id===id)).length}/${PUZZLES.length} bài`;
  $('#puzzleGrid').innerHTML = list.slice(0,shown).map(p=>{
    const [label,cls] = DIFF_LABEL[p.difficulty];
    return `<button class="puzzle-card ${solved.includes(p.id)?'solved':''}" data-id="${p.id}">
      <div class="puzzle-top"><span class="badge ${cls}">${label}</span><span class="topic-tag">${esc(PUZZLE_TOPICS[p.topic])}${p.turn===BLACK?' · Đen đi':''}</span>
        ${solved.includes(p.id) ? '<span class="solved-check" title="Đã giải"><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-check"></use></svg></span>' : ''}</div>
      <h4>${esc(p.title)}</h4>
    </button>`;
  }).join('') || '<p class="hint-text">Không có bài nào khớp bộ lọc.</p>';
  $$('.puzzle-card',$('#puzzleGrid')).forEach(btn=> btn.addEventListener('click', ()=> openPuzzle(btn.dataset.id)));
  const more=$('#puzzleMore');
  if(more){
    more.innerHTML = shown<list.length
      ? `<button type="button" class="btn btn-outline" id="puzzleMoreBtn">Xem thêm bài (còn ${list.length-shown})</button>`
      : (list.length>PZ_PAGE ? `<span class="hint-text">Đã hiện hết ${list.length} bài.</span>` : '');
    const b=$('#puzzleMoreBtn',more);
    if(b) b.addEventListener('click',()=>{ pz.shown=shown+PZ_PAGE; renderPuzzleGrid(); });
  }
}
function openPuzzle(id){
  pz.active = PUZZLES.find(p=>p.id===id);
  pz.recorded=false; pz.usedHint=false;   // kết quả lần mở bài này (để ôn bài sai)
  $('#puzzleListCard').hidden = true;
  $('#puzzleDetailCard').hidden = false;
  $('#puzzleTitle').textContent = pz.active.title;
  const [label,cls]=DIFF_LABEL[pz.active.difficulty];
  $('#puzzleMeta').innerHTML = `<span class="badge ${cls}">${label}</span> <span class="topic-tag">${esc(PUZZLE_TOPICS[pz.active.topic])}${pz.random?' · Luyện ngẫu nhiên':''}</span>`;
  $('#puzzlePrompt').textContent = pz.active.prompt;
  setNextPrimary(false);
  if(!pz.widget){
    pz.widget = createBoardWidget($('#puzzleBoard'), {onSquareClick:(r,c)=>pz.ctl.click(r,c), label:'Bàn cờ bài tập'});
    pz.ctl = makeClickController({
      widget:pz.widget,
      getBoard:()=>pz.board,
      turn:()=>pz.active.turn,
      canMove:()=>!pz.locked,
      onMove:puzzleTryMove,
      extraMeta:()=>({lastMove:pz.last, highlight: pz.hint?[pz.active.solution.from]:null, arrows:pz.arrows,
        checkSq: [RED,BLACK].map(c=>Engine.isInCheck(pz.board,c)?Engine.findGeneral(pz.board,c):null).find(x=>x)}),
    });
  }
  pz.widget.setFlipped(pz.active.turn===BLACK);
  // lãi vật chất chuẩn của đáp án (cho bài bắt quân/bắt đôi)
  if(pz.active.type==='capture'||pz.active.type==='fork'||pz.active.type==='defend'){
    const b=pz.active.board, me=pz.active.turn;
    pz.targetGain = -Solver.materialSearch(Engine.applyMove(b,pz.active.solution),Engine.otherColor(me),3) - Solver.material(b,me);
  }
  puzzleResetBoard();
  $('#puzzleDetailCard').scrollIntoView({block:'start'}); revealBoard($('#puzzleBoard'));
}
function puzzleResetBoard(){
  pz.token=null;
  pz.board = Engine.cloneBoard(pz.active.board);
  pz.stage=0; pz.locked=false; pz.hint=false; pz.peeked=false; pz.arrows=null; pz.last=null;
  pz.ctl.clear();
  $('#puzzleStatus').innerHTML='';
  $('#puzzleExplain').hidden = true;
  pz.ctl.render();
}
// Lời giải theo các bước tư duy (dễ hiểu, lồng câu hỏi tự hỏi)
function puzzleExplainHTML(){
  const p=pz.active, me=p.turn, sol=p.solution, d=Notation.describe(p.board,sol);
  const isMate = p.type==='mate'||p.type==='mate2'||p.type==='mate3';
  const Q = isMate ? 'Khi Tướng đối phương ít chỗ chạy, hãy xét các nước CHIẾU trước (Chiếu → Ăn → Doạ), và đếm xem sau nước chiếu Tướng còn ô nào để chạy.'
          : p.type==='defend' ? Coach.QUESTIONS['ignored-threat']
          : p.type==='fork' ? 'Tìm ô mà từ đó một quân của mình tấn công được HAI mục tiêu cùng lúc — đối phương chỉ cứu được một.'
          : Coach.QUESTIONS['missed-capture'];
  // Gọn: chỉ "Đáp án" + "Vì sao"; các bước tư duy khác để trong "Xem thêm"
  const why = esc(
      p.type==='defend' ? 'Sau nước này, đối phương đáp cách nào bạn cũng không bị mất quân. Các nước khác đều để mất ít nhất một quân nhỏ.'
      : (p.type==='capture'||p.type==='fork') && !p.explain ? `Đối phương đáp tốt nhất rồi mà bạn vẫn lãi khoảng ${Math.max(1,Math.round(pz.targetGain||0))} điểm quân.${p.type==='fork'?' Đối phương chỉ cứu được một trong hai quân bị nhắm.':''}`
      : puzzleExplainText());
  return `<p class="ex-line"><b>Đáp án:</b> ${esc(d.short)} (${esc(d.long)}).</p><p class="ex-line"><b>Vì sao:</b> ${why}</p>
    <details class="more-box"><summary>Xem thêm</summary>${thinkStepsHTML([
      {ic:'eye', q:'Trước nước giải: bên nào đang doạ gì?', html:esc(Coach.threatText(p.board,me))},
      {ic:'search', q:'Nước giải làm gì?', html:esc(Coach.plainMove(p.board,sol))+'.'},
      {ic:'question', q:'Lần sau hãy tự hỏi', cls:'ts-q-row', html:esc(Q)},
    ])}</details>`;
}
function puzzleExplainText(){
  const p=pz.active;
  if(p.explain) return p.explain;
  if(p.type==='mate') return Solver.explainMate(p.board,p.solution);
  if(p.type==='mate2') return Solver.explainMate2(p.board,p.solution);
  const why=Coach.whyGood(p.board,p.solution);
  const me=p.turn;
  if(p.type==='mate3') return `Nước đầu ${Notation.describe(p.board,p.solution).short}: ${why.join('; ')||'khoá đường chạy của Tướng'}.`+(p.line?` Diễn biến chính: ${p.line}.`:'')+' Ép bí nhiều nước thường là chuỗi CHIẾU liên tục: mỗi nước chiếu lấy thêm một ô chạy của Tướng.';
  if(p.type==='defend'){
    const danger=Coach.endangered(p.board,me);
    return `Mối doạ: ${danger.length?danger.map(d=>`${Coach.NAME[d.type]} bị ${d.by.map(t=>Coach.NAME[t]).join(', ')} tấn công${d.defended?' (bảo vệ không đủ)':' mà không được bảo vệ'}`).join('; '):'đối phương sắp có đòn ăn quân'}. Vì sao nước này đúng: ${why.join('; ')||'nó hoá giải lời doạ mà không để lộ quân khác'}. ${Coach.QUESTIONS['ignored-threat']}`;
  }
  const g=pz.targetGain!=null?Math.round(pz.targetGain):null;
  return `Vì sao đúng: nước này ${why.join('; ')||'tạo đòn'}${g!=null?`. Sau khi đối phương đáp tốt nhất, bạn vẫn lãi khoảng ${g} điểm quân`:''}. ${p.type==='fork'?'Bắt đôi hiệu quả vì đối phương chỉ cứu được một quân mỗi lượt.':Coach.QUESTIONS['missed-capture']}`;
}
// Ghi kết quả lần đầu của mỗi lần mở bài (đúng ngay / đúng nhờ gợi ý / sai) cho lịch ôn tập
function puzzleRecord(outcome){
  if(pz.recorded) return; pz.recorded=true;
  Learn.record(pz.active.id, outcome);
}
function puzzleSuccess(){
  pz.locked=true;
  markPuzzleSolved(pz.active.id);
  puzzleRecord(pz.peeked?'fail':pz.usedHint?'help':'ok');
  const daily = !pz.peeked && Learn.markDailyDone(pz.active.id);
  if(pz.random && !pz.peeked){ pz.streak=(pz.streak||0)+1; }
  statusBanner($('#puzzleStatus'),'over','Chính xác! Giỏi lắm.'+(pz.random?` Chuỗi đúng liên tiếp: <b>${pz.streak}</b>.`:'')+(daily&&daily.done&&daily.lastDone===Learn.today()&&daily.id===pz.active.id?` Xong bài hôm nay — chuỗi <b>${daily.streak}</b> ngày!`:''));
  $('#puzzleExplain').hidden=false;
  $('#puzzleExplain').innerHTML = puzzleExplainHTML();
  setNextPrimary(true);
  pz.ctl.render();
}
// "Bài tiếp" chỉ nổi bật khi đã giải xong (trước đó là nút phụ, tránh khuyến khích bỏ qua)
function setNextPrimary(on){ const b=$('#puzzleNextBtn'); b.classList.toggle('btn-jade',on); b.classList.toggle('btn-outline',!on); }
function puzzleFail(msg){
  pz.locked=true; if(pz.random) pz.streak=0;
  puzzleRecord('fail');
  statusBanner($('#puzzleStatus'),'fail',msg||'Chưa đúng. Thử lại nhé!');
  pz.ctl.render();
  const token = pz.token = {};
  setTimeout(()=>{ if(pz.token===token) puzzleResetBoard(); }, 3200);
}
function puzzleTryMove(mv){
  const p=pz.active, me=p.turn, opp=Engine.otherColor(me);
  const before=pz.board;
  pz.board = Engine.applyMove(pz.board, mv); pz.last=mv; pz.hint=false;
  const nMate = p.type==='mate'?1 : p.type==='mate2'?2 : p.type==='mate3'?3 : 0;
  if(nMate){
    const remaining = nMate - pz.stage;
    const replies=Engine.generateLegalMoves(pz.board,opp);
    if(replies.length===0) return puzzleSuccess();   // bí sớm hơn cũng tính đúng
    if(remaining===1){
      const how = ` Vì sao chưa được: đối phương thoát bằng <b>${esc(Notation.describe(pz.board,replies[0]).short)}</b>. Tự hỏi: hãy liệt kê mọi ô Tướng có thể chạy và mọi cách chặn/ăn quân chiếu, rồi tìm nước khoá hết.`;
      return puzzleFail((Engine.isInCheck(pz.board,opp) ? 'Có chiếu nhưng đối phương vẫn giải được.' : 'Chưa chiếu bí.')+how);
    }
    pz.locked=true; pz.ctl.render();
    statusBanner($('#puzzleStatus'),'think','Đang kiểm tra nước của bạn…');
    const token = pz.token = {};
    const isSol = pz.stage===0 && mv.from+''===p.solution.from+'' && mv.to+''===p.solution.to+'';
    const afterMe = pz.board;
    // kiểm tra: mọi cách đỡ đều bị bí trong (remaining-1) nước; máy chọn cách đỡ dai nhất
    const check = ()=> new Promise(res=>setTimeout(()=>{
      if(remaining-1===1){
        const esc1=replies.find(r=>!Solver.findMate(Engine.applyMove(afterMe,r),me,1));
        return res({forced:!esc1, escape:esc1});
      }
      res({forced:isSol, escape:null, needEngine:!isSol});
    },30));
    check().then(async ck=>{
      if(pz.token!==token) return;
      if(ck.needEngine){
        const r=await AIEngine.think({board:afterMe, turn:opp, maxDepth:2*(remaining-1)+1, timeMs:2500});
        ck.forced = r.score <= -(XQSearch.MATE-2*(remaining-1)-1);
        if(!ck.forced && r.move) ck.escape=r.move;
      }
      if(pz.token!==token) return;
      if(!ck.forced){
        pz.locked=false;
        return puzzleFail('Nước này chưa ép được chiếu bí: đối phương có cách thoát'+(ck.escape?` (<b>${esc(Notation.describe(afterMe,ck.escape).short)}</b>)`:'')+'. Tự hỏi: ở bài ép bí, hãy ưu tiên nước CHIẾU hoặc nước lấy mất ô chạy của Tướng, để đối phương không có thời gian phản công.');
      }
      statusBanner($('#puzzleStatus'),'think','Tốt lắm! Đối phương đang đáp…');
      let d;
      if(remaining-1===1) d=Solver.bestDefense(afterMe,opp,1)||replies[0];
      else { const r=await AIEngine.think({board:afterMe, turn:opp, maxDepth:2*(remaining-1), timeMs:1500}); d=r.move||replies[0]; }
      if(pz.token!==token) return;
      const txt=Notation.describe(afterMe,d).short;
      pz.board=Engine.applyMove(afterMe,d); pz.last=d; pz.stage++; pz.locked=false;
      statusBanner($('#puzzleStatus'),'check',`Đối phương đáp <b>${esc(txt)}</b>. ${nMate-pz.stage===1?'Giờ hãy chiếu bí!':'Tiếp tục ép!'}`);
      pz.ctl.render();
    });
    return;
  }
  // bắt quân / bắt đôi: nước đi phải lãi được như đáp án sau khi đối phương đáp tốt nhất
  const gain = -Solver.materialSearch(pz.board,opp,3) - Solver.material(before,me);
  if(gain >= pz.targetGain - 0.5) return puzzleSuccess();
  if(p.type==='defend'){
    const danger=Coach.endangered(before,me);
    const q=danger.length?` Quân đang bị doạ: <b>${esc(danger.map(d=>Coach.NAME[d.type]).join(', '))}</b>.`:'';
    return puzzleFail(`Chưa giữ được: sau nước này bạn vẫn mất khoảng ${Math.max(1,Math.round(pz.targetGain-gain))} điểm quân.${q} Tự hỏi: ${esc(Coach.QUESTIONS['ignored-threat'])}`);
  }
  const wb=Coach.whyBad(before,mv,null);
  if(wb.length) return puzzleFail(`Chưa đúng: ${esc(wb[0].text)}. Tự hỏi: ${esc(Coach.QUESTIONS[wb[0].key])}`);
  return puzzleFail(gain>0 ? `Có lãi ${gain.toFixed(1).replace('.',',')} điểm nhưng vẫn còn nước tốt hơn. Thử lại nhé!` : 'Chưa đúng: nước này không lãi quân. Thử lại nhé!');
}
function puzzleNext(){
  if(pz.random){ const p=puzzlePickRandom(); if(p) openPuzzle(p.id); return; }
  const list=puzzleList(); const solved=getSolvedPuzzles();
  const i=list.findIndex(p=>p.id===pz.active.id);
  const next = list.slice(i+1).find(p=>!solved.includes(p.id)) || list.find(p=>!solved.includes(p.id)) || list[(i+1)%list.length];
  if(next) openPuzzle(next.id);
}
// Thêm các thế luyện sát cục vào kho bài tập (chủ đề riêng)
function mergeSatcucPuzzles(){
  if(typeof SATCUC==='undefined' || PUZZLES.some(p=>p.topic==='satcuc')) return;
  SATCUC.forEach(sc=>sc.drills.forEach((d,i)=>{
    PUZZLES.push({id:`sc-${sc.key}-${i}`, title:`${sc.name}${sc.drills.length>1?' #'+(i+1):''}`, difficulty:d.n===1?1:2, topic:'satcuc',
      board:mkBoard(d.pieces.map(q=>[q[0],q[1],q[2],q[3]])), turn:RED, type:d.n===1?'mate':'mate2',
      prompt:`Đến lượt Đỏ. ${d.n===1?'Chiếu bí trong 1 nước':'Ép chiếu bí trong 2 nước'} theo mẫu sát cục ${sc.name}.`,
      solution:{from:[d.sol[0],d.sol[1]],to:[d.sol[2],d.sol[3]]},
      explain:`Mẫu ${sc.name} (${sc.han}): ${sc.idea} Vì sao hiệu quả: ${sc.why}`});
  }));
}
function puzzlePickRandom(){
  const list=puzzleList(), solved=getSolvedPuzzles();
  const pool=list.filter(p=>!solved.includes(p.id) && (!pz.active || p.id!==pz.active.id));
  const from = pool.length ? pool : list.filter(p=>!pz.active || p.id!==pz.active.id);
  return from.length ? from[Math.floor(Math.random()*from.length)] : null;
}
function initPuzzles(){
  mergeSatcucPuzzles();
  $('#puzzleRandomBtn').addEventListener('click',()=>{ pz.random=true; pz.streak=0; const p=puzzlePickRandom(); if(p) openPuzzle(p.id); });
  $('#puzzleBackBtn').addEventListener('click', ()=>{ pz.random=false; $('#puzzleListCard').hidden=false; $('#puzzleDetailCard').hidden=true; renderPuzzleGrid(); });
  $('#puzzleRetryBtn').addEventListener('click', puzzleResetBoard);
  $('#puzzleHintBtn').addEventListener('click', ()=>{ if(pz.stage===0 && !pz.locked){ pz.hint=true; pz.usedHint=true; pz.ctl.render(); statusBanner($('#puzzleStatus'),'think','Gợi ý: quân cần đi được khoanh nét đứt.'); } });
  $('#puzzleNextBtn').addEventListener('click', puzzleNext);
  $('#puzzleAnswerBtn').addEventListener('click', ()=>{
    puzzleResetBoard(); pz.peeked=true; puzzleRecord('fail'); revealBoard($('#puzzleBoard')); if(pz.random) pz.streak=0;
    const p=pz.active, sol=p.solution;
    const d=Notation.describe(p.board,sol);
    pz.locked=true; pz.arrows=[{from:sol.from,to:sol.to}];
    pz.ctl.render();
    statusBanner($('#puzzleStatus'),'over',`Đáp án: <b>${esc(d.short)}</b> (${esc(d.long)})`);
    $('#puzzleExplain').hidden=false;
    $('#puzzleExplain').innerHTML = puzzleExplainHTML();
  });
  renderPuzzleGrid();
}

/* Tự sinh bởi tools/make-openings-ext.js — nhánh biến & bẫy khai cuộc có nguồn, đã kiểm hợp lệ. Không sửa tay. */
/*@@DATA:opening-lines@@*/
/*@@DATA:opening-traps@@*/

