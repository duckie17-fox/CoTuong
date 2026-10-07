/* =========================================================================
   CẤP ĐỘ MÁY — đặt tên theo thang đẳng cấp của Hiệp hội Cờ tướng Trung Quốc.
   Đây là MÔ PHỎNG TƯƠNG ĐỐI, không phải đo bằng thi đấu với người thật. Phần mô tả
   ghi kết quả đo bằng tools/selfplay.js (mỗi cặp cấp liền kề, đổi màu luân phiên).
   ========================================================================= */
const AI_LEVELS = [
  {id:1,  name:'Tân thủ',           maxDepth:1, timeMs:300,  noise:120, blunder:0.25,  book:false},
  {id:2,  name:'Kỳ sĩ cấp 14–12',   maxDepth:1, timeMs:300,  noise:80,  blunder:0.15,  book:false},
  {id:3,  name:'Kỳ sĩ cấp 11–9',    maxDepth:2, timeMs:400,  noise:60,  blunder:0.10,  book:false},
  {id:4,  name:'Kỳ sĩ cấp 8–7',     maxDepth:2, timeMs:500,  noise:30,  blunder:0.05,  book:false},
  {id:5,  name:'Kỳ sĩ cấp 6–5',     maxDepth:3, timeMs:600,  noise:22,  blunder:0.015, book:false},
  {id:6,  name:'Kỳ sĩ cấp 4–3',     maxDepth:3, timeMs:800,  noise:12,  blunder:0,     book:false},
  {id:7,  name:'Kỳ sĩ cấp 2',       maxDepth:4, timeMs:800,  noise:15,  blunder:0,     book:false},
  {id:8,  name:'Kỳ sĩ cấp 1',       maxDepth:4, timeMs:1000, noise:0,   blunder:0,     book:false},
  {id:9,  name:'Ứng viên đại sư',   maxDepth:5, timeMs:2000, noise:0,   blunder:0,     book:true},
  {id:10, name:'Đại sư địa phương', maxDepth:40,timeMs:4000, noise:0,   blunder:0,     book:true},
];
// Mô tả cho người chơi: cách máy chơi ở mỗi cấp + kết quả đo với cấp ngay dưới (LEVEL_MEASURED)
const LEVEL_MEASURED = {};
AI_LEVELS.forEach(l=>{
  const how = l.blunder>=0.1 ? 'hay đi nước ngẫu nhiên, bỏ sót quân'
    : l.blunder>0 ? 'thỉnh thoảng sơ suất'
    : l.noise>0 ? 'không sơ suất ngẫu nhiên, đôi khi chọn nước chưa tối ưu'
    : 'luôn chọn nước tốt nhất tìm được';
  const depth = l.maxDepth>=40 ? `tính tới ${l.timeMs/1000} giây/nước` : `nhìn trước ${l.maxDepth} nửa nước`;
  l.desc = `${depth[0].toUpperCase()+depth.slice(1)}${l.book?', có sách khai cuộc':''}, ${how}` + (LEVEL_MEASURED[l.id] ? ` · ${LEVEL_MEASURED[l.id]}` : '');
});
// Thang cấp cũ (6 cấp) → thang mới (10 cấp): cấp đã lưu và lịch sử ván trước đây vẫn hiển thị đúng
const LADDER_VERSION=2, OLD_LEVEL_MAP={1:1,2:4,3:6,4:8,5:9,6:10};
function recLevel(rec){ return rec.ladder===LADDER_VERSION ? rec.level : (OLD_LEVEL_MAP[rec.level]||rec.level); }
function savedAiLevel(){
  let lv=parseInt(safeLS_get('xq_ai_level')||'5',10);
  if(safeLS_get('xq_ai_ladder')!==String(LADDER_VERSION)){
    if(safeLS_get('xq_ai_level')) lv=OLD_LEVEL_MAP[lv]||5;
    safeLS_set('xq_ai_ladder',String(LADDER_VERSION)); safeLS_set('xq_ai_level',String(lv));
  }
  return AI_LEVELS.some(l=>l.id===lv) ? lv : 5;
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

