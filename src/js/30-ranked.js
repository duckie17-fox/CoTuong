/* =========================================================================
   XẾP HẠNG — bậc hạng theo Elo, 20 cấp máy xếp hạng, nick máy (spec v4).
   Dùng chung cho ứng dụng và máy chủ (tools/build-server.js ghép file này vào server).
   ========================================================================= */
const Ranked = (function(){
  // Bậc hạng: [tên, Elo bắt đầu]. Mỗi bậc (trừ Thách Đấu) chia III → II → I.
  const TIERS = [
    ['Đồng', -Infinity], ['Bạc', 1000], ['Vàng', 1150], ['Bạch Kim', 1300], ['Kim Cương', 1450],
    ['Tinh Anh', 1600], ['Cao Thủ', 1800], ['Đại Cao Thủ', 2000], ['Thách Đấu', 2200],
  ];
  const TIER_KEYS = ['dong','bac','vang','bachkim','kimcuong','tinhanh','caothu','daicaothu','thachdau'];
  function tierOf(elo){
    let i=TIERS.length-1; while(i>0 && elo<TIERS[i][1]) i--;
    const [name, lo]=TIERS[i], key=TIER_KEYS[i];
    if(i===TIERS.length-1) return {name, key, div:'', label:name, index:i};
    let div;
    if(i===0) div = elo<900 ? 'III' : elo<950 ? 'II' : 'I';
    else { const span=(TIERS[i+1][1]-lo)/3; div = elo<lo+span ? 'III' : elo<lo+2*span ? 'II' : 'I'; }
    return {name, key, div, label:`${name} ${div}`, index:i};
  }

  // 20 cấp máy xếp hạng: nội suy từ 10 cấp luyện tập (độ sâu, nhiễu, sơ suất, thời gian/nước).
  // Elo cố định là ước tính: cấp n = 700 + (n−1)·85.
  const BOT_LEVELS = [
    {maxDepth:1, timeMs:300,  noise:150, blunder:0.32},
    {maxDepth:1, timeMs:300,  noise:120, blunder:0.25},
    {maxDepth:1, timeMs:300,  noise:100, blunder:0.20},
    {maxDepth:1, timeMs:300,  noise:80,  blunder:0.15},
    {maxDepth:1, timeMs:300,  noise:60,  blunder:0.11},
    {maxDepth:1, timeMs:300,  noise:45,  blunder:0.08},
    {maxDepth:2, timeMs:400,  noise:45,  blunder:0.07},
    {maxDepth:2, timeMs:400,  noise:40,  blunder:0.06},
    {maxDepth:2, timeMs:500,  noise:30,  blunder:0.045},
    {maxDepth:2, timeMs:500,  noise:20,  blunder:0.03},
    {maxDepth:3, timeMs:600,  noise:30,  blunder:0.025},
    {maxDepth:3, timeMs:600,  noise:25,  blunder:0.02},
    {maxDepth:3, timeMs:700,  noise:15,  blunder:0.01},
    {maxDepth:3, timeMs:800,  noise:10,  blunder:0},
    {maxDepth:4, timeMs:800,  noise:12,  blunder:0},
    {maxDepth:4, timeMs:1200, noise:6,   blunder:0},
    {maxDepth:5, timeMs:2000, noise:0,   blunder:0, book:true},
    {maxDepth:6, timeMs:2500, noise:0,   blunder:0, book:true},
    {maxDepth:40,timeMs:3000, noise:0,   blunder:0, book:true},
    {maxDepth:40,timeMs:4000, noise:0,   blunder:0, book:true},
  ].map((l,i)=>Object.assign(l, {level:i+1, elo:700+i*85}));
  // Cấp máy cho người chơi có Elo `elo`: cấp đầu tiên có Elo ≥ elo (nhỉnh hơn một chút)
  function botLevelFor(elo){
    const l=BOT_LEVELS.find(b=>b.elo>=elo);
    return l ? l.level : BOT_LEVELS.length;
  }

  // Nick máy kiểu game thủ Việt — sinh từ một số ngẫu nhiên (seed) để máy chủ và ứng dụng ra cùng tên
  const NAMES = ['Tuấn','Hùng','Long','Minh','Huy','Nam','Phong','Khánh','Đạt','Quân','Linh','Trang','Vy','Thảo','Bảo',
    'Duy','Tú','Sơn','Hiếu','Nhật','Khoa','Tâm','Lâm','Thắng','Trung','Đức','Hải','Kiên','Vũ','Hoàng','Phúc','Thịnh'];
  const ASCII = s => s.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D');
  const NICK_SUFFIX = ['Đẹp Trai','Cờ Thủ','Pro','Vô Đối','Tàng Hình','Lạnh Lùng','Bất Bại','Mắt Nai','Tốc Độ','Thần Đồng'];
  const PLACES = ['Hà Nội','Sài Gòn','Đà Nẵng','Hải Phòng','Cần Thơ','Huế','Nghệ An','Thanh Hoá','Quảng Ninh','Bình Dương','Nam Định','Đồng Nai'];
  const CHESS = ['Pháo Đầu','Hắc Mã','Xe Thần','Mã Hồi','Tốt Qua Sông','Thuận Pháo','Bình Phong Mã','Song Xe','Phi Tượng','Liên Hoàn Mã'];
  const CUTE = ['Bé Mèo Ú','Gấu Lười','Tèo Em','Cún Con','Thỏ Bông','Mèo Mướp','Cá Mập Con','Sóc Nâu','Heo Hồng','Chuột Nhắt'];
  const TAGS = ['pro','dz','vip','tv','2k','gaming','cotuong','99','vn','official'];
  function rng(seed){ let s=(seed>>>0)||1; return ()=>{ s^=s<<13; s>>>=0; s^=s>>>17; s^=s<<5; s>>>=0; return s/4294967296; }; }
  function botNick(seed){
    const r=rng(seed), pick=a=>a[Math.floor(r()*a.length)], n=pick(NAMES), num=()=>String(Math.floor(r()*100)).padStart(2,'0');
    const yr=()=>String(1990+Math.floor(r()*18)), k=Math.floor(r()*10);
    switch(k){
      case 0: return `${n}${yr()}`;
      case 1: return `${ASCII(n).toLowerCase()}_${pick(TAGS)}`;
      case 2: return `xX${ASCII(n)}Xx`;
      case 3: return `${n} ${pick(NICK_SUFFIX)}`;
      case 4: return `Cờ Thủ ${pick(PLACES)}`;
      case 5: return `${pick(CHESS)} ${pick(PLACES)}`;
      case 6: return `${pick(CUTE)} ${num()}`;
      case 7: return `${ASCII(n).toLowerCase()}${pick(['dz','pro','cute','123','kute'])}${num()}`;
      case 8: return `${pick(CHESS)} ${num()}`;
      default: return `${n}.${ASCII(pick(NAMES)).toLowerCase()}${Math.floor(r()*10)}`;
    }
  }
  return {TIERS, tierOf, BOT_LEVELS, botLevelFor, botNick, MATCH_WAIT_MS:8000, ELO_RANGE:200};
})();
