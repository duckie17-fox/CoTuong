/* =========================================================================
   CẤP ĐỘ MÁY — đặt tên theo thang đẳng cấp của Hiệp hội Cờ tướng Trung Quốc.
   Đây là MÔ PHỎNG TƯƠNG ĐỐI, không phải đo bằng thi đấu với người thật. Phần mô tả
   ghi kết quả đo bằng tools/ladder.js (mỗi cặp cấp liền kề, đổi màu luân phiên).
   ========================================================================= */
// Tên cấp theo cấp bậc võ tướng thời xưa (người dùng chọn): Tiểu Tốt → Nguyên Soái.
// elo: cùng thông số với cấp máy xếp hạng tương ứng (Ranked.BOT_LEVELS) để quy ra bậc hạng.
const AI_LEVELS = [
  {id:1,  name:'Tiểu Tốt',        maxDepth:1, timeMs:300,  noise:120, blunder:0.25, book:false, elo:785,  desc:'Đi gần như ngẫu nhiên, hay để mất quân. Hợp người vừa học luật.'},
  {id:2,  name:'Ngũ Trưởng',       maxDepth:1, timeMs:300,  noise:80,  blunder:0.15, book:false, elo:955,  desc:'Biết ăn quân bị bỏ trống nhưng vẫn hay sơ hở.'},
  {id:3,  name:'Thập Trưởng',      maxDepth:1, timeMs:300,  noise:45,  blunder:0.08, book:false, elo:1125, desc:'Ít sơ hở hơn, bắt đầu biết giữ quân.'},
  {id:4,  name:'Bách Hộ',            maxDepth:2, timeMs:400,  noise:40,  blunder:0.06, book:false, elo:1295, desc:'Nhìn trước 2 nước, hiếm khi cho không quân.'},
  {id:5,  name:'Thiên Hộ',      maxDepth:2, timeMs:500,  noise:20,  blunder:0.03, book:false, elo:1465, desc:'Chơi chắc tay, rất ít sơ suất.'},
  {id:6,  name:'Hiệu Úy',           maxDepth:3, timeMs:600,  noise:25,  blunder:0.02, book:false, elo:1635, desc:'Tính trước 3 nước, biết đánh đòn đơn giản.'},
  {id:7,  name:'Tướng Quân',       maxDepth:3, timeMs:800,  noise:10,  blunder:0,    book:false, elo:1805, desc:'Không sơ suất, thấy được đòn chiến thuật.'},
  {id:8,  name:'Đại Tướng',        maxDepth:4, timeMs:800,  noise:12,  blunder:0,    book:false, elo:1890, desc:'Tính sâu, phòng thủ chắc.'},
  {id:9,  name:'Thượng Tướng',     maxDepth:5, timeMs:2000, noise:0,   blunder:0,    book:true,  elo:2060, desc:'Thuộc khai cuộc, luôn chọn nước tốt nhất tìm được.'},
  {id:10, name:'Nguyên Soái', maxDepth:40,timeMs:4000, noise:0,   blunder:0,    book:true,  elo:2315, desc:'Mạnh nhất: dùng hết sức máy, nghĩ tới 4 giây mỗi nước.'},
];
// Đo bằng tools/ladder.js: mỗi cặp cấp liền kề, cùng khai cuộc ngẫu nhiên, đổi màu (40–64 ván/cặp) — cấp sau thắng cấp trước bao nhiêu %
const LEVEL_MEASURED = {2:83, 3:84, 4:75, 5:84, 6:84, 7:96, 8:85, 9:85, 10:74};
// Thang cấp cũ (6 cấp) → thang mới (10 cấp): cấp đã lưu và lịch sử ván trước đây vẫn hiển thị đúng
const LADDER_VERSION=2, OLD_LEVEL_MAP={1:1,2:4,3:6,4:8,5:9,6:10};
function recLevel(rec){ return rec.ladder===LADDER_VERSION ? rec.level : (OLD_LEVEL_MAP[rec.level]||rec.level); }
function savedAiLevel(){
  let lv=parseInt(safeLS_get('xq_ai_level')||'2',10);   // người mới: cấp 2
  if(safeLS_get('xq_ai_ladder')!==String(LADDER_VERSION)){
    if(safeLS_get('xq_ai_level')) lv=OLD_LEVEL_MAP[lv]||5;
    safeLS_set('xq_ai_ladder',String(LADDER_VERSION)); safeLS_set('xq_ai_level',String(lv));
  }
  return AI_LEVELS.some(l=>l.id===lv) ? lv : 2;
}
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

