/* =========================================================================
   BÀI TẬP — topic: mate1 (chiếu bí 1 nước) · mate2 (2 nước) · capture (bắt quân) · fork (bắt đôi)
   Bài có auto:true không có lời giải thích viết tay; giao diện tự sinh lời giải thích
   (Solver.explainMate) từ engine để luôn khớp với thế cờ.
   ========================================================================= */
const PUZZLES = [
  {
    id:'chariot-mate', title:'Xe áp sát', difficulty:1,
    board: mkBoard([[9,4,'G',RED],[1,8,'R',RED],[3,2,'H',RED],[2,5,'H',RED],[0,3,'G',BLACK]]),
    turn:RED, type:'mate', prompt:'Đến lượt Đỏ. Tìm nước chiếu bí trong 1 nước!',
    solution:{from:[1,8],to:[1,3]},
    explain:'Xe áp sát ngay trước mặt Tướng đen nên không có khoảng trống nào để chặn. Tướng không ăn được Xe vì Xe đã có Mã bảo vệ; ô thoát còn lại trong cung bị quân Mã thứ hai khống chế. Tướng hết đường chạy. (Bài này còn vài cách chiếu bí khác; tìm được cách nào cũng tính đúng.)'
  },
  {
    id:'horse-mate', title:'Mã lập công', difficulty:2,
    board: mkBoard([[9,4,'G',RED],[4,4,'H',RED],[2,4,'S',RED],[0,4,'G',BLACK],[0,3,'A',BLACK],[0,5,'A',BLACK]]),
    turn:RED, type:'mate', prompt:'Đến lượt Đỏ. Tìm nước chiếu bí trong 1 nước bằng quân Mã!',
    solution:{from:[4,4],to:[2,3]},
    explain:'Mã nhảy vào chiếu Tướng; 2 Sĩ đen chắn mất 2 ô bên cạnh, còn quân Tốt Đỏ khống chế ô phía trước — Tướng đen hết đường thoát.'
  },
  {
    id:'cannon-mate', title:'Pháo có ngòi', difficulty:3,
    board: mkBoard([[9,4,'G',RED],[5,0,'C',RED],[2,3,'S',RED],[2,5,'H',RED],[0,3,'G',BLACK]]),
    turn:RED, type:'mate', prompt:'Đến lượt Đỏ. Di chuyển Pháo để chiếu bí!',
    solution:{from:[5,0],to:[5,3]},
    explain:'Pháo trượt vào cột của Tướng, dùng quân Tốt làm ngòi để chiếu thẳng vào Tướng — quân Tốt đó cũng chặn luôn đường lùi của Tướng.'
  },
  {
    id:'free-cannon', title:'Ăn Xe miễn phí', difficulty:1,
    board: mkBoard([[9,4,'G',RED],[5,4,'C',RED],[3,4,'H',RED],[0,3,'G',BLACK],[1,4,'R',BLACK]]),
    turn:RED, type:'capture', targetSquare:[1,4],
    prompt:'Đến lượt Đỏ. Có một quân Xe đen đang bị hở — ăn miễn phí!',
    solution:{from:[5,4],to:[1,4]},
    explain:'Pháo Đỏ nhảy qua quân Mã (ngòi) để ăn trọn quân Xe đen — không quân đen nào ăn lại được.'
  },
  {
    id:'free-horse', title:'Mã ăn Pháo', difficulty:1,
    board: mkBoard([[9,4,'G',RED],[5,4,'H',RED],[0,3,'G',BLACK],[3,5,'C',BLACK]]),
    turn:RED, type:'capture', targetSquare:[3,5],
    prompt:'Đến lượt Đỏ. Quân Pháo đen không có ai bảo vệ — tìm nước ăn quân!',
    solution:{from:[5,4],to:[3,5]},
    explain:'Mã nhảy chữ L để ăn thẳng quân Pháo đen đang bỏ ngỏ.'
  },
  {
    id:'fork-horse', title:'Mã chẻ đôi', difficulty:2,
    board: mkBoard([[9,4,'G',RED],[6,4,'S',RED],[4,2,'H',RED],[0,4,'G',BLACK],[0,5,'A',BLACK],[3,5,'R',BLACK],[3,0,'S',BLACK]]),
    turn:RED, type:'fork', targetSquare:[2,3],
    prompt:'Đến lượt Đỏ. Tìm 1 nước Mã vừa chiếu Tướng vừa đe doạ ăn Xe đen!',
    solution:{from:[4,2],to:[2,3]},
    explain:'Mã nhảy vào chiếu Tướng và cùng lúc nhắm quân Xe ("chẻ đôi"). Đen bắt buộc phải lo giải chiếu trước, nên nước sau Mã ăn Xe miễn phí. Nước chiếu kèm bắt quân là đòn chẻ đôi mạnh nhất vì đối phương không có thời gian cứu quân.'
  },
  {
    id:'chariot-elephant', title:'Xe bắt Tượng lạc', difficulty:1,
    board: mkBoard([[9,3,'G',RED],[4,0,'R',RED],[0,4,'G',BLACK],[4,6,'E',BLACK]]),
    turn:RED, type:'capture', targetSquare:[4,6],
    prompt:'Đến lượt Đỏ. Có một quân Tượng đen bỏ ngỏ trên cùng hàng với Xe — ăn ngay!',
    solution:{from:[4,0],to:[4,6]},
    explain:'Xe trượt ngang theo hàng ngang, ăn trọn quân Tượng đen đang không có quân nào bảo vệ.'
  },
  {
    id:'twin-chariot-mate', title:'Song xa phối hợp', difficulty:2,
    board: mkBoard([[9,5,'G',RED],[5,0,'R',RED],[8,3,'R',RED],[0,4,'G',BLACK]]),
    turn:RED, type:'mate', prompt:'Đến lượt Đỏ. Hai Xe phối hợp — tìm nước chiếu bí!',
    solution:{from:[5,0],to:[5,4]},
    explain:'Xe ở hàng 5 tiến sang cột 4, chiếu thẳng vào Tướng đen. Tướng không thể lùi vì vẫn ở trên cột bị chiếu; không sang cột 3 vì Xe còn lại đã khống chế sẵn; không sang cột 5 vì sẽ phạm luật "lộ mặt Tướng" (đối mặt trực tiếp với Tướng Đỏ). Hết đường thoát!'
  },
  {
    id:'chariot-fork', title:'Xe chẻ đôi', difficulty:2,
    board: mkBoard([[9,3,'G',RED],[5,1,'R',RED],[0,4,'G',BLACK],[5,6,'H',BLACK],[2,4,'C',BLACK]]),
    turn:RED, type:'fork', targetSquare:[5,4],
    prompt:'Đến lượt Đỏ. Tìm 1 nước đi khiến Xe đe doạ cùng lúc cả Mã và Pháo đen!',
    solution:{from:[5,1],to:[5,4]},
    explain:'Xe tiến vào giữa: cùng lúc uy hiếp quân Mã trên cùng hàng và quân Pháo trên cùng cột — đối phương không cứu được cả hai.'
  },
  {
    id:'soldier-mate', title:'Tốt qua sông lập công', difficulty:2,
    board: mkBoard([[9,3,'G',RED],[2,4,'S',RED],[2,2,'H',RED],[2,6,'H',RED],[0,4,'G',BLACK]]),
    turn:RED, type:'mate', prompt:'Đến lượt Đỏ. Tốt đã qua sông — tìm nước chiếu bí!',
    solution:{from:[2,4],to:[1,4]},
    explain:'Tốt tiến thêm một bước, đứng ngay trước mặt Tướng để chiếu. Hai Mã hai bên đã khống chế sẵn hai ô thoát duy nhất trong cung — Tướng đen hết đường chạy.'
  },
  {
    id:'cannon-screen-mate', title:'Pháo mượn ngòi', difficulty:3,
    board: mkBoard([[9,3,'G',RED],[9,5,'A',RED],[6,0,'C',RED],[2,4,'H',RED],[0,4,'G',BLACK],[0,2,'E',BLACK],[3,0,'S',BLACK]]),
    turn:RED, type:'mate', prompt:'Đến lượt Đỏ. Đưa Pháo vào đúng cột, mượn quân Mã làm ngòi để chiếu bí!',
    solution:{from:[6,0],to:[6,4]},
    explain:'Pháo trượt ngang vào cột giữa, mượn chính quân Mã của mình làm ngòi để chiếu thẳng Tướng đen. Quân Mã vừa làm ngòi vừa khống chế cả hai ô thoát ngang của Tướng; nếu Tướng tiến lên thì vẫn nằm trên đường Pháo. Đây chính là thế sát cục kinh điển "Mã hậu Pháo" (Mã đứng trước, Pháo ở phía sau).'
  },
  {
    id:'cannon-fork', title:'Pháo hai ngòi', difficulty:3,
    board: mkBoard([[9,4,'G',RED],[9,3,'A',RED],[9,5,'A',RED],[9,2,'E',RED],[9,6,'E',RED],[7,3,'C',RED],
                    [0,4,'G',BLACK],[0,3,'A',BLACK],[0,5,'A',BLACK],[0,2,'E',BLACK],[0,6,'E',BLACK],
                    [4,2,'S',BLACK],[4,4,'S',BLACK],[4,0,'H',BLACK],[4,7,'R',BLACK]]),
    turn:RED, type:'fork', targetSquare:[4,3],
    prompt:'Đến lượt Đỏ. Tìm ô đứng để Pháo cùng lúc mượn 2 ngòi, đe doạ cả Xe lẫn Mã đen!',
    solution:{from:[7,3],to:[4,3]},
    explain:'Pháo tiến thẳng lên sông, đứng giữa hai quân Tốt đen. Sang trái, Pháo mượn Tốt làm ngòi để nhắm quân Mã; sang phải, mượn Tốt còn lại để nhắm quân Xe. Tốt chưa qua sông không đi ngang được nên không ăn được Pháo, và đen chỉ cứu được một trong hai quân.'
  },

  /* ---- Bài sinh bằng máy tìm kiếm (test/gen), đã kiểm tra lời giải là duy nhất; lời giải thích tự sinh từ engine ---- */
  {
    id:'g01', title:'Trùng Pháo cột bốn', difficulty:2, auto:true,
    board: mkBoard([[9,4,'G',RED],[1,3,'G',BLACK],[0,5,'A',BLACK],[4,2,'E',BLACK],[7,3,'C',RED],[6,2,'C',RED],[4,0,'S',RED]]),
    turn:RED, type:'mate', prompt:'Đến lượt Đỏ. Tìm nước chiếu bí ngay!',
    solution:{from:[6,2],to:[6,3]},
  },
  {
    id:'g02', title:'Tốt làm ngòi', difficulty:2, auto:true,
    board: mkBoard([[9,3,'G',RED],[2,3,'G',BLACK],[2,5,'A',BLACK],[2,8,'E',BLACK],[2,4,'E',BLACK],[6,7,'C',RED],[4,3,'S',RED]]),
    turn:RED, type:'mate', prompt:'Đến lượt Đỏ. Tìm nước chiếu bí ngay!',
    solution:{from:[6,7],to:[6,3]},
  },
  {
    id:'g03', title:'Pháo sau lưng Tốt', difficulty:1, auto:true,
    board: mkBoard([[0,4,'G',BLACK],[9,3,'G',RED],[5,6,'E',RED],[3,7,'C',RED],[4,7,'C',BLACK],[6,3,'S',BLACK]]),
    turn:BLACK, type:'mate', prompt:'Đến lượt Đen. Tìm nước chiếu bí ngay!',
    solution:{from:[4,7],to:[4,3]},
  },
  {
    id:'g04', title:'Mã rút làm ngòi', difficulty:3, auto:true,
    board: mkBoard([[9,4,'G',RED],[1,5,'G',BLACK],[2,5,'A',BLACK],[0,5,'A',BLACK],[5,3,'C',BLACK],[2,6,'H',RED],[5,8,'C',RED]]),
    turn:RED, type:'mate', prompt:'Đến lượt Đỏ. Tìm nước chiếu bí ngay!',
    solution:{from:[2,6],to:[0,7]},
  },
  {
    id:'g05', title:'Sĩ chắn đường lui', difficulty:2, auto:true,
    board: mkBoard([[9,3,'G',RED],[1,5,'G',BLACK],[2,5,'A',BLACK],[1,4,'A',BLACK],[4,2,'E',BLACK],[0,6,'E',BLACK],[6,1,'H',RED],[6,2,'C',RED]]),
    turn:RED, type:'mate', prompt:'Đến lượt Đỏ. Tìm nước chiếu bí ngay!',
    solution:{from:[6,2],to:[6,5]},
  },
  {
    id:'g06', title:'Mã Tốt vây Tướng', difficulty:2, auto:true,
    board: mkBoard([[9,5,'G',RED],[2,4,'G',BLACK],[1,4,'A',BLACK],[2,3,'A',BLACK],[4,8,'H',RED],[1,3,'S',RED]]),
    turn:RED, type:'mate', prompt:'Đến lượt Đỏ. Tìm nước chiếu bí ngay!',
    solution:{from:[4,8],to:[3,6]},
  },
  {
    id:'g07', title:'Tốt áp sát', difficulty:2, auto:true,
    board: mkBoard([[0,4,'G',BLACK],[7,3,'G',RED],[5,2,'E',RED],[7,8,'E',RED],[9,1,'H',BLACK],[7,1,'S',BLACK]]),
    turn:BLACK, type:'mate', prompt:'Đến lượt Đen. Tìm nước chiếu bí ngay!',
    solution:{from:[7,1],to:[7,2]},
  },
  {
    id:'g08', title:'Xe Pháo cùng cột', difficulty:1, auto:true,
    board: mkBoard([[9,4,'G',RED],[1,3,'G',BLACK],[0,5,'A',BLACK],[4,6,'E',BLACK],[6,5,'R',RED],[1,1,'C',RED]]),
    turn:RED, type:'mate', prompt:'Đến lượt Đỏ. Tìm nước chiếu bí ngay!',
    solution:{from:[6,5],to:[6,3]},
  },
  {
    id:'g09', title:'Xe nhường ngòi cho Pháo', difficulty:2, auto:true,
    board: mkBoard([[9,4,'G',RED],[0,3,'G',BLACK],[0,2,'E',BLACK],[6,1,'C',BLACK],[5,5,'R',RED],[5,7,'C',RED]]),
    turn:RED, type:'mate', prompt:'Đến lượt Đỏ. Tìm nước chiếu bí ngay!',
    solution:{from:[5,5],to:[5,3]},
  },
  {
    id:'g10', title:'Xe Mã phối hợp', difficulty:1, auto:true,
    board: mkBoard([[0,4,'G',BLACK],[9,3,'G',RED],[5,6,'E',RED],[7,4,'E',RED],[3,2,'R',BLACK],[8,2,'H',BLACK]]),
    turn:BLACK, type:'mate', prompt:'Đến lượt Đen. Tìm nước chiếu bí ngay!',
    solution:{from:[3,2],to:[3,3]},
  },
  {
    id:'g11', title:'Xe chặn cột', difficulty:1, auto:true,
    board: mkBoard([[9,4,'G',RED],[2,5,'G',BLACK],[1,4,'A',BLACK],[6,0,'R',RED],[5,1,'H',RED]]),
    turn:RED, type:'mate', prompt:'Đến lượt Đỏ. Tìm nước chiếu bí ngay!',
    solution:{from:[6,0],to:[6,5]},
  },
  {
    id:'g12', title:'Mã tiến làm ngòi', difficulty:3, auto:true,
    board: mkBoard([[9,3,'G',RED],[0,5,'G',BLACK],[6,2,'C',RED],[5,3,'H',RED],[1,8,'S',RED]]),
    turn:RED, type:'mate2', prompt:'Đến lượt Đỏ. Chiếu bí trong 2 nước (đối phương đỡ thế nào cũng thua).',
    solution:{from:[5,3],to:[3,4]},
  },
  {
    id:'g13', title:'Mã phá Sĩ', difficulty:3, auto:true,
    board: mkBoard([[9,5,'G',RED],[0,4,'G',BLACK],[0,5,'A',BLACK],[2,4,'H',RED],[5,7,'C',RED],[3,6,'S',RED]]),
    turn:RED, type:'mate2', prompt:'Đến lượt Đỏ. Chiếu bí trong 2 nước (đối phương đỡ thế nào cũng thua).',
    solution:{from:[2,4],to:[0,5]},
  },
  {
    id:'g14', title:'Tốt vào cung', difficulty:2, auto:true,
    board: mkBoard([[9,4,'G',RED],[0,3,'G',BLACK],[4,6,'E',BLACK],[0,2,'E',BLACK],[0,1,'H',RED],[3,1,'C',RED],[2,4,'S',RED]]),
    turn:RED, type:'mate2', prompt:'Đến lượt Đỏ. Chiếu bí trong 2 nước (đối phương đỡ thế nào cũng thua).',
    solution:{from:[2,4],to:[1,4]},
  },
  {
    id:'g15', title:'Xe ép Mã cản', difficulty:3, auto:true,
    board: mkBoard([[9,5,'G',RED],[2,4,'G',BLACK],[1,4,'A',BLACK],[2,3,'A',BLACK],[5,3,'H',BLACK],[4,0,'R',RED],[7,3,'C',RED]]),
    turn:RED, type:'mate2', prompt:'Đến lượt Đỏ. Chiếu bí trong 2 nước (đối phương đỡ thế nào cũng thua).',
    solution:{from:[4,0],to:[4,4]},
  },
  {
    id:'g16', title:'Tướng vào trận', difficulty:3, auto:true,
    board: mkBoard([[0,5,'G',BLACK],[7,3,'G',RED],[9,2,'E',RED],[5,6,'R',BLACK],[5,7,'C',BLACK]]),
    turn:BLACK, type:'mate2', prompt:'Đến lượt Đen. Chiếu bí trong 2 nước (đối phương đỡ thế nào cũng thua).',
    solution:{from:[0,5],to:[0,4]},
  },
  {
    id:'g17', title:'Mã khoá, Xe chiếu', difficulty:2, auto:true,
    board: mkBoard([[9,5,'G',RED],[2,3,'G',BLACK],[2,0,'E',BLACK],[4,0,'R',RED],[4,3,'H',RED]]),
    turn:RED, type:'mate2', prompt:'Đến lượt Đỏ. Chiếu bí trong 2 nước (đối phương đỡ thế nào cũng thua).',
    solution:{from:[4,3],to:[3,5]},
  },
  {
    id:'g18', title:'Xe dồn Tướng', difficulty:2, auto:true,
    board: mkBoard([[9,4,'G',RED],[1,3,'G',BLACK],[2,3,'A',BLACK],[4,0,'R',RED],[4,1,'H',RED]]),
    turn:RED, type:'mate2', prompt:'Đến lượt Đỏ. Chiếu bí trong 2 nước (đối phương đỡ thế nào cũng thua).',
    solution:{from:[4,0],to:[1,0]},
  },
  {
    id:'g19', title:'Song Xa đuổi Tướng', difficulty:2, auto:true,
    board: mkBoard([[9,4,'G',RED],[0,4,'G',BLACK],[0,3,'A',BLACK],[4,6,'E',BLACK],[2,4,'E',BLACK],[6,8,'R',RED],[6,0,'R',RED]]),
    turn:RED, type:'mate2', prompt:'Đến lượt Đỏ. Chiếu bí trong 2 nước (đối phương đỡ thế nào cũng thua).',
    solution:{from:[6,8],to:[0,8]},
  },
  {
    id:'g20', title:'Xe Tốt ép cung', difficulty:2, auto:true,
    board: mkBoard([[0,3,'G',BLACK],[7,4,'G',RED],[8,4,'A',RED],[5,6,'R',BLACK],[5,3,'S',BLACK]]),
    turn:BLACK, type:'mate2', prompt:'Đến lượt Đen. Chiếu bí trong 2 nước (đối phương đỡ thế nào cũng thua).',
    solution:{from:[5,6],to:[5,4]},
  },
];

const PUZZLE_TOPICS = {mate1:'Chiếu bí 1 nước', mate2:'Chiếu bí 2 nước', mate3:'Chiếu bí 3 nước', capture:'Bắt quân', fork:'Bắt đôi', defend:'Tìm nước cứu', satcuc:'Sát cục'};
// Bài sinh từ thế cờ thật (máy tự đánh), đã kiểm bằng engine — xem tools/gen-puzzles.js, tools/make-puzzles.js
if(typeof PUZZLES_GEN!=='undefined') PUZZLES_GEN.forEach(g=>PUZZLES.push({
  id:g.id, title:g.title, difficulty:g.difficulty, auto:true, gen:true,
  board:mkBoard(g.pieces.map(q=>[q[0],q[1],q[2],q[3]])), turn:g.turn, type:g.type, prompt:g.prompt,
  solution:{from:[g.sol[0],g.sol[1]],to:[g.sol[2],g.sol[3]]}, minGain:g.minGain, line:g.line }));
PUZZLES.forEach(p=>{ p.topic = p.topic || ({mate:'mate1',mate2:'mate2',mate3:'mate3',capture:'capture',fork:'fork',defend:'defend'})[p.type]; });

