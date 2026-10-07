/* =========================================================================
   COACH — giải thích "VÌ SAO" bằng các nguyên tắc tư duy, không chỉ nêu nước đi
   Mọi nhận xét đều suy ra từ thế cờ thật bằng Engine (quân bị tấn công, được
   bảo vệ, phát triển quân, an toàn Tướng…), nên luôn khớp với bàn cờ.
   ========================================================================= */
const Coach = (function(){
  const VAL={G:100,A:2,E:2,H:4,R:9,C:4.5,S:1};
  const NAME={G:'Tướng',A:'Sĩ',E:'Tượng',H:'Mã',R:'Xe',C:'Pháo',S:'Tốt'};
  const HOME={ // vị trí xuất phát của quân Đỏ; Đen đối xứng qua sông
    R:[[9,0],[9,8]], H:[[9,1],[9,7]], C:[[7,1],[7,7]] };
  const isHome=(p,r,c)=> HOME[p.type] && HOME[p.type].some(([hr,hc])=> p.color===Engine.RED ? (hr===r&&hc===c) : (9-hr===r&&hc===c));
  const crossed=(r,color)=> color===Engine.RED ? r<=4 : r>=5;

  // Các quân của `color` tấn công ô (r,c) — dùng nước giả, có tính Pháo cần ngòi, chân Mã…
  function attackers(board,r,c,color){
    const res=[];
    for(let rr=0;rr<10;rr++) for(let cc=0;cc<9;cc++){
      const p=board[rr][cc]; if(!p||p.color!==color) continue;
      if(Engine.pseudoMovesForPiece(board,rr,cc).some(m=>m.to[0]===r&&m.to[1]===c)) res.push({type:p.type,at:[rr,cc]});
    }
    return res;
  }
  function defenders(board,r,c){
    const p=board[r][c]; if(!p) return [];
    const tmp=Engine.cloneBoard(board); tmp[r][c]={type:'S',color:Engine.otherColor(p.color)};
    return attackers(tmp,r,c,p.color);
  }
  // Quân của `color` đang gặp nguy: bị tấn công mà không được bảo vệ, hoặc bị quân rẻ hơn tấn công
  function endangered(board,color){
    const opp=Engine.otherColor(color), out=[];
    for(let r=0;r<10;r++) for(let c=0;c<9;c++){
      const p=board[r][c]; if(!p||p.color!==color||p.type==='G') continue;
      const att=attackers(board,r,c,opp); if(!att.length) continue;
      const def=defenders(board,r,c);
      const cheapest=Math.min(...att.map(a=>VAL[a.type]));
      if(!def.length || cheapest<VAL[p.type]) out.push({type:p.type,at:[r,c],by:att.map(a=>a.type),defended:def.length>0});
    }
    return out.sort((a,b)=>VAL[b.type]-VAL[a.type]);
  }
  const listNames=arr=>[...new Set(arr.map(t=>NAME[t]))].join(', ');

  // Lý do một nước đi là tốt (dùng cho gợi ý và "nước tốt hơn")
  function whyGood(board,move){
    const p=board[move.from[0]][move.from[1]], me=p.color, opp=Engine.otherColor(me);
    const after=Engine.applyMove(board,move);
    const out=[];
    const cap=board[move.to[0]][move.to[1]];
    if(Engine.generateLegalMoves(after,opp).length===0) { out.push('kết thúc ván: đối phương hết nước đi'); return out; }
    if(Engine.isInCheck(after,opp)) out.push('chiếu Tướng, buộc đối phương phải đối phó ngay');
    if(cap) out.push(`ăn ${NAME[cap.type]}${defenders(board,move.to[0],move.to[1]).length?'':' không được bảo vệ'}`);
    // cứu quân đang bị doạ
    const dangerBefore=endangered(board,me), dangerAfter=endangered(after,me);
    const saved=dangerBefore.filter(d=>!dangerAfter.some(x=>x.type===d.type) || (d.at[0]===move.from[0]&&d.at[1]===move.from[1]&&!dangerAfter.some(x=>x.at[0]===move.to[0]&&x.at[1]===move.to[1])));
    if(saved.length && !cap){
      const self=saved.filter(d=>d.at[0]===move.from[0]&&d.at[1]===move.from[1]), other=saved.filter(d=>!(d.at[0]===move.from[0]&&d.at[1]===move.from[1]));
      if(self.length) out.push(`đưa ${listNames(self.map(s=>s.type))} khỏi chỗ bị tấn công`);
      if(other.length) out.push(`bảo vệ/che chắn cho ${listNames(other.map(s=>s.type))} đang bị doạ`);
    }
    // tạo đe doạ mới
    const threatBefore=endangered(board,opp).map(t=>t.at+''), threatAfter=endangered(after,opp).filter(t=>!threatBefore.includes(t.at+''));
    if(threatAfter.length) out.push(`tạo đe doạ lên ${listNames(threatAfter.map(t=>t.type))} của đối phương`);
    if(isHome(p,move.from[0],move.from[1])) out.push(p.type==='R' ? 'đưa Xe ra hoạt động (Xe còn ở góc là lãng phí quân mạnh nhất)' : `phát triển ${NAME[p.type]} ra khỏi vị trí xuất phát`);
    if(p.type!=='A'&&p.type!=='E'&&p.type!=='G' && !crossed(move.from[0],me) && crossed(move.to[0],me) && !cap) out.push(`đưa ${NAME[p.type]} qua sông, gây áp lực lên phần sân đối phương`);
    if(p.type==='C' && move.to[1]===4 && move.from[1]!==4) out.push('đặt Pháo vào cột giữa, nhắm thẳng vào cung Tướng');
    if((p.type==='A'||p.type==='E') && !cap && !saved.length) out.push('củng cố thế phòng thủ quanh cung Tướng');
    return out;
  }
  // Lý do một nước đi là dở, so với thế trước đó
  function whyBad(board,move,reply){
    const p=board[move.from[0]][move.from[1]], me=p.color, opp=Engine.otherColor(me);
    const after=Engine.applyMove(board,move);
    const out=[];
    const dangerBefore=endangered(board,me).map(d=>d.at+'');
    const dangerAfter=endangered(after,me);
    const moved=dangerAfter.find(d=>d.at[0]===move.to[0]&&d.at[1]===move.to[1]);
    if(moved) out.push({key:'moved-into-attack', text:`${NAME[moved.type]} vừa đi tới ô bị ${listNames(moved.by)} đối phương tấn công${moved.defended?' (có quân bảo vệ nhưng bị quân rẻ hơn đổi lấy)':' mà không có quân nào bảo vệ'}`});
    const newHang=dangerAfter.filter(d=>!(d.at[0]===move.to[0]&&d.at[1]===move.to[1]) && !dangerBefore.includes(d.at+''));
    if(newHang.length) out.push({key:'uncovered', text:`nước này làm lộ ${listNames(newHang.map(d=>d.type))}: quân đang che chắn hoặc bảo vệ đã rời đi`});
    const ignored=endangered(board,me).filter(d=>dangerAfter.some(x=>x.at+''===d.at+'') && !(d.at[0]===move.from[0]&&d.at[1]===move.from[1]));
    if(ignored.length) out.push({key:'ignored-threat', text:`${listNames(ignored.map(d=>d.type))} đang bị doạ từ trước mà bạn chưa xử lý`});
    if((p.type==='A'||p.type==='E') && Engine.findGeneral(board,me)){
      // rời vị trí che Tướng khi đối phương có quân tấn công mạnh
      const oppHeavy=board.flat().filter(q=>q&&q.color===opp&&(q.type==='R'||q.type==='H'||q.type==='C')).length;
      if(oppHeavy>=2 && reply && Engine.isInCheck(Engine.applyMove(after,reply),me)) out.push({key:'palace', text:`${NAME[p.type]} rời vị trí làm cung Tướng yếu đi, đối phương có ngay nước chiếu`});
    }
    if(p.type==='G' && !Engine.isInCheck(board,me)) out.push({key:'king-walk', text:'đi Tướng khi không bị chiếu thường làm cung trống trải và phí một nước'});
    // phát triển chậm: còn Xe ở góc mà lại đi quân đã ra rồi (chỉ ở đầu ván)
    const undevelopedRook=[];
    for(let r=0;r<10;r++) for(let c=0;c<9;c++){ const q=board[r][c]; if(q&&q.color===me&&q.type==='R'&&isHome(q,r,c)) undevelopedRook.push([r,c]); }
    if(undevelopedRook.length && !isHome(p,move.from[0],move.from[1]) && p.type!=='R' && !board[move.to[0]][move.to[1]] && countPieces(board)>=26) out.push({key:'slow', text:'còn Xe nằm ở góc mà bạn lại đi một quân đã ra rồi: chậm phát triển'});
    if(reply){
      const rp=after[reply.from[0]][reply.from[1]], victim=after[reply.to[0]][reply.to[1]];
      if(victim && victim.color===me && !out.some(o=>o.key==='moved-into-attack'||o.key==='uncovered'||o.key==='ignored-threat')) out.push({key:'tactic', text:`đối phương có đòn ${NAME[rp.type]} ăn ${NAME[victim.type]}`});
      else if(Engine.isInCheck(Engine.applyMove(after,reply),me) && !out.length) out.push({key:'check', text:`đối phương có nước chiếu ${Notation.describe(after,reply).short} mở ra đòn tấn công`});
    }
    return out;
  }
  function countPieces(b){ let n=0; for(const row of b) for(const q of row) if(q) n++; return n; }
  // Câu hỏi tư duy tương ứng với từng loại lỗi
  const QUESTIONS={
    'moved-into-attack':'Trước khi đặt quân xuống: "Ô này có bị quân nào của đối phương nhắm tới không? Nếu có thì mình có đủ quân bảo vệ không?"',
    'uncovered':'Trước khi đi một quân đang che chắn: "Quân này đang bảo vệ ai? Nó rời đi thì quân nào bị lộ?"',
    'ignored-threat':'Mỗi lượt, hãy bắt đầu bằng câu: "Nước vừa rồi của đối phương đang doạ gì?" rồi xử lý lời doạ trước.',
    'palace':'"Sau nước này, Tướng mình còn đủ Sĩ Tượng che chắn không? Đối phương có nước chiếu nào không?"',
    'king-walk':'"Tướng có thật sự cần đi không, hay mình nên dùng quân khác để phòng thủ?"',
    'slow':'Ở khai cuộc hãy hỏi: "Quân nào của mình chưa ra trận?" Ưu tiên ra Xe và Mã trước khi đi lại quân đã ra.',
    'tactic':'Hãy thử đặt mình vào vị trí đối phương: "Nếu mình là đối phương, nước tốt nhất tiếp theo là gì?"',
    'check':'Luôn kiểm tra: "Sau nước này, đối phương có những nước chiếu nào?"',
    'missed-mate':'Khi Tướng đối phương ít chỗ chạy, hãy xét các nước CHIẾU trước tiên (thứ tự: Chiếu → Ăn → Doạ).',
    'missed-capture':'Mỗi lượt hãy quét một vòng: "Quân nào của đối phương đang không được bảo vệ?"',
    'allowed-mate':'Trước mỗi nước: "Sau nước này, Tướng mình còn ô chạy không? Đối phương có chuỗi chiếu nào?"',
    'positional':'Hỏi: "Quân nào của mình đang kém hoạt động nhất? Nước này có làm nó tốt lên không?"',
  };
  // Quy trình tư duy 5 bước (dùng cho bài học & bảng nhắc cạnh bàn cờ)
  const THINKING_STEPS=[
    ['Đối phương vừa doạ gì?','Nhìn nước vừa đi của đối phương: nó tấn công quân nào, mở đường cho quân nào, có dọa chiếu không?'],
    ['Quân mình có an toàn không?','Quân nào đang bị tấn công mà không được bảo vệ? Quân nào đang che chắn cho Tướng?'],
    ['Có Chiếu – Ăn – Doạ không?','Xét các nước chiếu trước, rồi nước ăn quân, rồi nước tạo đe doạ. Đòn thắng thường nằm ở đây.'],
    ['Quân nào kém hoạt động nhất?','Nếu không có đòn gì, hãy cải thiện quân tệ nhất: ra Xe, nhảy Mã, đưa Pháo vào chỗ có ngòi.'],
    ['Kiểm tra lại trước khi đi','Đặt mình vào vị trí đối phương: sau nước này họ có đòn nào? Nếu có, tìm nước khác.'],
  ];
  // Bước 1 của quy trình tư duy: trước nước đi, bên `me` đang bị doạ gì? (câu ngắn, dễ hiểu)
  function threatText(board,me){
    const opp=Engine.otherColor(me);
    if(Engine.isInCheck(board,me)) return 'Tướng đang bị chiếu, nên việc đầu tiên bắt buộc là giải chiếu.';
    const d=endangered(board,me).slice(0,2);
    if(d.length) return d.map(x=>`${NAME[x.type]} đang bị ${listNames(x.by)} nhắm tới${x.defended?' (có bảo vệ nhưng đối phương đổi bằng quân rẻ hơn thì vẫn lời)':' mà không có quân nào bảo vệ'}`).join('; ')+'.';
    // doạ chiếu: đối phương có nước chiếu nào ăn được quân hoặc chiếu bí?
    const mine=endangered(board,opp);
    if(mine.length) return `Không có lời doạ trực tiếp. Ngược lại, ${NAME[mine[0].type]} của đối phương đang bị bỏ ngỏ — cơ hội để tấn công!`;
    return 'Không có lời doạ trực tiếp, nên có thể chủ động: ra quân, chiếm cột trống hoặc tạo đe doạ.';
  }
  // Mô tả nước đi bằng lời thường
  function plainMove(board,move){
    const why=whyGood(board,move);
    if(why.length) return why.join('; ');
    const p=board[move.from[0]][move.from[1]];
    return `điều ${NAME[p.type]} sang vị trí khác, chưa tạo ra đe doạ trực tiếp nào`;
  }
  return {attackers, defenders, endangered, whyGood, whyBad, threatText, plainMove, QUESTIONS, THINKING_STEPS, NAME};
})();

/*@@WORKER@@*/
