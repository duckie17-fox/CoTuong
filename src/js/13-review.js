/* =========================================================================
   REVIEW — chấm từng nước, gợi ý nước tốt hơn, rút ra bài học
   ========================================================================= */
const review = { rec:null, game:null, an:null, idx:-1, widget:null, running:false, token:0, anim:0 };
const CLASS_INFO = {
  book:   {label:'Theo sách',            icon:'📖', cls:'book'},
  best:   {label:'Tốt nhất',              icon:'★',  cls:'best'},
  good:   {label:'Tốt',                   icon:'✓',  cls:'good'},
  inacc:  {label:'Không chính xác',       icon:'?!', cls:'inacc'},
  mistake:{label:'Sai lầm',               icon:'?',  cls:'mistake'},
  blunder:{label:'Sai lầm nghiêm trọng',  icon:'??', cls:'blunder'},
};
const MATE_T = XQSearch.MATE-200;
const clampScore = s => s>MATE_T ? 2000 : s<-MATE_T ? -2000 : Math.max(-1500,Math.min(1500,s));
const PIECE_PTS = {G:0,A:2,E:2,H:4,R:9,C:4.5,S:1};

async function analyzeRecord(rec, onProgress){
  const g=replayRecord(rec);
  const positions=[];
  const keysAll=[XQSearch.keyOf(g.start,g.startTurn)];
  for(let k=0;k<=g.moves.length;k++){
    const board = k===0 ? g.start : g.boards[k-1];
    const turn = k%2===0 ? g.startTurn : Engine.otherColor(g.startTurn);
    positions.push({board, turn, historyKeys: keysAll.slice(0,k)});
    if(k<g.moves.length) keysAll.push(XQSearch.keyOf(g.boards[k], k%2===0?Engine.otherColor(g.startTurn):g.startTurn));
  }
  const res = await AIEngine.analyze({positions, timeMs:260, maxDepth:12}, onProgress);
  return {g, res};
}
function buildAnalysis(rec, g, res){
  const book = aiGame.book || (aiGame.book=buildOpeningBook(OPENINGS));
  const plies=[];
  let bookOn=true;
  for(let k=0;k<g.moves.length;k++){
    const m=g.moves[k], before = k===0 ? g.start : g.boards[k-1];
    const best=res[k], after=res[k+1];
    const bestScore = best.score;
    // điểm của nước đã đi, theo góc nhìn người vừa đi
    const played = (after.move===null) ? XQSearch.MATE : -after.score;
    const sameAsBest = best.move && best.move.from+''===m.from+'' && best.move.to+''===m.to+'';
    let loss = sameAsBest ? 0 : Math.max(0, clampScore(bestScore) - clampScore(played));
    const bk = book.get(Game.key(before, m.color));
    const inBook = bookOn && bk && bk.some(x=>x.move.from+''===m.from+''&&x.move.to+''===m.to+'');
    if(!inBook) bookOn=false;
    let cls = inBook ? 'book' : sameAsBest || loss<=10 ? 'best' : loss<=40 ? 'good' : loss<=100 ? 'inacc' : loss<=250 ? 'mistake' : 'blunder';
    plies.push({k, color:m.color, loss, cls, bestMove:best.move, bestPv:(best.pv||[]).slice(0,5), bestScore, played, reply: after.move, replyPv: (after.pv||[]).slice(0,4),
      evalRed: (m.color===RED?1:-1)*clampScore(bestScore)});
  }
  // đánh giá cuối (sau nước cuối)
  const last=res[g.moves.length];
  const finalRed = last.move===null ? (g.turn()===RED?-2000:2000) : (g.turn()===RED?1:-1)*clampScore(last.score);
  const mine=plies.filter(p=>p.color===rec.human);
  const acc = mine.length ? Math.round(mine.reduce((s,p)=>s+100*Math.exp(-p.loss/250),0)/mine.length) : 100;
  const counts={}; for(const c in CLASS_INFO) counts[c]=mine.filter(p=>p.cls===c).length;
  return {plies, finalRed, accuracy:acc, counts};
}
function explainPly(g, p){
  const m=g.moves[p.k], before = p.k===0 ? g.start : g.boards[p.k-1], after=g.boards[p.k];
  const me=m.color, opp=Engine.otherColor(me);
  const bestTxt = p.bestMove ? Notation.describe(before,p.bestMove) : null;
  const step1={ic:'👀', q:'Trước nước này: đối phương đang doạ gì?', html:esc(Coach.threatText(before,me))};
  const step2={ic:'🔎', q:'Nước này làm gì?', html:`<b>${esc(m.text.short)}</b> (${esc(m.text.long)}): ${esc(Coach.plainMove(before,m))}.`};
  if(p.cls==='book') return thinkStepsHTML([step1, step2, {ic:'📖', q:'Kết quả', cls:'ts-good', html:'Đúng lý thuyết khai cuộc: phát triển quân theo nguyên tắc.'}]);
  if(p.cls==='best'||p.cls==='good') return thinkStepsHTML([step1, step2, {ic:'✅', q:'Kết quả', cls:'ts-good', html: p.cls==='best'?'Đây là nước tốt nhất (hoặc ngang bằng) mà máy tìm được.':`Nước tốt, chỉ ${lossWords(p.loss)} so với lựa chọn của máy${bestTxt?` (${esc(bestTxt.short)})`:''}.`}]);
  const bad=[]; let qKey=null;
  if(p.bestScore>MATE_T && p.played<MATE_T){ bad.push(`bỏ lỡ đòn chiếu bí (${esc(bestTxt.short)} thắng trong ${Math.max(1,Math.ceil((XQSearch.MATE-p.bestScore)/2))} nước)`); qKey='missed-mate'; }
  if(p.played < -MATE_T){ bad.push(`để đối phương có đường chiếu bí${p.reply?` (bắt đầu bằng ${esc(Notation.describe(after,p.reply).short)})`:''}`); qKey=qKey||'allowed-mate'; }
  const wb=Coach.whyBad(before,m,p.reply);
  wb.forEach(w=>bad.push(esc(w.text)));
  if(wb.length) qKey=qKey||wb[0].key;
  if(wb.some(w=>w.key==='moved-into-attack'||w.key==='uncovered'||w.key==='ignored-threat'||w.key==='tactic')) p.hanging=true;
  if(p.bestMove){
    const cap=before[p.bestMove.to[0]][p.bestMove.to[1]], playedCap=before[m.to[0]][m.to[1]];
    if(cap && cap.color===opp && PIECE_PTS[cap.type]>=2 && (!playedCap || PIECE_PTS[playedCap.type]<PIECE_PTS[cap.type])){ bad.push(`bỏ lỡ cơ hội ăn ${VN_NAME[cap.type]}`); p.missedCapture=true; qKey=qKey||'missed-capture'; }
  }
  const TACTICAL=['moved-into-attack','uncovered','ignored-threat','tactic','check','palace'];
  const hasTactical = wb.some(w=>TACTICAL.includes(w.key)) || p.missedCapture || p.played< -MATE_T || p.bestScore>MATE_T;
  const seqOf=(pv)=>{ let b=after; const seq=[]; for(const mv of (pv||[]).slice(0,4)){ const pc=b[mv.from[0]]&&b[mv.from[0]][mv.from[1]]; if(!pc) break; seq.push(Notation.describe(b,mv).short); b=Engine.applyMove(b,mv); } return seq; };
  if(!hasTactical && p.loss>=100){ const seq=seqOf(p.replyPv); if(seq.length){ bad.unshift(`đối phương có đòn cụ thể: <b>${esc(seq.join(' '))}</b>… (bấm “▶ Đòn đối phương” trên bàn cờ để xem)`); qKey='tactic'; } }
  if(!bad.length){ const seq=seqOf(p.replyPv); if(seq.length) bad.push(`máy thấy đối phương đáp <b>${esc(seq.join(' '))}</b>… và thế cờ của bạn xấu đi`); }
  qKey=qKey||'positional';
  p.qKey=qKey;
  const good = p.bestMove ? Coach.whyGood(before,p.bestMove) : [];
  const decisive = p.played< -MATE_T || p.bestScore>MATE_T;
  return thinkStepsHTML([
    step1, step2,
    {ic:p.cls==='inacc'?'⚠️':'❌', q:'Kết quả: vì sao chưa tốt?', cls:'ts-bad', html:`${bad.length?bad.join('; '):'nước này kém hơn lựa chọn tốt nhất về vị trí'}. <i>(${decisive?'lỗi quyết định cả ván':lossWords(p.loss)})</i>`},
    bestTxt && {ic:'💡', q:'Nước tốt hơn', cls:'ts-good', html:`<b>${esc(bestTxt.short)}</b> (mũi tên xanh)${good.length?' vì nó '+esc(good.join('; ')):''}.`},
    {ic:'🧠', q:'Lần sau hãy tự hỏi', cls:'ts-q-row', html:esc(Coach.QUESTIONS[qKey])},
  ]);
}
function lessonsFrom(rec, g, an){
  const mine=an.plies.filter(p=>p.color===rec.human);
  mine.forEach(p=>{ if(p.cls!=='best'&&p.cls!=='book'&&p.cls!=='good') explainPly(g,p); });
  const L=[];
  const hang=mine.filter(p=>p.hanging && (p.cls==='mistake'||p.cls==='blunder')).length;
  const missCap=mine.filter(p=>p.missedCapture).length;
  const missMate=mine.filter(p=>p.bestScore>MATE_T && p.played<MATE_T).length;
  const allowMate=mine.filter(p=>p.played< -MATE_T && p.bestScore> -MATE_T).length;
  if(allowMate) L.push(`⚠️ Có ${allowMate} lần bạn đi nước để đối phương có đường chiếu bí. Trước mỗi nước, hãy tự hỏi: "Sau nước này đối phương có chiếu được không, Tướng mình còn chỗ chạy không?"`);
  if(hang) L.push(`🛡️ Có ${hang} lần bạn để quân bị ăn không (treo quân). Thói quen tốt: trước khi đi, kiểm tra quân vừa đi và các quân khác xem có bị Xe, Mã, Pháo đối phương nhắm không.`);
  if(missMate) L.push(`🎯 Bạn bỏ lỡ ${missMate} cơ hội chiếu bí. Khi Tướng đối phương ít chỗ chạy, hãy thử tính các nước chiếu trước tiên. Luyện mục "Sát cục" trong tab Chiến thuật.`);
  if(missCap) L.push(`👀 Bạn bỏ lỡ ${missCap} lần ăn quân miễn phí. Mỗi lượt, hãy nhìn một vòng xem quân nào của đối phương đang không được bảo vệ.`);
  // ra Xe chậm
  const firstRookMove = g.moves.findIndex(m=>m.color===rec.human && m.piece==='R');
  const myMovesBefore = firstRookMove<0 ? g.moves.filter(m=>m.color===rec.human).length : g.moves.slice(0,firstRookMove).filter(m=>m.color===rec.human).length;
  if(myMovesBefore>=6 && g.moves.filter(m=>m.color===rec.human).length>=8) L.push(`🚀 Bạn ra Xe khá muộn (sau ${myMovesBefore} nước). Nhớ nguyên tắc khai cuộc: ra Xe sớm, vì Xe là quân mạnh nhất. Luyện với Trainer ở tab Khai cuộc.`);
  const kingWalks = g.moves.filter((m,i)=>m.color===rec.human && m.piece==='G' && i<40).length;
  if(kingWalks>=3) L.push(`🏯 Tướng của bạn di chuyển ${kingWalks} lần ở đầu ván. Hãy giữ Sĩ Tượng đầy đủ để Tướng không phải chạy nhiều.`);
  const early=mine.filter(p=>p.k<20);
  if(early.length>=5 && early.every(p=>['book','best','good'].includes(p.cls))) L.push('👍 Khai cuộc của bạn rất chắc: 10 nước đầu không có sai lầm nào.');
  if(an.accuracy>=85) L.push(`🌟 Độ chính xác ${an.accuracy}% là rất tốt. Hãy thử nâng cấp độ máy lên một bậc.`);
  const qCount={}; mine.forEach(p=>{ if(p.qKey && ['inacc','mistake','blunder'].includes(p.cls)) qCount[p.qKey]=(qCount[p.qKey]||0)+1; });
  const topQ=Object.entries(qCount).sort((a,b)=>b[1]-a[1])[0];
  if(topQ && topQ[1]>=2) L.unshift(`🧠 Thói quen cần luyện nhất (${topQ[1]} lỗi): ${Coach.QUESTIONS[topQ[0]]}`);
  if(!L.length) L.push('Ván cờ khá ổn. Hãy bấm vào các nước được đánh dấu màu để xem chỗ có thể cải thiện.');
  return L.slice(0,5);
}

function openReview(rec){
  if(!rec) return;
  review.rec=rec; review.game=replayRecord(rec); review.an=null; review.idx=-1; review.token++;
  showAICard('review');
  if(!review.widget) review.widget=createBoardWidget($('#reviewBoard'),{label:'Bàn cờ xem lại ván'});
  review.widget.setFlipped(rec.human===BLACK);
  const rs=resultForHuman(rec);
  $('#reviewHead').innerHTML=`<span class="badge ${rs.cls}">${rs.txt}</span> <b>${esc(levelInfo(rec.level).name)}</b> · Bạn cầm ${COLOR_VN[rec.human]} · ${Math.ceil(rec.moves.length/2)} nước`;
  $('#reviewSummary').innerHTML=''; $('#reviewChart').innerHTML=''; $('#reviewDetail').innerHTML='';
  reviewRender();
  $('#aiReviewCard').scrollIntoView({block:'start'});
  if(rec.analysis && rec.analysis.version===2) { applyStoredAnalysis(rec); return; }
  runAnalysis();
}
async function runAnalysis(){
  const rec=review.rec, token=review.token, total=rec.moves.length+1;
  review.running=true;
  $('#reviewProgress').hidden=false; $('#reviewProgressBar').style.width='0%';
  $('#reviewProgressTxt').textContent=`Máy đang phân tích 0/${total} thế cờ…`;
  const t0=Date.now();
  const {g,res}=await analyzeRecord(rec,(n)=>{ if(token!==review.token) return; $('#reviewProgressBar').style.width=(100*n/total)+'%'; $('#reviewProgressTxt').textContent=`Máy đang phân tích ${n}/${total} thế cờ…`; });
  if(token!==review.token) return;
  review.running=false; $('#reviewProgress').hidden=true;
  const an=buildAnalysis(rec,g,res);
  review.an=an; review.ms=Date.now()-t0;
  // lưu kết quả để lần sau không phải phân tích lại
  rec.analysis={version:2, accuracy:an.accuracy, plies:an.plies.map(p=>({c:p.cls,l:Math.round(p.loss),b:p.bestMove?[p.bestMove.from,p.bestMove.to]:null,s:p.bestScore,pl:p.played,r:p.reply?[p.reply.from,p.reply.to]:null,rp:(p.replyPv||[]).map(m=>[m.from,m.to]),bp:(p.bestPv||[]).map(m=>[m.from,m.to]),e:p.evalRed})), finalRed:an.finalRed};
  if(loadHistory().some(x=>x.id===rec.id)) upsertHistory(rec);
  reviewShowAnalysis();
}
function applyStoredAnalysis(rec){
  const a=rec.analysis;
  const plies=a.plies.map((p,k)=>({k, color:review.game.moves[k].color, cls:p.c, loss:p.l, bestMove:p.b?{from:p.b[0],to:p.b[1]}:null, bestScore:p.s, played:p.pl, reply:p.r?{from:p.r[0],to:p.r[1]}:null, replyPv:(p.rp||[]).map(x=>({from:x[0],to:x[1]})), bestPv:(p.bp||[]).map(x=>({from:x[0],to:x[1]})), evalRed:p.e}));
  const mine=plies.filter(p=>p.color===rec.human);
  const counts={}; for(const c in CLASS_INFO) counts[c]=mine.filter(p=>p.cls===c).length;
  review.an={plies, finalRed:a.finalRed, accuracy:a.accuracy, counts};
  $('#reviewProgress').hidden=true;
  reviewShowAnalysis();
}
function reviewShowAnalysis(){
  const rec=review.rec, g=review.game, an=review.an;
  const lessons=lessonsFrom(rec,g,an);
  const cnt=Object.entries(CLASS_INFO).filter(([c])=>an.counts[c]).map(([c,i])=>`<span class="cls-chip cls-${i.cls}">${i.icon} ${i.label}: <b>${an.counts[c]}</b></span>`).join('');
  $('#reviewSummary').innerHTML=`<div class="acc-box"><div class="acc-num">${an.accuracy}%</div><div class="hint-text small">độ chính xác của bạn</div></div>
    <div class="acc-side"><div class="cls-chips">${cnt}</div><h3 class="side-h mt10">📌 Bài học rút ra</h3><ul class="lesson-list">${lessons.map(l=>`<li>${l}</li>`).join('')}</ul></div>`;
  renderEvalChart();
  // nhảy tới sai lầm lớn nhất của người chơi
  const worst=an.plies.filter(p=>p.color===rec.human).sort((a,b)=>b.loss-a.loss)[0];
  review.idx = worst && worst.loss>40 ? worst.k : -1;
  reviewRender();
}
function renderEvalChart(){
  const an=review.an, rec=review.rec, n=an.plies.length;
  const W=600, H=130, pad=6, sign = rec.human===RED?1:-1;
  const vals=an.plies.map(p=>sign*p.evalRed).concat([sign*an.finalRed]);
  const x=i=>pad+(W-2*pad)*i/Math.max(1,vals.length-1), y=v=>H/2 - (H/2-pad)*Math.max(-1,Math.min(1,v/800));
  const path=vals.map((v,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area=`M${x(0)},${H/2} `+vals.map((v,i)=>`L${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')+` L${x(vals.length-1)},${H/2} Z`;
  const dots=an.plies.filter(p=>p.color===rec.human && ['inacc','mistake','blunder'].includes(p.cls))
    .map(p=>`<circle class="dot dot-${p.cls}" cx="${x(p.k+1)}" cy="${y(vals[p.k+1])}" r="5" data-k="${p.k}"><title>Nước ${Math.floor(p.k/2)+1}: ${CLASS_INFO[p.cls].label}</title></circle>`).join('');
  $('#reviewChart').innerHTML=`<svg viewBox="0 0 ${W} ${H}" class="eval-svg" role="img" aria-label="Biểu đồ lợi thế theo từng nước (phía trên là bạn đang hơn)">
    <line x1="0" x2="${W}" y1="${H/2}" y2="${H/2}" class="mid"/><path d="${area}" class="area"/><path d="${path}" class="line"/>${dots}
    ${review.idx>=0?`<line class="cursor" x1="${x(review.idx+1)}" x2="${x(review.idx+1)}" y1="0" y2="${H}"/>`:''}</svg>
    <div class="chart-legend"><span>▲ Bạn hơn</span><span>▼ Máy hơn</span></div>`;
  $$('.dot',$('#reviewChart')).forEach(d=>d.addEventListener('click',()=>{ review.idx=+d.dataset.k; reviewRender(); revealBoard($('#reviewBoard')); }));
  $('#reviewChart svg').addEventListener('click',(e)=>{
    if(e.target.classList.contains('dot')) return;
    const r=e.currentTarget.getBoundingClientRect(); const i=Math.round((e.clientX-r.left)/r.width*(vals.length-1))-1;
    review.idx=Math.max(-1,Math.min(n-1,i)); reviewRender(); revealBoard($('#reviewBoard'));
  });
}
function reviewRender(){
  review.anim++;
  const g=review.game, idx=review.idx, an=review.an, rec=review.rec;
  const board = idx<0 ? g.start : (idx===0 ? g.start : g.boards[idx-1]);   // thế TRƯỚC nước đang xem
  const m = idx>=0 ? g.moves[idx] : null, p = an && idx>=0 ? an.plies[idx] : null;
  const arrows=[];
  if(m) arrows.push({from:m.from,to:m.to,alt:true});
  if(p && p.bestMove && !(p.bestMove.from+''===m.from+''&&p.bestMove.to+''===m.to+'') && !['book','best'].includes(p.cls)) arrows.push({from:p.bestMove.from,to:p.bestMove.to});
  review.widget.setBoard(idx<0 && g.moves.length ? g.board() : board, {arrows, lastMove: idx<0 ? g.lastMove() : null});
  const marks={}, badges={};
  if(an) an.plies.forEach(q=>{ if(q.color===rec.human){ marks[q.k]=CLASS_INFO[q.cls].cls; if(['inacc','mistake','blunder'].includes(q.cls)) badges[q.k]=`<small class="mk">${CLASS_INFO[q.cls].icon}</small>`; } });
  renderMoveLog($('#reviewLog'), g.moves, {active:idx, marks, badges, onPick:(k)=>{ review.idx=k; reviewRender(); revealBoard($('#reviewBoard')); }});
  const det=$('#reviewDetail');
  if(idx<0){ $('#reviewTools').innerHTML=''; det.innerHTML = an ? '<p class="hint-text">Thế cờ cuối ván. Chọn một nước trong biên bản hoặc trên biểu đồ để xem phân tích; các nước tô màu là chỗ bạn có thể đi tốt hơn.</p>' : ''; }
  else {
    const who = m.color===rec.human ? 'Bạn' : 'Máy';
    const info = p ? CLASS_INFO[p.cls] : null;
    det.innerHTML = `<div class="rv-head"><b>${Math.floor(idx/2)+1}${m.color===RED?'.':'...'} ${esc(m.text.short)}</b> <span class="hint-text">(${who} · ${esc(m.text.long)})</span>
      ${info && m.color===rec.human?`<span class="cls-chip cls-${info.cls}">${info.icon} ${info.label}</span>`:''}</div>
      ${p && m.color===rec.human ? `${explainPly(g,p)}<p class="hint-text small">Mũi tên đỏ: nước đã đi${arrows.length>1?' · mũi tên xanh: nước máy đề xuất':''}.</p>` : (an?'<p class="hint-text small">Nước của máy.</p>':'')}`;
    $('#reviewTools').innerHTML = p && m.color===rec.human && !['book','best','good'].includes(p.cls)
      ? `${p.replyPv&&p.replyPv.length?'<button class="btn btn-outline" id="rvShowReply">▶ Đòn đối phương</button>':''}${p.bestPv&&p.bestPv.length?'<button class="btn btn-outline" id="rvShowBest">▶ Nước tốt hơn</button>':''}` : '';
    const play=(startBoard,line,label)=>{
      const tk=++review.anim; let b=startBoard, i=0;
      const step=()=>{ if(tk!==review.anim) return;
        if(i>=line.length){ setTimeout(()=>{ if(tk===review.anim) reviewRender(); }, 1600); return; }
        const mv=line[i]; if(!b[mv.from[0]][mv.from[1]]) return;
        b=Engine.applyMove(b,mv); i++;
        review.widget.setBoard(b,{lastMove:mv, arrows:[{from:mv.from,to:mv.to,alt:label==='reply'?(i%2===1):(i%2===0)}]});
        setTimeout(step, 900); };
      revealBoard($('#reviewBoard')); review.widget.setBoard(startBoard,{}); setTimeout(step, 500);
    };
    const rb=$('#rvShowReply'); if(rb) rb.addEventListener('click',()=>play(g.boards[idx], p.replyPv,'reply'));
    const bb=$('#rvShowBest'); if(bb) bb.addEventListener('click',()=>play(board, p.bestPv,'best'));
  }
  if(an) renderEvalChart();
  $('#reviewPrev').disabled = g.moves.length===0 || idx===0;
  $('#reviewNext').disabled = idx===-1;
}
function initReview(){
  $('#reviewBack').addEventListener('click',()=>{ review.token++; showAICard(aiGame.game && review.rec && review.rec.id===aiGame.recId && !aiGame.game.result ? 'game':'setup'); });
  $('#reviewPrev').addEventListener('click',()=>{ const n=review.game.moves.length; review.idx = review.idx===-1 ? n-1 : Math.max(0,review.idx-1); reviewRender(); });
  $('#reviewNext').addEventListener('click',()=>{ const n=review.game.moves.length; review.idx = review.idx>=n-1 ? -1 : review.idx+1; reviewRender(); });
  $('#reviewNextMistake').addEventListener('click',()=>{
    if(!review.an) return;
    const list=review.an.plies.filter(p=>p.color===review.rec.human && ['inacc','mistake','blunder'].includes(p.cls));
    if(!list.length) return;
    const nx=list.find(p=>p.k>review.idx) || list[0];
    review.idx=nx.k; reviewRender();
  });
}

/* Tự sinh bởi tools/gen-puzzles.js + tools/make-puzzles.js: thế cờ lấy từ ván máy tự đánh, đã kiểm lại bằng Solver. Không sửa tay. */
/*@@DATA:puzzles-gen@@*/

