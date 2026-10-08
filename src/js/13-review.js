/* =========================================================================
   REVIEW — chấm từng nước, gợi ý nước tốt hơn, rút ra bài học
   ========================================================================= */
const review = { rec:null, game:null, an:null, idx:-1, overview:false, onlyBig:safeLS_get('xq_review_big')==='1', lessons:null, widget:null, running:false, token:0, anim:0 };
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
  const keysAll=[XQSearch.keyOf(g.start,g.startTurn)], chkAll=[Engine.isInCheck(g.start,g.startTurn)];
  for(let k=0;k<=g.moves.length;k++){
    const board = k===0 ? g.start : g.boards[k-1];
    const turn = k%2===0 ? g.startTurn : Engine.otherColor(g.startTurn);
    positions.push({board, turn, historyKeys: keysAll.slice(0,k), historyChecks: chkAll.slice(0,k)});
    if(k<g.moves.length){ keysAll.push(XQSearch.keyOf(g.boards[k], k%2===0?Engine.otherColor(g.startTurn):g.startTurn)); chkAll.push(!!g.moves[k].check); }
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
// Tên bên trong phân tích: người chơi là "Bạn", bên kia là "Máy"
const sideName=(color)=> review.rec && color===review.rec.human ? 'Bạn' : 'Máy';
// Đọc một chuỗi nước (PV) thành lời: ghi rõ bên nào đi và ai ăn quân gì
function lineText(startBoard, line, max){
  let b=startBoard; const parts=[], caps=[];
  for(const mv of (line||[]).slice(0,max||4)){
    const pc=b[mv.from[0]] && b[mv.from[0]][mv.from[1]]; if(!pc) break;
    const victim=b[mv.to[0]][mv.to[1]];
    parts.push(`${sideName(pc.color)} <b>${esc(Notation.describe(b,mv).short)}</b>`);
    if(victim) caps.push(`${sideName(pc.color)==='Bạn'?'bạn':'máy'} ăn ${VN_NAME[victim.type]}`);
    b=Engine.applyMove(b,mv);
  }
  return {html: parts.join(' → '), caps, end:b, n:parts.length};
}
// Giai đoạn ván tại nửa nước k
function phaseOf(g,k){
  const b = k===0 ? g.start : g.boards[k-1];
  let heavy=0; for(const row of b) for(const q of row) if(q && 'RHC'.includes(q.type)) heavy++;
  return heavy<=6 ? 'Tàn cuộc' : k<20 ? 'Khai cuộc' : 'Trung cuộc';
}
// Thế cờ (góc nhìn người chơi) ngay trước nửa nước k; k = số nước → sau nước cuối
function evalAt(k){
  const an=review.an, sign = review.rec.human===RED ? 1 : -1;
  return sign * (k < an.plies.length ? an.plies[k].evalRed : an.finalRed);
}
// Mục đích + cách nghĩ của một nước (pv: chuỗi nước máy dự tính, bắt đầu bằng chính nước đó)
function purposeHTML(board, move, pv){
  const it=Coach.intent(board,move);
  if(it.length){
    const main=it[0], extra=it.slice(1).map(x=>x.goal);
    return `<span class="purpose">🎯 <b>Mục đích:</b> ${esc(main.goal)}${extra.length?`; đồng thời ${esc(extra.join('; '))}`:''}.<br>🧭 <b>Cách nghĩ:</b> ${esc(main.think)}</span>`;
  }
  // Nước thầm lặng: xem nó chuẩn bị cho đòn nào ở nước sau
  const line=pv||[];
  if(line.length>=3 && line[0].from+''===move.from+'' && line[0].to+''===move.to+''){
    const b1=Engine.applyMove(board,line[0]); const b2=b1[line[1].from[0]]&&b1[line[1].from[0]][line[1].from[1]] ? Engine.applyMove(b1,line[1]) : null;
    const nxt=line[2];
    if(b2 && b2[nxt.from[0]] && b2[nxt.from[0]][nxt.from[1]]){
      const fu=Coach.intent(b2,nxt);
      if(fu.length) return `<span class="purpose">🎯 <b>Mục đích:</b> chuẩn bị — sau khi máy đáp <b>${esc(Notation.describe(b1,line[1]).short)}</b>, bạn có <b>${esc(Notation.describe(b2,nxt).short)}</b> để ${esc(fu[0].goal)}.<br>🧭 <b>Cách nghĩ:</b> Nước thầm lặng tốt thường mở đường cho đòn ở nước sau. Hãy hỏi: “Nếu được đi thêm một nước nữa, mình muốn đi gì? Nước này có tạo điều kiện cho nước đó không?”</span>`;
    }
  }
  const pc=board[move.from[0]][move.from[1]];
  return `<span class="purpose">🎯 <b>Mục đích:</b> cải thiện vị trí ${VN_NAME[pc.type]}: đưa nó tới chỗ hoạt động tốt hơn, chuẩn bị cho trung cuộc.<br>🧭 <b>Cách nghĩ:</b> Khi không có đòn hay lời doạ nào, hãy tìm quân kém hoạt động nhất của mình và cải thiện nó.</span>`;
}
function explainPly(g, p){
  const m=g.moves[p.k], before = p.k===0 ? g.start : g.boards[p.k-1], after=g.boards[p.k];
  const me=m.color, opp=Engine.otherColor(me);
  const bestTxt = p.bestMove ? Notation.describe(before,p.bestMove) : null;
  const step1={ic:'📍', q:'Tình huống trước nước này', html:esc(Coach.threatText(before,me))};
  const step2={ic:'🔎', q:'Bạn đã đi', html:`<b>${esc(m.text.short)}</b> (${esc(m.text.long)}): ${esc(Coach.plainMove(before,m))}.`};
  if(p.cls==='book') return thinkStepsHTML([step1, step2, {ic:'📖', q:'Kết quả', cls:'ts-good', html:'Đúng lý thuyết khai cuộc: phát triển quân theo nguyên tắc.'}]);
  if(p.cls==='best'||p.cls==='good') return thinkStepsHTML([step1, step2, {ic:'✅', q:'Kết quả', cls:'ts-good', html: (p.cls==='best'?'Đây là nước tốt nhất (hoặc ngang bằng) mà máy tìm được.':`Nước tốt, ${lossWords(p.loss)} so với lựa chọn của máy${bestTxt?` (${esc(bestTxt.short)})`:''}.`)+purposeHTML(before,m,null)}]);

  // Lý do chính trước, các lý do phụ sau
  const bad=[]; let qKey=null;
  if(p.bestScore>MATE_T && p.played<MATE_T){ bad.push(`bỏ lỡ đòn chiếu bí: <b>${esc(bestTxt.short)}</b> thắng trong ${Math.max(1,Math.ceil((XQSearch.MATE-p.bestScore)/2))} nước`); qKey='missed-mate'; }
  if(p.played < -MATE_T){ bad.push(`để máy có đường chiếu bí${p.reply?`, bắt đầu bằng <b>${esc(Notation.describe(after,p.reply).short)}</b>`:''}`); qKey=qKey||'allowed-mate'; }
  const wb=Coach.whyBad(before,m,p.reply,{ply:p.k});
  wb.forEach(w=>bad.push(esc(w.text)));
  if(wb.length) qKey=qKey||wb[0].key;
  if(wb.some(w=>w.key==='moved-into-attack'||w.key==='uncovered'||w.key==='ignored-threat'||w.key==='tactic')) p.hanging=true;
  if(p.bestMove){
    const cap=before[p.bestMove.to[0]][p.bestMove.to[1]], playedCap=before[m.to[0]][m.to[1]];
    if(cap && cap.color===opp && PIECE_PTS[cap.type]>=2 && (!playedCap || PIECE_PTS[playedCap.type]<PIECE_PTS[cap.type])){ bad.push(`bỏ lỡ cơ hội ăn ${VN_NAME[cap.type]} cột ${Notation.fileOf(p.bestMove.to[1],opp)}`); p.missedCapture=true; qKey=qKey||'missed-capture'; }
  }
  const reply=lineText(after, p.replyPv, 4);
  if(!bad.length){
    const bi = p.bestMove ? Coach.intent(before,p.bestMove)[0] : null, mi = Coach.intent(before,m)[0];
    if(reply.caps.length) bad.push(`sau nước này máy có cách đáp làm bạn thiệt quân (${reply.caps.join(', ')})`);
    else if(bi && !mi) bad.push(`nước của bạn không có mục tiêu rõ ràng, trong khi lúc này có thể ${bi.goal}`);
    else if(bi) bad.push(`nước của bạn nhằm ${mi.goal}, nhưng lúc này quan trọng hơn là ${bi.goal}`);
    else bad.push('nước này không sai về chiến thuật nhưng đặt quân vào chỗ kém hoạt động hơn nước máy đề xuất');
  }
  qKey=qKey||'positional';
  p.qKey=qKey;
  p.short=bad[0].replace(/<[^>]+>/g,'');

  const decisive = p.played< -MATE_T || p.bestScore>MATE_T;
  const evBefore=evalAt(p.k), evAfter=evalAt(p.k+1);
  const trend=`Thế cờ: trước nước này <b>${evalWords(evBefore,'bạn','máy')}</b> → sau nước này <b>${evalWords(evAfter,'bạn','máy')}</b>.<br>So với nước nên đi: <b>${decisive?'lỗi quyết định cả ván':lossWords(p.loss)}</b>.`;
  const why=`<b>${bad[0][0].toUpperCase()+bad[0].slice(1)}.</b>${bad.length>1?` Ngoài ra: ${bad.slice(1).join('; ')}.`:''}<br>${trend}`;

  const best = lineText(before, p.bestPv, 4);
  return thinkStepsHTML([
    step1, step2,
    {ic:p.cls==='inacc'?'⚠️':'❌', q:'Vì sao chưa tốt?', cls:'ts-bad', html:why},
    reply.n && {ic:'⚔️', q:'Máy có thể đáp lại', html:`${reply.html}${reply.n>=4?' …':''}${(()=>{ const ri=Coach.intent(after,p.replyPv[0])[0]; return ri?`<br>Ý đồ của máy: ${esc(ri.goal)}.`:''; })()}${reply.caps.length?`<br>Kết quả: ${reply.caps.join(', ')}.`:''} <span class="hint-text small">(bấm “▶ Đòn đối phương” để xem trên bàn)</span>`},
    bestTxt && {ic:'💡', q:'Nên đi', cls:'ts-good', html:`<b>${esc(bestTxt.short)}</b> (${esc(bestTxt.long)}, mũi tên xanh).${purposeHTML(before,p.bestMove,p.bestPv)}${best.n>1?`Diễn biến máy dự tính: ${best.html}${best.caps.length?` — ${best.caps.join(', ')}`:''}.`:''}`},
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
  review.rec=rec; review.game=replayRecord(rec); review.an=null; review.idx=-1; review.overview=false; review.token++;
  showAICard('review');
  if(!review.widget) review.widget=createBoardWidget($('#reviewBoard'),{label:'Bàn cờ xem lại ván'});
  review.widget.setFlipped(rec.human===BLACK);
  const rs=resultForHuman(rec);
  $('#reviewHead').innerHTML=`<span class="badge ${rs.cls}">${rs.txt}</span> <b>${esc(levelInfo(recLevel(rec)).name)}</b> · Bạn cầm ${COLOR_VN[rec.human]} · ${Math.ceil(rec.moves.length/2)} nước`;
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
/* ---------- Luồng xem lại: Tổng quan → Lỗi 1 → … → Lỗi cuối → Tổng kết ---------- */
const ERR_ALL=['inacc','mistake','blunder'], ERR_BIG=['mistake','blunder'];
function reviewErrors(){
  const set = review.onlyBig ? ERR_BIG : ERR_ALL;
  return review.an ? review.an.plies.filter(p=>p.color===review.rec.human && set.includes(p.cls)) : [];
}
function turningPoint(){ const e=reviewErrors(); return e.length ? e.reduce((a,b)=>b.loss>a.loss?b:a) : null; }
function moveNo(k){ return `${Math.floor(k/2)+1}${k%2===0?'.':'...'}`; }
const moveNum=k=>Math.floor(k/2)+1;   // dùng trong câu văn: "nước 12"
function reviewShowAnalysis(){
  const rec=review.rec, g=review.game, an=review.an;
  review.lessons=lessonsFrom(rec,g,an);   // cũng tính sẵn lời giải thích ngắn cho từng lỗi
  const cnt=Object.entries(CLASS_INFO).filter(([c])=>an.counts[c]).map(([c,i])=>`<span class="cls-chip cls-${i.cls}">${i.icon} ${i.label}: <b>${an.counts[c]}</b></span>`).join('');
  $('#reviewSummary').innerHTML=`<div class="acc-box"><div class="acc-num">${an.accuracy}%</div><div class="hint-text small">độ chính xác của bạn</div></div>
    <div class="acc-side"><div class="cls-chips">${cnt}</div><h3 class="side-h mt10">📌 Bài học rút ra</h3><ul class="lesson-list">${review.lessons.map(l=>`<li>${l}</li>`).join('')}</ul></div>`;
  review.overview=true; review.idx=-1;
  renderEvalChart();
  reviewRender();
}
function overviewHTML(){
  const g=review.game, errs=reviewErrors(), tp=turningPoint(), an=review.an;
  const nInacc=an.plies.filter(p=>p.color===review.rec.human && p.cls==='inacc').length;
  const filter=`<label class="toggle small"><input type="checkbox" id="rvOnlyBig" ${review.onlyBig?'checked':''}> Chỉ xem sai lầm lớn (bỏ qua ${nInacc} nước “không chính xác”)</label>`;
  if(!errs.length) return `<p><b>🎉 Không có lỗi đáng kể${review.onlyBig?' (sai lầm lớn)':''}.</b> Bạn có thể bấm từng nước trong biên bản để xem máy nhận xét.</p>${filter}`;
  const groups={};
  errs.forEach((p,i)=>{ const ph=phaseOf(g,p.k); (groups[ph]=groups[ph]||[]).push({p,i}); });
  const items=Object.entries(groups).map(([ph,list])=>`<div class="tl-phase"><div class="tl-phase-h">${ph}</div>${list.map(({p,i})=>{
      const info=CLASS_INFO[p.cls], m=g.moves[p.k];
      return `<button type="button" class="tl-item" data-k="${p.k}"><span class="tl-n">${i+1}</span><span class="tl-body"><b>Nước ${moveNum(p.k)}: ${esc(m.text.short)}</b> <span class="cls-chip cls-${info.cls}">${info.icon} ${info.label}</span>${p===tp?' <span class="tl-star">⭐ bước ngoặt</span>':''}<small>${esc(p.short||lossWords(p.loss))}</small></span></button>`; }).join('')}</div>`).join('');
  const tpLine = tp ? `<p class="hint-text">⭐ <b>Bước ngoặt</b> là nước ${moveNum(tp.k)} (${esc(review.game.moves[tp.k].text.short)}): thế cờ từ “${evalWords(evalAt(tp.k),'bạn','máy')}” thành “${evalWords(evalAt(tp.k+1),'bạn','máy')}”.</p>` : '';
  return `<p><b>Ván này có ${errs.length} chỗ bạn có thể đi tốt hơn.</b> Hãy xem lần lượt từ đầu đến cuối: mỗi chỗ có tình huống, vì sao chưa tốt, máy đáp thế nào và nên đi gì.</p>
    ${tpLine}${filter}<div class="timeline">${items}</div>
    <div class="btn-row mt10"><button type="button" class="btn btn-primary" id="rvStart">▶ Bắt đầu từ lỗi 1</button></div>`;
}
function endHTML(){
  const rec=review.rec, errs=reviewErrors(), res=review.game.result;
  const resTxt = res ? Game.resultText(res) : 'Ván chưa kết thúc.';
  return `<p><b>🏁 Đã xem hết ${errs.length} lỗi.</b> ${esc(resTxt)}</p>
    <h3 class="side-h">Thói quen cần luyện từ ván này</h3><ul class="lesson-list">${(review.lessons||[]).map(l=>`<li>${l}</li>`).join('')}</ul>
    <div class="btn-row mt10"><button type="button" class="btn btn-outline" id="rvRestart">↺ Xem lại từ đầu</button></div>`;
}
// Đoạn nối giữa hai lỗi: từ lỗi trước tới lỗi này bạn đi thế nào, thế cờ đang ra sao
function bridgeHTML(i, p){
  const errs=reviewErrors(), prevK = i>0 ? errs[i-1].k : -1, rec=review.rec, an=review.an;
  const between=an.plies.filter(q=>q.k>prevK && q.k<p.k && q.color===rec.human);
  const okN=between.filter(q=>['book','best','good'].includes(q.cls)).length;
  const from = i>0 ? `Kể từ lỗi trước (nước ${moveNum(prevK)})` : 'Từ đầu ván đến đây';
  const walk = between.length ? `${from}, bạn đi ${between.length} nước${okN===between.length?', tất cả đều ổn':`, ${okN} nước ổn`}.` : `${from}: ngay nước kế tiếp.`;
  return `${walk} Thế cờ lúc này: <b>${evalWords(evalAt(p.k),'bạn','máy')}</b>.`;
}
function reviewGo(idx){ review.overview=false; review.idx=idx; reviewRender(); revealBoard($('#reviewBoard')); }
function reviewNextErr(){
  const errs=reviewErrors();
  if(review.overview){ if(errs.length) reviewGo(errs[0].k); else reviewGo(-1); return; }
  if(review.idx===-1) return;
  const nx=errs.find(p=>p.k>review.idx);
  reviewGo(nx ? nx.k : -1);
}
function reviewPrevErr(){
  const errs=reviewErrors();
  if(review.overview) return;
  const cur = review.idx===-1 ? Infinity : review.idx;
  const pv=[...errs].reverse().find(p=>p.k<cur);
  if(pv) reviewGo(pv.k); else { review.overview=true; review.idx=-1; reviewRender(); }
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
  $$('.dot',$('#reviewChart')).forEach(d=>d.addEventListener('click',()=>reviewGo(+d.dataset.k)));
  $('#reviewChart svg').addEventListener('click',(e)=>{
    if(e.target.classList.contains('dot')) return;
    const r=e.currentTarget.getBoundingClientRect(); const i=Math.round((e.clientX-r.left)/r.width*(vals.length-1))-1;
    reviewGo(Math.max(-1,Math.min(n-1,i)));
  });
}
function reviewRender(){
  review.anim++;
  const g=review.game, an=review.an, rec=review.rec;
  const ov = review.overview && an;
  const idx = ov ? -1 : review.idx;
  const board = idx<0 ? g.start : (idx===0 ? g.start : g.boards[idx-1]);   // thế TRƯỚC nước đang xem
  const m = idx>=0 ? g.moves[idx] : null, p = an && idx>=0 ? an.plies[idx] : null;
  const arrows=[];
  if(m) arrows.push({from:m.from,to:m.to,alt:true});
  if(p && p.bestMove && !(p.bestMove.from+''===m.from+''&&p.bestMove.to+''===m.to+'') && !['book','best'].includes(p.cls)) arrows.push({from:p.bestMove.from,to:p.bestMove.to});
  review.widget.setBoard(ov ? g.start : idx<0 && g.moves.length ? g.board() : board, {arrows, lastMove: !ov && idx<0 ? g.lastMove() : null});
  const marks={}, badges={};
  if(an) an.plies.forEach(q=>{ if(q.color===rec.human){ marks[q.k]=CLASS_INFO[q.cls].cls; if(ERR_ALL.includes(q.cls)) badges[q.k]=`<small class="mk">${CLASS_INFO[q.cls].icon}</small>`; } });
  renderMoveLog($('#reviewLog'), g.moves, {active:ov?null:idx, marks, badges, onPick:(k)=>reviewGo(k)});
  // Thanh tiến trình: đang ở đâu trong luồng xem lại
  const errs=reviewErrors(), ei = idx>=0 ? errs.findIndex(q=>q.k===idx) : -1, tp=turningPoint();
  const stepEl=$('#reviewStep');
  if(!an) stepEl.innerHTML='';
  else if(ov) stepEl.innerHTML=`<b>Tổng quan</b> · ${errs.length} lỗi cần xem, theo thứ tự ván`;
  else if(idx<0) stepEl.innerHTML=`<b>Tổng kết</b> · đã xem ${errs.length}/${errs.length} lỗi`;
  else if(ei>=0) stepEl.innerHTML=`<b>Lỗi ${ei+1}/${errs.length}</b> · Nước ${moveNum(idx)} · ${phaseOf(g,idx)}${errs[ei]===tp?' · ⭐ bước ngoặt':''}
    <div class="step-dots">${errs.map((q,j)=>`<span class="sd ${j<ei?'done':j===ei?'cur':''}"></span>`).join('')}</div>`;
  else stepEl.innerHTML=`Nước ${moveNum(idx)} · ${phaseOf(g,idx)} <span class="hint-text small">(không nằm trong danh sách lỗi)</span>`;
  const det=$('#reviewDetail');
  if(ov){ $('#reviewTools').innerHTML=''; det.innerHTML=overviewHTML(); }
  else if(idx<0){ $('#reviewTools').innerHTML=''; det.innerHTML = an ? endHTML() : ''; }
  else {
    const who = m.color===rec.human ? 'Bạn' : 'Máy';
    const info = p ? CLASS_INFO[p.cls] : null;
    det.innerHTML = `${ei>=0?`<p class="bridge">${bridgeHTML(ei,p)}</p>`:''}<div class="rv-head"><b>${moveNo(idx)} ${esc(m.text.short)}</b> <span class="hint-text">(${who} · ${esc(m.text.long)})</span>
      ${info && m.color===rec.human?`<span class="cls-chip cls-${info.cls}">${info.icon} ${info.label}</span>`:''}</div>
      ${p && m.color===rec.human ? `${explainPly(g,p)}<p class="hint-text small">Mũi tên đỏ: nước đã đi${arrows.length>1?' · mũi tên xanh: nước nên đi':''}.</p>` : (an?`<p class="hint-text small">Nước của máy${p&&p.bestMove?'':''}.</p>`:'')}
      ${ei>=0?`<div class="btn-row mt10">${ei+1<errs.length?`<button type="button" class="btn btn-primary btn-sm" data-rv="next">Lỗi tiếp theo (${ei+2}/${errs.length}) ⏭</button>`:`<button type="button" class="btn btn-primary btn-sm" data-rv="next">🏁 Xem tổng kết</button>`}</div>`:''}`;
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
  // nút trong khung chi tiết
  $$('.tl-item',det).forEach(b=>b.addEventListener('click',()=>reviewGo(+b.dataset.k)));
  const st=$('#rvStart',det); if(st) st.addEventListener('click',reviewNextErr);
  const rs=$('#rvRestart',det); if(rs) rs.addEventListener('click',()=>{ review.overview=true; review.idx=-1; reviewRender(); });
  const nx=det.querySelector('[data-rv="next"]'); if(nx) nx.addEventListener('click',reviewNextErr);
  const ob=$('#rvOnlyBig',det); if(ob) ob.addEventListener('change',()=>{ review.onlyBig=ob.checked; safeLS_set('xq_review_big',ob.checked?'1':'0'); reviewRender(); });
  if(an) renderEvalChart();
  const nE=$('#reviewNextMistake'), pE=$('#reviewPrevMistake');
  if(an){
    nE.disabled = !ov && idx===-1;
    nE.textContent = ov ? (errs.length?'▶ Bắt đầu: lỗi 1':'▶ Tổng kết') : 'Lỗi tiếp ⏭';
    pE.disabled = ov;
  } else { nE.disabled=true; pE.disabled=true; }
  $('#reviewPrev').disabled = g.moves.length===0 || (!ov && idx===0) || ov;
  $('#reviewNext').disabled = !ov && idx===-1;
}
function initReview(){
  $('#reviewBack').addEventListener('click',()=>{ review.token++; showAICard(aiGame.game && review.rec && review.rec.id===aiGame.recId && !aiGame.game.result ? 'game':'setup'); });
  // ◀ ▶: từng nửa nước. Tổng quan ↔ nước đầu ↔ … ↔ nước cuối (tổng kết)
  $('#reviewPrev').addEventListener('click',()=>{ const n=review.game.moves.length;
    if(review.overview) return;
    if(review.idx===0){ review.overview=!!review.an; review.idx=-1; reviewRender(); return; }
    reviewGo(review.idx===-1 ? n-1 : review.idx-1); });
  $('#reviewNext').addEventListener('click',()=>{ const n=review.game.moves.length;
    if(review.overview){ reviewGo(n?0:-1); return; }
    reviewGo(review.idx>=n-1 ? -1 : review.idx+1); });
  $('#reviewNextMistake').addEventListener('click',reviewNextErr);
  $('#reviewPrevMistake').addEventListener('click',reviewPrevErr);
}

/* Tự sinh bởi tools/gen-puzzles.js + tools/make-puzzles.js: thế cờ lấy từ ván máy tự đánh, đã kiểm lại bằng Solver. Không sửa tay. */
/*@@DATA:puzzles-gen@@*/

