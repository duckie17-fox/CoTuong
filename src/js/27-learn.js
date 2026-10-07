/* =========================================================================
   HỌC TẬP — FEN, ôn bài sai (lặp lại ngắt quãng), bài hôm nay, bảng tiến độ,
   gợi ý cấp máy, "đấu với máy từ thế này"
   ========================================================================= */

/* ---------------- FEN (chuẩn UCCI / WXF) ----------------
   Hàng 0 (phía Đen) ghi trước. Đỏ chữ hoa, Đen chữ thường:
   K Tướng · A Sĩ · B Tượng · N Mã · R Xe · C Pháo · P Tốt  (đọc được cả E=Tượng, H=Mã).
   Lượt: w/r = Đỏ đi, b = Đen đi. Ví dụ thế xuất phát:
   rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1 */
const Fen = (function(){
  const TO={G:'k',A:'a',E:'b',H:'n',R:'r',C:'c',S:'p'};
  const FROM={k:'G',a:'A',b:'E',e:'E',n:'H',h:'H',r:'R',c:'C',p:'S'};
  const START='rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';
  function toFen(board,turn){
    const rows=[];
    for(let r=0;r<10;r++){
      let s='', e=0;
      for(let c=0;c<9;c++){
        const p=board[r][c];
        if(!p){ e++; continue; }
        if(e){ s+=e; e=0; }
        s += p.color==='red' ? TO[p.type].toUpperCase() : TO[p.type];
      }
      if(e) s+=e;
      rows.push(s);
    }
    return rows.join('/')+' '+(turn==='black'?'b':'w')+' - - 0 1';
  }
  // Trả về {board, turn}; ném lỗi tiếng Việt nếu sai cú pháp hoặc thế cờ không hợp lệ
  function parse(text){
    const parts=String(text||'').trim().split(/\s+/);
    const rows=(parts[0]||'').split('/');
    if(rows.length!==10) throw new Error('FEN phải có đủ 10 hàng, ngăn cách bằng dấu “/”.');
    const board=Array.from({length:10},()=>Array(9).fill(null));
    rows.forEach((row,r)=>{
      let c=0;
      for(const ch of row){
        if(/[1-9]/.test(ch)){ c+=+ch; continue; }
        const t=FROM[ch.toLowerCase()];
        if(!t) throw new Error(`Ký tự lạ “${ch}” ở hàng ${r+1}.`);
        if(c>8) throw new Error(`Hàng ${r+1} có quá 9 cột.`);
        board[r][c++]={type:t, color: ch===ch.toUpperCase() ? 'red' : 'black'};
      }
      if(c!==9) throw new Error(`Hàng ${r+1} có ${c} cột (cần đúng 9).`);
    });
    const tc=(parts[1]||'w').toLowerCase();
    const turn = tc==='b' ? 'black' : 'red';
    const err=positionError(board,turn);
    if(err) throw new Error(err);
    return {board, turn};
  }
  // Kiểm tra thế cờ có thể xảy ra (đủ Tướng, quân đúng chỗ, bên không đi không bị chiếu…)
  function positionError(b,turn){
    const count={red:{},black:{}};
    const MAX={G:1,A:2,E:2,H:2,R:2,C:2,S:5};
    for(let r=0;r<10;r++) for(let c=0;c<9;c++){
      const p=b[r][c]; if(!p) continue;
      count[p.color][p.type]=(count[p.color][p.type]||0)+1;
      const who = p.color==='red'?'Đỏ':'Đen';
      if((p.type==='G'||p.type==='A') && !Engine.inPalace(r,c,p.color)) return `${VN_NAME[p.type]} ${who} nằm ngoài cung.`;
      if(p.type==='E' && !Engine.ownSide(r,p.color)) return `Tượng ${who} không thể qua sông.`;
      if(p.type==='S' && (p.color==='red' ? r>6 : r<3)) return `Tốt ${who} không thể ở sau hàng xuất phát.`;
    }
    for(const col of ['red','black']) for(const [t,n] of Object.entries(count[col]))
      if(n>MAX[t]) return `${col==='red'?'Đỏ':'Đen'} có ${n} quân ${VN_NAME[t]} (tối đa ${MAX[t]}).`;
    if(!count.red.G || !count.black.G) return 'Mỗi bên phải có đúng một Tướng.';
    if(Engine.generalsFacing(b)) return 'Hai Tướng đang đối mặt trực tiếp — thế cờ không hợp lệ.';
    if(Engine.isInCheck(b,Engine.otherColor(turn))) return 'Bên không tới lượt đang bị chiếu — thế cờ không hợp lệ.';
    return null;
  }
  return {toFen, parse, positionError, START};
})();

async function copyText(text, el){
  try{ await navigator.clipboard.writeText(text); if(el) statusBanner(el,'over','📋 Đã sao chép FEN: <code>'+esc(text)+'</code>'); }
  catch(e){ if(el) statusBanner(el,'think','FEN của thế này (hãy tự sao chép): <code>'+esc(text)+'</code>'); }
}

/* ---------------- Ôn bài sai: hộp Leitner ----------------
   Mỗi bài từng làm sai có một "hộp" 0..5; đúng ngay lần đầu thì lên hộp, sai thì về hộp 0.
   Hộp càng cao càng lâu mới phải ôn lại. */
const Learn = (function(){
  const KEY='xq_srs', DAILY='xq_daily';
  const GAP_DAYS=[0,1,3,7,16,35];
  const DAY=86400000;
  const load=()=>safeJSON(KEY,{});
  const save=s=>safeLS_set(KEY,JSON.stringify(s));
  const today=(t)=>{ const d=new Date(t||Date.now()); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
  // outcome: 'ok' (đúng ngay), 'help' (đúng nhưng đã dùng gợi ý), 'fail' (sai / xem đáp án)
  function record(id, outcome, now){
    now=now||Date.now();
    const s=load(), e=s[id]||{box:0,due:0,ok:0,fail:0};
    if(outcome==='fail'){ e.fail++; e.box=0; e.due=now; }
    else {
      e.ok++;
      if(!s[id] && outcome==='ok'){ e.last=now; e.mastered=true; s[id]=e; save(s); return e; } // chưa từng sai: không cần ôn
      if(outcome==='ok') e.box=Math.min(GAP_DAYS.length-1, e.box+1);
      e.due = now + Math.max(1,GAP_DAYS[e.box])*DAY;
    }
    e.last=now; s[id]=e; save(s);
    return e;
  }
  // Các bài cần ôn (đã từng sai, tới hạn), bài sai gần nhất lên trước
  function due(now){
    now=now||Date.now(); const s=load();
    return Object.entries(s).filter(([,e])=>!e.mastered && e.fail>0 && e.due<=now && e.box<GAP_DAYS.length-1)
      .sort((a,b)=>a[1].box-b[1].box || b[1].last-a[1].last).map(([id])=>id);
  }
  function stats(){ const s=load(); return {tracked:Object.keys(s).length, wrong:Object.values(s).filter(e=>e.fail>0).length}; }

  // Bài hôm nay: chọn cố định theo ngày, ưu tiên bài chưa giải (không lấy bài sát cục — đã có mục riêng)
  function hash(str){ let h=2166136261; for(const ch of str){ h^=ch.charCodeAt(0); h=Math.imul(h,16777619); } return h>>>0; }
  function dailyPuzzle(now){
    const d=today(now), solved=getSolvedPuzzles();
    const pool=PUZZLES.filter(p=>p.topic!=='satcuc');
    const fresh=pool.filter(p=>!solved.includes(p.id));
    const st=safeJSON(DAILY,{});
    if(st.date===d && st.id && PUZZLES.some(p=>p.id===st.id)) return PUZZLES.find(p=>p.id===st.id);
    const from=fresh.length?fresh:pool, p=from[hash(d)%from.length];
    safeLS_set(DAILY,JSON.stringify(Object.assign({},st,{date:d,id:p.id,done:false})));
    return p;
  }
  function dailyState(){ return safeJSON(DAILY,{}); }
  function markDailyDone(id, now){
    const st=dailyState(), d=today(now);
    if(st.date!==d || st.id!==id || st.done) return st;
    const yesterday=today((now||Date.now())-DAY);
    st.streak = st.lastDone===yesterday ? (st.streak||0)+1 : 1;
    st.lastDone=d; st.done=true; st.best=Math.max(st.best||0, st.streak);
    safeLS_set(DAILY,JSON.stringify(st));
    return st;
  }
  // Chuỗi ngày còn hiệu lực (bị đứt nếu hôm qua không làm)
  function streak(now){ const st=dailyState(); const d=today(now), y=today((now||Date.now())-DAY); return (st.lastDone===d||st.lastDone===y) ? (st.streak||0) : 0; }
  return {record, due, stats, dailyPuzzle, dailyState, markDailyDone, streak, today};
})();

/* ---------------- Gợi ý cấp máy dựa trên các ván gần đây ---------------- */
function suggestAiLevel(history){
  const games=(history||[]).filter(r=>!r.start && r.result && r.level>0);
  if(games.length<2) return null;
  const L=recLevel(games[0]), same=games.filter(r=>recLevel(r)===L);
  const res=r=>!r.result.winner?'draw':r.result.winner===r.human?'win':'loss';
  if(L<AI_LEVELS.length && same.length>=2 && res(same[0])==='win' && res(same[1])==='win')
    return {level:L+1, why:`Bạn đã thắng 2 ván gần nhất ở cấp ${L}. Thử sức với cấp cao hơn?`};
  if(L>1 && same.length>=3 && [0,1,2].every(i=>res(same[i])==='loss'))
    return {level:L-1, why:`3 ván gần nhất ở cấp ${L} đều thua. Hạ một cấp để luyện chắc tay hơn rồi quay lại.`};
  return null;
}

/* ---------------- Đấu với máy từ một thế cờ bất kỳ ---------------- */
function playFromPosition(board, turn, source){
  const err=Fen.positionError(board,turn);
  if(err) return alertSoft(err);
  if(Engine.generateLegalMoves(board,turn).length===0) return alertSoft('Thế này đã hết nước đi — không thể chơi tiếp.');
  showTab('may');
  aiBeginGame({board:Engine.cloneBoard(board), turn, humanColor:turn, level:savedAiLevel(), source});
}
function alertSoft(msg){ const el=document.querySelector('section:not([hidden]) [aria-live]'); if(el) statusBanner(el,'fail',esc(msg)); }

/* ---------------- Bảng tiến độ ---------------- */
function renderProgressDashboard(){
  const el=$('#progressDash'); if(!el) return;
  const done=lessonsDone().filter(k=>LESSONS.some(l=>l.key===k)).length;
  const solved=getSolvedPuzzles();
  const topics=Object.entries(PUZZLE_TOPICS).map(([k,v])=>{ const all=PUZZLES.filter(p=>p.topic===k); return {k,v,n:all.length,s:all.filter(p=>solved.includes(p.id)).length}; }).filter(t=>t.n);
  const hist=loadHistory().filter(r=>r.result);
  const w=hist.filter(r=>r.result.winner===r.human).length, d=hist.filter(r=>!r.result.winner).length, l=hist.length-w-d;
  const accs=hist.filter(r=>r.analysis).map(r=>r.analysis.accuracy);
  const acc=accs.length?Math.round(accs.reduce((a,b)=>a+b,0)/accs.length):null;
  const due=Learn.due().length, st=Learn.streak();
  const bar=(s,n)=>`<span class="pbar"><span style="width:${n?Math.round(100*s/n):0}%"></span></span>`;
  el.innerHTML=`
    <div class="dash-grid">
      <div class="dash-tile"><b>${done}/${LESSONS.length}</b><span>bài học đã xem</span>${bar(done,LESSONS.length)}</div>
      <div class="dash-tile"><b>${solved.filter(id=>PUZZLES.some(p=>p.id===id)).length}/${PUZZLES.length}</b><span>bài tập đã giải</span>${bar(solved.length,PUZZLES.length)}</div>
      <div class="dash-tile"><b>${st?'🔥 '+st:'—'}</b><span>ngày liên tiếp làm bài hôm nay</span></div>
      <div class="dash-tile"><b>${w}–${d}–${l}</b><span>thắng–hoà–thua với máy${acc!=null?` · chính xác TB ${acc}%`:''}</span></div>
    </div>
    <details class="dash-more"><summary>Chi tiết theo chủ đề bài tập</summary>
      <ul class="dash-topics">${topics.map(t=>`<li><span>${esc(t.v)}</span>${bar(t.s,t.n)}<small>${t.s}/${t.n}</small></li>`).join('')}</ul>
    </details>
    ${due?`<p class="mt10"><button type="button" class="btn btn-primary btn-sm" id="dashReview">🔁 Ôn ${due} bài từng làm sai</button></p>`:''}`;
  const rb=$('#dashReview',el); if(rb) rb.addEventListener('click',()=>{ showTab('baitap'); pz.filter.topic='review'; renderPuzzleGrid(); });
}

/* ---------------- Gắn vào giao diện ---------------- */
function renderDailyCard(){
  const el=$('#dailyCard'); if(!el) return;
  const p=Learn.dailyPuzzle(), st=Learn.dailyState(), done=st.done && st.id===p.id && st.date===Learn.today();
  const streak=Learn.streak();
  el.innerHTML=`<div class="daily-inner"><div><b>🌅 Bài hôm nay:</b> ${esc(p.title)} <span class="topic-tag">${esc(PUZZLE_TOPICS[p.topic]||'')}</span>
      <div class="hint-text small">${done?'✓ Đã xong hôm nay. Mai có bài mới!':'Mỗi ngày một bài — giữ chuỗi ngày liên tiếp.'}${streak?` · 🔥 Chuỗi ${streak} ngày`:''}</div></div>
    <button type="button" class="btn ${done?'btn-outline':'btn-primary'} btn-sm" id="dailyOpen">${done?'Xem lại':'Làm ngay'}</button></div>`;
  $('#dailyOpen',el).addEventListener('click',()=>{ pz.random=false; openPuzzle(p.id); });
}
function renderAiSuggestion(){
  const el=$('#aiSuggest'); if(!el) return;
  const s=suggestAiLevel(loadHistory());
  if(!s){ el.innerHTML=''; return; }
  const name=levelInfo(s.level).name;
  el.innerHTML=`<div class="suggest-box">💡 ${esc(s.why)} <button type="button" class="btn btn-outline btn-sm" id="aiSuggestBtn">Chọn cấp ${s.level}: ${esc(name)}</button></div>`;
  $('#aiSuggestBtn',el).addEventListener('click',()=>{ const r=$(`input[name="aiLevel"][value="${s.level}"]`); if(r){ r.checked=true; } el.innerHTML=''; });
}
function initLearn(){
  // Bài tập: chơi tiếp & FEN
  $('#puzzlePlayBtn').addEventListener('click',()=>{ const p=pz.active; playFromPosition(p.board,p.turn,'Bài tập: '+p.title); });
  $('#puzzleFenBtn').addEventListener('click',()=>copyText(Fen.toFen(pz.active.board,pz.active.turn), $('#puzzleStatus')));
  // Ván danh thủ
  const msTurn=()=>ms.pos%2===0?RED:BLACK;
  $('#masterPlayBtn').addEventListener('click',()=>playFromPosition(masterBoard(),msTurn(),`Ván ${ms.g.red} – ${ms.g.black}, sau ${ms.pos} nửa nước`));
  $('#masterFenBtn').addEventListener('click',()=>copyText(Fen.toFen(masterBoard(),msTurn()), $('#masterDetail')));
  // Phân tích ván: thử lại từ thế TRƯỚC nước đang xem
  const rvPos=()=>{ const g=review.game, i=review.idx; return i<0 ? {b:g.board(), t:g.turn()} : {b: i===0?g.start:g.boards[i-1], t:g.moves[i].color}; };
  $('#reviewPlayBtn').addEventListener('click',()=>{ const {b,t}=rvPos(); playFromPosition(b,t,'Thử lại từ ván đã đấu'); });
  $('#reviewFenBtn').addEventListener('click',()=>{ const {b,t}=rvPos(); copyText(Fen.toFen(b,t), $('#reviewDetail')); });
  // Ván đang đấu
  $('#aiFenBtn').addEventListener('click',()=>{ const g=aiGame.game; copyText(Fen.toFen(g.board(),g.turn()), $('#aiStatus')); });
  // Bắt đầu từ FEN
  $('#fenStartBtn').addEventListener('click',()=>{
    const out=$('#fenMsg');
    try{
      const {board,turn}=Fen.parse($('#fenInput').value);
      if(Engine.generateLegalMoves(board,turn).length===0) throw new Error('Thế này đã hết nước đi.');
      out.textContent='';
      const human=$('input[name="aiColor"]:checked').value;
      aiBeginGame({board, turn, humanColor:human, level:parseInt($('input[name="aiLevel"]:checked').value,10), source:'FEN'});
    }catch(e){ out.textContent='✘ '+e.message; }
  });
  renderDailyCard(); renderAiSuggestion(); renderProgressDashboard();
  document.addEventListener('tabshown',e=>{
    if(e.detail==='hoc') renderProgressDashboard();
    if(e.detail==='baitap') renderDailyCard();
    if(e.detail==='may') renderAiSuggestion();
  });
}
