/* =========================================================================
   ĐẤU VỚI MÁY + REVIEW VÁN + LỊCH SỬ
   ========================================================================= */
const aiGame = { game:null, humanColor:RED, level:3, widget:null, ctl:null, thinking:false, hint:null, bookNote:'', saved:false, book:null, token:0 };

/* ---------------- Lịch sử ván (localStorage) ---------------- */
const HISTORY_KEY='xq_ai_history';
function loadHistory(){ const h=safeJSON(HISTORY_KEY,[]); return Array.isArray(h)?h:[]; }
function saveHistory(list){ safeLS_set(HISTORY_KEY, JSON.stringify(list.slice(0,30))); }
function upsertHistory(rec){ const list=loadHistory().filter(x=>x.id!==rec.id); list.unshift(rec); saveHistory(list); }
function gameToRecord(){
  const g=aiGame.game;
  return { id: aiGame.recId, date: aiGame.recDate, level: aiGame.level, human: aiGame.humanColor,
    moves: g.moves.map(m=>[m.from[0],m.from[1],m.to[0],m.to[1]]),
    result: g.result ? {winner:g.result.winner, reason:g.result.reason} : null };
}
function replayRecord(rec){
  const g=Game.create();
  for(const [a,b,c,d] of rec.moves) g.play({from:[a,b],to:[c,d]});
  if(rec.result && !g.result) g.result=Object.assign({state:'over'},rec.result);
  return g;
}
function levelInfo(id){ return AI_LEVELS.find(l=>l.id===id)||AI_LEVELS[2]; }
function resultForHuman(rec){
  if(!rec.result) return {txt:'Chưa kết thúc', cls:'badge-mid'};
  if(!rec.result.winner) return {txt:'Hoà', cls:'badge-mid'};
  return rec.result.winner===rec.human ? {txt:'Thắng', cls:'badge-easy'} : {txt:'Thua', cls:'badge-hard'};
}
function renderHistoryList(){
  const list=loadHistory(), el=$('#aiHistory');
  if(!list.length){ el.innerHTML='<p class="hint-text">Chưa có ván nào. Các ván đấu với máy sẽ được lưu ở đây (trong trình duyệt này) để bạn xem lại và phân tích.</p>'; return; }
  el.innerHTML = list.map(r=>{
    const rs=resultForHuman(r), d=new Date(r.date);
    const acc = r.analysis ? ` · Chính xác ${r.analysis.accuracy}%` : '';
    return `<div class="hist-row"><div><span class="badge ${rs.cls}">${rs.txt}</span> <b>${esc(levelInfo(r.level).name)}</b>
      <div class="hint-text small">${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})} · Bạn cầm ${COLOR_VN[r.human]} · ${Math.ceil(r.moves.length/2)} nước${acc}</div></div>
      <div class="btn-row"><button class="btn btn-outline btn-sm" data-review="${esc(r.id)}">📊 Phân tích</button><button class="btn btn-outline btn-sm" data-del="${esc(r.id)}" aria-label="Xoá ván">🗑</button></div></div>`;
  }).join('');
  $$('[data-review]',el).forEach(b=>b.addEventListener('click',()=>openReview(loadHistory().find(x=>x.id===b.dataset.review))));
  $$('[data-del]',el).forEach(b=>b.addEventListener('click',()=>{ saveHistory(loadHistory().filter(x=>x.id!==b.dataset.del)); renderHistoryList(); }));
}

/* ---------------- Ván đấu ---------------- */
function historyKeysOf(g){
  // khoá các thế đã qua (không gồm thế hiện tại) để máy tránh lặp nước
  const keys=[XQSearch.keyOf(g.start,g.startTurn)];
  for(let i=0;i<g.boards.length-1;i++) keys.push(XQSearch.keyOf(g.boards[i], i%2===0?Engine.otherColor(g.startTurn):g.startTurn));
  return keys;
}
// Cờ "đang bị chiếu" của từng thế trong historyKeysOf (cùng thứ tự) — để máy biết luật chiếu mãi
function historyChecksOf(g){
  const chk=[Engine.isInCheck(g.start,g.startTurn)];
  for(let i=0;i<g.moves.length-1;i++) chk.push(!!g.moves[i].check);
  return chk;
}
// Các nước mà luật ván (Game) xử bên đi THUA ngay (chiếu mãi / đuổi mãi ở lần lặp thứ 3).
// Chỉ cần thử những nước dẫn tới thế đã xuất hiện ≥ 2 lần nên rất rẻ.
function ruleLosingMoves(g){
  const seen=new Map(); for(const k of [g.startKey].concat(g.keys)) seen.set(k,(seen.get(k)||0)+1);
  const me=g.turn(), b=g.board(), out=[];
  for(const mv of g.legalMoves()){
    if((seen.get(Game.key(Engine.applyMove(b,mv),Engine.otherColor(me)))||0)<2) continue;
    g.play(mv); const res=g.result; g.undo(1);
    if(res && res.winner && res.winner!==me) out.push(mv);
  }
  return out;
}
// Tham số gọi máy cho thế hiện tại của ván g
function aiThinkArgs(g, extra){
  return Object.assign({board:g.board(), turn:g.turn(), historyKeys:historyKeysOf(g), historyChecks:historyChecksOf(g), excludeMoves:ruleLosingMoves(g)}, extra||{});
}
function aiMeta(){
  const g=aiGame.game, b=g.board(), turn=g.turn();
  const m={lastMove:g.lastMove(), checkSq: !g.result && Engine.isInCheck(b,turn) ? Engine.findGeneral(b,turn) : null};
  if(aiGame.hint) m.arrows=[{from:aiGame.hint.from,to:aiGame.hint.to}];
  return m;
}
function aiRender(){
  const g=aiGame.game, b=g.board(), turn=g.turn();
  aiGame.ctl.render();
  const el=$('#aiStatus');
  if(g.result){
    const human = g.result.winner===aiGame.humanColor, draw=!g.result.winner;
    statusBanner(el, draw?'draw':(human?'over':'fail'), (draw?'🤝 ':human?'🎉 ':'♟ ')+Game.resultText(g.result)+' Bấm <b>📊 Phân tích ván</b> để xem mình đi hay/dở ở đâu.');
  } else if(aiGame.thinking) statusBanner(el,'think','🤔 Máy đang suy nghĩ…');
  else if(Engine.isInCheck(b,turn)) statusBanner(el,'check', turn===aiGame.humanColor ? 'Bạn đang bị chiếu tướng — phải giải chiếu!' : 'Máy đang bị chiếu tướng!');
  else el.innerHTML = (turn===aiGame.humanColor ? `<span class="turn-dot turn-${turn}"></span> Đến lượt bạn (${COLOR_VN[turn]})` : `<span class="turn-dot turn-${turn}"></span> Lượt của máy`) + (aiGame.bookNote?`<div class="hint-text small">${esc(aiGame.bookNote)}</div>`:'');
  renderMoveLog($('#aiLog'), g.moves);
  const humanTurn = !g.result && !aiGame.thinking && turn===aiGame.humanColor;
  $('#aiUndo').disabled = aiGame.thinking || g.moves.filter(m=>m.color===aiGame.humanColor).length===0;
  $('#aiHint').disabled = !humanTurn;
  $('#aiResign').disabled = !!g.result;
  $('#aiReviewBtn').disabled = g.moves.length<2;
  $('#aiLevelTag').textContent = `${levelInfo(aiGame.level).name} · Bạn cầm ${COLOR_VN[aiGame.humanColor]}`;
}
function aiPersist(){
  if(!aiGame.game.moves.length) return;
  upsertHistory(gameToRecord());
}
function aiAfterMove(){
  aiGame.hint=null;
  aiPersist();
  aiRender();
  if(!aiGame.game.result && aiGame.game.turn()!==aiGame.humanColor) triggerAIMove();
}
async function triggerAIMove(){
  const g=aiGame.game, L=levelInfo(aiGame.level), token=++aiGame.token;
  aiGame.thinking=true; aiRender();
  const started=Date.now();
  let mv=null;
  if(L.book && aiGame.book){
    const opts=aiGame.book.get(Game.key(g.board(),g.turn()));
    if(opts && opts.length){ const o=opts[Math.floor(Math.random()*opts.length)]; mv=o.move; aiGame.bookNote=`Máy đi theo sách khai cuộc: ${o.opening}.`; }
  }
  if(!mv){
    aiGame.bookNote='';
    try{
      const r=await AIEngine.think(aiThinkArgs(g,{timeMs:L.timeMs, maxDepth:L.maxDepth, noise:L.noise, blunder:L.blunder}));
      mv=r&&r.move;
    }catch(e){ mv=null; }
  }
  // giữ nhịp tối thiểu để người chơi kịp thấy
  const wait=Math.max(0, 350-(Date.now()-started));
  setTimeout(()=>{
    if(token!==aiGame.token) return;
    aiGame.thinking=false;
    if(mv) g.play(mv);
    aiAfterMove();
  }, wait);
}
function aiStartGame(){
  aiGame.humanColor = $('input[name="aiColor"]:checked').value;
  aiGame.level = parseInt($('input[name="aiLevel"]:checked').value,10);
  safeLS_set('xq_ai_level', String(aiGame.level));
  aiGame.game = Game.create();
  aiGame.thinking=false; aiGame.hint=null; aiGame.bookNote=''; aiGame.token++;
  aiGame.recId = 'g'+Date.now().toString(36); aiGame.recDate = Date.now();
  if(!aiGame.book) aiGame.book=buildOpeningBook(OPENINGS);
  showAICard('game');
  aiGame.ctl.clear();
  aiGame.widget.setFlipped(aiGame.humanColor===BLACK);
  aiAfterMove();
  $('#aiGameCard').scrollIntoView({block:'start'});
}
function showAICard(which){
  $('#aiSetupCard').hidden = which!=='setup';
  $('#aiGameCard').hidden = which!=='game';
  $('#aiReviewCard').hidden = which!=='review';
  if(which==='setup') renderHistoryList();
}
function renderLevelPicker(){
  const saved=parseInt(safeLS_get('xq_ai_level')||'3',10);
  $('#aiLevelPicker').innerHTML = AI_LEVELS.map(l=>`<label class="level-opt"><input type="radio" name="aiLevel" value="${l.id}" ${l.id===saved?'checked':''}>
    <span><b>${l.id}. ${esc(l.name)}</b><small>${esc(l.desc)}</small></span></label>`).join('');
}
function initAIGame(){
  renderLevelPicker();
  $('#thinkSteps').innerHTML=Coach.THINKING_STEPS.map(([h,t])=>`<li><b>${esc(h)}</b><span>${esc(t)}</span></li>`).join('');
  if(window.matchMedia && matchMedia('(max-width:860px)').matches) $('#thinkBox').open=false;
  aiGame.widget = createBoardWidget($('#aiBoard'), {onSquareClick:(r,c)=>aiGame.ctl.click(r,c), label:'Bàn cờ đấu với máy'});
  aiGame.ctl = makeClickController({
    widget:aiGame.widget,
    getBoard:()=>aiGame.game.board(),
    turn:()=>aiGame.game.turn(),
    canMove:(turn)=>!aiGame.game.result && !aiGame.thinking && turn===aiGame.humanColor,
    onMove:(mv)=>{ aiGame.game.play(mv); aiAfterMove(); },
    extraMeta:aiMeta,
  });
  $('#aiStartBtn').addEventListener('click', aiStartGame);
  $('#aiNewGameBtn').addEventListener('click', ()=>{ aiGame.token++; aiGame.thinking=false; showAICard('setup'); });
  $('#aiUndo').addEventListener('click', ()=>{
    const g=aiGame.game; aiGame.token++; aiGame.thinking=false;
    // lùi tới trước nước gần nhất của người chơi
    let n=0; while(g.moves.length && (n===0 || g.turn()!==aiGame.humanColor)){ g.undo(1); n++; if(g.turn()===aiGame.humanColor) break; }
    aiGame.hint=null; aiGame.ctl.clear(); aiPersist(); aiRender();
  });
  $('#aiHint').addEventListener('click', async ()=>{
    const g=aiGame.game; $('#aiHint').disabled=true;
    statusBanner($('#aiStatus'),'think','💡 Đang tìm gợi ý…');
    const r=await AIEngine.think(aiThinkArgs(g,{timeMs:1200, maxDepth:40}));
    if(r&&r.move){
      aiGame.hint=r.move; aiRender();
      const why=Coach.whyGood(g.board(),r.move), danger=Coach.endangered(g.board(),g.turn());
      const warn = danger.length ? ` Lưu ý: ${Coach.NAME[danger[0].type]} của bạn đang bị doạ.` : '';
      statusBanner($('#aiStatus'),'think',`💡 Gợi ý: <b>${esc(Notation.describe(g.board(),r.move).short)}</b> (mũi tên xanh)${why.length?' vì nó '+esc(why.join('; ')):''}.${esc(warn)}`);
    }
  });
  $('#aiResign').addEventListener('click', ()=>{
    const g=aiGame.game; if(g.result) return;
    const btn=$('#aiResign');
    // xác nhận 2 bước ngay trên nút (không dùng confirm() vì có thể bị chặn trong khung nhúng)
    if(!btn.dataset.confirm){ btn.dataset.confirm='1'; btn.textContent='Bấm lần nữa để đầu hàng'; setTimeout(()=>{ delete btn.dataset.confirm; btn.textContent='🏳 Đầu hàng'; },3000); return; }
    delete btn.dataset.confirm; btn.textContent='🏳 Đầu hàng';
    aiGame.token++; aiGame.thinking=false;
    g.result={state:'over', winner:Engine.otherColor(aiGame.humanColor), reason:'resign'};
    aiPersist(); aiRender();
  });
  $('#aiFlip').addEventListener('click', ()=> aiGame.widget.setFlipped(!aiGame.widget.isFlipped()));
  $('#aiReviewBtn').addEventListener('click', ()=>{ aiPersist(); openReview(gameToRecord()); });
  initReview();
  renderHistoryList();
}

