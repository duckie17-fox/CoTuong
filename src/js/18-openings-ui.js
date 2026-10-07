/* =========================================================================
   UI KHAI CUỘC — xem từng nước + Trainer (tự đi theo lý thuyết)
   ========================================================================= */
const openingView = { widget:null, active:null, idx:0 };
const trainer = { widget:null, ctl:null, op:null, color:RED, game:null, mistakes:0, wrongHere:0, hint:false, busy:false, feedback:null };

function trainerBest(){ return safeJSON('xq_trainer_best',{}); }
function renderOpeningList(){
  const best=trainerBest();
  const grid = $('#openingGrid');
  grid.innerHTML = OPENING_GROUPS.map(g=>`
    <div class="opening-group">
      <h3 class="group-h">${esc(g.name)}</h3><p class="hint-text">${esc(g.desc)}</p>
      <div class="opening-cards">${OPENINGS.filter(o=>o.group===g.id).map(o=>{
        const b=[best[o.id+':red'],best[o.id+':black']].filter(x=>x!=null);
        const star = b.length ? `<span class="solved-check" title="Điểm Trainer cao nhất">🎓 ${Math.max(...b)}%</span>` : '';
        return `<button class="opening-card" data-id="${o.id}">
          <div class="puzzle-top">${o.isTrap?'<span class="badge badge-hard">Bẫy</span>':`<span class="badge ${['','badge-easy','badge-mid','badge-hard'][o.level]}">${['','Cơ bản','Phổ biến','Nâng cao'][o.level]}</span>`}${o.lines.length>1?`<span class="hint-text small">${o.lines.length-1} nhánh</span>`:''}${star}</div>
          <h4>${esc(o.name)} <span class="han-sm">${esc(o.han)}</span></h4>
          <p>${esc(o.summary)}</p>
          <div class="op-first">${esc(o.moves.slice(0,4).map((m,i)=>(i%2===0?(i/2+1)+'. ':'')+m.text).join(' '))} …</div>
        </button>`;}).join('')}</div>
    </div>`).join('');
  $$('.opening-card',grid).forEach(btn=> btn.addEventListener('click', ()=> openOpening(btn.dataset.id)));
}
function showOpeningCard(which){
  $('#openingListCard').hidden = which!=='list';
  $('#openingDetailCard').hidden = which!=='detail';
  $('#trainerCard').hidden = which!=='trainer';
  const mc=$('#masterCard'); if(mc) mc.hidden = true;
}
function openOpening(id, lineId){
  const o = OPENINGS.find(o=>o.id===id);
  openingView.active=o; openingView.idx=0;
  openingView.line = o.lines.find(l=>l.id===lineId) || o.lines[0];
  showOpeningCard('detail');
  $('#openingTitle').innerHTML = `${esc(o.name)} <span class="han-sm">${esc(o.han)}</span>`;
  $('#openingSummary').textContent = o.summary;
  $('#openingIdeasH').textContent = o.isTrap ? '📌 Bài học' : '💡 Ý chính';
  $('#openingTrapsH').textContent = o.isTrap ? '⚠️ Chỗ mắc bẫy' : '⚠️ Bẫy thường gặp';
  $('#openingIdeas').innerHTML = o.ideas.map(t=>`<li>${esc(t)}</li>`).join('');
  $('#openingTraps').innerHTML = o.traps.map(t=>`<li>${esc(t)}</li>`).join('') + (o.isTrap?`<li>${esc(o.result)}</li>`:'');
  $('#trainBlackBtn').style.display = o.isTrap ? 'none' : '';
  $('#trainMultiWrap').style.display = o.lines.length<2 ? 'none' : '';
  renderOpeningLines();
  if(!openingView.widget) openingView.widget = createBoardWidget($('#openingBoard'), {label:'Bàn cờ khai cuộc'});
  openingView.widget.setFlipped(false);
  openingRender();
  $('#openingDetailCard').scrollIntoView({block:'start'});
}
function renderOpeningLines(){
  const o=openingView.active, cur=openingView.line, el=$('#openingLines');
  const src=(arr)=>arr&&arr.length?`<p class="sources">Nguồn: ${arr.map(([t,u])=>`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t||'nguồn')}</a>`).join(' · ')}</p>`:'';
  if(o.lines.length<2){ el.innerHTML = o.isTrap ? src(o.sources) : ''; return; }
  el.innerHTML = `<div class="chip-row" role="group" aria-label="Chọn nhánh">${o.lines.map(l=>`<button class="chip ${l===cur?'on':''}" data-line="${esc(l.id)}" aria-pressed="${l===cur}">${l.id==='main'?'Diễn biến chính':esc(l.name.replace(/^.*?—\s*/,''))}</button>`).join('')}</div>
    ${cur.id!=='main'?`<div class="explain-box"><b>${esc(cur.name)}</b> <span class="han-sm">${esc(cur.han||'')}</span><br>${esc(cur.idea||'')}${src(cur.sources)}</div>`:''}`;
  $$('[data-line]',el).forEach(b=>b.addEventListener('click',()=>{ openingView.line=o.lines.find(l=>l.id===b.dataset.line); openingView.idx=0; renderOpeningLines(); openingRender(); }));
}
function openingGame(moves, upto){
  const g=Game.create();
  for(let i=0;i<upto;i++) g.play(moves[i]);
  return g;
}
function openingRender(){
  const o=openingView.active, mv=openingView.line.moves, idx=openingView.idx, total=mv.length;
  const g=openingGame(mv, total);
  const b = idx===0 ? g.start : g.boards[idx-1];
  const last = idx>0 ? mv[idx-1] : null;
  const next = idx<total ? mv[idx] : null;
  openingView.widget.setBoard(b, {lastMove:last, arrows: next ? [{from:next.from,to:next.to,alt:true}] : []});
  $('#openingProgress').textContent = `${idx} / ${total}`;
  const isTrapPly = o.isTrap && idx-1===o.trapPly;
  $('#openingCaption').innerHTML = idx===0
    ? 'Thế xuất phát. Mũi tên đỏ chỉ nước sắp đi; bấm <b>Nước tiếp ▶</b> để xem.'
    : `<b>${Math.ceil(idx/2)}${idx%2?'.':'...'} ${esc(last.text)}</b> — ${esc(last.caption)}`+(o.isTrap&&idx===total?`<br><b>${esc(o.result)}</b>`:'');
  $('#openingCaption').classList.toggle('trap-hit', !!isTrapPly);
  $('#openingPrev').disabled = idx===0;
  $('#openingNext').disabled = idx===total;
  const marks={}; if(o.isTrap && o.trapPly!=null) marks[o.trapPly]='blunder';
  renderMoveLog($('#openingLog'), g.moves, {active: idx-1, marks, onPick:(p)=>{ openingView.idx=p+1; openingRender(); revealBoard($('#openingBoard')); }});
}

/* ---------------- Trainer ----------------
   Luyện một nhánh, hoặc "mọi nhánh": máy chọn ngẫu nhiên nhánh ở chỗ rẽ, bạn phải đáp đúng theo nhánh đó. */
function startTrainer(o, color, multi){
  const lines = multi ? o.lines : [openingView.line && o.lines.includes(openingView.line) ? openingView.line : o.lines[0]];
  trainer.op=o; trainer.color=color; trainer.multi=!!multi; trainer.lines=lines.map(l=>l.moves.filter(m=>!m.error));
  trainer.lineNames=lines.map(l=>l.id==='main'?'Diễn biến chính':l.name);
  trainer.mistakes=0; trainer.wrongHere=0; trainer.hint=false; trainer.busy=false; trainer.feedback=null; trainer.mine=0;
  trainer.game=Game.create();
  showOpeningCard('trainer');
  $('#trainerTitle').textContent = `Trainer: ${o.name}`;
  $('#trainerSide').textContent = `Bạn cầm ${COLOR_VN[color]}. Hãy đi đúng các nước lý thuyết của bên ${COLOR_VN[color]}; máy đi bên kia${multi?' và chọn ngẫu nhiên một trong '+lines.length+' nhánh ở mỗi chỗ rẽ':''}.`;
  if(!trainer.widget){
    trainer.widget = createBoardWidget($('#trainerBoard'), {onSquareClick:(r,c)=>trainer.ctl.click(r,c), label:'Bàn cờ Trainer khai cuộc'});
    trainer.ctl = makeClickController({
      widget:trainer.widget,
      getBoard:()=>trainer.game.board(),
      turn:()=>trainer.game.turn(),
      canMove:(t)=> !trainer.busy && t===trainer.color && trainerCands().length>0,
      onMove:trainerUserMove,
      extraMeta:trainerMeta,
    });
  }
  trainer.widget.setFlipped(color===BLACK);
  trainer.ctl.clear();
  $('#trainerCard').scrollIntoView({block:'start'});
  trainerAdvance();
}
const sameMv=(a,b)=>a.from[0]===b.from[0]&&a.from[1]===b.from[1]&&a.to[0]===b.to[0]&&a.to[1]===b.to[1];
// các nhánh khớp với ván hiện tại và còn nước tiếp theo
function trainerCands(){
  const played=trainer.game.moves, n=played.length;
  return trainer.lines.filter(l=> l.length>n && played.every((m,i)=>sameMv(m,l[i])));
}
function trainerExpected(){ const c=trainerCands(); return c.length ? c[0][trainer.game.moves.length] : null; }
function trainerMeta(){
  const m={lastMove:trainer.game.lastMove()};
  const exp=trainerExpected();
  if(trainer.hint && exp) m.highlight=[exp.from];
  if(trainer.feedback && trainer.feedback.arrow) m.arrows=[trainer.feedback.arrow];
  return m;
}
function trainerRender(){
  trainer.ctl.render();
  const n=trainer.game.moves.length;
  const c=trainerCands(); const total = c.length ? Math.max(...c.map(l=>l.length)) : n;
  $('#trainerProgress').style.width = (100*n/Math.max(1,total))+'%';
  $('#trainerCount').textContent = `${trainer.mine} nước đúng · ${trainer.mistakes} lần sai`;
  renderMoveLog($('#trainerLog'), trainer.game.moves);
  const fb=trainer.feedback, el=$('#trainerMsg');
  if(fb) statusBanner(el, fb.kind, fb.html); else el.innerHTML='';
  $('#trainerHint').disabled = !c.length || trainer.game.turn()!==trainer.color;
}
function trainerAdvance(){
  const c=trainerCands();
  if(!c.length){ trainerFinish(); return; }
  if(trainer.game.turn()!==trainer.color){
    trainer.busy=true; trainerRender();
    setTimeout(()=>{
      const cands=trainerCands(), n=trainer.game.moves.length;
      const pick=cands[Math.floor(Math.random()*cands.length)];
      const m=pick[n];
      const branches=new Set(cands.map(l=>l[n].from+'>'+l[n].to)).size;
      trainer.game.play(m);
      trainer.busy=false;
      const prev=trainer.feedback&&trainer.feedback.kind==='over'&&trainer.feedback.fresh ? trainer.feedback.html+'<br>' : '';
      trainer.feedback={kind: prev?'over':'think', html:`${prev}Máy đi <b>${esc(m.text)}</b>${branches>1?' <i>(chỗ rẽ nhánh: máy chọn ngẫu nhiên)</i>':''} — ${esc(m.caption)}`};
      trainerAdvance();
    }, 550);
    return;
  }
  trainerRender();
}
function trainerUserMove(mv){
  const cands=trainerCands(), n=trainer.game.moves.length;
  const b=trainer.game.board();
  const hit=cands.find(l=>sameMv(l[n],mv));
  if(hit){
    const exp=hit[n];
    trainer.game.play(mv); trainer.mine++;
    trainer.hint=false; trainer.wrongHere=0;
    trainer.feedback={kind:'over', fresh:true, html:`✔ Đúng: <b>${esc(exp.text)}</b> — ${esc(exp.caption)}`};
    trainerAdvance();
  } else {
    const exp=cands[0][n];
    trainer.mistakes++; trainer.wrongHere++;
    const tried=Notation.describe(b,mv).short;
    trainer.game.play(mv);
    trainer.busy=true;
    const alts=[...new Set(cands.map(l=>l[n].text))];
    trainer.feedback={kind:'fail', html: trainer.wrongHere>=2
      ? `✘ ${esc(tried)} chưa đúng. Nước lý thuyết là <b>${esc(alts.join(' hoặc '))}</b> (mũi tên xanh). Vì sao: ${esc(exp.caption)}`
      : `✘ ${esc(tried)} chưa đúng lý thuyết của thế này.${(()=>{ const w=Coach.whyBad(b,mv,null); return w.length?' Vì sao chưa ổn: '+esc(w[0].text)+'.':''; })()} 🧠 Tự hỏi: quân nào của mình chưa ra trận, và Pháo đầu đối phương đang nhắm vào đâu? (bấm 💡 để được gợi ý)`,
      arrow: trainer.wrongHere>=2 ? {from:exp.from,to:exp.to} : null};
    trainerRender();
    setTimeout(()=>{ trainer.game.undo(1); trainer.busy=false; if(trainer.wrongHere>=2) trainer.hint=true; trainerRender(); }, 900);
  }
}
function trainerFinish(){
  const mine=trainer.mine+trainer.mistakes;
  const score=mine?Math.max(0, Math.round(100*trainer.mine/mine)):100;
  const best=trainerBest(); const k=trainer.op.id+':'+trainer.color;
  if(best[k]==null || score>best[k]){ best[k]=score; safeLS_set('xq_trainer_best', JSON.stringify(best)); }
  const stars = score>=100?'⭐⭐⭐':score>=70?'⭐⭐':score>=40?'⭐':'';
  const played=trainer.game.moves; const li=trainer.lines.findIndex(l=>l.length===played.length&&played.every((m,i)=>sameMv(m,l[i])));
  trainer.feedback={kind:'over', html:`🎓 Hoàn thành${trainer.multi&&li>=0?` nhánh “${esc(trainer.lineNames[li])}”`:''}! Điểm: <b>${score}%</b> ${stars} (${trainer.mistakes} lần sai). ${score<100?'Luyện lại để đạt 100% nhé.':'Bạn đã thuộc thế này!'}${trainer.multi?' Bấm ↺ để máy chọn nhánh khác.':''}`};
  trainerRender();
}

function initOpenings(){
  renderOpeningList();
  $('#openingBackBtn').addEventListener('click', ()=>{ showOpeningCard('list'); renderOpeningList(); });
  $('#openingPrev').addEventListener('click', ()=>{ if(openingView.idx>0){ openingView.idx--; openingRender(); } });
  $('#openingNext').addEventListener('click', ()=>{ if(openingView.idx<openingView.line.moves.length){ openingView.idx++; openingRender(); } });
  $('#openingFlip').addEventListener('click', ()=> openingView.widget.setFlipped(!openingView.widget.isFlipped()));
  $('#trainRedBtn').addEventListener('click', ()=> startTrainer(openingView.active, RED, $('#trainMulti').checked));
  $('#trainBlackBtn').addEventListener('click', ()=> startTrainer(openingView.active, BLACK, $('#trainMulti').checked));
  $('#trainerBackBtn').addEventListener('click', ()=>{ openOpening(trainer.op.id, openingView.line&&openingView.line.id); });
  $('#trainerRestart').addEventListener('click', ()=> startTrainer(trainer.op, trainer.color, trainer.multi));
  $('#trainerHint').addEventListener('click', ()=>{ trainer.hint=true; trainerRender(); });
  $('#trainRandomBtn').addEventListener('click', ()=>{
    const pool=OPENINGS.filter(o=>!o.isTrap);
    const o=pool[Math.floor(Math.random()*pool.length)];
    openingView.active=o; openingView.line=o.lines[0]; startTrainer(o, Math.random()<0.5?RED:BLACK, o.lines.length>1);
  });
}

/* Tự sinh bởi tools/make-games.js — biên bản ván danh thủ (đã kiểm hợp lệ) + đánh giá của máy. Không sửa tay. */
/*@@DATA:master-games@@*/

