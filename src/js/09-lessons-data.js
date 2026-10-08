/* =========================================================================
   BÀI HỌC — lộ trình Nhập môn → Sơ cấp → Trung cấp → Tham khảo
   Mỗi demo là một bàn cờ nhỏ. Các trường kiểm tra được harness đối chiếu với engine:
     expect:{'r,c':n}          quân ở (r,c) có đúng n nước hợp lệ
     expectCaptures:{'r,c':[]} quân ở (r,c) ăn được đúng các ô này
     expectStatus               trạng thái của bên toMove: 'check' | 'checkmate'
     solution                   nước giải của demo goal:'mate' (phải chiếu bí)
   mode: 'hero' (chỉ đi các quân trong hero, mặc định) · 'free' (đi mọi quân, luân phiên,
         hiện ký hiệu) · 'game' (luân phiên, xử kết quả theo luật trong game.js)
   goal: 'escape' (thoát chiếu) · 'mate' (tìm nước chiếu bí)
   ========================================================================= */
const LESSON_LEVELS = [
  {id:1, name:'Nhập môn', desc:'Bàn cờ, cách đi của 7 loại quân, ký hiệu và luật.'},
  {id:2, name:'Sơ cấp', desc:'Nguyên tắc khai cuộc và cách xử lý khi bị chiếu.'},
  {id:3, name:'Trung cấp', desc:'Các thế chiếu bí (sát cục) kinh điển cần thuộc lòng.'},
  {id:4, name:'Tham khảo', desc:'Hệ thống đẳng cấp kỳ thủ và cấp độ của máy.'},
];

const LESSONS = [
  /* ============================ NHẬP MÔN ============================ */
  {
    key:'tuong', level:1, type:'G', title:'Tướng', han:'帥 / 將',
    text:[
      'Tướng (帥 bên Đỏ, 將 bên Đen) là quân quan trọng nhất: bị chiếu bí là thua cả ván.',
      'Tướng chỉ đi <b>1 bước theo đường ngang hoặc dọc</b> mỗi lượt và không bao giờ được rời khỏi <b>cung</b> (ô vuông 3×3 có vẽ chữ X).',
      'Luật "lộ mặt Tướng": hai Tướng <b>không được đứng đối mặt</b> trên cùng một cột mà giữa không có quân nào. Nước đi tạo ra thế đó là nước không hợp lệ. Nhờ luật này, Tướng cũng góp sức tấn công, vì nó khống chế cả cột mình đang đứng.'
    ],
    demos:[{
      board:mkBoard([[9,3,'G',RED],[0,5,'G',BLACK]]),
      hero:[[9,3]], expect:{'9,3':2},
      caption:'Tướng Đỏ ở góc cung: chạm vào để thấy 2 nước đi được.'
    },{
      board:mkBoard([[9,3,'G',RED],[0,4,'G',BLACK],[8,3,'H',RED]]),
      hero:[[9,3]], expect:{'9,3':0},
      caption:'Tướng Đỏ không bước sang cột giữa được (sẽ đối mặt Tướng Đen), cũng không tiến lên được vì Mã của mình đang đứng đó. Chạm thử để thấy không còn nước nào.'
    }]
  },
  {
    key:'si', level:1, type:'A', title:'Sĩ', han:'仕 / 士',
    text:[
      'Sĩ đi <b>1 bước theo đường chéo</b> và cũng không bao giờ rời khỏi cung.',
      'Cung chỉ có 5 điểm nằm trên 2 đường chéo (4 góc và tâm), nên Sĩ chỉ đi qua lại giữa 5 điểm này để che chắn cho Tướng.'
    ],
    demos:[{
      board:mkBoard([[9,4,'G',RED],[8,4,'A',RED],[0,3,'G',BLACK]]),
      hero:[[8,4]], expect:{'8,4':4},
      caption:'Sĩ Đỏ ở tâm cung: chạm vào để thấy cả 4 hướng chéo.'
    }]
  },
  {
    key:'tuong2', level:1, type:'E', title:'Tượng', han:'相 / 象',
    text:[
      'Tượng đi <b>chéo 2 ô</b> mỗi lần, tức đi theo đường chéo của một hình vuông 2×2 (giống chữ "điền" 田).',
      'Tượng <b>không bao giờ được qua sông</b>, luôn ở lại sân nhà để phòng thủ. Vì vậy mỗi bên chỉ có đúng <b>7 điểm</b> mà Tượng có thể đứng.',
      'Nếu điểm ở giữa đường chéo (gọi là "mắt Tượng") có quân đứng, Tượng không đi được hướng đó dù điểm đến còn trống. Gọi là "cản mắt Tượng".'
    ],
    demos:[{
      board:mkBoard([[9,3,'G',RED],[0,5,'G',BLACK],[5,2,'E',RED],[6,3,'H',RED]]),
      hero:[[5,2]], expect:{'5,2':1},
      caption:'Tượng Đỏ sát bờ sông chỉ đi được 1 nước: 2 hướng lên bị sông chặn, hướng chéo phải bị Mã chặn "mắt Tượng".'
    }]
  },
  {
    key:'ma', level:1, type:'H', title:'Mã', han:'傌 / 馬',
    text:[
      'Mã đi hình chữ "nhật" (chữ L): 1 bước thẳng rồi 1 bước chéo ra xa, tức 1 ô theo một hướng và 2 ô theo hướng vuông góc.',
      'Nếu điểm ngay sát Mã theo hướng đi (gọi là "chân Mã") có quân đứng, Mã <b>không đi được hướng đó</b>. Gọi là "cản chân Mã", và người mới rất hay quên luật này!',
      'Ở giữa bàn trống, Mã có tối đa 8 nước.'
    ],
    demos:[{
      board:mkBoard([[9,3,'G',RED],[0,5,'G',BLACK],[5,4,'H',RED],[4,4,'S',RED]]),
      hero:[[5,4]], expect:{'5,4':6},
      caption:'Tốt phía trên cản "chân Mã" nên Mã mất 2 nước đi lên, chỉ còn 6 nước.'
    }]
  },
  {
    key:'xe', level:1, type:'R', title:'Xe', han:'俥 / 車',
    text:[
      'Xe là quân mạnh nhất: đi thẳng theo hàng ngang hoặc cột dọc, <b>bao xa tuỳ ý</b> cho tới khi gặp quân cản.',
      'Gặp quân đối phương thì được ăn quân đó (và dừng ở đó); gặp quân mình thì phải dừng trước nó.'
    ],
    demos:[{
      board:mkBoard([[9,3,'G',RED],[0,5,'G',BLACK],[5,4,'R',RED],[5,7,'H',BLACK],[2,4,'S',RED]]),
      hero:[[5,4]], expectCaptures:{'5,4':['5,7']},
      caption:'Xe Đỏ ăn được Mã Đen bên phải; phía trên bị chính Tốt của mình chặn.'
    }]
  },
  {
    key:'phao', level:1, type:'C', title:'Pháo', han:'炮 / 砲',
    text:[
      'Khi <b>không ăn quân</b>, Pháo đi giống Xe: thẳng, bao xa tuỳ ý cho tới khi gặp quân cản.',
      'Khi <b>ăn quân</b>, Pháo phải nhảy qua đúng <b>1 quân</b> (gọi là "ngòi", là quân mình hay quân đối phương đều được) rồi ăn quân kế tiếp trên đường đó.',
      'Lỗi thường gặp: Pháo <b>không ăn được quân đứng sát bên</b> khi giữa không có ngòi. Nếu có 2 quân ở giữa thì cũng không ăn được.'
    ],
    demos:[{
      board:mkBoard([[9,3,'G',RED],[0,5,'G',BLACK],[5,4,'C',RED],[5,6,'H',BLACK],[5,8,'S',BLACK]]),
      hero:[[5,4]], expectCaptures:{'5,4':['5,8']},
      caption:'Pháo nhảy qua Mã Đen (ngòi) để ăn Tốt Đen ở xa. Pháo không ăn thẳng Mã được vì giữa không có ngòi.'
    }]
  },
  {
    key:'tot', level:1, type:'S', title:'Tốt', han:'兵 / 卒',
    text:[
      'Tốt (còn gọi là Binh) yếu nhất nhưng đông nhất: mỗi bên có 5 con.',
      'Chưa qua sông: Tốt chỉ được <b>tiến thẳng 1 bước</b>.',
      'Đã qua sông: Tốt được tiến hoặc <b>đi ngang</b> 1 bước, nhưng <b>không bao giờ được lùi</b>. Tốt đi tới hàng cuối thì chỉ còn đi ngang được.'
    ],
    demos:[{
      board:mkBoard([[9,3,'G',RED],[0,5,'G',BLACK],[6,4,'S',RED],[3,2,'S',RED]]),
      hero:[[6,4],[3,2]], expect:{'6,4':1,'3,2':3},
      caption:'Tốt ở giữa chưa qua sông nên chỉ có 1 nước. Tốt bên trái đã qua sông nên có 3 nước: tiến, sang trái, sang phải.'
    }]
  },
  {
    key:'chieu', level:1, type:'G', title:'Chiếu tướng & chiếu bí', han:'將軍 / 將死',
    text:[
      '<b>Chiếu tướng</b> là khi một quân đối phương có thể ăn Tướng ở nước kế tiếp. Bên bị chiếu <b>bắt buộc</b> phải giải chiếu ngay.',
      '<b>Chiếu bí</b> (hết cờ) là khi bị chiếu mà <b>không còn cách nào</b> giải: bên đó thua ngay.',
      'Trong cờ tướng, nếu đến lượt mà <b>không còn nước đi hợp lệ</b> nào (kể cả khi không bị chiếu) thì cũng bị xử <b>thua</b>. Cờ vua gọi trường hợp này là hoà, còn cờ tướng thì không.'
    ],
    demos:[
      {
        board:mkBoard([[9,4,'G',RED],[0,4,'G',BLACK],[5,4,'R',BLACK]]),
        hero:[[9,4]], toMove:RED, expectStatus:'check', goal:'escape',
        caption:'Tướng Đỏ đang bị Xe Đen chiếu! Chạm vào Tướng rồi chọn một điểm sáng để thoát.'
      },
      {
        board:mkBoard([[9,4,'G',RED],[1,3,'R',RED],[3,2,'H',RED],[2,5,'H',RED],[0,3,'G',BLACK]]),
        hero:[[0,3]], toMove:BLACK, expectStatus:'checkmate',
        caption:'Thế chiếu bí thật sự (đến lượt Đen). Chạm vào Tướng Đen: nó không còn nước nào. Không ăn được Xe vì Mã bảo vệ Xe; ô bên phải bị Mã còn lại và Tướng Đỏ khống chế.'
      }
    ]
  },
  {
    key:'kyhieu', level:1, type:'C', title:'Ký hiệu ghi nước đi', han:'記譜',
    text:[
      'Để ghi lại và đọc sách cờ, người ta dùng ký hiệu. Mỗi bên <b>đánh số cột 1→9 từ phải sang trái</b> theo hướng mình ngồi. Số của Đỏ in ở mép dưới bàn, số của Đen in ở mép trên.',
      'Một nước đi gồm 4 phần: <b>tên quân · cột đang đứng · hướng đi · số</b>.<br>Tên quân: <b>Tg</b> Tướng, <b>S</b> Sĩ, <b>T</b> Tượng, <b>M</b> Mã, <b>X</b> Xe, <b>P</b> Pháo, <b>B</b> Tốt (Binh).<br>Hướng: <b>.</b> tiến, <b>/</b> thoái (lùi), <b>-</b> bình (đi ngang).',
      'Quân đi thẳng (Tướng, Xe, Pháo, Tốt): khi tiến/thoái thì ghi <b>số bước</b>, khi đi ngang thì ghi <b>cột đến</b>. Quân đi chéo (Sĩ, Tượng, Mã): luôn ghi <b>cột đến</b>.',
      'Ví dụ: <b>P2-5</b> là Pháo cột 2 đi ngang sang cột 5 (Pháo đầu). <b>M8.7</b> là Mã cột 8 tiến tới cột 7. <b>X1.1</b> là Xe cột 1 tiến 1 bước. Nếu hai quân cùng loại đứng chung một cột thì ghi <b>t</b> (trước) hoặc <b>s</b> (sau) thay cho số cột, ví dụ <b>Xt.3</b>.',
      'Sách quốc tế (WXF) ghi <b>+</b> tiến, <b>-</b> thoái, <b>=</b> bình và dùng chữ tiếng Anh: P2-5 được viết là <b>C2=5</b>, M8.7 là <b>H8+7</b>.'
    ],
    demos:[{
      board:Engine.initialBoard(),
      mode:'free', toMove:RED,
      caption:'Hãy đi thử vài nước cho cả hai bên. Ký hiệu của từng nước hiện ngay bên dưới. Nhìn số cột ở mép bàn để tự đối chiếu.'
    }]
  },
  {
    key:'giatri', level:1, type:'R', title:'Giá trị các quân', han:'子力',
    text:[
      'Muốn biết một cuộc đổi quân có lợi hay không, người chơi dùng bảng điểm ước lượng dưới đây. Đây chỉ là con số tham khảo; giá trị thật còn tuỳ vị trí.',
      '<b>Pháo mạnh ở đầu ván</b> vì bàn còn nhiều quân làm ngòi. <b>Mã mạnh hơn ở cuối ván</b> khi bàn thưa, ít bị cản chân. <b>Tốt qua sông</b> được đi ngang nên giá trị tăng gấp đôi; Tốt đã tới hàng cuối thì yếu đi.',
      'Hai quy tắc hay dùng: đổi một Xe lấy Mã + Pháo thường là có lợi cho bên lấy hai quân. Mất Sĩ Tượng thì Tướng dễ bị chiếu bí, dù điểm số không cao.'
    ],
    table:{
      head:['Quân','Điểm','Ghi chú'],
      rows:[
        ['Xe','9','Mạnh nhất, cần ra sớm'],
        ['Pháo','4,5','Mạnh đầu ván'],
        ['Mã','4','Mạnh cuối ván'],
        ['Sĩ','2','Giữ cung'],
        ['Tượng','2','Giữ sân nhà'],
        ['Tốt chưa qua sông','1',''],
        ['Tốt đã qua sông','2','Được đi ngang'],
      ]
    },
    demos:[]
  },
  {
    key:'luatcam', level:1, type:'G', title:'Luật cấm & hoà cờ', han:'禁著 / 和棋',
    text:[
      '<b>Cấm chiếu mãi:</b> một bên không được chiếu liên tục khiến thế cờ lặp đi lặp lại. Nếu thế cờ lặp lại lần thứ 3 mà chỉ một bên chiếu liên tục, bên đó bị xử <b>thua</b>.',
      '<b>Cấm đuổi mãi:</b> cũng không được liên tục đe doạ ăn cùng một quân không được bảo vệ (hoặc dùng Mã/Pháo đuổi Xe) để ép lặp nước. Bên đuổi mãi bị xử thua.',
      '<b>Hoà cờ</b> khi: hai bên cùng lặp nước mà không ai phạm luật; 60 nước liên tiếp không có quân nào bị ăn; hai bên đều không còn quân tấn công được (Xe, Mã, Pháo, Tốt); hoặc hai bên thoả thuận hoà.',
      '<i>Ghi chú: luật thi đấu chính thức (luật Á châu) còn nhiều trường hợp chi tiết hơn. Ứng dụng này dùng bản rút gọn ở trên cho Luyện tập và Đấu với máy.</i>'
    ],
    demos:[{
      board:mkBoard([[9,3,'G',RED],[2,8,'R',RED],[1,4,'G',BLACK],[3,0,'S',BLACK],[6,0,'S',RED]]),
      mode:'game', toMove:RED,
      caption:'Thử chiếu mãi: Đỏ đưa Xe lên chiếu (X1.1), Đen chạy Tướng, Đỏ lại lùi Xe chiếu (X1/1)… Tới lần lặp thứ 3, trọng tài xử Đỏ thua vì chiếu mãi.'
    }]
  },

  /* ============================ SƠ CẤP ============================ */
  {
    key:'nguyentac', level:2, type:'H', title:'Nguyên tắc khai cuộc', han:'布局',
    text:[
      'Khai cuộc là khoảng 10–15 nước đầu. Mục tiêu là <b>đưa quân ra vị trí tốt nhanh nhất</b> và giữ cung Tướng an toàn. Bảy nguyên tắc cho người mới:',
      '<ol><li><b>Ra Xe sớm.</b> Xe mạnh nhất; câu "ba nước không ra Xe là thua" rất đáng nhớ.</li><li><b>Nhảy Mã giữ Tốt đầu</b> khi đối phương vào Pháo đầu.</li><li><b>Không đi một quân hai lần</b> khi chưa cần, để không phí nước.</li><li><b>Không tham ăn Tốt sớm</b> nếu làm quân của mình bị vây hoặc bị bỏ lại.</li><li><b>Phối hợp quân:</b> Xe, Mã, Pháo cùng nhắm một hướng mới tạo sức mạnh.</li><li><b>Giữ Sĩ Tượng</b> đầy đủ trước khi tấn công lớn.</li><li><b>Để ý Pháo đối phương</b>: không đặt Xe, Mã vào cùng cột với Pháo địch khi giữa chỉ có một quân (ngòi).</li></ol>',
      'Tab <b>Khai cuộc</b> có 12 thế trận mẫu, cùng chế độ <b>Trainer</b> để luyện tới khi thuộc.'
    ],
    demos:[{
      board:Engine.initialBoard(),
      mode:'free', toMove:RED,
      arrows:[{from:[7,7],to:[7,4]},{from:[9,7],to:[7,6]},{from:[9,1],to:[7,2]}],
      caption:'Mũi tên là ba nước mở màn phổ biến của Đỏ: Pháo đầu (P2-5) và nhảy hai Mã (M2.3, M8.7). Hãy tự đi thử cho cả hai bên.'
    }]
  },
  {
    key:'tuduy', level:2, type:'H', title:'Tư duy mỗi nước đi', han:'思考',
    text:[
      'Người chơi giỏi không nhớ nhiều nước hơn bạn. Họ <b>đặt đúng câu hỏi</b> ở mỗi lượt. Hãy tập thành thói quen trả lời 5 câu sau trước khi chạm vào quân:',
      '<ol><li><b>Đối phương vừa doạ gì?</b> Nước vừa đi tấn công quân nào, mở đường cho quân nào, có dọa chiếu không?</li><li><b>Quân mình có an toàn không?</b> Quân nào đang bị tấn công mà không được bảo vệ, hoặc bị quân rẻ hơn tấn công?</li><li><b>Có Chiếu – Ăn – Doạ không?</b> Xét nước chiếu trước, rồi nước ăn quân, rồi nước tạo đe doạ. Đòn thắng thường nằm ở đây.</li><li><b>Quân nào kém hoạt động nhất?</b> Không có đòn gì thì cải thiện quân tệ nhất: ra Xe, nhảy Mã, đưa Pháo tới chỗ có ngòi.</li><li><b>Kiểm tra lại.</b> Đặt mình vào vị trí đối phương: sau nước này họ có đòn gì? Nếu có, tìm nước khác.</li></ol>',
      'Vì sao cần thứ tự này? Vì <b>mất quân do sơ suất</b> là nguyên nhân thua phổ biến nhất ở người mới, nên câu 1 và 2 phải hỏi trước. Câu 3 giúp bạn không bỏ lỡ cơ hội. Câu 4 là "kế hoạch" khi thế cờ yên tĩnh. Câu 5 là chốt chặn cuối cùng.',
      'Khi đấu với máy, bảng nhắc 5 bước này luôn nằm cạnh bàn cờ. Phần <b>Phân tích ván</b> cũng chỉ ra bạn đã bỏ qua câu hỏi nào ở mỗi lỗi.'
    ],
    demos:[{
      board:mkBoard([[9,4,'G',RED],[9,3,'A',RED],[9,5,'A',RED],[5,2,'H',RED],[6,0,'R',RED],[6,4,'S',RED],
                     [0,4,'G',BLACK],[0,3,'A',BLACK],[5,8,'R',BLACK],[3,0,'S',BLACK],[2,4,'H',BLACK],[3,4,'S',BLACK]]),
      hero:[[5,2],[6,0],[6,4],[9,3],[9,5],[9,4]], toMove:RED, goal:'safe', solution:{from:[5,2],to:[3,3]},
      caption:'Đen vừa đưa Xe sang hàng này. Làm theo 5 bước: Đen đang doạ gì? Xe Đỏ có nên tham ăn Tốt không? Hãy chọn một nước an toàn.'
    }]
  },
  {
    key:'giaichieu', level:2, type:'G', title:'Ba cách giải chiếu', han:'應將',
    text:[
      'Khi bị chiếu có đúng <b>ba cách</b> giải:',
      '<ol><li><b>Chạy Tướng</b> sang điểm an toàn.</li><li><b>Cản:</b> đặt một quân vào giữa quân chiếu và Tướng. Với Mã chiếu thì cản ở chân Mã; với Pháo chiếu thì có thể rút ngòi hoặc thêm quân vào giữa để Pháo có 2 ngòi.</li><li><b>Ăn quân đang chiếu.</b></li></ol>',
      'Khi còn chọn được, hãy ưu tiên cách <b>ăn quân chiếu</b> (lợi quân), rồi tới <b>cản</b>. Chạy Tướng nhiều khiến cung bị xộc xệch.'
    ],
    demos:[
      {
        board:mkBoard([[9,4,'G',RED],[9,3,'A',RED],[9,5,'A',RED],[3,4,'R',BLACK],[6,0,'R',RED],[0,3,'G',BLACK]]),
        hero:[[6,0]], toMove:RED, expectStatus:'check', goal:'escape',
        caption:'Tướng Đỏ bị kẹt giữa hai Sĩ nên không chạy được. Hãy dùng Xe CẢN đường chiếu.'
      },
      {
        board:mkBoard([[9,4,'G',RED],[9,3,'A',RED],[7,3,'H',BLACK],[7,0,'R',RED],[0,5,'G',BLACK]]),
        hero:[[7,0],[9,4]], toMove:RED, expectStatus:'check', goal:'escape',
        caption:'Mã Đen chiếu. Cách tốt nhất là dùng Xe ĂN luôn quân Mã đang chiếu.'
      }
    ]
  },

  /* ============================ TRUNG CẤP — SÁT CỤC ============================ */
  {
    key:'mahauphao', level:3, type:'H', title:'Sát cục: Mã hậu Pháo', han:'馬後炮',
    text:[
      '"Mã hậu Pháo" nghĩa là Mã ở trước, Pháo ở sau. Mã đứng cùng cột với Tướng đối phương và cách Tướng một hàng, vừa làm ngòi cho Pháo vừa khống chế hai điểm hai bên Tướng.',
      'Pháo vào cột đó là chiếu bí: Tướng không sang ngang được (Mã giữ), tiến lên vẫn nằm trên đường Pháo, còn ăn Mã thì không với tới.',
      'Đây là một trong những thế sát cục nổi tiếng nhất. Tục ngữ có câu "Mã hậu Pháo" để chỉ việc làm muộn, nhưng trên bàn cờ thì đây là đòn kết thúc rất nhanh!'
    ],
    demos:[{
      board:mkBoard([[9,4,'G',RED],[2,3,'H',RED],[7,0,'C',RED],[0,3,'G',BLACK],[0,5,'A',BLACK],[3,8,'S',BLACK]]),
      hero:[[7,0]], toMove:RED, goal:'mate', solution:{from:[7,0],to:[7,3]},
      caption:'Tìm nước chiếu bí: đưa Pháo vào đúng cột của Mã và Tướng Đen.'
    }]
  },
  {
    key:'trungphao', level:3, type:'C', title:'Sát cục: Trùng Pháo', han:'重炮',
    text:[
      '"Trùng Pháo" là hai Pháo đứng chồng trên cùng một cột. Pháo sau dùng Pháo trước làm ngòi để chiếu.',
      'Nếu đối phương đưa quân vào giữa để cản, thì chính quân cản đó lại trở thành ngòi cho Pháo trước. Nếu hai bên Tướng bị Sĩ của mình chặn, Tướng hết đường chạy.'
    ],
    demos:[{
      board:mkBoard([[9,3,'G',RED],[5,4,'C',RED],[7,0,'C',RED],[0,4,'G',BLACK],[0,3,'A',BLACK],[0,5,'A',BLACK],[3,8,'S',BLACK]]),
      hero:[[7,0]], toMove:RED, goal:'mate', solution:{from:[7,0],to:[7,4]},
      caption:'Đưa Pháo thứ hai vào sau Pháo thứ nhất để chiếu bí. Thử nghĩ xem vì sao Sĩ Đen lên cản cũng vô ích.'
    }]
  },
  {
    key:'songxa', level:3, type:'R', title:'Sát cục: Song Xa', han:'雙車',
    text:[
      'Hai Xe phối hợp là bộ đôi chiếu bí mạnh nhất. Cách đơn giản: một Xe khoá một hàng để Tướng không tiến lên được, Xe kia chiếu ở hàng Tướng đang đứng.',
      'Kỹ thuật này còn gọi là "Xe khoá, Xe chiếu": hai Xe lần lượt thay nhau đẩy Tướng về hàng cuối.'
    ],
    demos:[{
      board:mkBoard([[9,3,'G',RED],[1,0,'R',RED],[5,8,'R',RED],[0,4,'G',BLACK],[3,2,'S',BLACK]]),
      hero:[[5,8]], toMove:RED, goal:'mate', solution:{from:[5,8],to:[0,8]},
      caption:'Xe trên đã khoá hàng thứ hai. Hãy dùng Xe còn lại chiếu bí ở hàng cuối.'
    }]
  },
  {
    key:'bachdien', level:3, type:'G', title:'Sát cục: Bạch diện tướng', han:'白臉將',
    text:[
      '"Bạch diện tướng" (Tướng mặt trắng) tận dụng luật lộ mặt Tướng: Tướng của mình khống chế cả cột đang đứng, nên Tướng đối phương không được bước vào cột đó.',
      'Chỉ cần thêm một quân chiếu ở cột bên cạnh là Tướng đối phương hết đường. Đây là lý do Tướng cũng là một quân tấn công, nhất là ở tàn cuộc.'
    ],
    demos:[{
      board:mkBoard([[9,4,'G',RED],[5,0,'R',RED],[0,3,'G',BLACK],[0,2,'E',BLACK],[3,8,'S',BLACK]]),
      hero:[[5,0]], toMove:RED, goal:'mate', solution:{from:[5,0],to:[5,3]},
      caption:'Tướng Đỏ đang giữ cột giữa. Hãy chiếu bí bằng Xe.'
    }]
  },

  /* ============================ THAM KHẢO ============================ */
  {
    key:'dangcap', level:4, type:'G', title:'Hệ thống đẳng cấp kỳ thủ', han:'等級',
    text:[
      '<b>Trung Quốc</b> (Hiệp hội Cờ tướng Trung Quốc) có khoảng 20 bậc, từ thấp lên cao: <b>Kỳ sĩ</b> cấp 16 → cấp 1 (棋士, dành cho người chơi nghiệp dư), <b>Đại sư địa phương</b> (地方大师, trình độ tuyển thủ thành phố/tỉnh), <b>Kỳ hiệp đại sư</b> (棋协大师, cỡ vô địch tỉnh), <b>Đại sư quốc gia</b> (国家大师, ranh giới giữa nghiệp dư và chuyên nghiệp) và cao nhất là <b>Đặc cấp đại sư</b> (特级大师).',
      '<b>Quốc tế</b> (Liên đoàn Cờ tướng Thế giới, WXF) phong các danh hiệu: <b>Kiện tướng Liên đoàn</b>, <b>Kiện tướng quốc tế</b> và <b>Đại kiện tướng quốc tế</b>.',
      '<b>Việt Nam:</b> vận động viên được phong đẳng cấp (như Kiện tướng quốc gia) dựa trên thành tích tại các giải quốc gia; ở quốc tế thì nhận danh hiệu của WXF.',
      '<b>Cấp độ của máy</b> trong tab Đấu với máy được đặt tên theo thang của Trung Quốc để bạn dễ hình dung. Đây là <b>mô phỏng tương đối</b>: sức mạnh được hiệu chỉnh bằng cách cho máy tự đấu với nhau, không phải đo bằng thi đấu thật.'
    ],
    table:{
      head:['Cấp độ máy','Hình dung (ước lượng, chưa đo với người thật)','Đo bằng máy tự đấu'],
      rows:[
        ['1 · Tân thủ','Vừa biết luật (kỳ sĩ cấp 16–15)','—'],
        ['2 · Kỳ sĩ cấp 14–12','Mới chơi vài tháng','thắng cấp 1: ~83%'],
        ['3 · Kỳ sĩ cấp 11–9','Chơi cờ phong trào','thắng cấp 2: ~84%'],
        ['4 · Kỳ sĩ cấp 8–7','Phong trào khá','thắng cấp 3: ~75%'],
        ['5 · Kỳ sĩ cấp 6–5','Giải cấp phường/xã','thắng cấp 4: ~84%'],
        ['6 · Kỳ sĩ cấp 4–3','Người chơi khá ở câu lạc bộ','thắng cấp 5: ~84%'],
        ['7 · Kỳ sĩ cấp 2','Câu lạc bộ, không còn sơ suất','thắng cấp 6: ~96%'],
        ['8 · Kỳ sĩ cấp 1','Người chơi giỏi phong trào','thắng cấp 7: ~85%'],
        ['9 · Ứng viên đại sư','Có sách khai cuộc, tính 2 giây','thắng cấp 8: ~85%'],
        ['10 · Đại sư địa phương','Mạnh nhất của ứng dụng','thắng cấp 9: ~74%'],
      ]
    },
    sources:[
      ['Hệ thống đẳng cấp cờ tướng Trung Quốc (sohu.com)','https://www.sohu.com/a/691622246_121251116'],
      ['Các danh hiệu trong cờ tướng (xiangqi.com)','https://www.vn.xiangqi.com/articles/cac-danh-hieu-trong-co-tuong'],
    ],
    demos:[]
  },
];

