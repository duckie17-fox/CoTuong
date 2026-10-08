/* =========================================================================
   UI BÀI HỌC
   ========================================================================= */
function initLessonDemo(container, demo){
  const mode = demo.mode || 'hero';
  const turnBased = mode==='game' || mode==='free' || mode==='endgame';
  const hasSolution = demo.solution || (mode==='endgame' && (demo.pv || demo.defender!=='engine'));
  container.innerHTML = `<div class="board-caption demo-cap">${demo.caption}</div>
    <div class="board-toolbar"><button class="btn btn-outline demo-reset"><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-undo"></use></svg>Làm lại</button>
    ${hasSolution && (demo.result!=='draw' || demo.pv) ?`<button class="btn btn-outline demo-show">${demo.result==='draw'?'<svg class="ic" aria-hidden="true" focusable="false"><use href="#i-play"></use></svg>Xem cách giữ hoà':'<svg class="ic" aria-hidden="true" focusable="false"><use href="#i-bulb"></use></svg>Xem lời giải'}</button>`:''}</div>
    <div class="board-shell board-card"><div class="demo-board"></div></div>
    <div class="demo-msg" aria-live="polite"></div>
    <div class="demo-log movelog" hidden></div>`;
  const msgEl = $('.demo-msg',container), logEl=$('.demo-log',container);
  const heroInit = demo.hero ? demo.hero.map(h=>h.slice()) : null;
  let shown=false, game, board, solved=false, showArrows=true, stage=0, busy=false, token=null, userColor=demo.toMove||RED;
  const say=(cls,html)=>{ msgEl.className='demo-msg'+(cls?' '+cls:''); msgEl.innerHTML=html; };
  function reset(){
    token=null; solved=false; showArrows=true; stage=0; busy=false; say('','');
    if(heroInit) demo.hero=heroInit.map(h=>h.slice());
    if(turnBased) game=Game.create(demo.board, demo.toMove||RED);
    board=Engine.cloneBoard(demo.board);
    logEl.hidden = !turnBased;
    if(turnBased) renderMoveLog(logEl, []);
    if(ctl){ ctl.clear(); ctl.render(); }
  }
  const curBoard=()=> turnBased ? game.board() : board;
  const heroColor=()=> demo.toMove || (demo.hero&&demo.hero.length ? demo.board[heroInit[0][0]][heroInit[0][1]].color : RED);
  const widget = createBoardWidget($('.demo-board',container), {onSquareClick:(r,c)=>ctl.click(r,c), label:'Bàn cờ minh hoạ'});
  widget.setFlipped(!turnBased && heroColor()===BLACK && demo.flip);
  const isHero=(r,c)=> !demo.hero || demo.hero.some(s=>s[0]===r&&s[1]===c);
  function machineReply(){
    const opp=Engine.otherColor(userColor);
    busy=true; say('think','Máy đang tìm nước phòng thủ…');
    const my=token={};
    const apply=(d)=>{
      if(token!==my) return;
      const rec=game.play(d); busy=false;
      renderMoveLog(logEl, game.moves);
      if(game.result){ endgameResult(); }
      else say('', `Máy đáp <b>${esc(rec.text.short)}</b>. Đến lượt bạn.` + (game.moves.length>=40 && demo.result==='draw' ? ' <i>Đã 20 nước mà chưa thắng được — đúng như lý thuyết, thế này là hoà.</i>':''));
      ctl.render();
    };
    setTimeout(()=>{
      if(token!==my) return;
      const b=game.board();
      if(demo.defender==='engine'){
        // thế lớn: dùng máy tìm kiếm (chạy trong Worker), ưu tiên kéo dài / giữ hoà
        AIEngine.think(aiThinkArgs(game,{timeMs:demo.thinkMs||800}))
          .then(r=>apply(r.move || Engine.generateLegalMoves(b,opp)[0]))
          .catch(()=>apply(Solver.bestDefense(b,opp,1) || Engine.generateLegalMoves(b,opp)[0]));
        return;
      }
      apply(Solver.bestDefense(b,opp,2) || Engine.generateLegalMoves(b,opp)[0]);
    }, 350);
  }
  function endgameResult(){
    const res=game.result; solved=true;
    if(res.winner===userColor) say('ok',Game.resultText(res));
    else if(!res.winner) say('ok',Game.resultText(res)+(demo.result==='draw'?' Đúng như lý thuyết: thế này là hoà.':''));
    else say('bad',Game.resultText(res));
  }
  const ctl = makeClickController({
    widget,
    getBoard:curBoard,
    turn:()=> turnBased ? game.turn() : heroColor(),
    canMove:(t)=> !solved && !busy && !(game&&game.result) && (mode!=='endgame' || t===userColor),
    legalMoves:()=>{
      if(turnBased) return game.legalMoves();
      return Engine.generateLegalMoves(board,heroColor()).filter(m=>isHero(m.from[0],m.from[1]));
    },
    onSelect:(n)=>{ if(n===0) say('','Quân này không có nước đi hợp lệ nào.'); else if(!solved&&stage===0) say('',''); },
    onMove:(mv)=>{
      showArrows=false;
      if(turnBased){
        const rec=game.play(mv);
        renderMoveLog(logEl, game.moves);
        if(mode==='endgame'){
          if(game.result) endgameResult(); else machineReply();
        } else {
          say('', `Nước vừa đi: <b>${esc(rec.text.short)}</b> — ${esc(rec.text.long)}`);
          if(game.result) say('ok', Game.resultText(game.result));
        }
        ctl.render(); return;
      }
      const mover=board[mv.from[0]][mv.from[1]].color, opp=Engine.otherColor(mover);
      const before=board;
      board=Engine.applyMove(board,mv);
      if(demo.hero) demo.hero=demo.hero.map(h=>(h[0]===mv.from[0]&&h[1]===mv.from[1])?mv.to.slice():h);
      if(demo.goal==='escape'){
        if(!Engine.isInCheck(board,mover)){ say('ok','Chính xác! Bạn đã giải chiếu.'); solved=true; }
      } else if(demo.goal==='mate' || (demo.goal==='mate2' && stage===1)){
        solved=true;
        const st=Engine.gameStatus(board,opp);
        if(st==='checkmate'||st==='stalemate'){ if(demo.onSolved && !shown) demo.onSolved(); } if(st==='checkmate'||st==='stalemate') say('ok',(st==='checkmate'?'Chiếu bí! Tướng đối phương hết đường.':'Đối phương hết nước đi (bị vây) — thắng!')+(demo.explain?' '+esc(demo.explain):''));
        else say('bad', Engine.isInCheck(board,opp) ? 'Có chiếu nhưng đối phương vẫn thoát được. Bấm "Làm lại" để thử lại.' : 'Chưa chiếu bí. Bấm "Làm lại" để thử lại.');
      } else if(demo.goal==='mate2'){
        const replies=Engine.generateLegalMoves(board,opp);
        if(!replies.length){ solved=true; say('ok','Chiếu bí luôn!'); }
        else if(!replies.every(r=>Solver.findMate(Engine.applyMove(board,r),mover,1))){ solved=true; say('bad','Nước này chưa ép được chiếu bí: đối phương có đường thoát. Bấm "Làm lại" để thử lại.'); }
        else {
          busy=true; say('think','Hay lắm! Đối phương đang đáp…');
          const my=token={};
          setTimeout(()=>{ if(token!==my) return;
            const d=Solver.bestDefense(board,opp,1)||replies[0];
            const t=Notation.describe(board,d).short;
            board=Engine.applyMove(board,d); stage=1; busy=false;
            say('', `Đối phương đáp <b>${esc(t)}</b>. Giờ hãy chiếu bí!`); ctl.render(); }, 500);
        }
      } else if(demo.goal==='safe'){
        solved=true;
        const danger=Coach.endangered(board,mover);
        const gain=-Solver.materialSearch(board,opp,2)-Solver.material(before,mover);
        if(!danger.length && gain>-0.5) say('ok',`An toàn! Vì sao đúng: nước này ${esc(Coach.whyGood(before,mv).join('; ')||'không để quân nào bị bỏ ngỏ')}.`);
        else { const why=Coach.whyBad(before,mv,null); say('bad',`Chưa ổn: ${esc((why[0]&&why[0].text)||'vẫn còn quân bị doạ')}. Tự hỏi: ${esc(Coach.QUESTIONS[(why[0]&&why[0].key)||'ignored-threat'])}`); }
      } else if(demo.goal==='win'){
        solved=true;
        const gain = -Solver.materialSearch(board,opp,3) - Solver.material(before,mover);
        if(gain>=demo.minGain) say('ok',`Chính xác! Sau khi đối phương đáp tốt nhất, bạn vẫn lãi khoảng ${Math.round(gain)} điểm quân.`);
        else say('bad','Chưa đúng: đối phương vẫn giữ được quân. Bấm "Làm lại" để thử lại.');
      }
      ctl.render();
    },
    extraMeta:()=>{
      const b=curBoard();
      const meta={};
      if(turnBased) meta.lastMove=game.lastMove();
      const chk=[RED,BLACK].find(c=>Engine.findGeneral(b,c) && Engine.isInCheck(b,c));
      if(chk) meta.checkSq=Engine.findGeneral(b,chk);
      if(showArrows && demo.arrows) meta.arrows=demo.arrows;
      return meta;
    }
  });
  $('.demo-reset',container).addEventListener('click',reset);
  const showBtn=$('.demo-show',container);
  if(showBtn) showBtn.addEventListener('click',()=>{
    reset(); revealBoard($('.demo-board',container));
    if(mode==='endgame'){
      // chạy lời giải từng nước
      solved=true; busy=true; say('think','Máy đang tính lời giải…');
      const my=token={};
      setTimeout(()=>{
        if(token!==my) return;
        const line=demo.pv ? demo.pv.map(m=>({from:[m[0],m[1]],to:[m[2],m[3]]})) : (Solver.mateLine(demo.board, demo.toMove, demo.mateIn||5) || []);
        let i=0;
        const step=()=>{ if(token!==my) return;
          if(i>=line.length){ busy=false; say('ok', `${demo.result==='draw'?'Diễn biến mẫu':'Lời giải'}: ${esc(Notation.gameRecord(demo.board,line,demo.toMove).map(r=>r.n+'. '+(r.red?r.red.short:'…')+' '+(r.black?r.black.short:'')).join('  '))}`); return; }
          game.play(line[i++]); renderMoveLog(logEl, game.moves); ctl.render(); setTimeout(step, line.length>16?450:700); };
        step();
      }, 50);
      return;
    }
    solved=true; shown=true;
    board=Engine.applyMove(board,demo.solution);
    const d=Notation.describe(demo.board,demo.solution);
    say('ok',`Nước giải: <b>${esc(d.short)}</b> (${esc(d.long)})`+(demo.explain?'<br>'+esc(demo.explain):''));
    widget.setBoard(board,{lastMove:demo.solution, arrows:[{from:demo.solution.from,to:demo.solution.to}]});
  });
  reset();
}

let currentLessonIdx=0;
function lessonsDone(){ return safeJSON('xq_lessons_done',[]); }
function renderLessonNav(){
  const nav=$('#lessonNav');
  const done = lessonsDone();
  nav.innerHTML = LESSON_LEVELS.map(lv=>{
    const items=LESSONS.map((l,i)=>({l,i})).filter(x=>x.l.level===lv.id);
    return `<div class="lesson-level"><div class="lesson-level-h"><b>${esc(lv.name)}</b> <span>${esc(lv.desc)}</span></div>
      <div class="lesson-level-items">${items.map(({l,i})=>
        `<button class="lesson-dot ${i===currentLessonIdx?'active':''} ${done.includes(l.key)?'done':''}" data-idx="${i}" ${i===currentLessonIdx?'aria-current="true"':''}>${i+1}. ${esc(l.title)}</button>`).join('')}</div></div>`;
  }).join('');
  $$('.lesson-dot',nav).forEach(btn=>{
    btn.addEventListener('click',()=>{ currentLessonIdx=parseInt(btn.dataset.idx,10); renderLesson(true); });
  });
}
function markLessonDone(key){
  const done = lessonsDone();
  if(!done.includes(key)){ done.push(key); safeLS_set('xq_lessons_done', JSON.stringify(done)); }
}
function renderLesson(scroll){
  const lesson = LESSONS[currentLessonIdx];
  markLessonDone(lesson.key);
  renderLessonNav();
  const lv = LESSON_LEVELS.find(x=>x.id===lesson.level);
  const content = $('#lessonContent');
  const table = lesson.table ? `<div class="table-wrap"><table class="lesson-table"><thead><tr>${lesson.table.head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${lesson.table.rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '';
  const sources = lesson.sources ? `<p class="sources">Nguồn: ${lesson.sources.map(([t,u])=>`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`).join(' · ')}</p>` : '';
  content.innerHTML = `
    <div class="lesson-head">
      <span class="han" aria-hidden="true">${lesson.han}</span>
      <div><div class="lesson-level-tag">${esc(lv.name)}</div><h3 style="margin:0;">${esc(lesson.title)}</h3></div>
    </div>
    <div class="lesson-body ${lesson.demos.length?'':'no-demo'}">
      <div class="lesson-text">${lesson.text.map(t=>t.startsWith('<ol')?t:`<p>${t}</p>`).join('')}${table}${sources}</div>
      <div class="lesson-demos"></div>
    </div>`;
  const demosEl = $('.lesson-demos',content);
  lesson.demos.forEach(demo=>{
    const d = document.createElement('div');
    d.className='lesson-demo-slot';
    demosEl.appendChild(d);
    initLessonDemo(d, Object.assign({}, demo, {hero: demo.hero ? demo.hero.map(h=>h.slice()) : demo.hero}));
  });
  $('#lessonsHeading').textContent = `${LESSONS.length} bài học`;
  $('#lessonProgress').textContent = `Bài ${currentLessonIdx+1} / ${LESSONS.length}`;
  $('#lessonPrev').disabled = currentLessonIdx===0;
  $('#lessonNext').disabled = currentLessonIdx===LESSONS.length-1;
  $('#lessonNext').innerHTML = currentLessonIdx===LESSONS.length-1 ? 'Đã hết bài' : 'Bài tiếp<svg class="ic" aria-hidden="true" focusable="false"><use href="#i-right"></use></svg>';
  if(scroll) content.scrollIntoView({behavior:'smooth', block:'start'});
}
$('#lessonPrev').addEventListener('click',()=>{ if(currentLessonIdx>0){ currentLessonIdx--; renderLesson(true); } });
$('#lessonNext').addEventListener('click',()=>{ if(currentLessonIdx<LESSONS.length-1){ currentLessonIdx++; renderLesson(true); } });

