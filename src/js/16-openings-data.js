/* =========================================================================
   KHAI CUỘC — dữ liệu
   Nước đi ghi bằng ký hiệu Việt Nam (xem notation.js) và được đọc ra nước đi
   thật bằng engine khi tải trang; harness kiểm tra mọi nước đều hợp lệ.
   Các nước định danh của từng hệ thống đối chiếu theo:
   - xiangqi.com "Glossary of Basic Xiangqi Opening Systems" (Thuận/Nghịch Pháo, Bình phong Mã,
     Tam bộ hổ, Quy bối Pháo, Tiên nhân chỉ lộ, Phi Tượng, Khởi Mã)
   - xiangqielephantgame.blogspot.com (Thuận Pháo: 1. P2-5 P8-5 2. M2.3 M8.7 3. X1-2 X9.1)
   - mocvien.com (Bán đồ Nghịch Pháo: 1. P2-5 M8.7 2. M2.3 X9-8 3. X1-2 P2-5; Sĩ giác Pháo P2-4)
   - zigavn.com (Tiên nhân chỉ lộ và cách đáp "Tốt để Pháo")
   Phần tiếp theo sau các nước định danh là diễn biến phát triển quân tiêu biểu,
   được chọn để minh hoạ nguyên tắc khai cuộc cho người mới — không phải bảng biến đầy đủ.
   ========================================================================= */
const OPENING_GROUPS = [
  {id:'phaodau', name:'Đỏ đi Pháo đầu', desc:'Nước mở màn phổ biến nhất: Pháo vào cột giữa nhắm Tốt đầu. Các thế dưới đây là những cách Đen đáp lại.'},
  {id:'mem', name:'Khai cuộc mềm', desc:'Đỏ không vào Pháo đầu ngay mà chuẩn bị kín đáo hơn, giữ thế linh hoạt.'},
  {id:'bay', name:'Bẫy khai cuộc', desc:'Những cái bẫy có thật trong sách và thực chiến, mỗi bẫy đều có nguồn. Xem bên mắc bẫy sai ở đâu và vì sao — để mình không mắc, và biết cách trừng phạt khi đối phương mắc.'},
];

const OPENINGS_RAW = [
  {
    id:'binh-phong-ma', group:'phaodau', level:1,
    name:'Pháo đầu đối Bình phong Mã', han:'中炮對屏風馬',
    summary:'Thế trận cơ bản và được dùng nhiều nhất ở các giải lớn. Đỏ đưa Pháo vào giữa để tấn công, Đen đưa hai Mã lên như hai tấm bình phong để giữ Tốt đầu, rồi xuất Xe phản công.',
    ideas:[
      'Đen luôn phải giữ Tốt đầu (Tốt cột 5) vì đó là mục tiêu của Pháo đầu.',
      'Cả hai bên cố ra Xe thật sớm: Xe là quân mạnh nhất, ra chậm là thua thiệt.',
      'Tốt 3 và Tốt 7 được tiến lên để mở đường cho Mã nhảy ra.',
    ],
    traps:[
      'Nếu Đen quên giữ Tốt đầu (chẳng hạn chỉ ra một Mã rồi đi quân khác), Đỏ có thể dùng Pháo ăn Tốt đầu kèm nước chiếu (P5.4) và giành ngay lợi thế.',
    ],
    moves:[
      ['P2-5','Đỏ vào Pháo đầu: Pháo đứng cột giữa, qua ngòi là Tốt đầu, nhắm thẳng vào cung Tướng đen.'],
      ['M8.7','Đen nhảy Mã lên giữ Tốt đầu. Tốt ở cột 5 bị Pháo nhắm nên cần có quân bảo vệ.'],
      ['M2.3','Đỏ ra Mã giữ Tốt đầu của mình và dọn đường cho Xe bên phải.'],
      ['X9-8','Đen ra Xe ngay. Xe đứng ở cột 8 nhắm vào Mã và Pháo phía Đỏ.'],
      ['X1-2','Đỏ cũng ra Xe vào cột 2 (cột trống vì Mã đã nhảy đi). Hai Xe đối mặt nhau trên hai cột "Xe mở".'],
      ['M2.3','Đen nhảy Mã thứ hai. Hai Mã đứng hai bên đúng hình "bình phong", cùng giữ Tốt đầu.'],
      ['B7.1','Đỏ tiến Tốt 7 để mở đường cho Mã trái nhảy lên chỗ tốt.'],
      ['B7.1','Đen cũng tiến Tốt 7 để Mã có đường tiến lên.'],
      ['M8.7','Đỏ nhảy nốt Mã trái. Cả hai Mã Đỏ đã ra trận.'],
      ['T3.5','Đen lên Tượng vào giữa, nối hai cánh phòng thủ trước cung.'],
      ['X9.1','Đỏ nhích Xe trái lên một bước để chuẩn bị đưa sang giữa bàn (hoành Xe).'],
      ['S4.5','Đen lên Sĩ, làm cung Tướng vững chắc. Khai cuộc đã xong; hai bên chuyển vào trung cuộc.'],
    ]
  },
  {
    id:'thuan-phao', group:'phaodau', level:2,
    name:'Thuận Pháo', han:'順炮',
    summary:'Đen trả lời Pháo đầu bằng chính một Pháo đầu, đặt ở cùng phía với Pháo Đỏ. Hai bên tấn công nhau ngay từ đầu, thế trận sắc bén.',
    ideas:[
      'Đen thiếu một nước so với Đỏ nên phải ra quân thật nhanh.',
      'Nước X9.1 rồi hoành Xe sang giữa (X9-4) là cách Đen hay dùng để ra Xe nhanh.',
    ],
    traps:[
      'Ăn Tốt đầu quá sớm bằng Pháo (P5.4) thường khiến Pháo bị vây và mất quân: cả hai bên nên ra đủ quân trước khi ăn Tốt.',
    ],
    moves:[
      ['P2-5','Pháo đầu của Đỏ.'],
      ['P8-5','Đen cũng vào Pháo đầu, cùng phía với Pháo Đỏ (Pháo 8 của Đen nằm cùng phía màn hình với Pháo 2 của Đỏ), nên gọi là "Thuận Pháo".'],
      ['M2.3','Đỏ nhảy Mã giữ Tốt đầu.'],
      ['M8.7','Đen nhảy Mã giữ Tốt đầu.'],
      ['X1-2','Đỏ ra Xe vào cột trống.'],
      ['X9.1','Đen nhích Xe lên một bước, chuẩn bị hoành Xe.'],
      ['M8.7','Đỏ nhảy Mã thứ hai.'],
      ['X9-4','Đen hoành Xe sang cột 4 để trấn giữ giữa bàn — lối "Thuận Pháo hoành Xe" rất phổ biến.'],
      ['S4.5','Đỏ lên Sĩ giữ cung.'],
      ['M2.3','Đen nhảy Mã còn lại. Hai bên đã ra gần đủ quân.'],
    ]
  },
  {
    id:'nghich-phao', group:'phaodau', level:2,
    name:'Nghịch Pháo', han:'列炮',
    summary:'Đen vào Pháo đầu ở phía ngược với Pháo Đỏ. Mỗi bên dồn lực tấn công ở một cánh, rất quyết liệt và ít khi hoà. Không khuyến khích người mới dùng khi chưa vững.',
    ideas:[
      'Hai bên tấn công ở hai cánh khác nhau nên thường là cuộc đua ai nhanh hơn.',
      'Xe tuần hà (Xe đứng ở bờ sông) giúp vừa công vừa thủ.',
    ],
    traps:[
      'Bên nào ra quân chậm một nhịp dễ bị Pháo đầu và Xe đối phương đánh thẳng vào cung.',
    ],
    moves:[
      ['P2-5','Pháo đầu của Đỏ.'],
      ['P2-5','Đen vào Pháo đầu ở phía ngược lại (Pháo 2 của Đen nằm khác phía màn hình với Pháo 2 của Đỏ), gọi là "Nghịch Pháo".'],
      ['M2.3','Đỏ nhảy Mã giữ Tốt đầu.'],
      ['M2.3','Đen cũng nhảy Mã giữ Tốt đầu.'],
      ['X1-2','Đỏ ra Xe.'],
      ['X1-2','Đen ra Xe đối xứng.'],
      ['M8.7','Đỏ nhảy Mã thứ hai.'],
      ['M8.7','Đen nhảy Mã thứ hai.'],
      ['X2.4','Đỏ đưa Xe lên bờ sông ("Xe tuần hà"), vừa canh giữ vừa sẵn sàng tấn công.'],
      ['X2.4','Đen cũng tuần hà Xe. Thế trận cân bằng, sắp vào trận đánh.'],
    ]
  },
  {
    id:'ban-do-nghich-phao', group:'phaodau', level:3,
    name:'Bán đồ Nghịch Pháo', han:'半途列炮',
    summary:'"Nghịch Pháo giữa đường": Đen ra Mã và Xe trước cho vững, sau đó mới vào Pháo đầu ngược phía. Ít rủi ro hơn Nghịch Pháo cổ điển mà vẫn có phản công.',
    ideas:[
      'Đen giữ Tốt đầu bằng Mã trước rồi mới vào Pháo, nên không sợ bị tấn công sớm.',
      'Đây là cách tạo bất ngờ khi đối phương đã quen với Bình phong Mã.',
    ],
    traps:[
      'Nếu Đỏ ra quân chậm, Pháo đầu và Xe của Đen phối hợp rất nhanh ở cột giữa.',
    ],
    moves:[
      ['P2-5','Pháo đầu của Đỏ.'],
      ['M8.7','Đen nhảy Mã giữ Tốt đầu như Bình phong Mã.'],
      ['M2.3','Đỏ nhảy Mã.'],
      ['X9-8','Đen ra Xe ngay.'],
      ['X1-2','Đỏ ra Xe.'],
      ['P2-5','Giờ Đen mới vào Pháo đầu ở phía ngược — "Nghịch Pháo giữa đường".'],
      ['M8.7','Đỏ nhảy Mã thứ hai.'],
      ['M2.3','Đen nhảy Mã thứ hai.'],
      ['B7.1','Đỏ tiến Tốt 7 cho Mã có đường ra.'],
      ['X1-2','Đen ra nốt Xe thứ hai. Cả hai Xe Đen đã hoạt động.'],
    ]
  },
  {
    id:'phan-cung-ma', group:'phaodau', level:2,
    name:'Phản cung Mã', han:'反宮馬',
    summary:'Đen nhảy một Mã, đưa một Pháo vào góc cung (tai Sĩ) rồi nhảy Mã thứ hai. Thế phòng thủ chắc chắn, Pháo ở tai Sĩ có thể chuyển sang tấn công.',
    ideas:[
      'Pháo ở góc cung (P8-6) vừa giữ cung vừa có thể chuyển ra cánh để tấn công.',
      'Hai Mã vẫn cùng giữ Tốt đầu như Bình phong Mã.',
    ],
    traps:[
      'Pháo đứng tai Sĩ chặn đường lên của Sĩ; nếu Đen không đưa Pháo đi kịp, Tướng có thể bị bí khi bị chiếu.',
    ],
    moves:[
      ['P2-5','Pháo đầu của Đỏ.'],
      ['M2.3','Đen nhảy Mã bên trái giữ Tốt đầu.'],
      ['M2.3','Đỏ nhảy Mã.'],
      ['P8-6','Đen đưa Pháo vào góc cung (tai Sĩ), là nước đặc trưng của Phản cung Mã.'],
      ['X1-2','Đỏ ra Xe.'],
      ['M8.7','Đen nhảy Mã thứ hai về phía có Pháo. Hình Mã–Pháo–Mã này tạo nên tên gọi Phản cung Mã.'],
      ['B7.1','Đỏ mở đường cho Mã trái.'],
      ['X9-8','Đen ra Xe.'],
      ['M8.7','Đỏ nhảy Mã thứ hai.'],
      ['T3.5','Đen lên Tượng giữa, cung đã vững.'],
    ]
  },
  {
    id:'tam-bo-ho', group:'phaodau', level:2,
    name:'Tam bộ hổ', han:'三步虎',
    summary:'"Hổ ba bước": Đen nhảy Mã, đưa Pháo ra biên rồi ra Xe, chỉ ba nước là Xe đã hoạt động. Ra Xe rất nhanh, hợp với người thích phản công.',
    ideas:[
      'Pháo ra biên (P8-9) để dọn đường cho Xe ra cột 8.',
      'Ưu điểm là tốc độ ra Xe; nhược điểm là Pháo ở biên ít tác dụng ở giữa bàn.',
    ],
    traps:[
      'Chỉ có một Mã giữ Tốt đầu, nên Đen phải để ý không để Mã đó bị đánh đuổi.',
    ],
    moves:[
      ['P2-5','Pháo đầu của Đỏ.'],
      ['M8.7','Đen nhảy Mã giữ Tốt đầu (bước 1).'],
      ['M2.3','Đỏ nhảy Mã.'],
      ['P8-9','Đen đưa Pháo ra biên (bước 2), dọn đường cho Xe.'],
      ['X1-2','Đỏ ra Xe.'],
      ['X9-8','Đen ra Xe vào cột 8 (bước 3). Chỉ ba nước là Xe đã nhắm thẳng xuống hàng quân Đỏ.'],
      ['B7.1','Đỏ tiến Tốt mở đường Mã.'],
      ['B3.1','Đen tiến Tốt 3 để Mã còn lại có đường nhảy ra.'],
      ['M8.7','Đỏ nhảy Mã thứ hai.'],
      ['M2.3','Đen nhảy Mã thứ hai.'],
    ]
  },
  {
    id:'quy-boi-phao', group:'phaodau', level:3,
    name:'Quy bối Pháo', han:'烏龜砲',
    summary:'"Pháo lưng rùa": Đen nhích Xe lên rồi lui Pháo về sau lưng, để Pháo được Xe che chở và sau đó chuyển sang cánh khác. Thiên về phòng thủ.',
    ideas:[
      'Pháo lui một bước (P8/1) để có thể chuyển ngang dọc hàng thứ hai.',
      'Thế cờ chắc chắn nhưng kém linh hoạt, cần kiên nhẫn.',
    ],
    traps:[
      'Vì Pháo và Xe cùng dồn một cánh, cánh còn lại của Đen dễ bị Đỏ tấn công.',
    ],
    moves:[
      ['P2-5','Pháo đầu của Đỏ.'],
      ['M8.7','Đen nhảy Mã giữ Tốt đầu.'],
      ['M2.3','Đỏ nhảy Mã.'],
      ['X9.1','Đen nhích Xe lên một bước.'],
      ['X1-2','Đỏ ra Xe.'],
      ['P8/1','Đen lui Pháo về sau: nước đặc trưng "lưng rùa". Pháo được Xe bảo vệ và có thể chuyển sang cánh khác.'],
      ['B7.1','Đỏ tiến Tốt.'],
      ['M2.3','Đen nhảy Mã thứ hai.'],
      ['M8.7','Đỏ nhảy Mã thứ hai.'],
      ['T3.5','Đen lên Tượng củng cố phòng thủ.'],
    ]
  },
  {
    id:'tien-nhan-chi-lo', group:'mem', level:2,
    name:'Tiên nhân chỉ lộ', han:'仙人指路',
    summary:'"Tiên ông chỉ đường": Đỏ mở màn bằng tiến Tốt 3 hoặc Tốt 7, thăm dò ý đồ của Đen trước khi quyết định thế trận. Là vũ khí ưa thích của nhiều danh thủ.',
    ideas:[
      'Tốt tiến lên mở đường cho Mã và hạn chế Mã đối phương.',
      'Đỏ giữ quyền chọn: có thể chuyển sang Pháo đầu hoặc lối chơi khác tuỳ Đen.',
      'Cách đáp phổ biến là "Tốt để Pháo": Đen đưa Pháo nhắm vào con Tốt vừa tiến.',
    ],
    traps:[
      'Nếu Đỏ không để ý, Tốt vừa tiến có thể bị Pháo Đen ăn (Pháo dùng Tốt Đen làm ngòi).',
    ],
    moves:[
      ['B7.1','Đỏ tiến Tốt 7 — "tiên nhân chỉ lộ".'],
      ['P2-3','Đen đáp "Tốt để Pháo": Pháo sang cột 3, mượn Tốt của mình làm ngòi để nhắm con Tốt Đỏ vừa tiến.'],
      ['P2-5','Đỏ chuyển sang Pháo đầu.'],
      ['T3.5','Đen lên Tượng giữ cung vững.'],
      ['M2.3','Đỏ nhảy Mã.'],
      ['M8.7','Đen nhảy Mã.'],
      ['X1-2','Đỏ ra Xe.'],
      ['X9-8','Đen ra Xe.'],
      ['M8.9','Đỏ nhảy Mã trái ra biên (Tốt 7 đã tiến nên Mã ra biên để không cản đường Xe).'],
      ['B7.1','Đen tiến Tốt 7 mở đường cho Mã.'],
    ]
  },
  {
    id:'phi-tuong', group:'mem', level:1,
    name:'Phi Tượng', han:'飛相局',
    summary:'Đỏ mở màn bằng lên Tượng vào giữa (T3.5). Thế cờ vững chắc, chơi chậm mà chắc, cần giỏi trung cuộc và tàn cuộc. Đây mới là khai cuộc "lên Tượng" chuẩn — Tượng không cần Tốt mở đường.',
    ideas:[
      'Tượng ở giữa bảo vệ Tốt đầu và cung Tướng, giúp Đỏ không lo bị Pháo đầu đánh sớm.',
      'Đỏ chuyển sang phản công sau khi đã phòng thủ vững.',
    ],
    traps:[
      'Chơi quá thụ động sẽ mất lợi thế đi trước; cần ra Xe và Mã đều tay sau khi lên Tượng.',
    ],
    moves:[
      ['T3.5','Đỏ lên Tượng vào giữa — "Phi Tượng cục". Không cần tiến Tốt vì Tượng đi chéo 2 ô qua điểm trống.'],
      ['P8-4','Đen đáp bằng Quá cung Pháo: Pháo đi ngang qua trước cung sang cột 4, dọn đường cho Xe.'],
      ['M2.3','Đỏ nhảy Mã.'],
      ['M8.7','Đen nhảy Mã.'],
      ['X1-2','Đỏ ra Xe vào cột 2.'],
      ['X9-8','Đen ra Xe vào cột 8. Lưu ý: Đen chỉ ra Xe ở cột này được sau khi Pháo đã rời đi, nếu không Pháo Đỏ có thể mượn Pháo Đen làm ngòi để ăn Xe.'],
      ['M8.9','Đỏ nhảy Mã trái ra biên để Xe trái có đường ra.'],
      ['M2.3','Đen nhảy Mã thứ hai.'],
      ['X9.1','Đỏ nhích Xe trái lên một bước, chuẩn bị hoành Xe sang giữa. (Chưa ra Xe vào cột 8 vì Pháo Đen ở cột đó có thể mượn Pháo Đỏ làm ngòi ăn Xe.)'],
      ['T3.5','Đen lên Tượng. Hai bên đều vững chắc, bước vào trung cuộc.'],
    ]
  },
  {
    id:'khoi-ma', group:'mem', level:1,
    name:'Khởi Mã', han:'起馬局',
    summary:'Đỏ mở màn bằng nhảy Mã (M2.3 hoặc M8.7). Linh hoạt, có thể chuyển sang nhiều thế trận, kể cả Pháo đầu ở nước sau.',
    ideas:[
      'Mã ra trước giữ Tốt đầu và chuẩn bị ra Xe.',
      'Không lộ ý đồ sớm, dễ chuyển sang các thế trận quen thuộc.',
    ],
    traps:[
      'Nếu không chuyển được Pháo vào vị trí tốt, thế trận dễ bị động.',
    ],
    moves:[
      ['M2.3','Đỏ nhảy Mã — "Khởi Mã cục".'],
      ['B7.1','Đen tiến Tốt 7.'],
      ['B7.1','Đỏ tiến Tốt 7.'],
      ['M8.7','Đen nhảy Mã.'],
      ['M8.7','Đỏ nhảy Mã thứ hai.'],
      ['P8-9','Đen đưa Pháo ra biên để Xe có đường ra. (Nếu ra Xe ở cột 8 khi Pháo Đen vẫn đứng đó, Pháo Đỏ sẽ mượn Pháo Đen làm ngòi ăn Xe.)'],
      ['X1-2','Đỏ ra Xe.'],
      ['X9-8','Đen ra Xe vào cột 8.'],
      ['P8-9','Đỏ đưa Pháo trái ra biên.'],
      ['M2.3','Đen nhảy Mã thứ hai.'],
      ['X9-8','Đỏ ra nốt Xe trái.'],
      ['T3.5','Đen lên Tượng. Khai cuộc hoàn tất.'],
    ]
  },
  {
    id:'si-giac-phao', group:'mem', level:2,
    name:'Sĩ giác Pháo', han:'士角炮',
    summary:'Đỏ đưa Pháo vào góc cung (tai Sĩ) thay vì vào giữa. Pháo vừa giữ cung vừa khiêu khích đối phương bày trận trước; phản công mạnh khi đối phương sai lầm.',
    ideas:[
      'Pháo ở tai Sĩ (P2-4) giữ cung, có thể chuyển sang cánh bên kia.',
      'Đỏ thường nhảy Mã và ra Xe cùng phía với Pháo.',
    ],
    traps:[
      'Pháo đứng chỗ Sĩ đi lên, nên phải để ý khi Tướng bị chiếu ở cột giữa.',
    ],
    moves:[
      ['P2-4','Đỏ đưa Pháo vào tai Sĩ — "Sĩ giác Pháo".'],
      ['M8.7','Đen nhảy Mã.'],
      ['M2.3','Đỏ nhảy Mã.'],
      ['X9-8','Đen ra Xe.'],
      ['X1-2','Đỏ ra Xe vào cột 2.'],
      ['B7.1','Đen tiến Tốt.'],
      ['B7.1','Đỏ tiến Tốt.'],
      ['M2.3','Đen nhảy Mã thứ hai.'],
      ['M8.7','Đỏ nhảy Mã thứ hai.'],
      ['T3.5','Đen lên Tượng.'],
    ]
  },
  {
    id:'qua-cung-phao', group:'mem', level:2,
    name:'Quá cung Pháo', han:'過宮炮',
    summary:'Đỏ đưa Pháo đi ngang qua trước cung sang tai Sĩ bên kia (P2-6). Hai Pháo ở gần nhau, vừa công vừa thủ vững chắc.',
    ideas:[
      'Pháo "qua cung" nhường cột 2 cho Mã và Xe ra nhanh.',
      'Thế trận thiên về phòng thủ, dễ dẫn tới thế giằng co.',
    ],
    traps:[
      'Hai Pháo dồn một cánh làm cánh kia mỏng; cần ra Xe đúng lúc.',
    ],
    moves:[
      ['P2-6','Đỏ đưa Pháo qua trước cung sang cột 6 — "Quá cung Pháo".'],
      ['M8.7','Đen nhảy Mã.'],
      ['M2.3','Đỏ nhảy Mã vào chỗ Pháo vừa rời đi.'],
      ['X9-8','Đen ra Xe.'],
      ['X1-2','Đỏ ra Xe.'],
      ['B7.1','Đen tiến Tốt.'],
      ['B7.1','Đỏ tiến Tốt.'],
      ['M2.3','Đen nhảy Mã thứ hai.'],
      ['M8.7','Đỏ nhảy Mã thứ hai.'],
      ['T3.5','Đen lên Tượng. Thế cờ cân bằng.'],
    ]
  },
];

// Chuyển ký hiệu thành nước đi thật (dùng cho bàn xem, Trainer, sách khai cuộc của máy)
const OPENINGS = OPENINGS_RAW.map(o=>{
  let b=Engine.initialBoard(), color=Engine.RED;
  const moves=[];
  for(const [text,caption] of o.moves){
    const m=Notation.parse(b,color,text);
    if(!m){ moves.push({error:`Không đọc được nước "${text}"`, text, caption}); break; }
    moves.push({from:m.from,to:m.to,text,caption});
    b=Engine.applyMove(b,m); color=Engine.otherColor(color);
  }
  return Object.assign({}, o, {moves});
});

// Nhánh biến và bẫy khai cuộc có nguồn (data-openings-ext.js, sinh bởi tools/make-openings-ext.js)
function autoCaption(b,m){
  const w=Coach.whyGood(b,m);
  if(!w.length) return 'Tiếp tục triển khai quân theo thế trận.';
  const t=w.join('; '); return t.charAt(0).toUpperCase()+t.slice(1)+'.';
}
function parseOpeningLine(texts, captions){
  let b=Engine.initialBoard(), color=Engine.RED; const out=[];
  for(let i=0;i<texts.length;i++){
    const m=Notation.parse(b,color,texts[i]);
    if(!m){ out.push({error:`Không đọc được nước "${texts[i]}"`, text:texts[i], caption:''}); break; }
    out.push({from:m.from,to:m.to,text:texts[i],caption:(captions&&captions[i])||autoCaption(b,m)});
    b=Engine.applyMove(b,m); color=Engine.otherColor(color);
  }
  return out;
}
OPENINGS.forEach(o=>{
  o.lines=[{id:'main', name:'Diễn biến chính', moves:o.moves}].concat(
    (typeof OPENING_LINES!=='undefined' && OPENING_LINES[o.id] ? OPENING_LINES[o.id] : []).map(l=>Object.assign({},l,{moves:parseOpeningLine(l.moves,l.captions)})));
});
if(typeof OPENING_TRAPS!=='undefined') OPENING_TRAPS.forEach(t=>{
  const moves=parseOpeningLine(t.moves,t.captions);
  const pt = t.point ? 2*t.point-1 : null;
  OPENINGS.push({id:'trap-'+t.id, group:'bay', level:2, isTrap:true, name:t.name, han:t.han, sources:t.sources, trapPly:pt,
    summary:t.lesson, ideas:[t.lesson],
    traps:[pt!=null && moves[pt] ? `Nước mắc bẫy: ${Math.floor(pt/2)+1}${pt%2?'...':'.'} ${moves[pt].text} — ${moves[pt].caption}` : ''].filter(Boolean),
    result: t.mate ? 'Kết thúc bằng chiếu bí.' : 'Kết thúc: bên đặt bẫy hơn rõ (máy đã kiểm).',
    moves, lines:[{id:'main', name:'Diễn biến', moves}]});
});

