/* =========================================================================
   WORKER — Cloudflare Worker + Durable Object cho Sa trường và tài khoản
   - GET  /              → kiểm tra server sống
   - /api/*              → tài khoản, đồng bộ, bạn bè, mời đấu, xếp hạng (Accounts, dữ liệu ở D1 "DB")
   - GET  /room/<MÃ>     → nâng cấp WebSocket, vào phòng <MÃ> (mỗi phòng một Durable Object)
   Dùng WebSocket Hibernation: lúc hai người đang nghĩ nước, Object được ngủ, không tốn tiền.
   Phần trên của file (Engine, Notation, Game, RoomCore, Accounts) được tools/build-server.js ghép vào.
   ========================================================================= */
const CODE_RE = /^\/room\/([A-Z0-9]{4,12})$/;
const MSG_MAX = 4000;
const IDLE_MS = 30*24*3600*1000;   // phòng không ai dùng 30 ngày thì xoá

export default {
  async fetch(req, env){
    const url=new URL(req.url);
    if(url.pathname==='/' || url.pathname==='/health')
      return new Response('Co Tuong online server: OK', {headers:{'content-type':'text/plain; charset=utf-8', 'access-control-allow-origin':'*'}});
    const api=await Accounts.handle(req, env);
    if(api) return api;
    const m=url.pathname.match(CODE_RE);
    if(m){
      if(req.headers.get('Upgrade')!=='websocket') return new Response('Expected WebSocket', {status:426});
      const stub=env.ROOMS.get(env.ROOMS.idFromName(m[1]));
      return stub.fetch(req);
    }
    return new Response('Not found', {status:404});
  }
};

export class GameRoom {
  constructor(ctx, env){
    this.ctx=ctx; this.env=env; this.room=null;
    // "ping" → "pong" trả lời ngay mà không đánh thức Object
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));
  }
  async load(){
    if(!this.room){ const st=await this.ctx.storage.get('state'); this.room=new RoomCore.Room(st||null); }
    return this.room;
  }
  async fetch(req){
    const code=new URL(req.url).pathname.match(CODE_RE)[1];
    const pair=new WebSocketPair(), client=pair[0], server=pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({code, token:null, name:null, uid:null, joined:false});
    return new Response(null, {status:101, webSocket:client});
  }
  // Ghế nào đang có kết nối
  online(skip){
    const online={red:false, black:false, spectators:0};
    for(const s of this.ctx.getWebSockets()){
      if(s===skip) continue;
      const a=s.deserializeAttachment()||{}; if(!a.joined) continue;
      const seat=this.room.seatFor(a); if(seat) online[seat]=true; else online.spectators++;
    }
    return online;
  }
  async save(){
    const room=this.room;
    // ván vừa xong của người đã đăng nhập → ghi vào D1, tính Elo
    if(room.st.report){
      let r=null;
      if(this.env.DB){ try{ r=await Accounts.recordGame(this.env.DB, room.st.report, Date.now()); }catch(e){ console.error(e); } }
      room.setElo(r);
    }
    room.st.updated=Date.now();
    await this.ctx.storage.put('state', room.st);
    await this.ctx.storage.setAlarm(Date.now()+IDLE_MS);
  }
  async webSocketMessage(ws, data){
    if(typeof data!=='string' || data.length>MSG_MAX) return;
    let msg; try{ msg=JSON.parse(data); }catch(e){ return; }
    if(!msg || typeof msg!=='object') return;
    const room=await this.load(), att=ws.deserializeAttachment()||{};
    const conn={token:att.token, name:att.name, uid:att.uid};
    let res;
    if(msg.type==='join'){
      if(msg.auth && this.env.DB){
        try{ const s=await Accounts.sessionUser(this.env.DB, msg.auth, Date.now()); if(s) conn.user=s.user; }catch(e){ console.error(e); }
      }
      res=room.join(msg, conn, att.code);
    }
    else if(!att.joined) res={error:'not_joined'};
    else res=room.handle(msg, conn, {now:Date.now(), online:this.online()});
    if(res.error){
      ws.send(JSON.stringify({type:'error', error:res.error}));
      if(res.close) ws.close(4000, res.error);
      return;
    }
    if(msg.type==='join') ws.serializeAttachment(Object.assign(att, {token:conn.token, name:conn.name, uid:conn.uid||null, joined:true}));
    if(res.changed) await this.save();
    this.broadcast();
  }
  async gone(ws){
    const room=await this.load();
    if(room.exists()){
      const a=ws.deserializeAttachment()||{}, seat=a.joined ? room.seatFor(a) : null;
      if(seat && !this.online(ws)[seat] && room.markLeft(seat, Date.now())) await this.save();
    }
    this.broadcast(ws);
  }
  async webSocketClose(ws){ await this.gone(ws); }
  async webSocketError(ws){ await this.gone(ws); }
  broadcast(skip){
    if(!this.room || !this.room.exists()) return;
    const online=this.online(skip);
    for(const s of this.ctx.getWebSockets()){
      if(s===skip) continue;
      const a=s.deserializeAttachment()||{}; if(!a.joined) continue;
      try{ s.send(JSON.stringify(this.room.view(a, online))); }catch(e){}
    }
  }
  async alarm(){ await this.ctx.storage.deleteAll(); this.room=null; }
}
