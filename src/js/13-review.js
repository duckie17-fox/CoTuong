/* =========================================================================
   REVIEW — chấm từng nước, gợi ý nước tốt hơn, rút ra bài học
   ========================================================================= */
const review = { rec:null, game:null, an:null, idx:-1, overview:false, onlyBig:safeLS_get('xq_review_big')==='1', lessons:null, widget:null, running:false, token:0, anim:0 };
// Ký hiệu theo quy ước bình luận cờ: chỉ 5 dấu !! ! ?! ? ??; nước bình thường không ghi ký hiệu.
// Xếp hạng theo mức tụt "cơ hội thắng" của người đi (xem classifyPly), không theo điểm tuyệt đối.
const CLASS_INFO = {
  brilliant:{label:'Tuyệt hay',  icon:'!!', cls:'brilliant', desc:'Giống “Hay”, nhưng nước đó còn <b>thí quân</b> (để đối phương ăn quân của mình) để đổi lấy cái lợi lớn hơn. Hiếm nhất, khó tìm nhất.'},
  great:  {label:'Hay',          icon:'!',  cls:'great',   desc:'Đúng nước máy chọn <b>và là nước duy nhất</b>: mọi nước khác đều làm thế cờ kém hẳn. Khen vì bạn tìm ra lối thoát duy nhất.'},
  best:   {label:'Tốt nhất',     icon:'',   cls:'best',    desc:'Đúng (hoặc ngang) nước máy chọn, nhưng còn những nước khác cũng ổn — nên không có gì phải khen riêng.'},
  good:   {label:'Tốt',          icon:'',   cls:'good',    desc:'Kém nước máy chọn một chút, thế cờ không bị ảnh hưởng. Bấm vào để xem nước hay hơn.'},
  book:   {label:'Theo sách',    icon:'',   cls:'book',    desc:'Nước khai cuộc đúng lý thuyết.'},
  inacc:  {label:'Đáng ngờ',     icon:'?!', cls:'inacc',   desc:'Thiệt nhẹ (cỡ 2 Tốt trở lên), hoặc bỏ lỡ đòn thắng trong khi vẫn đang hơn.'},
  mistake:{label:'Sai lầm',      icon:'?',  cls:'mistake', desc:'Thiệt đáng kể (cỡ một Sĩ/Tượng trở lên), thế cờ xấu đi rõ.'},
  blunder:{label:'Sai lầm nặng', icon:'??', cls:'blunder', desc:'Đổi kết quả ván: mất quân lớn, để bị chiếu bí, hoặc đánh mất thế thắng.'},
};
const clsTag = info => info.label;   // chỉ dùng chữ, không dùng ký hiệu ?! ??
// Bỏ lỡ đòn thắng nhưng vẫn đang hơn rõ
const missedWin = p => (p.bestScore>MATE_T || winChance(p.bestScore)>=0.6) && winChance(p.played)>=0.2;
// "Cơ hội thắng" trong khoảng [-1, 1] theo điểm của máy (thang: Tốt≈30, Mã/Pháo≈280, Xe≈600).
// Cùng dạng công thức Lichess dùng cho cờ vua, hệ số quy đổi theo giá trị Xe.
const winChance = cp => 2/(1+Math.exp(-0.003*clampScore(cp))) - 1;
// Xếp hạng một nước. o: {inBook, sameAsBest, best, played, second, forced, recapture, sacrifice}
//  best/played/second: điểm (góc nhìn người đi) của nước tốt nhất / nước đã đi / cận trên của nước tốt thứ hai
function classifyPly(o){
  if(o.inBook) return 'book';
  const wb=winChance(o.best), wp=winChance(o.played), drop = o.sameAsBest ? 0 : Math.max(0, wb-wp);
  if(drop<0.03){
    // "Nước duy nhất": nước tốt thứ hai kém hẳn (dùng cận trên nên chỉ gắn khi chắc chắn)
    if(o.second!=null && !o.forced && !o.recapture && o.best>-MATE_T && wb - winChance(o.second) >= 0.25) return o.sacrifice ? 'brilliant' : 'great';
    return 'best';
  }
  if(drop<0.1) return 'good';
  // bỏ lỡ đòn thắng mà vẫn hơn rõ: chỉ tính là đáng ngờ
  if((o.best>MATE_T || wb>=0.6) && wp>=0.2) return 'inacc';
  return drop<0.2 ? 'inacc' : drop<0.3 ? 'mistake' : 'blunder';
}
// Độ chính xác từng nước theo mức tụt % thắng (công thức kiểu Lichess)
function moveAccuracy(best, played){
  const d = Math.max(0, 50*(winChance(best)-winChance(played)));
  return Math.max(0, Math.min(100, 103.1668*Math.exp(-0.04354*d) - 3.1669));
}
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
    const sameAsBest = !!(best.move && best.move.from+''===m.from+'' && best.move.to+''===m.to+'');
    const loss = sameAsBest ? 0 : Math.max(0, clampScore(bestScore) - clampScore(played));
    const bk = book.get(Game.key(before, m.color));
    const inBook = bookOn && bk && bk.some(x=>x.move.from+''===m.from+''&&x.move.to+''===m.to+'');
    if(!inBook) bookOn=false;
    // cận trên điểm của nước tốt thứ hai (từ điểm các nước ở gốc)
    let second=null;
    if(best.rootScores && best.rootScores.length>1){
      const others=best.rootScores.filter(r=>!(best.move && r.move.from+''===best.move.from+'' && r.move.to+''===best.move.to+''));
      if(others.length) second=Math.max(...others.map(r=>r.score));
    }
    const prev = k>0 ? g.moves[k-1] : null;
    const recapture = !!(prev && prev.captured && before[m.to[0]][m.to[1]] && prev.to+''===m.to+'');
    const forced = Engine.generateLegalMoves(before, m.color).length<=2;
    // thí quân: nước đáp tốt nhất của đối phương ăn ngay quân vừa đi, và quân đó đắt hơn quân mình vừa ăn
    const capVal = before[m.to[0]][m.to[1]] ? PIECE_PTS[before[m.to[0]][m.to[1]].type] : 0;
    const sacrifice = !!(after.move && after.move.to+''===m.to+'' && PIECE_PTS[m.piece] >= 2 && PIECE_PTS[m.piece] > capVal);
    const cls = classifyPly({inBook, sameAsBest, best:bestScore, played, second, forced, recapture, sacrifice});
    plies.push({k, color:m.color, loss, cls, second, bestMove:best.move, bestPv:(best.pv||[]).slice(0,5), bestScore, played, reply: after.move, replyPv: (after.pv||[]).slice(0,4),
      evalRed: (m.color===RED?1:-1)*clampScore(bestScore)});
  }
  // đánh giá cuối (sau nước cuối)
  const last=res[g.moves.length];
  const finalRed = last.move===null ? (g.turn()===RED?-2000:2000) : (g.turn()===RED?1:-1)*clampScore(last.score);
  return summarizeAnalysis(rec, plies, finalRed);
}
function summarizeAnalysis(rec, plies, finalRed){
  const mine=plies.filter(p=>p.color===rec.human);
  const acc = mine.length ? Math.round(mine.reduce((s,p)=>s+(p.cls==='book'?100:moveAccuracy(p.bestScore,p.played)),0)/mine.length) : 100;
  const counts={}; for(const c in CLASS_INFO) counts[c]=mine.filter(p=>p.cls===c).length;
  return {plies, finalRed, accuracy:acc, counts};
}
// Tên bên trong phân tích: người chơi là "Bạn", bên kia là "Máy"
const sideName=(color)=> review.rec && color===review.rec.human ? 'Bạn' : review.rec && review.rec.online ? 'Đối thủ' : 'Máy';
// Đọc một chuỗi nước (PV) thành lời: ghi rõ bên nào đi và ai ăn quân gì
function lineText(startBoard, line, max){
  let b=startBoard; const parts=[], caps=[];
  for(const mv of (line||[]).slice(0,max||4)){
    const pc=b[mv.from[0]] && b[mv.from[0]][mv.from[1]]; if(!pc) break;
    const victim=b[mv.to[0]][mv.to[1]];
    parts.push(`${sideName(pc.color)} <b>${esc(Notation.describe(b,mv).short)}</b>`);
    if(victim) caps.push(`${sideName(pc.color)==='Bạn'?'bạn':sideName(pc.color).toLowerCase()} ăn ${VN_NAME[victim.type]}`);
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
    return `<span class="purpose"><b>Mục đích:</b> ${esc(main.goal)}${extra.length?`; đồng thời ${esc(extra.join('; '))}`:''}.<br><b>Cách nghĩ:</b> ${esc(main.think)}</span>`;
  }
  // Nước thầm lặng: xem nó chuẩn bị cho đòn nào ở nước sau
  const line=pv||[];
  if(line.length>=3 && line[0].from+''===move.from+'' && line[0].to+''===move.to+''){
    const b1=Engine.applyMove(board,line[0]); const b2=b1[line[1].from[0]]&&b1[line[1].from[0]][line[1].from[1]] ? Engine.applyMove(b1,line[1]) : null;
    const nxt=line[2];
    if(b2 && b2[nxt.from[0]] && b2[nxt.from[0]][nxt.from[1]]){
      const fu=Coach.intent(b2,nxt);
      if(fu.length) return `<span class="purpose"><b>Mục đích:</b> chuẩn bị — sau khi máy đáp <b>${esc(Notation.describe(b1,line[1]).short)}</b>, bạn có <b>${esc(Notation.describe(b2,nxt).short)}</b> để ${esc(fu[0].goal)}.<br><b>Cách nghĩ:</b> Nước thầm lặng tốt thường mở đường cho đòn ở nước sau. Hãy hỏi: “Nếu được đi thêm một nước nữa, mình muốn đi gì? Nước này có tạo điều kiện cho nước đó không?”</span>`;
    }
  }
  const pc=board[move.from[0]][move.from[1]];
  return `<span class="purpose"><b>Mục đích:</b> cải thiện vị trí ${VN_NAME[pc.type]}: đưa nó tới chỗ hoạt động tốt hơn, chuẩn bị cho trung cuộc.<br><b>Cách nghĩ:</b> Khi không có đòn hay lời doạ nào, hãy tìm quân kém hoạt động nhất của mình và cải thiện nó.</span>`;
}
// Chênh lệch nhỏ giữa hai nước, nói bằng lời: "một chút", "khoảng 1–2 Tốt"…
const diffWords = d => d<40 ? 'một chút' : lossWords(d).replace(/^thiệt [^,]*, cỡ /,'khoảng ');
function explainPly(g, p){
  const m=g.moves[p.k], before = p.k===0 ? g.start : g.boards[p.k-1], after=g.boards[p.k];
  const me=m.color, opp=Engine.otherColor(me);
  const bestTxt = p.bestMove ? Notation.describe(before,p.bestMove) : null;
  const step1={ic:'pin', q:'Tình huống trước nước này', html:esc(Coach.threatText(before,me))};
  const step2={ic:'search', q:'Bạn đã đi', html:`<b>${esc(m.text.short)}</b> (${esc(m.text.long)}): ${esc(Coach.plainMove(before,m))}.`};
  if(p.cls==='book') return thinkStepsHTML([step1, step2, {ic:'book', q:'Kết quả', cls:'ts-good', html:'Đúng lý thuyết khai cuộc: phát triển quân theo nguyên tắc.'}]);
  if(p.cls==='great'||p.cls==='brilliant'){
    const gap = p.second!=null ? diffWords(Math.max(0, clampScore(p.bestScore)-clampScore(p.second))) : '';
    return thinkStepsHTML([step1, step2,
      {ic:'star', q:'Kết quả', cls:'ts-good', html:`<b>${p.cls==='brilliant'?'Nước tuyệt hay (!!)':'Nước hay (!)'}:</b> đây là nước duy nhất giữ được thế cờ${gap?` — các nước khác đều kém ít nhất ${gap}`:''}.${p.cls==='brilliant'?' Bạn dám để quân bị ăn vì đã tính được cái lợi phía sau.':''}${purposeHTML(before,m,p.bestPv)}`},
      {ic:'question', q:'Vì sao khó tìm?', cls:'ts-q-row', html:'Khi chỉ có một nước tốt, phải xét hết các nước chiếu, ăn quân và doạ quân của cả hai bên mới thấy được. Bạn đã làm đúng việc đó.'}]);
  }
  const same = p.bestMove && p.bestMove.from+''===m.from+'' && p.bestMove.to+''===m.to+'';
  if(p.cls==='best'||p.cls==='good'){
    const res={ic:'check', q:'Kết quả', cls:'ts-good', html:(p.cls==='best'
      ? (same?'Đây chính là nước tốt nhất máy tìm được.':'Ngang bằng nước tốt nhất máy tìm được.')
      : `Nước tốt — chỉ kém nước hay nhất ${diffWords(p.loss)}, thế cờ không bị ảnh hưởng.`)+purposeHTML(before,m,same?p.bestPv:null)};
    if(same || !bestTxt) return thinkStepsHTML([step1, step2, res]);
    // Nước đã tốt nhưng vẫn có nước hay hơn (hoặc một lựa chọn ngang bằng) → chỉ ra để học thêm
    const bi=Coach.intent(before,p.bestMove)[0], mi=Coach.intent(before,m)[0];
    const cmp = bi && mi && bi.key!==mi.key ? `Nước của bạn nhằm ${esc(mi.goal)} — chưa sai, nhưng lúc này có việc đáng làm hơn:`
      : bi && !mi ? 'Nước của bạn chưa có mục tiêu cụ thể, còn nước này có:' : '';
    const best=lineText(before, p.bestPv, 4);
    return thinkStepsHTML([step1, step2, res,
      {ic:p.cls==='best'?'repeat':'bulb', q:p.cls==='best'?'Lựa chọn khác ngang bằng':'Nước hay hơn', cls:'ts-good', html:`<b>${esc(bestTxt.short)}</b> (${esc(bestTxt.long)}, mũi tên xanh)${p.cls==='good'?` — hơn nước của bạn ${diffWords(p.loss)}`:''}.${cmp?`<br>${cmp}`:''}${purposeHTML(before,p.bestMove,p.bestPv)}${best.n>1?`Diễn biến máy dự tính: ${best.html}${best.caps.length?` — ${best.caps.join(', ')}`:''}.`:''}`},
    ]);
  }

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
  const trend=`Thế cờ: trước nước này <b>${evalWords(evBefore,'bạn','máy')}</b> → sau nước này <b>${evalWords(evAfter,'bạn','máy')}</b>.<br>So với nước nên đi: <b>${missedWin(p)?`bạn vẫn giữ ưu thế, nhưng để lỡ ${p.bestScore>MATE_T?'đòn kết thúc ván':lossWords(p.loss)}`:decisive?'lỗi quyết định cả ván':lossWords(p.loss)}</b>.`;
  const why=`<b>${bad[0][0].toUpperCase()+bad[0].slice(1)}.</b>${bad.length>1?` Ngoài ra: ${bad.slice(1).join('; ')}.`:''}<br>${trend}`;

  const best = lineText(before, p.bestPv, 4);
  return thinkStepsHTML([
    step1, step2,
    {ic:missedWin(p)?'target':p.cls==='inacc'?'alert':'x', q:missedWin(p)?'Bỏ lỡ cơ hội gì?':'Vì sao chưa tốt?', cls:'ts-bad', html:why},
    reply.n && {ic:'swords', q:'Máy có thể đáp lại', html:`${reply.html}${reply.n>=4?' …':''}${(()=>{ const ri=Coach.intent(after,p.replyPv[0])[0]; return ri?`<br>Ý đồ của máy: ${esc(ri.goal)}.`:''; })()}${reply.caps.length?`<br>Kết quả: ${reply.caps.join(', ')}.`:''} <span class="hint-text small">(bấm “Xem đòn của máy” để xem trên bàn)</span>`},
    bestTxt && {ic:'bulb', q:'Nên đi', cls:'ts-good', html:`<b>${esc(bestTxt.short)}</b> (${esc(bestTxt.long)}, mũi tên xanh).${purposeHTML(before,p.bestMove,p.bestPv)}${best.n>1?`Diễn biến máy dự tính: ${best.html}${best.caps.length?` — ${best.caps.join(', ')}`:''}.`:''}`},
    {ic:'question', q:'Lần sau hãy tự hỏi', cls:'ts-q-row', html:esc(Coach.QUESTIONS[qKey])},
  ]);
}
function lessonsFrom(rec, g, an){
  const mine=an.plies.filter(p=>p.color===rec.human);
  mine.forEach(p=>{ if(ERR_ALL.includes(p.cls)) explainPly(g,p); });
  const L=[];
  const hang=mine.filter(p=>p.hanging && (p.cls==='mistake'||p.cls==='blunder')).length;
  const missCap=mine.filter(p=>p.missedCapture).length;
  const missMate=mine.filter(p=>p.bestScore>MATE_T && p.played<MATE_T).length;
  const allowMate=mine.filter(p=>p.played< -MATE_T && p.bestScore> -MATE_T).length;
  if(allowMate) L.push(`Có ${allowMate} lần bạn đi nước để đối phương có đường chiếu bí. Trước mỗi nước, hãy tự hỏi: "Sau nước này đối phương có chiếu được không, Tướng mình còn chỗ chạy không?"`);
  if(hang) L.push(`Có ${hang} lần bạn để quân bị ăn không (quân không được bảo vệ). Thói quen tốt: trước khi đi, kiểm tra quân vừa đi và các quân khác xem có bị Xe, Mã, Pháo đối phương nhắm không.`);
  if(missMate) L.push(`Bạn bỏ lỡ ${missMate} cơ hội chiếu bí. Khi Tướng đối phương ít chỗ chạy, hãy thử tính các nước chiếu trước tiên. Luyện mục "Sát cục" trong tab Chiến thuật.`);
  if(missCap) L.push(`Bạn bỏ lỡ ${missCap} lần ăn quân miễn phí. Mỗi lượt, hãy nhìn một vòng xem quân nào của đối phương đang không được bảo vệ.`);
  // ra Xe chậm
  const firstRookMove = g.moves.findIndex(m=>m.color===rec.human && m.piece==='R');
  const myMovesBefore = firstRookMove<0 ? g.moves.filter(m=>m.color===rec.human).length : g.moves.slice(0,firstRookMove).filter(m=>m.color===rec.human).length;
  if(myMovesBefore>=6 && g.moves.filter(m=>m.color===rec.human).length>=8) L.push(`Bạn ra Xe khá muộn (sau ${myMovesBefore} nước). Nhớ nguyên tắc khai cuộc: ra Xe sớm, vì Xe là quân mạnh nhất. Luyện với Trainer ở tab Khai cuộc.`);
  const kingWalks = g.moves.filter((m,i)=>m.color===rec.human && m.piece==='G' && i<40).length;
  if(kingWalks>=3) L.push(`Tướng của bạn di chuyển ${kingWalks} lần ở đầu ván. Hãy giữ Sĩ Tượng đầy đủ để Tướng không phải chạy nhiều.`);
  const early=mine.filter(p=>p.k<20);
  if(early.length>=5 && early.every(p=>GOOD_ALL.includes(p.cls))) L.push('Khai cuộc của bạn rất chắc: 10 nước đầu không có sai lầm nào.');
  const lost = rec.result && rec.result.winner && rec.result.winner!==rec.human;
  if(an.accuracy>=85 && !lost) L.push(`Độ chính xác ${an.accuracy}% là rất tốt. Hãy thử nâng cấp độ máy lên một bậc.`);
  const qCount={}; mine.forEach(p=>{ if(p.qKey && ERR_ALL.includes(p.cls)) qCount[p.qKey]=(qCount[p.qKey]||0)+1; });
  const topQ=Object.entries(qCount).sort((a,b)=>b[1]-a[1])[0];
  if(topQ && topQ[1]>=2) L.unshift(`Thói quen cần luyện nhất (${topQ[1]} lỗi): ${Coach.QUESTIONS[topQ[0]]}`);
  if(an.accuracy>=85 && lost) L.push(`Độ chính xác ${an.accuracy}% nhưng vẫn thua: thường là do nhiều nước “tốt” nhưng chưa hay nhất dồn lại. Hãy xem mục “nước tốt nhưng vẫn có nước hay hơn” ở phần tổng quan.`);
  if(!L.length) L.push('Ván cờ khá ổn. Hãy bấm vào các nước được đánh dấu màu để xem chỗ có thể cải thiện.');
  return L.slice(0,5);
}

/* ---------- Phong cách chơi: đọc từ các ván gần nhất, đề xuất thế trận hợp tay ---------- */
// Thế khai cuộc trong sách khớp nhiều nước đầu nhất với ván (chỉ ván bắt đầu từ thế ban đầu)
function detectOpening(g){
  let best=null, bestN=0;
  for(const o of OPENINGS){ if(o.isTrap) continue;
    for(const l of o.lines){ let n=0;
      while(n<l.moves.length && n<g.moves.length && l.moves[n].from && l.moves[n].from+''===g.moves[n].from+'' && l.moves[n].to+''===g.moves[n].to+'') n++;
      if(n>bestN){ bestN=n; best=o; } } }
  return bestN>=3 ? best : null;
}
function gameStyleStats(rec, g, plies){
  const me=rec.human, st={n:0, checks:0, captures:0, cross:0, trades:0, guard:0, piece:{}, phase:{}, opening:null};
  g.moves.forEach((m,k)=>{
    if(m.color!==me) return;
    st.n++; if(m.check) st.checks++; if(m.captured) st.captures++;
    st.piece[m.piece]=(st.piece[m.piece]||0)+1;
    if('RHC'.includes(m.piece) && !Engine.ownSide(m.to[0],me)) st.cross++;
    if(m.piece==='A'||m.piece==='E') st.guard++;
    const nx=g.moves[k+1]; if(m.captured && nx && nx.captured && nx.to+''===m.to+'') st.trades++;
  });
  (plies||[]).forEach(p=>{ if(p.color!==me) return;
    const ph=phaseOf(g,p.k), a=st.phase[ph]||(st.phase[ph]={s:0,n:0});
    a.s += p.cls==='book' ? 100 : moveAccuracy(p.bestScore,p.played); a.n++; });
  if(!rec.start) st.opening=detectOpening(g);
  return st;
}
const STYLE_OPENINGS = {
  attack:  {[RED]:['binh-phong-ma','thuan-phao'], [BLACK]:['thuan-phao','ban-do-nghich-phao']},
  balanced:{[RED]:['tien-nhan-chi-lo','khoi-ma'], [BLACK]:['binh-phong-ma','tam-bo-ho']},
  solid:   {[RED]:['phi-tuong','si-giac-phao'],   [BLACK]:['binh-phong-ma','phan-cung-ma']},
};
function styleProfile(rec, g, an){
  // ván đang xem + tối đa 9 ván đã lưu gần nhất (đủ dài để nói được điều gì đó)
  const games=[{rec, g, plies:an.plies}];
  for(const r of loadHistory()){
    if(games.length>=10) break;
    if(r.id===rec.id || !r.moves || r.moves.length<20) continue;
    try{
      const gg=replayRecord(r), a=r.analysis;
      const pl = a && a.plies ? a.plies.map((q,k)=>({k, color:gg.moves[k].color, cls:q.c, bestScore:q.s, played:q.pl})) : null;
      games.push({rec:r, g:gg, plies:pl});
    }catch(e){}
  }
  const T={n:0, checks:0, captures:0, cross:0, trades:0, guard:0, piece:{}, phase:{}, openings:{}};
  for(const x of games){
    const st=gameStyleStats(x.rec, x.g, x.plies);
    for(const f of ['n','checks','captures','cross','trades','guard']) T[f]+=st[f];
    for(const t in st.piece) T.piece[t]=(T.piece[t]||0)+st.piece[t];
    for(const ph in st.phase){ const a=T.phase[ph]||(T.phase[ph]={s:0,n:0}); a.s+=st.phase[ph].s; a.n+=st.phase[ph].n; }
    if(st.opening) T.openings[st.opening.id]=(T.openings[st.opening.id]||0)+1;
  }
  const n=Math.max(1,T.n), crossR=T.cross/n, checkR=T.checks/n, guardR=T.guard/n, tradeR=T.trades/Math.max(1,T.captures);
  const aggr = crossR + 1.5*checkR - 0.5*guardR;
  const kind = aggr>=0.38 ? 'attack' : aggr<=0.22 ? 'solid' : 'balanced';
  const fav=['R','H','C'].sort((a,b)=>(T.piece[b]||0)-(T.piece[a]||0))[0];
  const phases=Object.entries(T.phase).filter(([,a])=>a.n>=4).map(([ph,a])=>[ph,Math.round(a.s/a.n)]).sort((a,b)=>b[1]-a[1]);
  const topOp=Object.entries(T.openings).sort((a,b)=>b[1]-a[1])[0];
  return {games:games.length, kind, crossR, checkR, guardR, tradeR, fav, phases, topOp: topOp ? OPENINGS.find(o=>o.id===topOp[0]) : null, captures:T.captures, color:rec.human};
}
function styleHTML(sp, an){
  const pct=v=>Math.round(100*v)+'%';
  const KIND={attack:['swords','Tấn công','Bạn thích chủ động đưa quân sang sân đối phương và tạo áp lực, chiếu tướng.'],
    balanced:['scale','Cân bằng','Bạn vừa phát triển quân vừa giữ nhà, chỉ tấn công khi có cơ hội.'],
    solid:['shield','Chắc chắn, phòng thủ','Bạn ưu tiên giữ thế, ít khi đưa quân qua sông sớm.']}[sp.kind];
  const traits=[
    `Đưa Xe/Mã/Pháo sang sân đối phương ở <b>${pct(sp.crossR)}</b> số nước, chiếu tướng ở <b>${pct(sp.checkR)}</b> số nước.`,
    `Quân bạn dùng nhiều nhất: <b>${VN_NAME[sp.fav]}</b>.`,
  ];
  if(sp.captures>=4) traits.push(sp.tradeR>=0.5 ? `Bạn hay <b>đổi quân</b> (${pct(sp.tradeR)} lần ăn quân là đổi qua lại) — thích đơn giản hoá thế cờ.` : `Bạn ít đổi quân (${pct(sp.tradeR)} lần ăn quân là đổi qua lại) — thích giữ thế cờ phức tạp.`);
  if(sp.topOp) traits.push(`Thế khai cuộc hay gặp: <b>${esc(sp.topOp.name)}</b>.`);
  if(sp.phases.length>=2){ const hi=sp.phases[0], lo=sp.phases[sp.phases.length-1];
    traits.push(`Chính xác nhất ở <b>${hi[0].toLowerCase()}</b> (${hi[1]}%), yếu nhất ở <b>${lo[0].toLowerCase()}</b> (${lo[1]}%).`); }
  // Đề xuất: thế khai cuộc hợp phong cách + điểm cần bù
  const ops=STYLE_OPENINGS[sp.kind][sp.color].map(id=>OPENINGS.find(o=>o.id===id)).filter(Boolean);
  const advice=[];
  const hangs=an.plies.filter(p=>p.color===sp.color && p.hanging && ['mistake','blunder'].includes(p.cls)).length;
  if(sp.kind==='attack') advice.push(hangs>=2
    ? 'Bạn có máu tấn công nhưng ván này để mất quân không đáng khá nhiều. Hãy giữ lối đánh chủ động, nhưng trước mỗi nước tấn công tự hỏi “quân vừa đi có bị ăn không?”. Thế trận dưới đây cho thế công rõ ràng mà vẫn có nền chắc.'
    : 'Lối đánh chủ động hợp với các thế trận mở, giao chiến sớm. Hãy chọn thế khai cuộc có kế hoạch tấn công rõ ràng.');
  else if(sp.kind==='solid') advice.push('Lối đánh chắc chắn hợp với các thế trận kín, triển khai đủ quân rồi mới phản công. Điểm cần luyện: biết lúc nào nên chuyển sang tấn công — khi đã ra đủ Xe và Tướng an toàn, đừng ngại đưa Xe qua sông.');
  else advice.push('Lối đánh cân bằng hợp với các thế trận linh hoạt, để ngỏ nhiều kế hoạch. Hãy luyện thêm cả thế công lẫn thế thủ để chọn theo đối thủ.');
  if(sp.fav==='H' && sp.kind!=='attack') advice.push('Bạn dùng Mã nhiều: các thế có hai Mã ra sớm (Bình phong Mã, Khởi Mã) sẽ hợp tay.');
  if(sp.fav==='C' && sp.kind!=='solid') advice.push('Bạn dùng Pháo nhiều: các thế Pháo đầu, Thuận Pháo tận dụng tốt sở thích này.');
  if(sp.phases.length>=2){ const lo=sp.phases[sp.phases.length-1][0];
    advice.push(lo==='Tàn cuộc' ? 'Bạn hay đánh rơi điểm ở tàn cuộc: luyện mục “Tàn cuộc” trong tab Chiến thuật.'
      : lo==='Khai cuộc' ? 'Bạn hay mất điểm ngay từ khai cuộc: dùng chế độ tự đi lại lý thuyết ở tab Khai cuộc với một trong các thế dưới đây.'
      : 'Bạn hay mất điểm ở trung cuộc: luyện bài tập chiến thuật (bắt đôi, bắt quân) để nhìn thấy đòn nhanh hơn.'); }
  return `<div class="style-box"><h3 class="side-h">Phong cách của bạn <span class="hint-text small">(dựa trên ${sp.games} ván gần nhất)</span></h3>
    <p class="style-tag"><span class="style-kind">${icon(KIND[0])}${KIND[1]}</span> ${KIND[2]}</p>
    <ul class="lesson-list">${traits.map(t=>`<li>${t}</li>`).join('')}</ul>
    <h3 class="side-h mt10">Nên học tiếp</h3><ul class="lesson-list">${advice.map(t=>`<li>${t}</li>`).join('')}</ul>
    ${ops.length?`<div class="btn-row">${ops.map(o=>`<button type="button" class="btn btn-outline btn-sm" data-op="${o.id}"><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-book"></use></svg>${esc(o.name)}</button>`).join('')}</div>`:''}
    ${sp.games<3?'<p class="hint-text small">Nhận xét tạm (mới ít ván).</p>':''}</div>`;
}
function legendHTML(){
  const C=CLASS_INFO, rows=[C.brilliant, C.great, C.best, C.good, C.book, C.inacc, C.mistake, C.blunder];
  return `<details class="cls-legend more-box"><summary>Ý nghĩa các nhãn</summary><dl>${rows.map(i=>`<div><dt class="cls-${i.cls}">${i.label}</dt><dd>${i.desc}</dd></div>`).join('')}</dl></details>`;
}

function openReview(rec){
  if(!rec) return;
  review.rec=rec; review.game=replayRecord(rec); review.an=null; review.idx=-1; review.overview=false; review.token++;
  showAICard('review');
  if(!review.widget) review.widget=createBoardWidget($('#reviewBoard'),{label:'Bàn cờ xem lại ván'});
  review.widget.setFlipped(rec.human===BLACK);
  const rs=resultForHuman(rec);
  $('#reviewHead').innerHTML=`<span class="badge ${rs.cls}">${rs.txt}</span> <b>${rec.online?`Đấu với ${esc(rec.oppName||'bạn')}`:esc(levelInfo(recLevel(rec)).name)}</b> · Bạn cầm ${COLOR_VN[rec.human]} · ${Math.ceil(rec.moves.length/2)} nước`;
  $('#reviewSummary').innerHTML=''; $('#reviewMore').innerHTML=''; $('#reviewChart').innerHTML=''; $('#reviewDetail').innerHTML='';
  reviewRender();
  $('#aiReviewCard').scrollIntoView({block:'start'}); revealBoard($('#reviewBoard'));
  if(rec.analysis && (rec.analysis.version===2 || rec.analysis.version===3)) { applyStoredAnalysis(rec); return; }
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
  rec.analysis={version:3, accuracy:an.accuracy, plies:an.plies.map(p=>({c:p.cls,g:p.second,l:Math.round(p.loss),b:p.bestMove?[p.bestMove.from,p.bestMove.to]:null,s:p.bestScore,pl:p.played,r:p.reply?[p.reply.from,p.reply.to]:null,rp:(p.replyPv||[]).map(m=>[m.from,m.to]),bp:(p.bestPv||[]).map(m=>[m.from,m.to]),e:p.evalRed})), finalRed:an.finalRed};
  if(rec.online) Online.saveRecord(rec);
  else if(loadHistory().some(x=>x.id===rec.id)) upsertHistory(rec);
  reviewShowAnalysis();
}
function applyStoredAnalysis(rec){
  const a=rec.analysis, g=review.game;
  const plies=a.plies.map((p,k)=>({k, color:g.moves[k].color, cls:CLASS_INFO[p.c]?p.c:'inacc', loss:p.l, second:p.g==null?null:p.g, bestMove:p.b?{from:p.b[0],to:p.b[1]}:null, bestScore:p.s, played:p.pl, reply:p.r?{from:p.r[0],to:p.r[1]}:null, replyPv:(p.rp||[]).map(x=>({from:x[0],to:x[1]})), bestPv:(p.bp||[]).map(x=>({from:x[0],to:x[1]})), evalRed:p.e}));
  // Bản lưu cũ (v2) xếp hạng theo thang điểm cũ → xếp hạng lại theo thang mới
  if(a.version===2) plies.forEach(p=>{
    const m=g.moves[p.k], same=!!(p.bestMove && p.bestMove.from+''===m.from+'' && p.bestMove.to+''===m.to+'');
    p.cls=classifyPly({inBook:p.cls==='book', sameAsBest:same, best:p.bestScore, played:p.played, second:null});
  });
  review.an=summarizeAnalysis(rec, plies, a.finalRed);
  $('#reviewProgress').hidden=true;
  reviewShowAnalysis();
}
/* ---------- Luồng xem lại: Tổng quan → Lỗi 1 → … → Lỗi cuối → Tổng kết ---------- */
const ERR_ALL=['inacc','mistake','blunder'], ERR_BIG=['mistake','blunder'];
const GOOD_ALL=['book','best','good','great','brilliant'];
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
  const C=an.counts, chips=[[CLASS_INFO.brilliant,C.brilliant],[CLASS_INFO.great,C.great],[{label:'Tốt',icon:'',cls:'good'},C.best+C.good+C.book],[CLASS_INFO.inacc,C.inacc],[CLASS_INFO.mistake,C.mistake],[CLASS_INFO.blunder,C.blunder]];
  const cnt=chips.filter(([,n])=>n).map(([i,n])=>`<span class="cls-chip cls-${i.cls}">${clsTag(i)}: <b>${n}</b></span>`).join('');
  const mine=an.plies.filter(p=>p.color===rec.human).length;
  review.short = mine<SHORT_GAME;   // ván quá ngắn: không chấm % chính xác, không đoán phong cách, không vẽ biểu đồ
  $('#reviewSummary').innerHTML = review.short
    ? `<div class="rv-sum"><span>Ván ngắn (${mine} nước), chưa chấm điểm</span>${cnt}</div>`
    : `<div class="rv-sum"><span class="acc-num">${an.accuracy}%</span><span class="hint-text small">chính xác</span>${cnt}</div>`;
  $('#reviewMore').innerHTML = `<details class="more-box"><summary>Nhận xét cả ván</summary>
    ${review.short?`<p class="hint-text">Chơi từ ${SHORT_GAME} nước trở lên thì máy chấm độ chính xác và nhận xét lối chơi.</p>`
      :`<h3 class="side-h">Bài học rút ra</h3><ul class="lesson-list">${review.lessons.map(l=>`<li>${l}</li>`).join('')}</ul>${styleHTML(styleProfile(rec,g,an), an)}`}
    ${cnt?legendHTML():''}</details>`;
  $$('[data-op]',$('#reviewMore')).forEach(b=>b.addEventListener('click',()=>{ showTab('khaicuoc'); openOpening(b.dataset.op); }));
  review.overview=true; review.idx=-1;
  renderEvalChart();
  reviewRender();
}
function overviewHTML(){
  const g=review.game, errs=reviewErrors(), tp=turningPoint(), an=review.an;
  const nInacc=an.plies.filter(p=>p.color===review.rec.human && p.cls==='inacc').length;
  const filter=`<label class="toggle small"><input type="checkbox" id="rvOnlyBig" ${review.onlyBig?'checked':''}> Chỉ xem lỗi lớn</label>`;
  const better=an.plies.filter(q=>q.color===review.rec.human && q.cls==='good' && q.bestMove);
  const betterHTML = better.length ? `<details class="better-list mt10"><summary>${better.length} nước ổn, còn cách hay hơn</summary><div class="timeline">${better.map(q=>`<button type="button" class="tl-item" data-k="${q.k}"><span class="tl-n"><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-check"></use></svg></span><span class="tl-body"><b>Nước ${moveNum(q.k)}: ${esc(g.moves[q.k].text.short)}</b> → tối ưu hơn: <b>${esc(Notation.describe(q.k===0?g.start:g.boards[q.k-1], q.bestMove).short)}</b><small>chênh ${diffWords(q.loss)}</small></span></button>`).join('')}</div></details>` : '';
  if(!errs.length) return `<p><b>Không có lỗi đáng kể${review.onlyBig?' (sai lầm lớn)':''}.</b> Bạn có thể bấm từng nước trong biên bản để xem máy nhận xét.</p>${filter}${betterHTML}`;
  const groups={};
  errs.forEach((p,i)=>{ const ph=phaseOf(g,p.k); (groups[ph]=groups[ph]||[]).push({p,i}); });
  const items=Object.entries(groups).map(([ph,list])=>`<div class="tl-phase"><div class="tl-phase-h">${ph}</div>${list.map(({p,i})=>{
      const info=CLASS_INFO[p.cls], m=g.moves[p.k];
      return `<button type="button" class="tl-item" data-k="${p.k}"><span class="tl-n">${i+1}</span><span class="tl-body"><b>Nước ${moveNum(p.k)}: ${esc(m.text.short)}</b> <span class="cls-chip cls-${info.cls}">${clsTag(info)}</span>${p===tp?' <span class="tl-star"><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-star"></use></svg>bước ngoặt</span>':''}<small>${esc(p.short||lossWords(p.loss))}</small></span></button>`; }).join('')}</div>`).join('');
  const tpLine = tp ? `<p class="hint-text"><b>Lỗi đắt nhất</b> là nước ${moveNum(tp.k)} (${esc(review.game.moves[tp.k].text.short)}): thế cờ từ “${evalWords(evalAt(tp.k),'bạn','máy')}” thành “${evalWords(evalAt(tp.k+1),'bạn','máy')}”.</p>` : '';
  return `<p><b>${errs.length} chỗ có thể đi tốt hơn.</b> Bấm <b>Bắt đầu</b> để xem từng chỗ.</p>
    ${tpLine}${filter}<div class="timeline">${items}</div>${betterHTML}`;
}
function endHTML(){
  const rec=review.rec, errs=reviewErrors(), res=review.game.result;
  const resTxt = res ? Game.resultText(res) : 'Ván chưa kết thúc.';
  return `<p><b>Đã xem hết ${errs.length} lỗi.</b> ${esc(resTxt)}</p>
    <h3 class="side-h">Thói quen cần luyện từ ván này</h3><ul class="lesson-list">${(review.lessons||[]).map(l=>`<li>${l}</li>`).join('')}</ul>
    <div class="btn-row mt10"><button type="button" class="btn btn-outline" id="rvRestart"><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-undo"></use></svg>Xem lại từ đầu</button></div>`;
}
// Đoạn nối giữa hai lỗi: từ lỗi trước tới lỗi này bạn đi thế nào, thế cờ đang ra sao
function bridgeHTML(i, p){
  const errs=reviewErrors(), prevK = i>0 ? errs[i-1].k : -1, rec=review.rec, an=review.an;
  const between=an.plies.filter(q=>q.k>prevK && q.k<p.k && q.color===rec.human);
  const okN=between.filter(q=>GOOD_ALL.includes(q.cls)).length;
  const from = i>0 ? `Kể từ lỗi trước (nước ${moveNum(prevK)})` : 'Từ đầu ván đến đây';
  const impN=between.filter(q=>q.cls==='good' && q.bestMove).length;
  const walk = between.length ? `${from}, bạn đi ${between.length} nước${okN===between.length?', tất cả đều ổn':`, ${okN} nước ổn`}${impN?` (${impN} nước tốt vẫn có thể tối ưu hơn — bấm vào nước có gạch xanh trong biên bản để xem)`:''}.` : `${from}: ngay nước kế tiếp.`;
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
const SHORT_GAME=6;
function renderEvalChart(){
  if(review.short || !reviewErrors().length){ $('#reviewChart').innerHTML=''; return; }
  const an=review.an, rec=review.rec, n=an.plies.length;
  const W=600, H=64, pad=5, sign = rec.human===RED?1:-1;
  const vals=an.plies.map(p=>sign*p.evalRed).concat([sign*an.finalRed]);
  const x=i=>pad+(W-2*pad)*i/Math.max(1,vals.length-1), y=v=>H/2 - (H/2-pad)*Math.max(-1,Math.min(1,v/800));
  const path=vals.map((v,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area=`M${x(0)},${H/2} `+vals.map((v,i)=>`L${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')+` L${x(vals.length-1)},${H/2} Z`;
  const dots=an.plies.filter(p=>p.color===rec.human && ERR_ALL.includes(p.cls))
    .map(p=>`<circle class="dot dot-${p.cls}" cx="${x(p.k+1)}" cy="${y(vals[p.k+1])}" r="5" data-k="${p.k}"><title>Nước ${Math.floor(p.k/2)+1}: ${CLASS_INFO[p.cls].label}</title></circle>`).join('');
  $('#reviewChart').innerHTML=`<svg viewBox="0 0 ${W} ${H}" class="eval-svg" role="img" aria-label="Biểu đồ lợi thế theo từng nước (phía trên là bạn đang hơn)">
    <line x1="0" x2="${W}" y1="${H/2}" y2="${H/2}" class="mid"/><path d="${area}" class="area"/><path d="${path}" class="line"/>${dots}
    ${review.idx>=0?`<line class="cursor" x1="${x(review.idx+1)}" x2="${x(review.idx+1)}" y1="0" y2="${H}"/>`:''}</svg>
    <div class="chart-legend"><span>Trên: bạn hơn</span><span>Dưới: đối thủ hơn</span></div>`;
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
  if(an) an.plies.forEach(q=>{ if(q.color===rec.human) marks[q.k]=CLASS_INFO[q.cls].cls; });
  renderMoveLog($('#reviewLog'), g.moves, {active:ov?null:idx, marks, badges, onPick:(k)=>reviewGo(k)});
  // Thanh tiến trình: đang ở đâu trong luồng xem lại
  const errs=reviewErrors(), ei = idx>=0 ? errs.findIndex(q=>q.k===idx) : -1, tp=turningPoint();
  const stepEl=$('#reviewStep');
  if(!an) stepEl.innerHTML='';
  else if(ov) stepEl.innerHTML=`<b>Tổng quan</b> · ${errs.length} lỗi cần xem, theo thứ tự ván`;
  else if(idx<0) stepEl.innerHTML=`<b>Tổng kết</b> · đã xem ${errs.length}/${errs.length} lỗi`;
  else if(ei>=0) stepEl.innerHTML=`<b>Lỗi ${ei+1}/${errs.length}</b> · Nước ${moveNum(idx)} · ${phaseOf(g,idx)}${errs[ei]===tp?' · lỗi đắt nhất':''}
    <div class="step-dots">${errs.map((q,j)=>`<span class="sd ${j<ei?'done':j===ei?'cur':''}"></span>`).join('')}</div>`;
  else stepEl.innerHTML=`Nước ${moveNum(idx)} · ${phaseOf(g,idx)} <span class="hint-text small">(không nằm trong danh sách lỗi)</span>`;
  const det=$('#reviewDetail');
  if(ov){ $('#reviewTools').innerHTML=''; det.innerHTML=overviewHTML(); }
  else if(idx<0){ $('#reviewTools').innerHTML=''; det.innerHTML = an ? endHTML() : ''; }
  else {
    const who = m.color===rec.human ? 'Bạn' : 'Máy';
    const info = p ? CLASS_INFO[p.cls] : null;
    det.innerHTML = `${ei>=0?`<p class="bridge">${bridgeHTML(ei,p)}</p>`:''}<div class="rv-head"><b>${moveNo(idx)} ${esc(m.text.short)}</b> <span class="hint-text">(${who} · ${esc(m.text.long)})</span>
      ${info && m.color===rec.human?`<span class="cls-chip cls-${info.cls}">${clsTag(info)}</span>`:''}</div>
      ${p && m.color===rec.human ? `${explainPly(g,p)}<p class="hint-text small">Mũi tên đỏ: nước đã đi${arrows.length>1?' · mũi tên xanh: nước nên đi':''}.</p>` : (an?`<p class="hint-text small">Nước của máy${p&&p.bestMove?'':''}.</p>`:'')}
      ${ei>=0?`<div class="btn-row mt10">${ei+1<errs.length?`<button type="button" class="btn btn-primary btn-sm" data-rv="next">Lỗi tiếp theo (${ei+2}/${errs.length})<svg class="ic" aria-hidden="true" focusable="false"><use href="#i-nextErr"></use></svg></button>`:`<button type="button" class="btn btn-primary btn-sm" data-rv="next">Xem tổng kết</button>`}</div>`:''}`;
    $('#reviewTools').innerHTML = p && m.color===rec.human && !['book','best','great','brilliant'].includes(p.cls)
      ? `${p.replyPv&&p.replyPv.length?'<button class="btn btn-outline" id="rvShowReply"><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-play"></use></svg>Xem đòn của máy</button>':''}${p.bestPv&&p.bestPv.length?'<button class="btn btn-outline" id="rvShowBest"><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-play"></use></svg>Xem nước tốt hơn</button>':''}` : '';
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
  const rs=$('#rvRestart',det); if(rs) rs.addEventListener('click',()=>{ review.overview=true; review.idx=-1; reviewRender(); });
  const nx=det.querySelector('[data-rv="next"]'); if(nx) nx.addEventListener('click',reviewNextErr);
  const ob=$('#rvOnlyBig',det); if(ob) ob.addEventListener('change',()=>{ review.onlyBig=ob.checked; safeLS_set('xq_review_big',ob.checked?'1':'0'); reviewRender(); });
  if(an) renderEvalChart();
  const nE=$('#reviewNextMistake'), pE=$('#reviewPrevMistake');
  if(an){
    nE.disabled = !ov && idx===-1;
    nE.innerHTML = ov ? (errs.length?'<svg class="ic" aria-hidden="true" focusable="false"><use href="#i-play"></use></svg>Bắt đầu: lỗi 1':'<svg class="ic" aria-hidden="true" focusable="false"><use href="#i-play"></use></svg>Tổng kết') : 'Lỗi tiếp<svg class="ic" aria-hidden="true" focusable="false"><use href="#i-nextErr"></use></svg>';
    pE.disabled = ov;
  } else { nE.disabled=true; pE.disabled=true; }
  $('#reviewPrev').disabled = g.moves.length===0 || (!ov && idx===0) || ov;
  $('#reviewNext').disabled = !ov && idx===-1;
}
function initReview(){
  $('#reviewBack').addEventListener('click',()=>{ review.token++; if(review.rec && review.rec.online){ showStab('phong'); return; } showAICard(aiGame.game && review.rec && review.rec.id===aiGame.recId && !aiGame.game.result ? 'game':'setup'); });
  // ◀ ▶: từng nửa nước. Tổng quan ↔ nước đầu ↔ … ↔ nước cuối (tổng kết)
  $('#reviewPrev').addEventListener('click',()=>{ const n=review.game.moves.length;
    if(review.overview) return;
    if(review.idx===0){ review.overview=!!review.an; review.idx=-1; reviewRender(); return; }
    reviewGo(review.idx===-1 ? n-1 : review.idx-1); });
  $('#reviewNext').addEventListener('click',()=>{ const n=review.game.moves.length;
    if(review.overview){ reviewGo(n?0:-1); return; }
    reviewGo(review.idx>=n-1 ? -1 : review.idx+1); });
  $('#reviewNextMistake').addEventListener('click',()=>{ sideTabFor('#reviewDetail'); reviewNextErr(); });
  $('#reviewPrevMistake').addEventListener('click',()=>{ sideTabFor('#reviewDetail'); reviewPrevErr(); });
}

/* Tự sinh bởi tools/gen-puzzles.js + tools/make-puzzles.js: thế cờ lấy từ ván máy tự đánh, đã kiểm lại bằng Solver. Không sửa tay. */
/*@@DATA:puzzles-gen@@*/

