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
  // Gọi tên quân kèm vị trí để người học tìm được trên bàn: "Tốt cột 7" (cột tính theo bên sở hữu quân)
  const where=(d,color)=>`${NAME[d.type]} cột ${Notation.fileOf(d.at[1],color)}`;
  const listWhere=(arr,color)=>[...new Set(arr.map(d=>where(d,color)))].join(', ');

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
      if(self.length) out.push(`đưa ${listWhere(self,me)} khỏi chỗ bị tấn công`);
      if(other.length) out.push(`bảo vệ/che chắn cho ${listWhere(other,me)} đang bị doạ`);
    }
    // tạo đe doạ mới
    const threatBefore=endangered(board,opp).map(t=>t.at+''), threatAfter=endangered(after,opp).filter(t=>!threatBefore.includes(t.at+''));
    if(threatAfter.length) out.push(`tạo đe doạ lên ${listWhere(threatAfter,opp)} của đối phương`);
    if(isHome(p,move.from[0],move.from[1])) out.push(p.type==='R' ? 'đưa Xe ra hoạt động (Xe còn ở góc là lãng phí quân mạnh nhất)' : `phát triển ${NAME[p.type]} ra khỏi vị trí xuất phát`);
    if(p.type!=='A'&&p.type!=='E'&&p.type!=='G' && !crossed(move.from[0],me) && crossed(move.to[0],me) && !cap) out.push(`đưa ${NAME[p.type]} qua sông, gây áp lực lên phần sân đối phương`);
    if(p.type==='C' && move.to[1]===4 && move.from[1]!==4) out.push('đặt Pháo vào cột giữa, nhắm thẳng vào cung Tướng');
    if((p.type==='A'||p.type==='E') && !cap && !saved.length) out.push('củng cố thế phòng thủ quanh cung Tướng');
    return out;
  }
  // Ý đồ của một nước: mỗi mục có MỤC ĐÍCH (nước này nhằm làm gì) và CÁCH NGHĨ (nhìn thấy gì
  // trên bàn thì nghĩ tới nước này). Xếp theo mức quan trọng; dùng để giải thích "vì sao nên đi".
  function intent(board,move){
    const p=board[move.from[0]][move.from[1]], me=p.color, opp=Engine.otherColor(me);
    // "Mã Đen cột 7": kèm màu vì mỗi bên đánh số cột từ phía mình
    const where=(d,color)=>`${NAME[d.type]} ${color==='red'?'Đỏ':'Đen'} cột ${Notation.fileOf(d.at[1],color)}`;
    const listWhere=(arr,color)=>[...new Set(arr.map(d=>where(d,color)))].join(', ');
    const after=Engine.applyMove(board,move), out=[];
    const add=(key,goal,think)=>out.push({key,goal,think});
    if(Engine.generateLegalMoves(after,opp).length===0){
      add('mate','kết thúc ván: đối phương hết nước đi (chiếu bí)','Khi Tướng đối phương bị dồn, hãy xét các nước CHIẾU trước tiên và đếm xem sau mỗi nước chiếu Tướng còn ô nào để chạy.');
      return out;
    }
    const cap=board[move.to[0]][move.to[1]];
    if(cap){
      const victim=where({type:cap.type,at:move.to},opp), defended=defenders(board,move.to[0],move.to[1]).length>0;
      if(!defended) add('capture-free',`lấy ${victim} miễn phí — quân này không có quân nào bảo vệ`,'Mỗi lượt quét một vòng các quân đối phương: quân nào mình đang nhắm tới mà không được bảo vệ thì ăn được ngay, không phải trả giá.');
      else if(VAL[cap.type]>VAL[p.type]) add('capture-trade',`đổi có lời: ${NAME[p.type]} ăn ${victim}, dù bị ăn lại vẫn lãi (${NAME[cap.type]} giá trị hơn ${NAME[p.type]})`,'Khi hai bên có thể ăn qua lại, so giá trị: Xe ≈ 9, Pháo ≈ 4,5, Mã ≈ 4, Sĩ/Tượng ≈ 2, Tốt ≈ 1. Đổi quân rẻ lấy quân đắt là có lời.');
      else add('capture',`ăn ${victim}`,'Trước khi ăn, tự hỏi: quân mình có bị ăn lại không, và nếu bị ăn lại thì phép đổi này có lời không?');
    }
    if(Engine.isInCheck(after,opp)) add('check','chiếu Tướng: đối phương buộc phải đối phó ngay nên không kịp thực hiện ý định của họ','Xét các nước chiếu trước: chiếu có ích khi sau đó mình ăn được quân, đẩy Tướng ra chỗ hở, hoặc có nước chiếu tiếp theo.');
    const dangerBefore=endangered(board,me), dangerAfter=endangered(after,me);
    const saved=dangerBefore.filter(d=>!dangerAfter.some(x=>x.at+''===d.at+'') && !(d.at[0]===move.from[0]&&d.at[1]===move.from[1] && dangerAfter.some(x=>x.at[0]===move.to[0]&&x.at[1]===move.to[1])));
    if(saved.length && !cap) add('save',`cứu ${listWhere(saved,me)} đang bị ${listNames(saved.flatMap(d=>d.by))} doạ`,'Câu hỏi đầu tiên mỗi lượt: "Nước vừa rồi của đối phương doạ gì?" Có lời doạ thì xử lý trước — chạy quân, thêm quân bảo vệ hoặc chặn đường tấn công.');
    const threatBefore=endangered(board,opp).map(t=>t.at+''), threatNew=endangered(after,opp).filter(t=>!threatBefore.includes(t.at+''));
    if(threatNew.length>=2) add('fork',`bắt đôi: cùng lúc doạ ${listWhere(threatNew,opp)} — đối phương chỉ cứu được một`,'Tìm ô mà từ đó một quân của mình nhắm được HAI mục tiêu không được bảo vệ (hoặc một mục tiêu kèm nước chiếu).');
    else if(threatNew.length) add('threat',`doạ ${listWhere(threatNew,opp)}: buộc đối phương phải lo phòng thủ thay vì tấn công`,'Khi không có gì phải đỡ, hãy đi nước có mục tiêu cụ thể: doạ một quân yếu để giữ thế chủ động.');
    if(isHome(p,move.from[0],move.from[1])) add(p.type==='R'?'rook-out':'develop', p.type==='R'?'đưa Xe ra trận: Xe là quân mạnh nhất, nằm ở góc thì không làm được gì':`đưa ${NAME[p.type]} ra khỏi vị trí xuất phát để tham gia trận đấu`,'Ở khai cuộc, mỗi nước nên đưa thêm một quân vào trận (Xe, Mã, Pháo) thay vì đi lại quân đã ra.');
    if(p.type==='C' && move.to[1]===4 && move.from[1]!==4) add('center-cannon','đặt Pháo vào cột giữa, nhắm thẳng vào cung Tướng','Pháo đầu buộc đối phương phải giữ Tốt đầu và che cung; đây là cách gây sức ép phổ biến nhất.');
    if(p.type!=='A'&&p.type!=='E'&&p.type!=='G' && !crossed(move.from[0],me) && crossed(move.to[0],me) && !cap) add('cross',`đưa ${NAME[p.type]} qua sông, gây áp lực lên phần sân đối phương`,'Quân qua sông mới doạ được quân và Tướng đối phương; nhưng chỉ nên qua khi quân đó không bị đuổi ngay hoặc có quân bảo vệ.');
    if((p.type==='A'||p.type==='E') && !cap && !saved.length) add('defense','củng cố thế phòng thủ quanh cung Tướng','Khi đối phương dồn nhiều quân về phía cung mình, Sĩ Tượng đứng đúng chỗ giúp Tướng không bị chiếu bí.');
    return out;
  }
  // Lý do một nước đi là dở, so với thế trước đó
  // ctx.ply (tuỳ chọn): số nửa nước đã đi — để chỉ nhắc "chậm ra Xe" ở khai cuộc
  function whyBad(board,move,reply,ctx){
    const p=board[move.from[0]][move.from[1]], me=p.color, opp=Engine.otherColor(me);
    const after=Engine.applyMove(board,move);
    const out=[];
    const dangerBefore=endangered(board,me).map(d=>d.at+'');
    const dangerAfter=endangered(after,me);
    const moved=dangerAfter.find(d=>d.at[0]===move.to[0]&&d.at[1]===move.to[1]);
    if(moved) out.push({key:'moved-into-attack', text:`${where(moved,me)} vừa đi tới ô bị ${listNames(moved.by)} đối phương tấn công${moved.defended?' (có quân bảo vệ nhưng bị quân rẻ hơn đổi lấy)':' mà không có quân nào bảo vệ'}`});
    const newHang=dangerAfter.filter(d=>!(d.at[0]===move.to[0]&&d.at[1]===move.to[1]) && !dangerBefore.includes(d.at+''));
    if(newHang.length) out.push({key:'uncovered', text:`nước này làm lộ ${listWhere(newHang,me)} (bị ${listNames(newHang.flatMap(d=>d.by))} nhắm tới): quân đang che chắn hoặc bảo vệ đã rời đi`});
    const ignored=endangered(board,me).filter(d=>dangerAfter.some(x=>x.at+''===d.at+'') && !(d.at[0]===move.from[0]&&d.at[1]===move.from[1]));
    if(ignored.length) out.push({key:'ignored-threat', text:`${listWhere(ignored,me)} đang bị ${listNames(ignored.flatMap(d=>d.by))} doạ từ trước mà bạn chưa xử lý`});
    if((p.type==='A'||p.type==='E') && Engine.findGeneral(board,me)){
      // rời vị trí che Tướng khi đối phương có quân tấn công mạnh
      const oppHeavy=board.flat().filter(q=>q&&q.color===opp&&(q.type==='R'||q.type==='H'||q.type==='C')).length;
      if(oppHeavy>=2 && reply && Engine.isInCheck(Engine.applyMove(after,reply),me)) out.push({key:'palace', text:`${NAME[p.type]} rời vị trí làm cung Tướng yếu đi, đối phương có ngay nước chiếu`});
    }
    if(p.type==='G' && !Engine.isInCheck(board,me)) out.push({key:'king-walk', text:'đi Tướng khi không bị chiếu thường làm cung trống trải và phí một nước'});
    // phát triển chậm: còn Xe ở góc mà lại đi quân đã ra rồi (chỉ ở đầu ván)
    const undevelopedRook=[];
    for(let r=0;r<10;r++) for(let c=0;c<9;c++){ const q=board[r][c]; if(q&&q.color===me&&q.type==='R'&&isHome(q,r,c)) undevelopedRook.push([r,c]); }
    if(undevelopedRook.length && !isHome(p,move.from[0],move.from[1]) && p.type!=='R' && !board[move.to[0]][move.to[1]] && countPieces(board)>=26 && (!ctx || ctx.ply==null || ctx.ply<24)) out.push({key:'slow', text:'còn Xe nằm ở góc mà bạn lại đi một quân đã ra rồi: chậm phát triển'});
    if(reply){
      const rp=after[reply.from[0]][reply.from[1]], victim=after[reply.to[0]][reply.to[1]];
      if(victim && victim.color===me && !out.some(o=>o.key==='moved-into-attack'||o.key==='uncovered'||o.key==='ignored-threat')) out.push({key:'tactic', text:`đối phương có đòn ${Notation.describe(after,reply).short}: ${NAME[rp.type]} ăn ${where({type:victim.type,at:reply.to},me)} của bạn`});
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
    if(d.length) return d.map(x=>`${where(x,me)} (${me==='red'?'Đỏ':'Đen'}) của bạn đang bị ${listNames(x.by)} đối phương nhắm tới${x.defended?' (có bảo vệ nhưng đối phương đổi bằng quân rẻ hơn thì vẫn lời)':' mà không có quân nào bảo vệ'}`).join('; ')+'.';
    // doạ chiếu: đối phương có nước chiếu nào ăn được quân hoặc chiếu bí?
    const mine=endangered(board,opp);
    if(mine.length) return `Không có lời doạ trực tiếp. Ngược lại, ${where(mine[0],opp)} của đối phương đang bị bỏ ngỏ — cơ hội để tấn công!`;
    return 'Không có lời doạ trực tiếp, nên có thể chủ động: ra quân, chiếm cột trống hoặc tạo đe doạ.';
  }
  // Mô tả nước đi bằng lời thường
  function plainMove(board,move){
    const why=whyGood(board,move);
    if(why.length) return why.join('; ');
    const p=board[move.from[0]][move.from[1]];
    return `nước chuyển quân thầm lặng: không ăn quân, không chiếu, không cứu quân nào và chưa tạo đe doạ gì`;
  }
  return {attackers, defenders, endangered, whyGood, whyBad, intent, threatText, plainMove, QUESTIONS, THINKING_STEPS, NAME};
})();

