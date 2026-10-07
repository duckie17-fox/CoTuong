/* =========================================================================
   KÝ HIỆU GHI NƯỚC ĐI KIỂU VIỆT NAM
   - Mỗi bên đánh số cột 1→9 tính từ tay PHẢI của mình.
     Đỏ (ngồi dưới): cột 1 là cột ngoài cùng bên phải màn hình.
     Đen (ngồi trên): cột 1 là cột ngoài cùng bên trái màn hình.
   - Dấu:  "."  tiến   ·   "/"  thoái (lùi)   ·   "-"  bình (đi ngang)
   - Quân đi thẳng (Tướng, Xe, Pháo, Tốt): tiến/thoái ghi SỐ HÀNG đi được,
     bình ghi CỘT ĐẾN.  Quân đi chéo (Sĩ, Tượng, Mã): luôn ghi CỘT ĐẾN.
   - Hai quân cùng loại trên cùng một cột: thay số cột bằng "t" (trước) / "s" (sau);
     3 quân trở lên (chỉ có thể là Tốt): t / g (giữa) / s.
   ========================================================================= */
const Notation = (function(){
  const LETTER = {G:'Tg',A:'S',E:'T',H:'M',R:'X',C:'P',S:'B'};
  const NAME   = {G:'Tướng',A:'Sĩ',E:'Tượng',H:'Mã',R:'Xe',C:'Pháo',S:'Tốt'};
  const DIAGONAL = {A:true,E:true,H:true};

  function fileOf(c,color){ return color===Engine.RED ? 9-c : c+1; }
  function colOfFile(f,color){ return color===Engine.RED ? 9-f : f-1; }
  // Hàng "phía trước" theo góc nhìn của từng bên (số nhỏ = gần đối phương hơn)
  function isForward(fromR,toR,color){ return color===Engine.RED ? toR<fromR : toR>fromR; }

  // Nhãn cột hoặc t/g/s nếu có quân cùng loại trên cùng cột
  function originLabel(board,r,c){
    const p=board[r][c];
    const same=[];
    for(let rr=0;rr<10;rr++){ const q=board[rr][c]; if(q&&q.type===p.type&&q.color===p.color) same.push(rr); }
    // Sĩ/Tượng cùng cột vẫn phân biệt được nhờ dấu tiến/thoái nên không cần t/s
    if(same.length<2 || p.type==='G' || p.type==='A' || p.type==='E') return {short:String(fileOf(c,p.color)), long:String(fileOf(c,p.color))};
    // sắp xếp từ trước (gần đối phương) ra sau
    same.sort((a,b)=> p.color===Engine.RED ? a-b : b-a);
    const idx=same.indexOf(r);
    let tag, word;
    if(same.length===2){ tag = idx===0?'t':'s'; word = idx===0?'trước':'sau'; }
    else if(same.length===3){ tag=['t','g','s'][idx]; word=['trước','giữa','sau'][idx]; }
    else { tag=String(idx+1); word='thứ '+(idx+1); }
    return {short:tag, long:word, tagged:true};
  }

  function describe(board,move){
    const [fr,fc]=move.from, [tr,tc]=move.to;
    const p=board[fr][fc];
    if(!p) return {short:'?',long:'?'};
    const origin=originLabel(board,fr,fc);
    let sign, num, word;
    if(fr===tr){ sign='-'; word='bình'; num=fileOf(tc,p.color); }
    else {
      const fwd=isForward(fr,tr,p.color);
      sign = fwd?'.':'/'; word = fwd?'tiến':'thoái';
      num = DIAGONAL[p.type] ? fileOf(tc,p.color) : Math.abs(tr-fr);
    }
    const capture = board[tr][tc] ? NAME[board[tr][tc].type] : null;
    const short = LETTER[p.type] + origin.short + sign + num;
    const long = `${NAME[p.type]} ${origin.long} ${word} ${num}`;
    return {short, long, capture, piece:p.type, color:p.color};
  }

  // Ghi cả ván: trả về mảng {n, red, black} theo cặp nước
  function gameRecord(startBoard, moves, startColor){
    let b=Engine.cloneBoard(startBoard), color=startColor||Engine.RED;
    const rows=[]; let cur=null;
    for(const m of moves){
      const d=describe(b,m);
      if(color===Engine.RED || !cur){ cur={n:rows.length+1, red:null, black:null}; rows.push(cur); }
      cur[color]=d;
      if(color===Engine.BLACK) cur=null;
      b=Engine.applyMove(b,m); color=Engine.otherColor(color);
    }
    return rows;
  }

  // Đọc ký hiệu ngắn (vd "P2-5", "Mt.7", "B3.1") thành nước đi hợp lệ trên bàn hiện tại
  function parse(board,color,text){
    const legal=Engine.generateLegalMoves(board,color);
    const t=text.replace(/\s+/g,'');
    return legal.find(m=>describe(board,m).short===t) || null;
  }

  // Nhãn cột hiển thị trên bàn: trả mảng 9 số theo thứ tự cột màn hình 0..8
  function fileLabels(color){ const a=[]; for(let c=0;c<9;c++) a.push(fileOf(c,color)); return a; }

  return {LETTER,NAME,fileOf,colOfFile,describe,gameRecord,parse,fileLabels};
})();

