/* =========================================================================
   XQSearch — engine tìm kiếm của máy (tự chứa, chạy được trong Web Worker)
   - Bàn cờ 1 chiều Int8Array(90), ô = hàng*9 + cột (hàng 0 = phía Đen)
   - Quân: Tướng 1, Sĩ 2, Tượng 3, Mã 4, Xe 5, Pháo 6, Tốt 7; Đỏ dương, Đen âm
   - Negamax alpha-beta (PVS), iterative deepening theo thời gian, quiescence,
     bảng băm Zobrist, killer + history, null-move, LMR, gia hạn khi bị chiếu.
   - Đánh giá: vật chất + bảng điểm vị trí (PST).
   ========================================================================= */
const XQSearch = (function(){
  const K=1,A=2,E=3,H=4,R=5,C=6,P=7;
  const TYPE_OF={G:K,A:A,E:E,H:H,R:R,C:C,S:P};
  const LETTER=[null,'G','A','E','H','R','C','S'];
  const MATE=30000, INF=32000;
  const VAL=[0,0,120,120,270,600,285,30];

  // ---------- Bảng điểm vị trí (góc nhìn Đỏ; hàng 0 = hàng cuối của Đen) ----------
  const PST={};
  PST[P]=[
    [0,3,6,9,12,9,6,3,0],[18,36,56,80,120,80,56,36,18],[14,26,42,60,80,60,42,26,14],
    [10,20,30,34,40,34,30,20,10],[6,12,18,18,20,18,18,12,6],[2,0,8,0,8,0,8,0,2],
    [0,0,-2,0,4,0,-2,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0]];
  PST[H]=[
    [4,8,16,12,4,12,16,8,4],[4,10,28,16,8,16,28,10,4],[12,14,16,20,18,20,16,14,12],
    [8,24,18,24,20,24,18,24,8],[6,16,14,18,16,18,14,16,6],[4,12,16,14,12,14,16,12,4],
    [2,6,8,6,10,6,8,6,2],[4,2,8,8,4,8,8,2,4],[0,2,4,4,-2,4,4,2,0],[0,-4,0,0,0,0,0,-4,0]];
  PST[R]=[
    [14,14,12,18,16,18,12,14,14],[16,20,18,24,26,24,18,20,16],[12,12,12,18,18,18,12,12,12],
    [12,18,16,22,22,22,16,18,12],[12,14,12,18,18,18,12,14,12],[12,16,14,20,20,20,14,16,12],
    [6,10,8,14,14,14,8,10,6],[4,8,6,14,12,14,6,8,4],[8,4,8,16,8,16,8,4,8],[-2,10,6,14,12,14,6,10,-2]];
  PST[C]=[
    [6,4,0,-10,-12,-10,0,4,6],[2,2,0,-4,-14,-4,0,2,2],[2,2,0,-10,-8,-10,0,2,2],
    [0,0,-2,4,10,4,-2,0,0],[0,0,0,2,8,2,0,0,0],[-2,0,4,2,6,2,4,0,-2],
    [0,0,0,2,4,2,0,0,0],[4,0,8,6,10,6,8,0,4],[0,2,4,6,6,6,4,2,0],[0,0,2,6,6,6,2,0,0]];
  const zero=()=>Array.from({length:10},()=>Array(9).fill(0));
  PST[A]=zero(); PST[A][8][4]=3;
  PST[E]=zero(); PST[E][7][4]=3; PST[E][7][0]=-2; PST[E][7][8]=-2; PST[E][5][2]=-1; PST[E][5][6]=-1;
  PST[K]=zero(); PST[K][8][4]=-8; PST[K][7][4]=-15; PST[K][9][3]=-2; PST[K][9][5]=-2; PST[K][8][3]=-10; PST[K][8][5]=-10; PST[K][7][3]=-18; PST[K][7][5]=-18;
  // bảng phẳng: PSQ[piece+7][sq] = giá trị (góc nhìn của chính quân đó) + vật chất
  const PSQ=[];
  for(let pc=-7;pc<=7;pc++){
    const t=Math.abs(pc), arr=new Int16Array(90);
    if(pc!==0) for(let sq=0;sq<90;sq++){ const r=(sq/9)|0, c=sq%9; const rr = pc>0 ? r : 9-r; arr[sq]=VAL[t]+PST[t][rr][c]; }
    PSQ[pc+7]=arr;
  }

  // ---------- Zobrist ----------
  let seed=0x9E3779B1;
  function rnd32(){ seed^=seed<<13; seed^=seed>>>17; seed^=seed<<5; return seed|0; }
  const ZL=[], ZH=[];
  for(let pc=0;pc<15;pc++){ ZL.push(new Int32Array(90)); ZH.push(new Int32Array(90)); for(let s=0;s<90;s++){ ZL[pc][s]=rnd32(); ZH[pc][s]=rnd32(); } }
  const ZSIDE_L=rnd32(), ZSIDE_H=rnd32();

  // ---------- Hình học ----------
  const inPal=(sq,side)=>{ const r=(sq/9)|0, c=sq%9; if(c<3||c>5) return false; return side>0 ? r>=7 : r<=2; };
  const ownHalf=(sq,side)=>{ const r=(sq/9)|0; return side>0 ? r>=5 : r<=4; };
  const ORTH=[[-1,0],[1,0],[0,-1],[0,1]], DIAG=[[-1,-1],[-1,1],[1,-1],[1,1]];
  const HORSE=[[-2,-1,-1,0],[-2,1,-1,0],[2,-1,1,0],[2,1,1,0],[-1,-2,0,-1],[1,-2,0,-1],[-1,2,0,1],[1,2,0,1]];
  const ok=(r,c)=>r>=0&&r<=9&&c>=0&&c<=8;

  // ---------- Trạng thái tìm kiếm ----------
  function Pos(){
    this.b=new Int8Array(90); this.side=1; this.kpos=[0,0]; // kpos[0]=đỏ, [1]=đen
    this.hl=0; this.hh=0; this.score=0; // score: điểm tĩnh góc nhìn Đỏ
    this.hist=[]; // băm các thế đã qua (để phát hiện lặp)
  }
  Pos.prototype.load=function(board2d, turn){
    this.b.fill(0); this.hl=0; this.hh=0; this.score=0;
    for(let r=0;r<10;r++) for(let c=0;c<9;c++){
      const p=board2d[r][c]; if(!p) continue;
      const pc=TYPE_OF[p.type]*(p.color==='red'?1:-1), sq=r*9+c;
      this.b[sq]=pc; this.hl^=ZL[pc+7][sq]; this.hh^=ZH[pc+7][sq];
      this.score += pc>0 ? PSQ[pc+7][sq] : -PSQ[pc+7][sq];
      if(pc===K) this.kpos[0]=sq; if(pc===-K) this.kpos[1]=sq;
    }
    this.side = turn==='red'?1:-1;
    if(this.side<0){ this.hl^=ZSIDE_L; this.hh^=ZSIDE_H; }
  };
  // Nước đi mã hoá: from*128 + to ; bắt quân lưu riêng khi make
  Pos.prototype.make=function(mv){
    const f=mv>>7, t=mv&127, b=this.b, pc=b[f], cap=b[t];
    this.hist.push(this.hl, this.hh);
    if(cap){ this.hl^=ZL[cap+7][t]; this.hh^=ZH[cap+7][t]; this.score -= cap>0 ? PSQ[cap+7][t] : -PSQ[cap+7][t]; }
    this.hl^=ZL[pc+7][f]^ZL[pc+7][t]; this.hh^=ZH[pc+7][f]^ZH[pc+7][t];
    this.score += pc>0 ? (PSQ[pc+7][t]-PSQ[pc+7][f]) : -(PSQ[pc+7][t]-PSQ[pc+7][f]);
    b[t]=pc; b[f]=0;
    if(pc===K) this.kpos[0]=t; else if(pc===-K) this.kpos[1]=t;
    this.side=-this.side; this.hl^=ZSIDE_L; this.hh^=ZSIDE_H;
    return cap;
  };
  Pos.prototype.unmake=function(mv,cap){
    const f=mv>>7, t=mv&127, b=this.b, pc=b[t];
    b[f]=pc; b[t]=cap;
    if(pc===K) this.kpos[0]=f; else if(pc===-K) this.kpos[1]=f;
    this.side=-this.side;
    this.hh=this.hist.pop(); this.hl=this.hist.pop();
    this.score += pc>0 ? -(PSQ[pc+7][t]-PSQ[pc+7][f]) : (PSQ[pc+7][t]-PSQ[pc+7][f]);
    if(cap) this.score += cap>0 ? PSQ[cap+7][t] : -PSQ[cap+7][t];
  };
  Pos.prototype.nullMove=function(){ this.hist.push(this.hl,this.hh); this.side=-this.side; this.hl^=ZSIDE_L; this.hh^=ZSIDE_H; };
  Pos.prototype.unNull=function(){ this.side=-this.side; this.hh=this.hist.pop(); this.hl=this.hist.pop(); };

  // Ô sq có bị bên `by` (1/-1) tấn công không
  Pos.prototype.attacked=function(sq,by){
    const b=this.b, r=(sq/9)|0, c=sq%9;
    // Xe, Pháo, Tướng (lộ mặt) theo 4 hướng
    for(const [dr,dc] of ORTH){
      let rr=r+dr, cc=c+dc, screen=false;
      while(ok(rr,cc)){
        const p=b[rr*9+cc];
        if(p){
          if(!screen){
            if(p===R*by) return true;
            if(dr!==0 && p===K*by) return true;           // hai Tướng đối mặt
            screen=true;
          } else { if(p===C*by) return true; break; }
        }
        rr+=dr; cc+=dc;
      }
    }
    // Mã (chân Mã là ô chéo sát ô bị tấn công)
    for(const [dr,dc,lr,lc] of HORSE){
      const hr=r-dr, hc=c-dc; if(!ok(hr,hc)) continue;
      if(b[hr*9+hc]!==H*by) continue;
      if(b[(hr+lr)*9+(hc+lc)]===0) return true;
    }
    // Tốt
    const fr = r + (by>0?1:-1);   // Tốt đỏ đứng hàng dưới (r+1) tấn công lên
    if(ok(fr,c) && b[fr*9+c]===P*by) return true;
    for(const dc of [-1,1]){
      const cc=c+dc; if(!ok(r,cc)) continue;
      if(b[r*9+cc]===P*by && !ownHalf(r*9+cc,by)) return true;
    }
    return false;
  };
  Pos.prototype.inCheck=function(side){ return this.attacked(this.kpos[side>0?0:1], -side); };

  // Sinh nước giả hợp lệ (chưa lọc tự chiếu). capsOnly: chỉ nước ăn quân
  Pos.prototype.gen=function(out,capsOnly){
    const b=this.b, s=this.side;
    let n=0;
    const push=(f,t)=>{ const q=b[t]; if(q && (q>0)===(s>0)) return; if(capsOnly && !q) return; out[n++]=(f<<7)|t; };
    for(let sq=0;sq<90;sq++){
      const pc=b[sq]; if(!pc || (pc>0)!==(s>0)) continue;
      const t=Math.abs(pc), r=(sq/9)|0, c=sq%9;
      switch(t){
        case K: for(const [dr,dc] of ORTH){ const rr=r+dr, cc=c+dc; if(ok(rr,cc)&&inPal(rr*9+cc,s)) push(sq,rr*9+cc); } break;
        case A: for(const [dr,dc] of DIAG){ const rr=r+dr, cc=c+dc; if(ok(rr,cc)&&inPal(rr*9+cc,s)) push(sq,rr*9+cc); } break;
        case E: for(const [dr,dc] of DIAG){ const rr=r+2*dr, cc=c+2*dc; if(!ok(rr,cc)||!ownHalf(rr*9+cc,s)) continue; if(b[(r+dr)*9+c+dc]) continue; push(sq,rr*9+cc); } break;
        case H: for(const [dr,dc,lr,lc] of HORSE){ const rr=r+dr, cc=c+dc; if(!ok(rr,cc)) continue; if(b[(r+lr)*9+c+lc]) continue; push(sq,rr*9+cc); } break;
        case R: for(const [dr,dc] of ORTH){ let rr=r+dr, cc=c+dc; while(ok(rr,cc)){ const q=b[rr*9+cc]; if(q){ if((q>0)!==(s>0)) out[n++]=(sq<<7)|(rr*9+cc); break; } if(!capsOnly) out[n++]=(sq<<7)|(rr*9+cc); rr+=dr; cc+=dc; } } break;
        case C: for(const [dr,dc] of ORTH){ let rr=r+dr, cc=c+dc, scr=false; while(ok(rr,cc)){ const q=b[rr*9+cc]; if(!scr){ if(q) scr=true; else if(!capsOnly) out[n++]=(sq<<7)|(rr*9+cc); } else if(q){ if((q>0)!==(s>0)) out[n++]=(sq<<7)|(rr*9+cc); break; } rr+=dr; cc+=dc; } } break;
        case P: { const fr=r-(s>0?1:-1); if(ok(fr,c)) push(sq,fr*9+c); if(!ownHalf(sq,s)){ if(c>0) push(sq,sq-1); if(c<8) push(sq,sq+1); } } break;
      }
    }
    return n;
  };
  // Nước vừa đi có hợp lệ không (không để Tướng mình bị chiếu / đối mặt)
  Pos.prototype.legalAfterMake=function(){ return !this.attacked(this.kpos[this.side>0?1:0], this.side); };
  Pos.prototype.legalMoves=function(){
    const buf=new Int32Array(160), n=this.gen(buf,false), res=[];
    for(let i=0;i<n;i++){ const cap=this.make(buf[i]); if(this.legalAfterMake()) res.push(buf[i]); this.unmake(buf[i],cap); }
    return res;
  };
  Pos.prototype.evaluate=function(){ return this.side>0 ? this.score : -this.score; };

  // ---------- Bảng băm ----------
  const TT_BITS=18, TT_SIZE=1<<TT_BITS, TT_MASK=TT_SIZE-1;
  const ttKey=new Int32Array(TT_SIZE), ttMove=new Int32Array(TT_SIZE), ttScore=new Int32Array(TT_SIZE);
  const ttDepth=new Int8Array(TT_SIZE), ttFlag=new Int8Array(TT_SIZE);
  function ttClear(){ ttKey.fill(0); ttDepth.fill(0); ttFlag.fill(0); ttMove.fill(0); }

  // ---------- Tìm kiếm ----------
  const MAXPLY=64;
  let killers=[], history=new Int32Array(90*128), nodes=0, stopAt=0, stopped=false, gameHist=new Set();
  const moveBufs=Array.from({length:MAXPLY+8},()=>new Int32Array(160)), scoreBufs=Array.from({length:MAXPLY+8},()=>new Int32Array(160));
  function timeUp(){ if((nodes&1023)===0 && Date.now()>stopAt) stopped=true; return stopped; }

  function isRepetition(pos,ply){
    // lặp trong đường tìm kiếm (cùng bên đi) hoặc trùng thế đã có trong ván
    const h=pos.hist, L=h.length;
    for(let i=L-4;i>=0 && i>=L-2*ply;i-=4){ if(h[i]===pos.hl && h[i+1]===pos.hh) return true; }
    return gameHist.has(pos.hl+':'+pos.hh);
  }

  function orderMoves(pos,moves,scores,n,ttMv,ply){
    const b=pos.b;
    for(let i=0;i<n;i++){
      const mv=moves[i], t=mv&127, cap=b[t];
      let s;
      if(mv===ttMv) s=1e7;
      else if(cap) s=1e6 + VAL[Math.abs(cap)]*10 - VAL[Math.abs(b[mv>>7])]/10;
      else if(killers[ply] && (killers[ply][0]===mv)) s=9e5;
      else if(killers[ply] && (killers[ply][1]===mv)) s=8e5;
      else s=history[(mv>>7)*128+t];
      scores[i]=s;
    }
  }
  function pickNext(moves,scores,n,i){
    let bi=i; for(let j=i+1;j<n;j++) if(scores[j]>scores[bi]) bi=j;
    if(bi!==i){ let t=moves[i]; moves[i]=moves[bi]; moves[bi]=t; t=scores[i]; scores[i]=scores[bi]; scores[bi]=t; }
  }

  function quiesce(pos,alpha,beta,ply,qd){
    nodes++; if(timeUp()) return 0;
    const inChk=pos.inCheck(pos.side);
    if(!inChk){
      const stand=pos.evaluate();
      if(stand>=beta) return stand;
      if(stand>alpha) alpha=stand;
      if(qd>6) return stand;
    } else if(qd>8) return pos.evaluate();
    const moves=moveBufs[ply], scores=scoreBufs[ply];
    const n=pos.gen(moves, !inChk);
    orderMoves(pos,moves,scores,n,0,ply);
    let legal=0, best = inChk ? -MATE+ply : alpha;
    for(let i=0;i<n;i++){
      pickNext(moves,scores,n,i);
      const mv=moves[i], cap=pos.make(mv);
      if(!pos.legalAfterMake()){ pos.unmake(mv,cap); continue; }
      legal++;
      const v=-quiesce(pos,-beta,-alpha,ply+1,qd+1);
      pos.unmake(mv,cap);
      if(stopped) return 0;
      if(v>best) best=v;
      if(v>alpha){ alpha=v; if(alpha>=beta) break; }
    }
    if(inChk && legal===0) return -MATE+ply;
    return inChk ? best : alpha;
  }

  function search(pos,depth,alpha,beta,ply,allowNull){
    if(ply>0 && isRepetition(pos,ply)) return 0;
    const inChk=pos.inCheck(pos.side);
    if(inChk) depth++;                         // gia hạn khi bị chiếu
    if(depth<=0) return quiesce(pos,alpha,beta,ply,0);
    nodes++; if(timeUp()) return 0;
    if(ply>=MAXPLY) return pos.evaluate();
    // khoảng cách chiếu bí
    alpha=Math.max(alpha,-MATE+ply); beta=Math.min(beta,MATE-ply-1); if(alpha>=beta) return alpha;

    const idx=pos.hl & TT_MASK; let ttMv=0;
    if(ttKey[idx]===pos.hh && ttFlag[idx]){
      ttMv=ttMove[idx];
      if(ttDepth[idx]>=depth && ply>0){
        let s=ttScore[idx]; if(s>MATE-200) s-=ply; else if(s<-MATE+200) s+=ply;
        const f=ttFlag[idx];
        if(f===1) return s; if(f===2 && s>=beta) return s; if(f===3 && s<=alpha) return s;
      }
    }
    const pv = beta-alpha>1;
    // Null-move
    if(allowNull && !pv && !inChk && depth>=3 && pos.evaluate()>=beta){
      let big=0; for(let sq=0;sq<90;sq++){ const p=pos.b[sq]; if(p && (p>0)===(pos.side>0) && (Math.abs(p)===R||Math.abs(p)===H||Math.abs(p)===C)) big++; }
      if(big>=2){
        pos.nullMove();
        const v=-search(pos,depth-3,-beta,-beta+1,ply+1,false);
        pos.unNull();
        if(stopped) return 0;
        if(v>=beta) return v;
      }
    }
    const moves=moveBufs[ply], scores=scoreBufs[ply];
    const n=pos.gen(moves,false);
    orderMoves(pos,moves,scores,n,ttMv,ply);
    let best=-INF, bestMv=0, legal=0, origAlpha=alpha;
    for(let i=0;i<n;i++){
      pickNext(moves,scores,n,i);
      const mv=moves[i], cap=pos.make(mv);
      if(!pos.legalAfterMake()){ pos.unmake(mv,cap); continue; }
      legal++;
      let v;
      const givesCheck = pos.inCheck(pos.side);
      if(legal===1) v=-search(pos,depth-1,-beta,-alpha,ply+1,true);
      else {
        let red = (depth>=3 && legal>4 && !cap && !inChk && !givesCheck) ? 1 : 0;
        v=-search(pos,depth-1-red,-alpha-1,-alpha,ply+1,true);
        if(v>alpha && (red || v<beta)) v=-search(pos,depth-1,-beta,-alpha,ply+1,true);
      }
      pos.unmake(mv,cap);
      if(stopped) return 0;
      if(v>best){ best=v; bestMv=mv; }
      if(v>alpha){
        alpha=v;
        if(alpha>=beta){
          if(!cap){ if(!killers[ply]) killers[ply]=[0,0]; if(killers[ply][0]!==mv){ killers[ply][1]=killers[ply][0]; killers[ply][0]=mv; } history[(mv>>7)*128+(mv&127)]+=depth*depth; }
          break;
        }
      }
    }
    if(legal===0) return -MATE+ply;           // hết nước = thua (luật cờ tướng)
    let st=best; if(st>MATE-200) st+=ply; else if(st<-MATE+200) st-=ply;
    ttKey[idx]=pos.hh; ttMove[idx]=bestMv; ttScore[idx]=st; ttDepth[idx]=depth;
    ttFlag[idx]= best>=beta ? 2 : (best>origAlpha ? 1 : 3);
    return best;
  }

  function extractPV(pos,maxLen){
    const pv=[], undo=[];
    for(let i=0;i<maxLen;i++){
      const idx=pos.hl&TT_MASK; if(ttKey[idx]!==pos.hh||!ttFlag[idx]) break;
      const mv=ttMove[idx]; if(!mv) break;
      if(!pos.legalMoves().includes(mv)) break;
      pv.push(mv); undo.push([mv,pos.make(mv)]);
    }
    for(let i=undo.length-1;i>=0;i--) pos.unmake(undo[i][0],undo[i][1]);
    return pv;
  }
  const toMove=mv=>({from:[(mv>>7)/9|0,(mv>>7)%9], to:[(mv&127)/9|0,(mv&127)%9]});
  const encode=m=>((m.from[0]*9+m.from[1])<<7)|(m.to[0]*9+m.to[1]);

  // opts: {board, turn, timeMs, maxDepth, history:[key...], noise, blunder, rng}
  function think(opts){
    const pos=new Pos(); pos.load(opts.board, opts.turn);
    gameHist = new Set(opts.historyKeys||[]);
    killers=[]; history.fill(0); nodes=0; stopped=false;
    const t0=Date.now(); stopAt = t0 + (opts.timeMs||1000);
    const maxDepth = opts.maxDepth||40;
    const rootMoves=pos.legalMoves();
    if(!rootMoves.length) return {move:null, score:-MATE, depth:0, pv:[], nodes:0};
    let bestMv=rootMoves[0], bestScore=0, doneDepth=0, pv=[];
    const rng = opts.rng || Math.random;
    // Cấp thấp: đôi khi đi nước ngẫu nhiên (mô phỏng người mới hay sơ suất)
    if(opts.blunder && rng()<opts.blunder){
      const m=rootMoves[Math.floor(rng()*rootMoves.length)];
      return {move:toMove(m), score:0, depth:0, pv:[], nodes:0, random:true};
    }
    // Điểm từng nước ở gốc (để thêm nhiễu cho cấp thấp)
    const rootScores=new Map(); let lastFull=null;
    for(let d=1; d<=maxDepth; d++){
      let alpha=-INF, beta=INF, iterBest=0, iterScore=-INF;
      // sắp xếp nước gốc: nước tốt nhất lần trước lên đầu
      rootMoves.sort((a,b)=>(b===bestMv)-(a===bestMv) || (rootScores.get(b)||-INF)-(rootScores.get(a)||-INF));
      let first=true;
      for(const mv of rootMoves){
        const cap=pos.make(mv);
        let v;
        if(opts.noise) v=-search(pos,d-1,-INF,INF,1,true);     // cần điểm chính xác cho mọi nước để chọn ngẫu nhiên
        else if(first) v=-search(pos,d-1,-beta,-alpha,1,true);
        else { v=-search(pos,d-1,-alpha-1,-alpha,1,true); if(v>alpha && !stopped) v=-search(pos,d-1,-beta,-alpha,1,true); }
        pos.unmake(mv,cap);
        if(stopped) break;
        rootScores.set(mv,v);
        if(v>iterScore){ iterScore=v; iterBest=mv; }
        if(v>alpha) alpha=v;
        first=false;
      }
      if(stopped && !iterBest) break;
      if(iterBest){ bestMv=iterBest; bestScore=iterScore; doneDepth=d; }
      if(!stopped) lastFull=new Map(rootScores);
      if(stopped) break;
      // lưu nước tốt nhất vào TT để lấy PV
      const idx=pos.hl&TT_MASK; ttKey[idx]=pos.hh; ttMove[idx]=bestMv; ttFlag[idx]=1; ttDepth[idx]=d; ttScore[idx]=bestScore;
      if(Math.abs(bestScore)>MATE-100) break;   // đã thấy chiếu bí
      if(Date.now()-t0 > (opts.timeMs||1000)*0.55) break; // không đủ thời gian cho vòng sau
    }
    if(opts.noise){
      // chọn ngẫu nhiên trong các nước kém nước tốt nhất không quá `noise` điểm
      const sc=lastFull||rootScores, top=Math.max(...[...sc.values()]);
      const cands=rootMoves.filter(m=>sc.has(m) && sc.get(m)>=top-opts.noise);
      if(cands.length>1){ const m=cands[Math.floor(rng()*cands.length)]; bestMv=m; bestScore=sc.get(m); }
    }
    pv=[bestMv];
    { const cap=pos.make(bestMv); pv=pv.concat(extractPV(pos,8)); pos.unmake(bestMv,cap); }
    return {move:toMove(bestMv), score:bestScore, depth:doneDepth, pv:pv.map(toMove), nodes, ms:Date.now()-t0};
  }

  // Khoá thế cờ tương thích với Game.key để truyền lịch sử ván vào worker
  function keyOf(board,turn){ const p=new Pos(); p.load(board,turn); return p.hl+':'+p.hh; }
  function perft(board,turn,depth){
    const pos=new Pos(); pos.load(board,turn);
    const rec=d=>{ if(d===0) return 1; let n=0; for(const mv of pos.legalMoves()){ const c=pos.make(mv); n+=rec(d-1); pos.unmake(mv,c); } return n; };
    return rec(depth);
  }
  function legalMoves(board,turn){ const p=new Pos(); p.load(board,turn); return p.legalMoves().map(toMove); }
  function evaluate(board,turn){ const p=new Pos(); p.load(board,turn); return p.evaluate(); }
  return {think, keyOf, perft, legalMoves, evaluate, ttClear, MATE, encode};
})();

