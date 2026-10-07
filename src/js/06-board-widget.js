/* =========================================================================
   BOARD WIDGET — bàn cờ SVG dùng chung cho mọi phần
   - Hỗ trợ lật bàn (flipped), số cột 1–9 cho cả hai bên, mũi tên nước đi,
     quân chữ Hán hoặc chữ Việt (Settings.pieceStyle).
   ========================================================================= */
const UNIT=64, MARGIN=58, PIECE_R=28;
const BOARD_W = MARGIN*2 + UNIT*8;
const BOARD_H = MARGIN*2 + UNIT*9;
const PIECE_CHAR = {
  red:  {G:'帥',A:'仕',E:'相',H:'傌',R:'俥',C:'炮',S:'兵'},
  black:{G:'將',A:'士',E:'象',H:'馬',R:'車',C:'砲',S:'卒'}
};
const VN_NAME = {G:'Tướng',A:'Sĩ',E:'Tượng',H:'Mã',R:'Xe',C:'Pháo',S:'Tốt'};

function safeLS_get(key){ try{ return localStorage.getItem(key); }catch(e){ return null; } }
function safeLS_set(key,val){ try{ localStorage.setItem(key,val); }catch(e){} }
function safeJSON(key,fallback){ try{ const v=JSON.parse(safeLS_get(key)); return v==null?fallback:v; }catch(e){ return fallback; } }

/* ---------- Cài đặt hiển thị dùng chung ---------- */
const Settings = {
  pieceStyle: safeLS_get('xq_piece_style')==='vn' ? 'vn' : 'han',
  listeners: [],
  set(key,val){ this[key]=val; if(key==='pieceStyle') safeLS_set('xq_piece_style',val); this.listeners.forEach(f=>f()); },
  onChange(f){ this.listeners.push(f); }
};

function svgEl(tag,attrs){
  const el=document.createElementNS(SVGNS,tag);
  for(const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

// Ký hiệu nước đi đầy đủ cho log/hiển thị
function moveText(board,mv){
  const d=Notation.describe(board,mv);
  return d.short + (d.capture ? ' ×'+d.capture : '');
}

let _widgetSeq=0;
function createBoardWidget(container, opts){
  opts = opts || {};
  const uid = 'xqb'+(++_widgetSeq);
  let flipped = !!opts.flipped;
  let lastBoard=null, lastMeta={};
  container.innerHTML='';
  const svg = svgEl('svg',{viewBox:`0 0 ${BOARD_W} ${BOARD_H}`, class:'xq-board-svg', role:'img',
    'aria-label': opts.label || 'Bàn cờ tướng'});

  // Mỗi bàn có id gradient riêng: nếu dùng chung id, bàn nằm trong tab đang ẩn
  // có thể làm các bàn khác mất màu (gradient trong phần tử display:none không vẽ).
  const defs = svgEl('defs',{});
  const grad = svgEl('radialGradient',{id:uid+'-bevel',cx:'35%',cy:'30%',r:'75%'});
  grad.appendChild(svgEl('stop',{offset:'0%',style:'stop-color:var(--b-disc-hi)'}));
  grad.appendChild(svgEl('stop',{offset:'70%',style:'stop-color:var(--b-disc)'}));
  grad.appendChild(svgEl('stop',{offset:'100%',style:'stop-color:var(--b-disc-lo)'}));
  defs.appendChild(grad);
  const woodGrad = svgEl('linearGradient',{id:uid+'-wood',x1:'0%',y1:'0%',x2:'100%',y2:'100%'});
  woodGrad.appendChild(svgEl('stop',{offset:'0%',style:'stop-color:var(--b-wood-1)'}));
  woodGrad.appendChild(svgEl('stop',{offset:'100%',style:'stop-color:var(--b-wood-2)'}));
  defs.appendChild(woodGrad);
  for(const [name,color] of [['arrow','var(--arrow)'],['arrowAlt','var(--arrow-alt)']]){
    const mk=svgEl('marker',{id:uid+'-'+name,viewBox:'0 0 10 10',refX:'6',refY:'5',markerWidth:'3.2',markerHeight:'3.2',orient:'auto-start-reverse'});
    mk.appendChild(svgEl('path',{d:'M0,0 L10,5 L0,10 z',style:`fill:${color}`}));
    defs.appendChild(mk);
  }
  svg.appendChild(defs);

  svg.appendChild(svgEl('rect',{x:0,y:0,width:BOARD_W,height:BOARD_H,rx:14,fill:`url(#${uid}-wood)`}));
  svg.appendChild(svgEl('rect',{x:MARGIN-18,y:MARGIN-18,width:UNIT*8+36,height:UNIT*9+36,rx:8,
    style:'fill:var(--b-paper);stroke:var(--b-line)','stroke-width':2}));

  // Lưới: đối xứng nên không cần vẽ lại khi lật bàn
  const gridG = svgEl('g',{style:'stroke:var(--b-line)','stroke-width':1.4,'stroke-linecap':'round'});
  const P = (r,c)=>({x: MARGIN + c*UNIT, y: MARGIN + r*UNIT});
  for(let r=0;r<10;r++){ const a=P(r,0), b=P(r,8); gridG.appendChild(svgEl('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y})); }
  for(let c=0;c<9;c++){
    if(c===0||c===8){ const a=P(0,c), b=P(9,c); gridG.appendChild(svgEl('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y})); }
    else {
      let a=P(0,c), b=P(4,c); gridG.appendChild(svgEl('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y}));
      a=P(5,c); b=P(9,c); gridG.appendChild(svgEl('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y}));
    }
  }
  for(const [r0,c0,r1,c1] of [[0,3,2,5],[7,3,9,5]]){
    let a=P(r0,c0), b=P(r1,c1); gridG.appendChild(svgEl('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y}));
    a=P(r0,c1); b=P(r1,c0); gridG.appendChild(svgEl('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y}));
  }
  svg.appendChild(gridG);

  // Dấu hoa thị ở vị trí Pháo & Tốt
  const markPts=[[2,1],[2,7],[7,1],[7,7],[3,0],[3,2],[3,4],[3,6],[3,8],[6,0],[6,2],[6,4],[6,6],[6,8]];
  const markG = svgEl('g',{style:'stroke:var(--b-line)','stroke-width':1.2});
  const d=8, len=14;
  const ml=(x1,y1,x2,y2)=>markG.appendChild(svgEl('line',{x1,y1,x2,y2}));
  for(const [r,c] of markPts){
    const {x,y}=P(r,c);
    if(c>0){ ml(x-d,y-len,x-d,y-d); ml(x-d,y-d,x-len,y-d); ml(x-d,y+len,x-d,y+d); ml(x-d,y+d,x-len,y+d); }
    if(c<8){ ml(x+d,y-len,x+d,y-d); ml(x+d,y-d,x+len,y-d); ml(x+d,y+len,x+d,y+d); ml(x+d,y+d,x+len,y+d); }
  }
  svg.appendChild(markG);

  const riverY = P(4,0).y + UNIT/2;
  const riverG = svgEl('g',{class:'xq-river'});
  svg.appendChild(riverG);
  const labelsG = svgEl('g',{class:'xq-files'});
  svg.appendChild(labelsG);
  const overlayG = svgEl('g',{class:'xq-overlays'});
  const piecesG = svgEl('g',{class:'xq-pieces'});
  const arrowsG = svgEl('g',{class:'xq-arrows'});
  svg.appendChild(overlayG); svg.appendChild(piecesG); svg.appendChild(arrowsG);
  container.appendChild(svg);

  // toạ độ bàn (r,c) -> toạ độ màn hình, có tính lật bàn
  function ptxy(r,c){ return flipped ? P(9-r,8-c) : P(r,c); }

  function drawStatic(){
    riverG.innerHTML='';
    const t1 = svgEl('text',{x:P(0,2).x,y:riverY,'text-anchor':'middle','dominant-baseline':'central',class:'xq-river-text'});
    const t2 = svgEl('text',{x:P(0,6).x,y:riverY,'text-anchor':'middle','dominant-baseline':'central',class:'xq-river-text'});
    if(Settings.pieceStyle==='vn'){ t1.textContent='SỞ HÀ'; t2.textContent='HÁN GIỚI'; t1.classList.add('vn'); t2.classList.add('vn'); }
    else { t1.textContent='楚 河'; t2.textContent='漢 界'; }
    riverG.appendChild(t1); riverG.appendChild(t2);
    // Số cột: bên ngồi trên ghi ở mép trên, bên ngồi dưới ghi ở mép dưới
    labelsG.innerHTML='';
    const topColor = flipped ? Engine.RED : Engine.BLACK;
    const botColor = Engine.otherColor(topColor);
    for(let sc=0; sc<9; sc++){
      const boardC = flipped ? 8-sc : sc;   // cột bàn cờ đang nằm ở cột màn hình sc
      const x = MARGIN + sc*UNIT;
      const tt = svgEl('text',{x, y:20,'text-anchor':'middle','dominant-baseline':'central',class:'xq-file xq-file-'+topColor});
      tt.textContent = Notation.fileOf(boardC, topColor);
      const tb = svgEl('text',{x, y:BOARD_H-20,'text-anchor':'middle','dominant-baseline':'central',class:'xq-file xq-file-'+botColor});
      tb.textContent = Notation.fileOf(boardC, botColor);
      labelsG.appendChild(tt); labelsG.appendChild(tb);
    }
  }
  drawStatic();

  svg.addEventListener('click', (e)=>{
    if(!opts.onSquareClick) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM(); if(!ctm) return;
    const loc = pt.matrixTransform(ctm.inverse());
    let c = Math.round((loc.x - MARGIN)/UNIT);
    let r = Math.round((loc.y - MARGIN)/UNIT);
    if(r<0||r>9||c<0||c>8) return;
    const {x,y} = P(r,c);
    if(Math.hypot(loc.x-x, loc.y-y) > UNIT*0.55) return;
    if(flipped){ r=9-r; c=8-c; }
    opts.onSquareClick(r,c);
  });

  function drawPiece(p,r,c){
    const {x,y}=ptxy(r,c);
    const g = svgEl('g',{class:`xq-piece xq-${p.color}`,transform:`translate(${x},${y})`});
    g.appendChild(svgEl('circle',{r:PIECE_R,class:'xq-piece-outer',fill:`url(#${uid}-bevel)`}));
    g.appendChild(svgEl('circle',{r:PIECE_R-5,class:'xq-piece-inner'}));
    const vn = Settings.pieceStyle==='vn';
    const txt = svgEl('text',{class:'xq-piece-glyph'+(vn?' vn':''),'text-anchor':'middle','dominant-baseline':'central',y:vn?1:2});
    txt.textContent = vn ? VN_NAME[p.type] : PIECE_CHAR[p.color][p.type];
    if(vn && VN_NAME[p.type].length>=4){ txt.classList.add('long'); txt.setAttribute('textLength', VN_NAME[p.type].length>=5?42:38); txt.setAttribute('lengthAdjust','spacingAndGlyphs'); }
    g.appendChild(txt);
    const title = svgEl('title',{}); title.textContent = `${VN_NAME[p.type]} ${p.color==='red'?'Đỏ':'Đen'}`;
    g.appendChild(title);
    piecesG.appendChild(g);
  }

  function drawArrow(a){
    const s=ptxy(a.from[0],a.from[1]), t=ptxy(a.to[0],a.to[1]);
    const dx=t.x-s.x, dy=t.y-s.y, L=Math.hypot(dx,dy)||1;
    const sx=s.x+dx/L*10, sy=s.y+dy/L*10, tx=t.x-dx/L*16, ty=t.y-dy/L*16;
    arrowsG.appendChild(svgEl('line',{x1:sx,y1:sy,x2:tx,y2:ty,class:'xq-arrow'+(a.alt?' alt':''),
      'marker-end':`url(#${uid}-${a.alt?'arrowAlt':'arrow'})`}));
  }

  function setBoard(board, meta){
    lastBoard = board; lastMeta = meta = meta || {};
    piecesG.innerHTML=''; overlayG.innerHTML=''; arrowsG.innerHTML='';
    if(meta.lastMove){
      for(const sq of [meta.lastMove.from, meta.lastMove.to]){
        const {x,y}=ptxy(sq[0],sq[1]);
        overlayG.appendChild(svgEl('circle',{cx:x,cy:y,r:PIECE_R+6,class:'xq-lastmove'}));
      }
    }
    if(meta.highlight) for(const sq of meta.highlight){
      const {x,y}=ptxy(sq[0],sq[1]);
      overlayG.appendChild(svgEl('circle',{cx:x,cy:y,r:PIECE_R+7,class:'xq-highlight'}));
    }
    for(let r=0;r<10;r++) for(let c=0;c<9;c++){ const p=board[r][c]; if(p) drawPiece(p,r,c); }
    if(meta.selected){
      const {x,y}=ptxy(meta.selected[0],meta.selected[1]);
      overlayG.appendChild(svgEl('circle',{cx:x,cy:y,r:PIECE_R+5,class:'xq-selected-ring'}));
    }
    if(meta.legalDest){
      for(const sq of meta.legalDest){
        const {x,y}=ptxy(sq[0],sq[1]);
        if(board[sq[0]][sq[1]]) arrowsG.appendChild(svgEl('circle',{cx:x,cy:y,r:PIECE_R+4,class:'xq-dest-ring'}));
        else overlayG.appendChild(svgEl('circle',{cx:x,cy:y,r:10,class:'xq-dest-dot'}));
      }
    }
    if(meta.checkSq){
      const {x,y}=ptxy(meta.checkSq[0],meta.checkSq[1]);
      overlayG.appendChild(svgEl('circle',{cx:x,cy:y,r:PIECE_R+9,class:'xq-check-ring'}));
    }
    if(meta.arrows) meta.arrows.forEach(drawArrow);
  }
  function rerender(){ drawStatic(); if(lastBoard) setBoard(lastBoard,lastMeta); }
  function setFlipped(f){ f=!!f; if(f===flipped) return; flipped=f; rerender(); }
  Settings.onChange(rerender);
  return {svg, setBoard, setFlipped, isFlipped:()=>flipped, rerender};
}

