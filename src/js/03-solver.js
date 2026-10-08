/* =========================================================================
   SOLVER — tìm chiếu bí bắt buộc (dùng cho bài tập, tàn cuộc, harness)
   Chỉ dùng cho thế cờ ít quân; dùng nước đi hợp lệ đầy đủ.
   ========================================================================= */
const Solver = (function(){
  const MATE = 100000;
  function ordered(board,color){
    const opp=Engine.otherColor(color);
    const ms=Engine.generateLegalMoves(board,color);
    // ưu tiên nước chiếu, rồi nước ăn quân
    return ms.map(m=>{
      const nb=Engine.applyMove(board,m);
      const chk=Engine.isInCheck(nb,opp)?2:0, cap=board[m.to[0]][m.to[1]]?1:0;
      return {m,nb,s:chk+cap};
    }).sort((a,b)=>b.s-a.s);
  }
  // Bên `color` có ép chiếu bí được trong `plies` nửa nước không (plies lẻ)?
  // Trả về điểm: >0 nếu ép được (MATE - số nửa nước), 0 nếu không.
  function attack(board,color,plies,onlyChecks){
    if(plies<1) return 0;
    const opp=Engine.otherColor(color);
    let best=0;
    for(const {m,nb,s} of ordered(board,color)){
      if(onlyChecks && s<2) continue;
      const replies=Engine.generateLegalMoves(nb,opp);
      if(replies.length===0){ return MATE-1; }         // chiếu bí / vây bí ngay
      if(plies<3) continue;
      let worst=Infinity;
      for(const r of replies){
        const v=attack(Engine.applyMove(nb,r),color,plies-2,onlyChecks);
        if(v===0){ worst=0; break; }
        if(v<worst) worst=v;
      }
      if(worst>0 && worst!==Infinity){ const v=worst-2; if(v>best) best=v; if(best===MATE-3) return best; }
    }
    return best;
  }
  // Tìm chuỗi chiếu bí ngắn nhất (tối đa maxMoves nước của bên tấn công)
  function findMate(board,color,maxMoves,onlyChecks){
    for(let n=1;n<=maxMoves;n++){
      const plies=2*n-1;
      for(const {m,nb} of ordered(board,color)){
        const opp=Engine.otherColor(color);
        const replies=Engine.generateLegalMoves(nb,opp);
        if(replies.length===0) return {moves:n, first:m};
        if(plies<3) continue;
        let ok=true;
        for(const r of replies){ if(!attack(Engine.applyMove(nb,r),color,plies-2,onlyChecks)){ ok=false; break; } }
        if(ok) return {moves:n, first:m};
      }
    }
    return null;
  }
  // Nước phòng thủ kéo dài nhất (dùng để máy trả lời trong bài tập / tàn cuộc)
  function bestDefense(board,color,attackerMaxMoves){
    const opp=Engine.otherColor(color);
    const replies=Engine.generateLegalMoves(board,color);
    let best=null, bestLen=-1;
    for(const r of replies){
      const nb=Engine.applyMove(board,r);
      const f=findMate(nb,opp,attackerMaxMoves);
      const len = f ? f.moves : 999;
      if(len>bestLen){ bestLen=len; best=r; }
    }
    return best;
  }
  // Chuỗi chính (PV) của một thế chiếu bí: [nước tấn công, nước phòng thủ, ...]
  function mateLine(board,color,maxMoves){
    const line=[]; let b=board;
    for(let i=0;i<maxMoves;i++){
      const f=findMate(b,color,maxMoves-i); if(!f) return null;
      line.push(f.first); b=Engine.applyMove(b,f.first);
      const opp=Engine.otherColor(color);
      if(Engine.generateLegalMoves(b,opp).length===0) return line;
      const d=bestDefense(b,opp,maxMoves-i-1); if(!d) return line;
      line.push(d); b=Engine.applyMove(b,d);
    }
    return null;
  }
  // Tìm kiếm vật chất nhỏ (điểm cho `color`)
  const VAL={G:0,A:2,E:2,H:4,R:9,C:4.5,S:1};
  function material(board,color){
    let s=0; for(const row of board) for(const p of row) if(p) s+=(p.color===color?1:-1)*VAL[p.type]; return s;
  }
  // Bản chạy nhanh nằm trong XQSearch (cùng kết quả); bản dưới giữ làm tham chiếu cho test.
  function materialSearch(board,color,depth){ return XQSearch.materialSearch(board,color,depth); }
  function materialSearchRef(board,color,depth,alpha,beta){
    if(alpha===undefined){ alpha=-Infinity; beta=Infinity; }
    const moves=Engine.generateLegalMoves(board,color);
    if(moves.length===0) return -1000-depth;
    if(depth===0) return material(board,color);
    let best=-Infinity;
    for(const m of moves){
      const s=-materialSearchRef(Engine.applyMove(board,m),Engine.otherColor(color),depth-1,-beta,-alpha);
      if(s>best) best=s; if(best>alpha) alpha=best; if(alpha>=beta) break;
    }
    return best;
  }
  // Giải thích vì sao một nước là chiếu bí (tự sinh từ engine, luôn khớp thế cờ)
  const NAME={G:'Tướng',A:'Sĩ',E:'Tượng',H:'Mã',R:'Xe',C:'Pháo',S:'Tốt'};
  function attackersOf(board,r,c,byColor){
    const res=[];
    for(let rr=0;rr<10;rr++) for(let cc=0;cc<9;cc++){
      const p=board[rr][cc]; if(!p||p.color!==byColor) continue;
      if(Engine.pseudoMovesForPiece(board,rr,cc).some(m=>m.to[0]===r&&m.to[1]===c)) res.push(NAME[p.type]);
    }
    return [...new Set(res)];
  }
  function explainMate(board,move){
    const mover=board[move.from[0]][move.from[1]].color, opp=Engine.otherColor(mover);
    const after=Engine.applyMove(board,move);
    const g=Engine.findGeneral(after,opp);
    const side = mover==='red'?'Đỏ':'Đen', oside = opp==='red'?'Đỏ':'Đen';
    const parts=[];
    const d=Notation.describe(board,move);
    const checkers=attackersOf(after,g[0],g[1],mover);
    if(checkers.length) parts.push(`${d.short}: ${checkers.join(' và ')} ${side} chiếu Tướng ${oside}${checkers.length>1?' (chiếu đôi)':''}.`);
    else parts.push(`${d.short}: Tướng ${oside} không bị chiếu nhưng không còn nước đi hợp lệ nào (bị vây, cũng tính là thua).`);
    const reasons=[];
    for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const r=g[0]+dr, c=g[1]+dc;
      if(!Engine.inPalace(r,c,opp)) continue;
      const mv={from:g,to:[r,c]};
      const label=Notation.describe(after,mv).short;
      const occ=after[r][c];
      if(occ && occ.color===opp){ reasons.push(`${label} bị chính ${NAME[occ.type]} ${oside} chặn`); continue; }
      const nb=Engine.applyMove(after,mv);
      if(Engine.generalsFacing(nb)){ reasons.push(`${label} sẽ đối mặt Tướng ${side}`); continue; }
      const att=attackersOf(nb,r,c,mover);
      if(att.length) reasons.push(`${label} bị ${att.join(', ')} ${side} khống chế`);
    }
    if(reasons.length) parts.push('Tướng không chạy được: '+reasons.join('; ')+'.');
    if(checkers.length) parts.push(`Không quân ${oside} nào cản được hoặc ăn được quân chiếu.`);
    return parts.join(' ');
  }
  function explainMate2(board,move){
    const mover=board[move.from[0]][move.from[1]].color, opp=Engine.otherColor(mover);
    const after=Engine.applyMove(board,move);
    const lines=[];
    for(const r of Engine.generateLegalMoves(after,opp)){
      const b2=Engine.applyMove(after,r); const f=findMate(b2,mover,1);
      if(f) lines.push(`${Notation.describe(after,r).short} thì ${Notation.describe(b2,f.first).short}`);
    }
    const uniq=[...new Set(lines)];
    const first=Notation.describe(board,move).short;
    return `Nước đầu ${first}${Engine.isInCheck(after,opp)?' (chiếu)':' (nước êm, không chiếu)'}. Đối phương có ${uniq.length} cách đáp và cách nào cũng bị chiếu bí: `+uniq.slice(0,6).join('; ')+(uniq.length>6?'; …':'')+'.';
  }
  return {findMate, bestDefense, mateLine, materialSearch, materialSearchRef, material, explainMate, explainMate2, MATE};
})();

