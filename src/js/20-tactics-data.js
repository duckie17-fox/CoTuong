/* =========================================================================
   CHIẾN THUẬT & TÀN CUỘC — dữ liệu
   Dùng chung khung demo với bài học (initLessonDemo).
     goal:'win'   — nước giải phải lãi ít nhất minGain điểm quân sau khi đối phương đáp tốt nhất
     goal:'mate'  — chiếu bí ngay;  goal:'mate2' — ép chiếu bí trong 2 nước
     mode:'endgame' — bạn đi bên tấn công, máy phòng thủ; result 'win' (có lời giải) | 'draw'
   Harness kiểm tra: thế hợp lệ, nước giải hợp lệ và đạt mục tiêu; tàn cuộc thắng có
   chuỗi chiếu bí trong mateIn nước; tàn cuộc hoà thì máy không tìm được chiếu bí.
   ========================================================================= */
const TACTICS = [
  {
    key:'ghim', title:'Ghim quân', han:'牽制',
    text:[
      '<b>Ghim</b> là khi một quân đối phương không dám di chuyển, vì nếu nó đi thì quân quý hơn phía sau (thường là Tướng) sẽ bị ăn hoặc bị chiếu.',
      'Xe và Pháo là hai quân ghim giỏi nhất vì đi theo đường thẳng. Quân bị ghim vào Tướng thì <b>không được phép</b> di chuyển, nên chỉ cần tấn công thêm là ăn được.'
    ],
    demo:{
      board:mkBoard([[9,3,'G',RED],[7,0,'R',RED],[0,4,'G',BLACK],[0,3,'A',BLACK],[0,5,'A',BLACK],[3,4,'H',BLACK]]),
      hero:[[7,0]], toMove:RED, goal:'win', minGain:3, solution:{from:[7,0],to:[7,4]},
      caption:'Mã Đen đứng ngay trước Tướng. Hãy đưa Xe vào ghim và tấn công nó.'
    }
  },
  {
    key:'ghimtuong', title:'Ghim bằng Tướng (lộ mặt)', han:'白臉',
    text:[
      'Nhờ luật lộ mặt Tướng, <b>Tướng của bạn cũng ghim được quân</b>. Nếu chỉ có một quân Đen đứng giữa hai Tướng trên cùng cột, quân đó không được rời cột, vì nó rời đi thì hai Tướng sẽ đối mặt.',
      'Chỉ cần tấn công quân bị ghim đó từ bên cạnh là ăn được. Nhớ đừng tấn công từ trong cột, vì quân của bạn sẽ chắn giữa và gỡ ghim cho đối phương.'
    ],
    demo:{
      board:mkBoard([[9,4,'G',RED],[6,0,'R',RED],[0,4,'G',BLACK],[0,5,'A',BLACK],[4,4,'H',BLACK]]),
      hero:[[6,0]], toMove:RED, goal:'win', minGain:3, solution:{from:[6,0],to:[4,0]},
      caption:'Mã Đen bị Tướng Đỏ ghim trên cột giữa. Tấn công nó bằng Xe từ bên cạnh.'
    }
  },
  {
    key:'batdoi', title:'Bắt đôi (chẻ đôi)', han:'捉雙',
    text:[
      '<b>Bắt đôi</b> là một nước đi đe doạ ăn cùng lúc hai quân. Đối phương chỉ cứu được một quân.',
      'Mã là chuyên gia bắt đôi vì nó tấn công nhiều hướng một lúc. Mạnh nhất là bắt đôi kèm chiếu Tướng, vì đối phương buộc phải giải chiếu trước.'
    ],
    demo:{
      board:mkBoard([[9,4,'G',RED],[6,4,'S',RED],[4,6,'H',RED],[0,4,'G',BLACK],[0,3,'A',BLACK],[3,3,'R',BLACK],[3,8,'S',BLACK]]),
      hero:[[4,6]], toMove:RED, goal:'win', minGain:5, solution:{from:[4,6],to:[2,5]},
      caption:'Tìm ô cho Mã vừa chiếu Tướng vừa nhắm quân Xe.'
    }
  },
  {
    key:'chieurut', title:'Chiếu rút (chiếu mở)', han:'抽將',
    text:[
      '<b>Chiếu rút</b>: quân đứng chắn đường của Xe hoặc Pháo mình rút ra, thế là Xe hoặc Pháo phía sau chiếu Tướng. Quân vừa rút có thể <b>ăn một quân khác</b> cùng lúc.',
      'Đối phương phải lo giải chiếu nên không kịp ăn lại quân vừa rút ra.'
    ],
    demo:{
      board:mkBoard([[9,3,'G',RED],[6,4,'R',RED],[3,4,'H',RED],[0,4,'G',BLACK],[0,3,'A',BLACK],[2,2,'R',BLACK]]),
      hero:[[3,4]], toMove:RED, goal:'win', minGain:7, solution:{from:[3,4],to:[2,2]},
      caption:'Mã đang chắn đường Xe. Rút Mã ra để Xe chiếu, đồng thời để Mã ăn quân.'
    }
  },
  {
    key:'chieudoi', title:'Chiếu đôi', han:'雙將',
    text:[
      '<b>Chiếu đôi</b> là hai quân cùng chiếu Tướng một lúc. Không thể cản hay ăn cả hai cùng lúc, nên cách duy nhất là chạy Tướng.',
      'Nếu Tướng không còn chỗ chạy (ví dụ bị chính Sĩ của mình chặn), chiếu đôi là chiếu bí.'
    ],
    demo:{
      board:mkBoard([[9,3,'G',RED],[6,4,'R',RED],[4,4,'H',RED],[0,4,'G',BLACK],[0,3,'A',BLACK],[0,5,'A',BLACK]]),
      hero:[[4,4]], toMove:RED, goal:'mate', solution:{from:[4,4],to:[2,3]},
      caption:'Nhảy Mã để cả Mã lẫn Xe cùng chiếu: chiếu bí!'
    }
  },
  {
    key:'ruongoi', title:'Rút ngòi Pháo', han:'撤炮架',
    text:[
      'Khi bị Pháo chiếu, ngoài việc chạy Tướng còn có hai cách đặc biệt: <b>rút ngòi</b> (dời quân đang làm ngòi đi chỗ khác) hoặc <b>thêm ngòi</b> (đặt thêm một quân vào giữa để Pháo có 2 ngòi).',
      'Nếu quân làm ngòi là quân của bạn, rút nó ra kèm theo ăn một quân đối phương là cách giải chiếu có lời nhất.'
    ],
    demo:{
      board:mkBoard([[9,4,'G',RED],[9,3,'A',RED],[9,5,'A',RED],[7,4,'H',RED],[2,4,'C',BLACK],[5,5,'R',BLACK],[0,3,'G',BLACK]]),
      hero:[[7,4]], toMove:RED, goal:'win', minGain:7, solution:{from:[7,4],to:[5,5]},
      caption:'Pháo Đen đang chiếu, dùng Mã Đỏ làm ngòi. Hãy rút ngòi để giải chiếu và ăn luôn quân lớn.'
    }
  },
  {
    key:'thiquan', title:'Thí quân để chiếu bí', han:'棄子',
    text:[
      '<b>Thí quân</b> là cố ý cho đối phương ăn một quân của mình để mở đường chiếu bí. Quân bị mất không quan trọng, vì bắt được Tướng là thắng cả ván.',
      'Trước khi thí quân, hãy tính kỹ mọi cách đối phương có thể đáp.'
    ],
    demo:{
      board:mkBoard([[9,3,'G',RED],[2,5,'R',RED],[4,4,'H',RED],[2,1,'S',RED],[0,4,'G',BLACK],[2,3,'A',BLACK],[0,5,'A',BLACK]]),
      hero:[[2,5],[4,4],[2,1]], toMove:RED, goal:'mate2', solution:{from:[2,5],to:[0,5]},
      caption:'Đỏ chiếu bí sau 2 nước, nhưng phải chịu thí một quân lớn. Gợi ý: phá Sĩ để kéo Tướng ra khỏi chỗ trú.',
      explain:'X4.2 thí Xe ăn Sĩ và chiếu. Nếu Tướng Đen ăn Xe (Tg5-6) thì M5.6 chiếu bí; nếu Tướng chạy lên (Tg5.1) thì M5.7 chiếu bí.'
    }
  },
  {
    key:'cantuong', title:'Khống chế đường chạy của Tướng', han:'控將',
    text:[
      'Để chiếu bí, trước hết hãy <b>bịt các ô Tướng có thể chạy tới</b>, rồi mới chiếu. Một Xe ở hàng thứ hai, một Tốt đứng sát cung hay Tướng mình giữ cột giữa đều là những cách khoá rất hiệu quả.',
      'Người mới hay chiếu liên tục mà không khoá đường chạy, khiến Tướng đối phương cứ trốn mãi.'
    ],
    demo:{
      board:mkBoard([[9,5,'G',RED],[1,2,'R',RED],[0,7,'R',RED],[0,4,'G',BLACK],[1,4,'A',BLACK],[0,5,'A',BLACK]]),
      hero:[[9,5],[1,2],[0,7]], toMove:RED, goal:'mate2', solution:{from:[9,5],to:[9,4]},
      caption:'Chiếu bí trong 2 nước. Gợi ý: nước đầu KHÔNG phải nước chiếu, mà là một nước êm khoá đường chạy của Tướng Đen.',
      explain:'Tg4-5! Tướng Đỏ vào cột giữa, khống chế cả cột. Tướng Đen chỉ còn đường Tg5-4, sau đó X7-5 ăn Sĩ chiếu bí.'
    }
  },
];

const ENDGAMES = [
  {
    key:'xedon', title:'Xe đơn thắng Tướng đơn', result:'win', mateIn:2,
    text:['Xe cùng Tướng mình phối hợp thắng dễ dàng: Tướng giữ cột giữa (lộ mặt), Xe đẩy Tướng đối phương về hàng cuối rồi chiếu bí.'],
    demo:{ board:mkBoard([[9,3,'G',RED],[7,0,'R',RED],[1,4,'G',BLACK]]), toMove:RED, mode:'endgame',
      caption:'Bạn cầm Đỏ, máy giữ Đen. Hãy chiếu bí càng nhanh càng tốt.' }
  },
  {
    key:'totcao', title:'Tốt cao thắng Tướng đơn', result:'win', mateIn:3,
    text:['Tốt đã qua sông mà còn ở "cao" (chưa xuống tới hàng cuối), có Tướng mình giữ cột giữa hỗ trợ, thì thắng được Tướng đơn.','Bí quyết: Tốt tiến dần vào cung; Tướng mình khoá cột, không cho Tướng đối phương sang.'],
    demo:{ board:mkBoard([[8,3,'G',RED],[4,4,'S',RED],[1,4,'G',BLACK]]), toMove:RED, mode:'endgame',
      caption:'Tiến Tốt đúng lúc. Chú ý đừng để Tốt xuống hàng cuối quá sớm.' }
  },
  {
    key:'totthap', title:'Tốt đáy (Tốt thấp) chỉ hoà', result:'draw',
    text:['Tốt đã xuống tới <b>hàng cuối</b> chỉ còn đi ngang, không khống chế được các ô trong cung nữa. Một mình Tốt đáy không thắng được Tướng đơn.','Bài học: đừng vội đẩy Tốt xuống đáy. "Tốt cao" mới quý.'],
    demo:{ board:mkBoard([[9,3,'G',RED],[0,0,'S',RED],[1,4,'G',BLACK]]), toMove:RED, mode:'endgame',
      caption:'Thử xem: dù cố gắng thế nào bạn cũng không chiếu bí được.' }
  },
  {
    key:'mato', title:'Mã Tốt thắng Tướng đơn', result:'win', mateIn:3,
    text:['Mã và Tốt phối hợp: Tốt khống chế ô trước mặt Tướng, Mã nhảy vào chiếu. Có Tướng mình giữ cột giữa thì càng nhanh.'],
    demo:{ board:mkBoard([[9,4,'G',RED],[5,2,'H',RED],[3,4,'S',RED],[0,3,'G',BLACK]]), toMove:RED, mode:'endgame',
      caption:'Phối hợp Mã và Tốt để chiếu bí.' }
  },
  {
    key:'madon', title:'Mã đơn thắng Tướng đơn', result:'win', mateIn:3,
    text:['Khác với cờ vua, trong cờ tướng Mã cùng Tướng <b>thắng được</b> Tướng đơn. Lý do là Tướng mình khống chế cả một cột (luật lộ mặt), và bị "vây" không còn nước đi cũng tính là thua.','Kỹ thuật: Mã khống chế các ô quanh Tướng đối phương, Tướng mình chiếm cột bên cạnh để khoá đường.'],
    demo:{ board:mkBoard([[9,4,'G',RED],[5,4,'H',RED],[0,3,'G',BLACK]]), toMove:RED, mode:'endgame',
      caption:'Dùng Mã và cả Tướng của mình để dồn Tướng Đen vào thế hết nước đi.' }
  },
  {
    key:'phaosi', title:'Pháo Sĩ thắng Tướng đơn', result:'win', mateIn:3,
    text:['Pháo cần ngòi để chiếu. Khi chỉ còn Pháo, <b>Sĩ của mình</b> chính là ngòi: đặt Pháo phía sau Sĩ trên cùng cột với Tướng đối phương.','Tướng mình giữ cột giữa để khoá đường chạy.'],
    demo:{ board:mkBoard([[9,4,'G',RED],[8,4,'A',RED],[5,2,'C',RED],[1,3,'G',BLACK]]), toMove:RED, mode:'endgame',
      caption:'Dùng Sĩ làm ngòi cho Pháo để chiếu bí.' }
  },
  {
    key:'phaodon', title:'Pháo đơn chỉ hoà', result:'draw',
    text:['Pháo mà <b>không có ngòi</b> thì không chiếu được. Một mình Pháo với Tướng không thắng được Tướng đơn.','Đây là lý do ở tàn cuộc người ta hay nói: "Pháo cần ngòi, Mã cần Tốt".'],
    demo:{ board:mkBoard([[9,4,'G',RED],[5,2,'C',RED],[1,3,'G',BLACK]]), toMove:RED, mode:'endgame',
      caption:'Thử chiếu bí xem. Pháo không có ngòi nên không bắt được Tướng.' }
  },
  {
    key:'maphao', title:'Mã Pháo thắng Tướng đơn', result:'win', mateIn:3,
    text:['Mã và Pháo là cặp phối hợp mạnh: Mã vừa khống chế ô vừa làm ngòi cho Pháo (thế "Mã hậu Pháo").'],
    demo:{ board:mkBoard([[9,3,'G',RED],[5,2,'H',RED],[6,6,'C',RED],[1,4,'G',BLACK]]), toMove:RED, mode:'endgame',
      caption:'Chiếu bí bằng Mã và Pháo.' }
  },
  {
    key:'xesi', title:'Xe thắng Sĩ đôi', result:'win', mateIn:4,
    text:['Xe đơn thắng được Tướng có hai Sĩ, vì hai Sĩ chặn luôn đường chạy của chính Tướng mình.','Nhưng Xe đơn gặp <b>Sĩ Tượng toàn</b> (đủ 2 Sĩ 2 Tượng) thì theo lý thuyết là hoà: câu "Xe đơn khó phá Sĩ Tượng toàn".'],
    demo:{ board:mkBoard([[9,3,'G',RED],[5,0,'R',RED],[0,4,'G',BLACK],[0,3,'A',BLACK],[0,5,'A',BLACK]]), toMove:RED, mode:'endgame',
      caption:'Tận dụng việc hai Sĩ Đen chắn đường Tướng. Có lúc cần đưa cả Tướng mình vào cột giữa.' }
  },
  {
    key:'xesituong', title:'Xe đơn khó phá Sĩ Tượng toàn', result:'draw',
    text:['Khi đối phương còn đủ <b>2 Sĩ 2 Tượng</b>, một mình Xe (cùng Tướng) theo lý thuyết không thắng được: các quân phòng thủ luân phiên che chắn cho nhau.','Câu cửa miệng "Xe đơn khó phá Sĩ Tượng toàn" nhắc bạn: trước khi đổi quân vào tàn cuộc, hãy tính xem đối phương còn đủ Sĩ Tượng không.'],
    demo:{ board:mkBoard([[9,3,'G',RED],[5,0,'R',RED],[0,4,'G',BLACK],[0,3,'A',BLACK],[0,5,'A',BLACK],[0,2,'E',BLACK],[0,6,'E',BLACK]]), toMove:RED, mode:'endgame',
      caption:'Thử phá thế phòng thủ này. Máy sẽ giữ được hoà.' }
  },
];

/* Tự sinh bởi tools/make-endgames.js từ bảng tàn cuộc — không sửa tay */
/*@@DATA:endgame-theory@@*/

