/* =========================================================================
   ROOM — logic một phòng đấu (không phụ thuộc mạng, chạy được ở Worker lẫn Node)
   Dùng lại đúng luật ván của ứng dụng (Engine + Game), nên server là trọng tài:
   chỉ nhận nước hợp lệ, đúng lượt; tự xử thắng/thua/hoà theo luật ván.
   Người chơi nhận diện bằng "token" bí mật do trình duyệt tạo và giữ —
   mở lại trang hoặc rớt mạng thì vào lại đúng ghế. Không gửi token cho ai khác.
   ========================================================================= */
const RoomCore = (function(){
  const NAME_MAX=24, TEXT_MAX=200, CHAT_MAX=60, MOVES_MAX=600;
  const SEATS=['red','black'];
  const other = s => s==='red' ? 'black' : 'red';
  const cleanName = s => String(s||'').replace(/[\u0000-\u001f\u007f<>]/g,'').trim().slice(0,NAME_MAX) || 'Kỳ thủ';
  const cleanText = s => String(s||'').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g,'').trim().slice(0,TEXT_MAX);
  const isSq = a => Array.isArray(a) && a.length===2 && Number.isInteger(a[0]) && Number.isInteger(a[1]) && a[0]>=0 && a[0]<10 && a[1]>=0 && a[1]<9;

  function fresh(code){
    return {v:1, code, created:Date.now(), updated:Date.now(), seats:{red:null, black:null}, game:1, moves:[], result:null, offer:null, chat:[], history:[]};
  }
  function replay(st){
    const g=Game.create();
    for(const [a,b,c,d] of st.moves) g.play({from:[a,b], to:[c,d]});
    if(st.result) g.result=Object.assign({state:'over'}, st.result);
    return g;
  }
  // số nửa nước phải lùi để bỏ nước gần nhất của `seat`
  function takebackCount(st, g, seat){
    const n = g.turn()===seat ? 2 : 1;
    if(st.moves.length<n) return 0;
    const g2=Game.create(); // màu của nước thứ i: chẵn = Đỏ (ván luôn bắt đầu từ thế chuẩn)
    const idx=st.moves.length-n, colorAt = idx%2===0 ? g2.startTurn : other(g2.startTurn);
    return colorAt===seat ? n : 0;
  }

  class Room {
    constructor(state){ this.st=state||null; this.g=state ? replay(state) : null; }
    exists(){ return !!this.st; }
    seatOf(token){
      if(!this.st || !token) return null;
      for(const s of SEATS) if(this.st.seats[s] && this.st.seats[s].token===token) return s;
      return null;
    }
    sys(text){ this.pushChat({sys:true, text}); }
    pushChat(m){ m.t=Date.now(); this.st.chat.push(m); if(this.st.chat.length>CHAT_MAX) this.st.chat.splice(0, this.st.chat.length-CHAT_MAX); }

    // conn: {token, name}. Trả về {changed} hoặc {error, close}
    join(msg, conn, code){
      const token = typeof msg.token==='string' && msg.token.length>=16 && msg.token.length<=64 ? msg.token : null;
      if(!token) return {error:'bad_token', close:true};
      const name = cleanName(msg.name);
      conn.token=token; conn.name=name;
      if(!this.st){
        if(!msg.create) return {error:'not_found', close:true};
        this.st=fresh(code); this.g=replay(this.st);
        let color = msg.create.color;
        if(color!=='red' && color!=='black') color = Math.random()<0.5 ? 'red' : 'black';
        this.st.seats[color]={name, token};
        this.sys(`${name} đã tạo phòng (cầm quân ${color==='red'?'Đỏ':'Đen'}).`);
        return {changed:true};
      }
      let seat=this.seatOf(token);
      if(!seat && msg.create) return {error:'exists', close:true};
      if(seat){
        if(this.st.seats[seat].name!==name){ this.st.seats[seat].name=name; return {changed:true}; }
        return {changed:false};
      }
      const free = SEATS.find(s=>!this.st.seats[s]);
      if(free){
        this.st.seats[free]={name, token};
        this.sys(`${name} đã vào phòng (cầm quân ${free==='red'?'Đỏ':'Đen'}).`);
        return {changed:true};
      }
      return {changed:false};   // phòng đủ người → vào xem
    }

    handle(msg, conn){
      const st=this.st, g=this.g, seat=this.seatOf(conn.token);
      if(!st) return {error:'not_found'};
      const t=msg.type;
      if(t==='chat'){
        const text=cleanText(msg.text); if(!text) return {error:'empty'};
        this.pushChat({by:conn.name, seat, text});
        return {changed:true};
      }
      if(!seat) return {error:'spectator'};
      const name=st.seats[seat].name;
      if(t==='move'){
        if(st.result) return {error:'game_over'};
        if(g.turn()!==seat) return {error:'not_your_turn'};
        if(msg.n!==st.moves.length) return {error:'stale'};
        if(!isSq(msg.from) || !isSq(msg.to)) return {error:'bad_move'};
        const legal=g.legalMoves().some(m=>m.from[0]===msg.from[0]&&m.from[1]===msg.from[1]&&m.to[0]===msg.to[0]&&m.to[1]===msg.to[1]);
        if(!legal) return {error:'illegal'};
        if(st.moves.length>=MOVES_MAX) return {error:'too_long'};
        g.play({from:msg.from.slice(), to:msg.to.slice()});
        st.moves.push([msg.from[0],msg.from[1],msg.to[0],msg.to[1]]);
        if(g.result){ st.result={winner:g.result.winner, reason:g.result.reason}; this.finish(); }
        if(st.offer && st.offer.kind!=='rematch') st.offer=null;
        return {changed:true};
      }
      if(t==='offer'){
        const kind=msg.kind;
        if(!['draw','takeback','rematch'].includes(kind)) return {error:'bad_offer'};
        if(!st.seats[other(seat)]) return {error:'no_opponent'};
        if(kind==='rematch' ? !st.result : !!st.result) return {error:'bad_offer'};
        if(st.offer && st.offer.by!==seat && st.offer.kind===kind) return this.accept(seat);   // hai bên cùng đề nghị
        let n=0;
        if(kind==='takeback'){ n=takebackCount(st,g,seat); if(!n) return {error:'nothing_to_take_back'}; }
        st.offer={kind, by:seat, at:st.moves.length, n};
        return {changed:true};
      }
      if(t==='reply'){
        if(!st.offer || st.offer.by===seat) return {error:'no_offer'};
        if(msg.accept) return this.accept(seat);
        const k=st.offer.kind; st.offer=null;
        this.sys(`${name} từ chối ${k==='draw'?'hoà':k==='takeback'?'cho đi lại':'tái đấu'}.`);
        return {changed:true};
      }
      if(t==='cancel'){
        if(!st.offer || st.offer.by!==seat) return {error:'no_offer'};
        st.offer=null; return {changed:true};
      }
      if(t==='resign'){
        if(st.result) return {error:'game_over'};
        if(!st.moves.length && !st.seats[other(seat)]) return {error:'no_opponent'};
        st.result={winner:other(seat), reason:'resign'}; st.offer=null; this.finish();
        return {changed:true};
      }
      return {error:'unknown'};
    }
    accept(seat){
      const st=this.st, o=st.offer, name=st.seats[seat].name;
      st.offer=null;
      if(o.at!==st.moves.length && o.kind!=='rematch') return {changed:true};   // đề nghị đã cũ
      if(o.kind==='draw'){ st.result={winner:null, reason:'agreed'}; this.g.result=Object.assign({state:'over'},st.result); this.finish(); this.sys('Hai bên đồng ý hoà.'); }
      else if(o.kind==='takeback'){
        st.moves.splice(st.moves.length-o.n, o.n); this.g=replay(st);
        this.sys(`${name} đồng ý cho đi lại.`);
      } else {
        // tái đấu: đổi màu quân
        const r=st.seats.red; st.seats.red=st.seats.black; st.seats.black=r;
        st.moves=[]; st.result=null; st.game++; this.g=replay(st);
        this.sys(`Ván ${st.game} bắt đầu — hai bên đổi màu quân.`);
      }
      return {changed:true};
    }
    finish(){
      const st=this.st;
      st.history.push({game:st.game, red:st.seats.red&&st.seats.red.name, black:st.seats.black&&st.seats.black.name, moves:st.moves.slice(), result:st.result, t:Date.now()});
      if(st.history.length>20) st.history.shift();
    }
    // Trạng thái gửi cho một kết nối (không bao giờ kèm token)
    view(conn, online){
      const st=this.st, you=this.seatOf(conn.token);
      const seat=s=> st.seats[s] ? {name:st.seats[s].name, online:!!online[s]} : null;
      return {type:'state', code:st.code, you: you||'spectator', seats:{red:seat('red'), black:seat('black')}, game:st.game,
        moves:st.moves, result:st.result, offer: st.offer ? {kind:st.offer.kind, by:st.offer.by} : null, chat:st.chat, spectators:online.spectators||0};
    }
  }
  return {Room, fresh, NAME_MAX, TEXT_MAX};
})();
