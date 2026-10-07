/* =========================================================================
   CẤP ĐỘ MÁY — đặt tên theo thang đẳng cấp của Hiệp hội Cờ tướng Trung Quốc.
   Đây là MÔ PHỎNG TƯƠNG ĐỐI, được hiệu chỉnh bằng tự đấu (test/selfplay.js),
   không phải đo bằng thi đấu với người thật.
   ========================================================================= */
const AI_LEVELS = [
  {id:1, name:'Tân thủ',           desc:'Vừa biết luật (kỳ sĩ cấp 16–11)', maxDepth:1, timeMs:300,  noise:120, blunder:0.25, book:false},
  {id:2, name:'Kỳ sĩ cấp 10–7',    desc:'Chơi cờ phong trào',              maxDepth:2, timeMs:500,  noise:40,  blunder:0.05, book:false},
  {id:3, name:'Kỳ sĩ cấp 6–4',     desc:'Giải cấp phường/xã',              maxDepth:3, timeMs:800,  noise:15,  blunder:0,    book:false},
  {id:4, name:'Kỳ sĩ cấp 3–2',     desc:'≈ vô địch quận/huyện',            maxDepth:4, timeMs:1000, noise:0,   blunder:0,    book:false},
  {id:5, name:'Kỳ sĩ cấp 1',       desc:'≈ vô địch thành phố',             maxDepth:5, timeMs:2000, noise:0,   blunder:0,    book:true},
  {id:6, name:'Đại sư địa phương', desc:'≈ tuyển thủ tỉnh',                maxDepth:40,timeMs:4000, noise:0,   blunder:0,    book:true},
];
// Sách khai cuộc: lấy từ chính các thế ở tab Khai cuộc
function buildOpeningBook(openings){
  const book=new Map();
  for(const o of openings){
    if(o.isTrap) continue;                           // không cho máy đi theo đường mắc bẫy
    for(const line of (o.lines||[{id:'main',moves:o.moves}])){
      const g=Game.create();
      for(const m of line.moves){
        if(m.error) break;
        const k=Game.key(g.board(), g.turn());
        if(!book.has(k)) book.set(k,[]);
        const arr=book.get(k);
        if(!arr.some(x=>x.move.from+''===m.from+''&&x.move.to+''===m.to+'')) arr.push({move:{from:m.from,to:m.to}, opening:o.name+(line.id!=='main'?' — '+line.name:''), text:m.text});
        g.play(m);
      }
    }
  }
  return book;
}

