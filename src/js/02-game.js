/* =========================================================================
   GAME — trạng thái một ván cờ: lịch sử, hoàn tác, xử thắng/thua/hoà
   Luật rút gọn (ghi rõ trong bài học "Luật cấm & hoà cờ"):
   - Hết nước đi hợp lệ (bị chiếu bí hoặc bị "vây" không còn nước) → THUA.
   - Lặp lại cùng một thế cờ lần thứ 3:
       · nếu chỉ một bên chiếu liên tục trong chu kỳ lặp → bên đó THUA (cấm chiếu mãi);
       · nếu chỉ một bên liên tục đuổi bắt cùng một quân của đối phương mà không chiếu
         → bên đó THUA (cấm đuổi mãi — bản đơn giản hoá);
       · còn lại → HOÀ.
   - 60 nước (mỗi bên 60, tức 120 nửa nước) liên tiếp không có quân nào bị ăn → HOÀ.
   - Cả hai bên không còn quân có thể qua sông tấn công (Xe, Mã, Pháo, Tốt) → HOÀ.
   ========================================================================= */
const Game = (function(){
  function key(board,turn){
    let s=turn[0];
    for(let r=0;r<10;r++) for(let c=0;c<9;c++){ const p=board[r][c]; s += p ? (p.color==='red'?p.type:p.type.toLowerCase()) : '.'; }
    return s;
  }
  function hasAttackers(board,color){
    for(const row of board) for(const p of row) if(p&&p.color===color&&'RHCS'.includes(p.type)) return true;
    return false;
  }
  // Quân vừa đi tới `to` đang "đuổi" những quân nào của đối phương (bản đơn giản hoá luật Á châu):
  // tính là đuổi nếu quân bị nhắm KHÔNG có quân bảo vệ, hoặc là Xe bị Mã/Pháo nhắm.
  // Trả về loại quân bị đuổi (quân bị đuổi chạy đi nên so theo loại, không theo ô).
  function chasedTargets(board,to,victimColor){
    const res=[];
    const chaser=board[to[0]][to[1]];
    for(const m of Engine.pseudoMovesForPiece(board,to[0],to[1])){
      const [r,c]=m.to; const t=board[r][c];
      if(!t||t.color!==victimColor||t.type==='G') continue;
      const tmp=Engine.cloneBoard(board); tmp[r][c]={type:'S',color:Engine.otherColor(victimColor)};
      const guarded=Engine.isSquareAttacked(tmp,r,c,victimColor);
      if(!guarded || (t.type==='R' && (chaser.type==='H'||chaser.type==='C'))) res.push(t.type);
    }
    return res;
  }

  function create(startBoard, startTurn){
    const g = {
      start: Engine.cloneBoard(startBoard || Engine.initialBoard()),
      startTurn: startTurn || Engine.RED,
      moves: [],      // {from,to,captured,check}
      boards: [],     // bàn cờ sau từng nước
      keys: [],       // khoá thế cờ (sau từng nước), keys[-1] là thế xuất phát
      result: null,   // {winner:'red'|'black'|null, reason:'...'}
    };
    g.startKey = key(g.start, g.startTurn);
    g.board = ()=> g.boards.length ? g.boards[g.boards.length-1] : g.start;
    g.turn = ()=> g.moves.length%2===0 ? g.startTurn : Engine.otherColor(g.startTurn);
    g.lastMove = ()=> g.moves.length ? g.moves[g.moves.length-1] : null;
    g.legalMoves = ()=> g.result ? [] : Engine.generateLegalMoves(g.board(), g.turn());
    g.play = function(mv){
      const b=g.board(), mover=g.turn();
      const nb=Engine.applyMove(b,mv);
      const captured=b[mv.to[0]][mv.to[1]];
      const opp=Engine.otherColor(mover);
      const rec={from:mv.from.slice(), to:mv.to.slice(), piece:b[mv.from[0]][mv.from[1]].type, color:mover,
        captured: captured?captured.type:null, check: Engine.isInCheck(nb,opp),
        chases: chasedTargets(nb,mv.to,opp), text: Notation.describe(b,mv)};
      g.moves.push(rec); g.boards.push(nb); g.keys.push(key(nb,opp));
      g.result = evaluateResult();
      return rec;
    };
    g.undo = function(n){
      n = n||1;
      for(let i=0;i<n && g.moves.length;i++){ g.moves.pop(); g.boards.pop(); g.keys.pop(); }
      g.result = null;
    };
    g.status = function(){
      if(g.result) return g.result;
      const st=Engine.gameStatus(g.board(), g.turn());
      return {state:st};
    };
    function evaluateResult(){
      const b=g.board(), turn=g.turn();
      const st=Engine.gameStatus(b,turn);
      if(st==='checkmate') return {state:'over', winner:Engine.otherColor(turn), reason:'checkmate'};
      if(st==='stalemate') return {state:'over', winner:Engine.otherColor(turn), reason:'stalemate'};
      // Lặp thế cờ
      const k=g.keys[g.keys.length-1];
      const all=[g.startKey].concat(g.keys);
      const idxs=[]; all.forEach((kk,i)=>{ if(kk===k) idxs.push(i); });
      if(idxs.length>=3){
        const first=idxs[idxs.length-3];         // chu kỳ: từ lần xuất hiện thứ nhất tới hiện tại
        const cyc=g.moves.slice(first);          // các nước trong chu kỳ (nước thứ i dẫn tới all[i+1])
        const perp={red:true,black:true}, chase={red:true,black:true}, chaseSet={red:null,black:null};
        const moved={red:false,black:false};
        for(const m of cyc){
          moved[m.color]=true;
          if(!m.check) perp[m.color]=false;
          if(!m.chases.length) chase[m.color]=false;
          else {
            const s=new Set(m.chases);
            chaseSet[m.color] = chaseSet[m.color]===null ? s : new Set([...chaseSet[m.color]].filter(x=>s.has(x)));
          }
        }
        for(const c of ['red','black']){
          if(!moved[c]) { perp[c]=false; chase[c]=false; }
          if(chase[c] && (!chaseSet[c] || chaseSet[c].size===0)) chase[c]=false;
        }
        if(perp.red!==perp.black) return {state:'over', winner: perp.red?'black':'red', reason:'perpetual-check'};
        if(!perp.red && !perp.black && chase.red!==chase.black) return {state:'over', winner: chase.red?'black':'red', reason:'perpetual-chase'};
        return {state:'over', winner:null, reason:'repetition'};
      }
      // 60 nước không ăn quân
      let quiet=0;
      for(let i=g.moves.length-1;i>=0 && !g.moves[i].captured;i--) quiet++;
      if(quiet>=120) return {state:'over', winner:null, reason:'sixty-moves'};
      if(!hasAttackers(b,'red') && !hasAttackers(b,'black')) return {state:'over', winner:null, reason:'no-material'};
      return null;
    }
    return g;
  }

  const REASON_TEXT = {
    'checkmate':'chiếu bí',
    'stalemate':'đối phương hết nước đi (bị vây)',
    'perpetual-check':'phạm luật chiếu mãi',
    'perpetual-chase':'phạm luật đuổi bắt mãi một quân',
    'repetition':'lặp lại thế cờ 3 lần',
    'sixty-moves':'60 nước liên tiếp không ăn quân',
    'no-material':'cả hai bên không còn quân tấn công',
    'resign':'đầu hàng',
  };
  function resultText(res){
    if(!res) return '';
    const who = res.winner==='red'?'Đỏ':'Đen';
    if(!res.winner) return `Hoà cờ — ${REASON_TEXT[res.reason]}.`;
    if(res.reason==='perpetual-check'||res.reason==='perpetual-chase'){
      const loser = res.winner==='red'?'Đen':'Đỏ';
      return `${who} thắng — ${loser} ${REASON_TEXT[res.reason]}.`;
    }
    if(res.reason==='resign') return `${who} thắng — đối phương đầu hàng.`;
    return `${who} thắng — ${REASON_TEXT[res.reason]}.`;
  }
  return {create, key, resultText, REASON_TEXT};
})();

