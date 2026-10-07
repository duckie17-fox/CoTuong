'use strict';
const SVGNS = 'http://www.w3.org/2000/svg';
const Engine = (function(){
  const RED='red', BLACK='black';
  function otherColor(c){ return c===RED?BLACK:RED; }

  function initialBoard(){
    const b = Array.from({length:10},()=>Array(9).fill(null));
    const back=['R','H','E','A','G','A','E','H','R'];
    for(let c=0;c<9;c++){ b[0][c]={type:back[c],color:BLACK}; b[9][c]={type:back[c],color:RED}; }
    b[2][1]={type:'C',color:BLACK}; b[2][7]={type:'C',color:BLACK};
    b[7][1]={type:'C',color:RED};   b[7][7]={type:'C',color:RED};
    for(const c of [0,2,4,6,8]){ b[3][c]={type:'S',color:BLACK}; b[6][c]={type:'S',color:RED}; }
    return b;
  }
  function cloneBoard(b){ return b.map(row=>row.map(cell=>cell?{type:cell.type,color:cell.color}:null)); }
  function inBounds(r,c){ return r>=0&&r<=9&&c>=0&&c<=8; }
  function inPalace(r,c,color){ if(c<3||c>5) return false; return color===RED ? (r>=7&&r<=9) : (r>=0&&r<=2); }
  function ownSide(r,color){ return color===RED ? r>=5 : r<=4; }

  function pseudoMovesForPiece(board,r,c){
    const piece=board[r][c]; if(!piece) return [];
    const {type,color}=piece; const moves=[];
    const push=(nr,nc)=>{
      if(!inBounds(nr,nc)) return false;
      const target=board[nr][nc];
      if(target && target.color===color) return false;
      moves.push({from:[r,c],to:[nr,nc]});
      return !target;
    };
    switch(type){
      case 'G':{
        for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){
          const nr=r+dr,nc=c+dc; if(inPalace(nr,nc,color)) push(nr,nc);
        } break;
      }
      case 'A':{
        for(const [dr,dc] of [[1,1],[1,-1],[-1,1],[-1,-1]]){
          const nr=r+dr,nc=c+dc; if(inPalace(nr,nc,color)) push(nr,nc);
        } break;
      }
      case 'E':{
        for(const [dr,dc] of [[2,2],[2,-2],[-2,2],[-2,-2]]){
          const nr=r+dr,nc=c+dc; const midR=r+dr/2, midC=c+dc/2;
          if(!inBounds(nr,nc)) continue;
          if(!ownSide(nr,color)) continue;
          if(board[midR][midC]) continue;
          push(nr,nc);
        } break;
      }
      case 'H':{
        const jumps=[
          {d:[-2,-1],leg:[-1,0]},{d:[-2,1],leg:[-1,0]},
          {d:[2,-1],leg:[1,0]},{d:[2,1],leg:[1,0]},
          {d:[-1,-2],leg:[0,-1]},{d:[1,-2],leg:[0,-1]},
          {d:[-1,2],leg:[0,1]},{d:[1,2],leg:[0,1]},
        ];
        for(const {d,leg} of jumps){
          const nr=r+d[0], nc=c+d[1];
          const legR=r+leg[0], legC=c+leg[1];
          if(!inBounds(nr,nc)) continue;
          if(board[legR][legC]) continue;
          push(nr,nc);
        } break;
      }
      case 'R':{
        for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){
          let nr=r+dr,nc=c+dc;
          while(inBounds(nr,nc)){ const cont=push(nr,nc); if(!cont) break; nr+=dr; nc+=dc; }
        } break;
      }
      case 'C':{
        for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){
          let nr=r+dr,nc=c+dc; let screen=false;
          while(inBounds(nr,nc)){
            const target=board[nr][nc];
            if(!screen){
              if(!target) moves.push({from:[r,c],to:[nr,nc]});
              else screen=true;
            } else {
              if(target){ if(target.color!==color) moves.push({from:[r,c],to:[nr,nc]}); break; }
            }
            nr+=dr; nc+=dc;
          }
        } break;
      }
      case 'S':{
        const fwd = color===RED ? -1 : 1;
        push(r+fwd,c);
        if(!ownSide(r,color)){ push(r,c+1); push(r,c-1); }
        break;
      }
    }
    return moves;
  }

  function findGeneral(board,color){
    for(let r=0;r<10;r++) for(let c=0;c<9;c++){
      const p=board[r][c]; if(p&&p.type==='G'&&p.color===color) return [r,c];
    }
    return null;
  }
  function generalsFacing(board){
    const rg=findGeneral(board,RED), bg=findGeneral(board,BLACK);
    if(!rg||!bg) return false;
    if(rg[1]!==bg[1]) return false;
    const col=rg[1]; const r1=Math.min(rg[0],bg[0]), r2=Math.max(rg[0],bg[0]);
    for(let r=r1+1;r<r2;r++) if(board[r][col]) return false;
    return true;
  }
  function isSquareAttacked(board,r,c,byColor){
    for(let rr=0;rr<10;rr++) for(let cc=0;cc<9;cc++){
      const p=board[rr][cc]; if(!p||p.color!==byColor) continue;
      const moves=pseudoMovesForPiece(board,rr,cc);
      for(const m of moves) if(m.to[0]===r&&m.to[1]===c) return true;
    }
    return false;
  }
  function isInCheck(board,color){
    const g=findGeneral(board,color); if(!g) return true;
    return isSquareAttacked(board,g[0],g[1],otherColor(color));
  }
  function applyMove(board,move){
    const nb=cloneBoard(board);
    const [fr,fc]=move.from,[tr,tc]=move.to;
    nb[tr][tc]=nb[fr][fc]; nb[fr][fc]=null;
    return nb;
  }
  function generateLegalMoves(board,color){
    const legal=[];
    for(let r=0;r<10;r++) for(let c=0;c<9;c++){
      const p=board[r][c]; if(!p||p.color!==color) continue;
      for(const m of pseudoMovesForPiece(board,r,c)){
        const nb=applyMove(board,m);
        if(isInCheck(nb,color)) continue;
        if(generalsFacing(nb)) continue;
        legal.push(m);
      }
    }
    return legal;
  }
  function gameStatus(board,colorToMove){
    const moves=generateLegalMoves(board,colorToMove);
    const inCheck=isInCheck(board,colorToMove);
    if(moves.length===0) return inCheck?'checkmate':'stalemate';
    return inCheck?'check':'normal';
  }

  return {RED,BLACK,otherColor,initialBoard,cloneBoard,inBounds,inPalace,ownSide,
    pseudoMovesForPiece,findGeneral,generalsFacing,isSquareAttacked,isInCheck,
    applyMove,generateLegalMoves,gameStatus};
})();

const RED=Engine.RED, BLACK=Engine.BLACK;
function mkBoard(pieces){
  const b = Array.from({length:10},()=>Array(9).fill(null));
  for(const [r,c,type,color] of pieces) b[r][c]={type,color};
  return b;
}

