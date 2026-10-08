/* =========================================================================
   ĐẤU VỚI MÁY + REVIEW VÁN + LỊCH SỬ
   ========================================================================= */
const aiGame = { game:null, humanColor:RED, level:3, start:null, widget:null, ctl:null, thinking:false, hint:null, bookNote:'', saved:false, book:null, token:0 };
const boardToPieces = b => { const out=[]; for(let r=0;r<10;r++) for(let c=0;c<9;c++){ const p=b[r][c]; if(p) out.push([r,c,p.type,p.color]); } return out; };

/* ---------------- Lịch sử ván (localStorage) ---------------- */
const HISTORY_KEY='xq_ai_history';
function loadHistory(){ const h=safeJSON(HISTORY_KEY,[]); return Array.isArray(h)?h:[]; }
function saveHistory(list){ safeLS_set(HISTORY_KEY, JSON.stringify(list.slice(0,30))); }
function upsertHistory(rec){ const list=loadHistory().filter(x=>x.id!==rec.id); list.unshift(rec); saveHistory(list); }
function gameToRecord(){
  const g=aiGame.game;
  const rec = { id: aiGame.recId, date: aiGame.recDate, level: aiGame.level, ladder: LADDER_VERSION, human: aiGame.humanColor,
    moves: g.moves.map(m=>[m.from[0],m.from[1],m.to[0],m.to[1]]),
    result: g.result ? {winner:g.result.winner, reason:g.result.reason} : null };
  if(aiGame.start) rec.start=aiGame.start;   // ván bắt đầu từ một thế cờ cho trước
  return rec;
}
function replayRecord(rec){
  const g = rec.start ? Game.create(mkBoard(rec.start.pieces), rec.start.turn) : Game.create();
  for(const [a,b,c,d] of rec.moves) g.play({from:[a,b],to:[c,d]});
  if(rec.result && !g.result) g.result=Object.assign({state:'over'},rec.result);
  return g;
}
function levelInfo(id){ return AI_LEVELS.find(l=>l.id===id)||AI_LEVELS[4]; }
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
    return `<div class="hist-row"><div><span class="badge ${rs.cls}">${rs.txt}</span> <b>${esc(levelInfo(recLevel(r)).name)}</b>
      <div class="hint-text small">${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})} · Bạn cầm ${COLOR_VN[r.human]}${r.start?' · từ thế cho trước':''} · ${Math.ceil(r.moves.length/2)} nước${acc}</div></div>
      <div class="btn-row"><button class="btn btn-outline btn-sm" data-review="${esc(r.id)}"><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-chart"></use></svg>Phân tích</button><button class="btn btn-outline btn-sm" data-del="${esc(r.id)}" aria-label="Xoá ván" title="Xoá ván"><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-trash"></use></svg></button></div></div>`;
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
  const H=aiGame.humanColor, M=Engine.otherColor(H), over=!!g.result;
  // thanh người chơi: máy ở trên, bạn ở dưới; sáng lên khi tới lượt
  setPlayerBar($('#aiTop'), {color:M, name:'Máy', sub:esc(`Cấp ${aiGame.level} · ${levelInfo(aiGame.level).name}`), captured:capturedBy(g.moves,M),
    active:!over && turn===M, note: !over && aiGame.thinking ? 'đang nghĩ…' : ''});
  setPlayerBar($('#aiBottom'), {color:H, name:'Bạn', sub:COLOR_VN[H], me:false, captured:capturedBy(g.moves,H),
    active:!over && turn===H, note: !over && turn===H ? 'tới lượt' : ''});
  if(g.result){
    const human = g.result.winner===H, draw=!g.result.winner;
    statusBanner(el, draw?'draw':(human?'over':'fail'), `<b>${draw?'Hoà.':human?'Bạn thắng!':'Bạn thua.'}</b> ${esc(Game.resultText(g.result))}`);
  } else if(Engine.isInCheck(b,turn)) statusBanner(el,'check', turn===H ? 'Bạn đang bị chiếu tướng — phải giải chiếu!' : 'Máy đang bị chiếu tướng!');
  else if(aiGame.hint && aiGame.hintText) statusBanner(el,'think', aiGame.hintText);
  else el.innerHTML = turn===H && !aiGame.thinking ? `<span class="hint-text small">Đến lượt bạn — chạm quân rồi chạm ô sáng để đi.</span>` : (aiGame.bookNote?`<span class="hint-text small">${esc(aiGame.bookNote)}</span>`:'');
  renderMoveLog($('#aiLog'), g.moves);
  const humanTurn = !g.result && !aiGame.thinking && turn===aiGame.humanColor;
  $('#aiUndo').disabled = aiGame.thinking || g.moves.filter(m=>m.color===aiGame.humanColor).length===0;
  $('#aiHint').disabled = !humanTurn;
  $('#aiResign').disabled = !!g.result;
  $('#aiReviewBtn').disabled = g.moves.length<2;
  $('#aiActions').hidden = over;
  $('#aiAfter').hidden = !over;
  $('#aiLevelTag').textContent = '';
}
function aiPersist(){
  if(!aiGame.game.moves.length) return;
  upsertHistory(gameToRecord());
}
function aiAfterMove(){
  aiGame.hint=null; aiGame.hintText='';
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
  aiBeginGame({
    humanColor: $('input[name="aiColor"]:checked').value,
    level: parseInt($('input[name="aiLevel"]:checked').value,10),
  });
}
// Bắt đầu ván. cfg: {humanColor, level, board?, turn?, source?}
//  - board/turn: bắt đầu từ một thế cờ cho trước (vd. "chơi tiếp với máy" từ bài tập, ván danh thủ)
function aiBeginGame(cfg){
  aiGame.humanColor = cfg.humanColor || RED;
  aiGame.level = cfg.level || aiGame.level || savedAiLevel();
  safeLS_set('xq_ai_level', String(aiGame.level));
  aiGame.start = cfg.board ? {pieces:boardToPieces(cfg.board), turn:cfg.turn||RED, source:cfg.source||''} : null;
  aiGame.game = cfg.board ? Game.create(cfg.board, cfg.turn||RED) : Game.create();
  aiGame.thinking=false; aiGame.hint=null; aiGame.bookNote=''; aiGame.token++;
  aiGame.recId = 'g'+Date.now().toString(36); aiGame.recDate = Date.now();
  if(!aiGame.book) aiGame.book=buildOpeningBook(OPENINGS);
  showAICard('game');
  aiGame.ctl.clear();
  aiGame.widget.setFlipped(aiGame.humanColor===BLACK);
  aiAfterMove();
  $('#aiGameCard').scrollIntoView({block:'start'});
  revealBoard($('#aiBoardCard'));
}
function showAICard(which){
  $('#aiSetupCard').hidden = which!=='setup';
  $('#aiGameCard').hidden = which!=='game';
  $('#aiReviewCard').hidden = which!=='review';
  if(which==='setup') renderHistoryList();
}
function renderLevelPicker(){
  const saved=savedAiLevel();
  $('#aiLevelPicker').innerHTML = AI_LEVELS.map(l=>`<label class="level-opt"><input type="radio" name="aiLevel" value="${l.id}" ${l.id===saved?'checked':''}>
    <span><b>${l.id}. ${esc(l.name)}</b><small>${esc(l.desc)}</small><small class="lv-tier">Ngang bậc <b>${esc(Ranked.tierOf(l.elo).label)}</b></small></span></label>`).join('');
}
function initAIGame(){
  renderLevelPicker();

  $('#thinkSteps').innerHTML=Coach.THINKING_STEPS.map(([h,t])=>`<li><b>${esc(h)}</b><span>${esc(t)}</span></li>`).join('');
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
    aiGame.hint=null; aiGame.hintText=''; aiGame.ctl.clear(); aiPersist(); aiRender();
  });
  $('#aiHint').addEventListener('click', async ()=>{
    const g=aiGame.game; $('#aiHint').disabled=true;
    statusBanner($('#aiStatus'),'think','Đang tìm gợi ý…'); aiGame.hintText='';
    const r=await AIEngine.think(aiThinkArgs(g,{timeMs:1200, maxDepth:40}));
    if(r&&r.move){
      const why=Coach.whyGood(g.board(),r.move), danger=Coach.endangered(g.board(),g.turn());
      const warn = danger.length ? ` Lưu ý: ${Coach.NAME[danger[0].type]} của bạn đang bị doạ.` : '';
      aiGame.hint=r.move;
      aiGame.hintText=`Gợi ý: <b>${esc(Notation.describe(g.board(),r.move).short)}</b> (mũi tên xanh)${why.length?' vì nó '+esc(why.join('; ')):''}.${esc(warn)}`;
      aiRender();
    }
  });
  const RESIGN_HTML=$('#aiResign').innerHTML;
  $('#aiResign').addEventListener('click', ()=>{
    const g=aiGame.game; if(g.result) return;
    const btn=$('#aiResign');
    // xác nhận 2 bước ngay trên nút (không dùng confirm() vì có thể bị chặn trong khung nhúng)
    if(!btn.dataset.confirm){ btn.dataset.confirm='1'; btn.textContent='Bấm lần nữa để đầu hàng'; setTimeout(()=>{ delete btn.dataset.confirm; btn.innerHTML=RESIGN_HTML; },3000); return; }
    delete btn.dataset.confirm; btn.innerHTML=RESIGN_HTML;
    aiGame.token++; aiGame.thinking=false;
    g.result={state:'over', winner:Engine.otherColor(aiGame.humanColor), reason:'resign'};
    aiPersist(); aiRender();
  });
  $('#aiAgainBtn').addEventListener('click', ()=>aiBeginGame({humanColor:aiGame.humanColor, level:aiGame.level}));
  $('#aiReviewBtn').addEventListener('click', ()=>{ aiPersist(); openReview(gameToRecord()); });
  initReview();
  renderHistoryList();
}

