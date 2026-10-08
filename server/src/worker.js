/* =========================================================================
   WORKER — Cloudflare Worker + Durable Object cho Sa trường (đấu với bạn bè)
   - GET  /              → kiểm tra server sống
   - GET  /room/<MÃ>     → nâng cấp WebSocket, vào phòng <MÃ> (mỗi phòng một Durable Object)
   Dùng WebSocket Hibernation: lúc hai người đang nghĩ nước, Object được ngủ, không tốn tiền.
   Phần trên của file (Engine, Notation, Game, RoomCore) được tools/build-server.js ghép vào.
   ========================================================================= */
const CODE_RE = /^\/room\/([A-Z0-9]{4,12})$/;
const MSG_MAX = 4000;
const IDLE_MS = 30*24*3600*1000;   // phòng không ai dùng 30 ngày thì xoá

export default {
  async fetch(req, env){
    const url=new URL(req.url);
    if(url.pathname==='/' || url.pathname==='/health')
      return new Response('Co Tuong online server: OK', {headers:{'content-type':'text/plain; charset=utf-8', 'access-control-allow-origin':'*'}});
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
    this.ctx=ctx; this.room=null;
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
    server.serializeAttachment({code, token:null, name:null, joined:false});
    return new Response(null, {status:101, webSocket:client});
  }
  async webSocketMessage(ws, data){
    if(typeof data!=='string' || data.length>MSG_MAX) return;
    let msg; try{ msg=JSON.parse(data); }catch(e){ return; }
    if(!msg || typeof msg!=='object') return;
    const room=await this.load(), att=ws.deserializeAttachment()||{};
    const conn={token:att.token, name:att.name};
    let res;
    if(msg.type==='join') res=room.join(msg, conn, att.code);
    else if(!att.joined) res={error:'not_joined'};
    else res=room.handle(msg, conn);
    if(res.error){
      ws.send(JSON.stringify({type:'error', error:res.error}));
      if(res.close) ws.close(4000, res.error);
      return;
    }
    if(msg.type==='join') ws.serializeAttachment(Object.assign(att, {token:conn.token, name:conn.name, joined:true}));
    if(res.changed){
      room.st.updated=Date.now();
      await this.ctx.storage.put('state', room.st);
      await this.ctx.storage.setAlarm(Date.now()+IDLE_MS);
    }
    this.broadcast();
  }
  async webSocketClose(ws){ await this.load(); this.broadcast(ws); }
  async webSocketError(ws){ await this.load(); this.broadcast(ws); }
  broadcast(skip){
    if(!this.room || !this.room.exists()) return;
    const socks=this.ctx.getWebSockets().filter(s=>s!==skip);
    const online={red:false, black:false, spectators:0};
    const atts=socks.map(s=>s.deserializeAttachment()||{});
    atts.forEach(a=>{ if(!a.joined) return; const s=this.room.seatOf(a.token); if(s) online[s]=true; else online.spectators++; });
    socks.forEach((s,i)=>{ if(!atts[i].joined) return; try{ s.send(JSON.stringify(this.room.view(atts[i], online))); }catch(e){} });
  }
  async alarm(){ await this.ctx.storage.deleteAll(); this.room=null; }
}
