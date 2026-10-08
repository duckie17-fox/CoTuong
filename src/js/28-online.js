/* =========================================================================
   SA TRƯỜNG — đấu với bạn bè qua server (Cloudflare Worker, xem server/)
   - Server là trọng tài: client chỉ gửi ý định (đi quân, xin hoà…), hiển thị
     theo trạng thái server gửi về. Nước đi được vẽ trước cho mượt, server sai
     thì vẽ lại theo server.
   - Mỗi trình duyệt có một "token" bí mật để giữ ghế: tải lại trang / rớt mạng
     rồi vào lại link là ngồi đúng ghế cũ.
   ========================================================================= */
const ONLINE_DEFAULT_SERVER = /*@@ONLINE_SERVER@@*/'';
const ONLINE_WEB_URL = 'https://duckie17-fox.github.io/CoTuong/';
const ONLINE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // bỏ O/0, I/1 cho dễ đọc
const ONLINE_QUICK = ['Chào bạn 👋', 'Nước hay! 👍', 'Để mình nghĩ chút 🤔', 'Ối, sơ suất rồi 😅', 'Ván hay, cảm ơn bạn! 🤝'];
const ONLINE_ERR = {
  not_found:'Không có phòng này. Kiểm tra lại mã phòng.', exists:'Mã phòng đã có người dùng.', bad_token:'Lỗi nhận diện trình duyệt.',
  not_your_turn:'Chưa tới lượt bạn.', illegal:'Nước đi không hợp lệ.', stale:'Ván vừa thay đổi, đã cập nhật lại bàn cờ.',
  game_over:'Ván đã kết thúc.', spectator:'Bạn đang xem, không đi quân được.', no_opponent:'Chưa có đối thủ trong phòng.',
  nothing_to_take_back:'Bạn chưa có nước nào để xin đi lại.', no_offer:'Đề nghị không còn hiệu lực.',
};

const Online = (function(){
  const st = { ws:null, code:null, server:null, room:null, game:null, local:null, conn:'idle', retry:0, retryTimer:0, ping:0,
    widget:null, ctl:null, flipped:false, create:null, lastMoves:-1, lastResultKey:null, msg:'', msgTimer:0, chatSeen:0 };

  /* ---------- tiện ích ---------- */
  function randomHex(n){ const a=new Uint8Array(n); (window.crypto||{}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_,i)=>a[i]=Math.random()*256|0); return [...a].map(x=>x.toString(16).padStart(2,'0')).join(''); }
  function token(){ let t=safeLS_get('xq_online_token'); if(!t || t.length<16){ t=randomHex(16); safeLS_set('xq_online_token',t); } return t; }
  function myName(){ return (safeLS_get('xq_online_name')||'').trim(); }
  function newCode(){ const a=new Uint8Array(6); crypto.getRandomValues(a); return [...a].map(x=>ONLINE_CODE_CHARS[x%ONLINE_CODE_CHARS.length]).join(''); }
  function params(){ try{ return new URLSearchParams(location.search); }catch(e){ return new URLSearchParams(''); } }
  // Mã phòng từ chuỗi người dùng dán vào: mã trần hoặc link có ?room=
  function parseCode(text){
    text=String(text||'').trim();
    const m=text.match(/[?&#]room=([A-Za-z0-9]{4,12})/); if(m) return m[1].toUpperCase();
    const c=text.toUpperCase().replace(/[^A-Z0-9]/g,'');
    return /^[A-Z0-9]{4,12}$/.test(c) ? c : null;
  }
  function normServer(u){
    u=String(u||'').trim().replace(/\/+$/,''); if(!u) return '';
    if(/^https?:\/\//i.test(u)) u=u.replace(/^http/i,'ws');
    return /^wss?:\/\/[^\s]+$/i.test(u) ? u : '';
  }
  function server(){
    const q=normServer(params().get('server'));
    if(q) return q;
    return normServer(safeLS_get('xq_online_server')) || normServer(ONLINE_DEFAULT_SERVER);
  }
  function inviteLink(code){
    let base;
    try{ base = /^https?:$/.test(location.protocol) ? location.origin+location.pathname : ONLINE_WEB_URL; }catch(e){ base=ONLINE_WEB_URL; }
    const srv=server(), extra = srv && srv!==normServer(ONLINE_DEFAULT_SERVER) ? '&server='+encodeURIComponent(srv) : '';
    return `${base}?room=${code}${extra}`;
  }
  const colorVN = c => c==='red' ? 'Đỏ' : 'Đen';
  const other = c => c==='red' ? 'black' : 'red';

  /* ---------- lưu cục bộ: phòng gần đây, ván đã đấu ---------- */
  function recent(){ const v=safeJSON('xq_online_rooms',[]); return Array.isArray(v)?v:[]; }
  function saveRecent(entry){
    const list=recent().filter(r=>r.code!==entry.code); list.unshift(Object.assign({t:Date.now()}, entry));
    safeLS_set('xq_online_rooms', JSON.stringify(list.slice(0,12)));
  }
  function history(){ const v=safeJSON('xq_online_history',[]); return Array.isArray(v)?v:[]; }
  function saveRecord(rec){
    const list=history().filter(r=>r.id!==rec.id); list.unshift(rec);
    safeLS_set('xq_online_history', JSON.stringify(list.slice(0,40)));
  }
  // Ván vừa xong → bản ghi giống ván đấu máy để dùng chung phần Phân tích ván
  function recordOf(room){
    const you=room.you, opp=room.seats[other(you)];
    return {id:`ol-${room.code}-${room.game}`, online:true, code:room.code, game:room.game, human:you, oppName: opp?opp.name:'Đối thủ',
      date:Date.now(), moves:room.moves.map(m=>m.slice()), result: room.result ? {winner:room.result.winner, reason:room.result.reason} : null};
  }

  /* ---------- kết nối ---------- */
  function setConn(c){ st.conn=c; renderConn(); }
  function send(o){ if(st.ws && st.ws.readyState===1){ st.ws.send(JSON.stringify(o)); return true; } flash('Mất kết nối — đang kết nối lại…'); return false; }
  function connect(){
    clearTimeout(st.retryTimer); clearInterval(st.ping);
    const srv=server();
    if(!srv){ setConn('noserver'); return; }
    let ws;
    try{ ws=new WebSocket(`${srv}/room/${st.code}`); }catch(e){ setConn('blocked'); return; }
    st.ws=ws; setConn('connecting');
    ws.onopen=()=>{
      if(st.ws!==ws) return;
      st.retry=0; st.everOpen=true; setConn('open');
      const msg={type:'join', name:myName()||'Kỳ thủ', token:token()};
      if(st.create) msg.create={color:st.create};
      ws.send(JSON.stringify(msg));
      st.ping=setInterval(()=>{ try{ ws.readyState===1 && ws.send('ping'); }catch(e){} }, 25000);
    };
    ws.onmessage=(e)=>{
      if(st.ws!==ws || e.data==='pong') return;
      let m; try{ m=JSON.parse(e.data); }catch(err){ return; }
      if(m.type==='state'){ st.create=null; apply(m); }
      else if(m.type==='error') onError(m.error);
    };
    ws.onclose=(e)=>{
      if(st.ws!==ws) return;
      clearInterval(st.ping); st.ws=null;
      if(e.code===4000){ setConn('closed'); return; }        // server từ chối hẳn (phòng không có…)
      if(!st.code) return;
      // chưa từng kết nối được (server sai, mạng chặn, khung Artifact chặn kết nối ra ngoài) → thôi thử
      if(!st.everOpen && st.retry>=2){ setConn('blocked'); return; }
      setConn('retry');
      const wait=Math.min(15000, 1000*Math.pow(2, st.retry++));
      st.retryTimer=setTimeout(()=>{ if(st.code) connect(); }, wait);
    };
  }
  function disconnect(){
    clearTimeout(st.retryTimer); clearInterval(st.ping);
    const ws=st.ws; st.ws=null; st.code=null; st.room=null;
    if(ws) try{ ws.close(1000); }catch(e){}
  }
  function onError(err){
    if(err==='exists' && st.create){ const c=st.create; enterRoom(newCode(), c); return; }
    if(err==='not_found' || err==='bad_token'){
      const code=st.code; disconnect(); showLobby();
      $('#olJoinMsg').textContent=`${ONLINE_ERR[err]}${code?` (mã ${code})`:''}`;
      return;
    }
    flash(ONLINE_ERR[err] || 'Có lỗi: '+err);
    render();   // vẽ lại theo trạng thái server (bỏ nước vẽ trước)
  }
  function toast(t){
    const el=$('#olToast'); el.textContent=t; el.hidden=false;
    clearTimeout(st.toastTimer); st.toastTimer=setTimeout(()=>{ el.hidden=true; }, 5000);
  }
  function flash(t){ st.msg=t; clearTimeout(st.msgTimer); st.msgTimer=setTimeout(()=>{ st.msg=''; renderStatus(); }, 3500); renderStatus(); }

  /* ---------- trạng thái từ server ---------- */
  function replay(moves, result){
    const g=Game.create();
    for(const [a,b,c,d] of moves) g.play({from:[a,b],to:[c,d]});
    if(result) g.result=Object.assign({state:'over'}, result);
    return g;
  }
  function apply(room){
    const prev=st.room;
    st.room=room;
    st.game=replay(room.moves, room.result); st.local=null;
    if(prev===null || prev.you!==room.you){ st.flipped = room.you==='black'; st.widget.setFlipped(st.flipped); }
    // âm thanh khi có nước mới của đối phương
    if(prev && room.moves.length>prev.moves.length && st.lastMoves!==room.moves.length){
      const m=st.game.lastMove(); Sound.play(room.result?'end':m.check?'check':m.captured?'capture':'move');
    }
    st.lastMoves=room.moves.length;
    // tin nhắn mới của người khác: hiện nhanh dưới bàn cờ (trên điện thoại khung chat nằm xa)
    if(prev && room.chat.length){
      const last=room.chat[room.chat.length-1], seen=prev.chat.length && prev.chat[prev.chat.length-1].t;
      if(last.t!==seen && !last.sys && !(last.seat ? last.seat===room.you : last.by===myName())) toast(`💬 ${last.by}: ${last.text}`);
    }
    const opp=room.seats[other(room.you)];
    saveRecent({code:room.code, you:room.you, opp: room.you==='spectator' ? `${(room.seats.red||{}).name||'?'} – ${(room.seats.black||{}).name||'?'}` : (opp?opp.name:''), result:room.result, n:room.moves.length});
    if(room.result && room.you!=='spectator'){
      const key=room.code+'#'+room.game;
      if(st.lastResultKey!==key){ st.lastResultKey=key; if(!history().some(r=>r.id===`ol-${room.code}-${room.game}`)) { saveRecord(recordOf(room)); renderLobby(); } }
    }
    render();
  }

  /* ---------- giao diện ---------- */
  function board(){ return (st.local||st.game).board(); }
  function canMove(turn){
    const r=st.room; return !!r && !r.result && st.conn==='open' && !st.local && r.you===turn && !!r.seats[other(r.you)];
  }
  function onMove(mv){
    const r=st.room, n=r.moves.length;
    if(!send({type:'move', from:mv.from, to:mv.to, n})) return;
    st.local=replay(r.moves, null); const rec=st.local.play(mv);   // vẽ trước, chờ server xác nhận
    st.lastMoves=n+1;   // đã kêu tiếng đi quân rồi
    Sound.play(st.local.result?'end':rec.check?'check':rec.captured?'capture':'move');
    render();
  }
  function meta(){
    const g=st.local||st.game, b=g.board(), turn=g.turn();
    return {lastMove:g.lastMove(), checkSq: !g.result && Engine.isInCheck(b,turn) ? Engine.findGeneral(b,turn) : null};
  }
  function playerHTML(color){
    const r=st.room, s=r.seats[color], g=st.local||st.game, isTurn=!r.result && g.turn()===color;
    const me = r.you===color;
    if(!s) return `<span class="turn-dot turn-${color}"></span><span class="ol-pname ol-empty">Đang chờ người vào ghế ${colorVN(color)}…</span>`;
    return `<span class="turn-dot turn-${color}"></span><span class="ol-pname">${esc(s.name)}${me?' <small>(bạn)</small>':''}</span>
      <span class="ol-dot ${s.online?'on':''}" title="${s.online?'Đang trong phòng':'Đã rời phòng'}"></span><small class="hint-text">${s.online?'':'mất kết nối'}</small>
      ${isTurn?'<span class="ol-turn">đang đi</span>':''}`;
  }
  function renderConn(){
    const el=$('#olConn'); if(!el) return;
    const t={connecting:'⏳ đang kết nối…', open:'🟢 đã kết nối', retry:'🟠 mất kết nối, đang thử lại…', closed:'🔴 đã ngắt', noserver:'🔴 chưa cấu hình server', blocked:'🔴 trình duyệt chặn kết nối'}[st.conn]||'';
    el.textContent=t;
    renderNotice();
    if(st.room || st.code) renderStatus();
  }
  function renderStatus(){
    const el=$('#olStatus'); if(!el) return;
    const r=st.room;
    if(st.msg && !(r && r.result)){ statusBanner(el,'think',esc(st.msg)); return; }
    if(st.conn==='noserver' || st.conn==='blocked'){ statusBanner(el,'fail', noticeText()); return; }
    if(!r){ statusBanner(el,'think','⏳ Đang vào phòng…'); return; }
    const g=st.local||st.game;
    if(r.result){
      const res=r.result, txt=Game.resultText(res);
      const kind = !res.winner || r.you==='spectator' ? 'draw' : res.winner===r.you ? 'over' : 'fail';
      statusBanner(el, kind, (kind==='over'?'🎉 ':kind==='fail'?'😔 ':'🤝 ')+esc(txt)); return;
    }
    if(!r.seats[other(r.you==='spectator'?'red':r.you)] && r.you!=='spectator'){ statusBanner(el,'think','⏳ Đang chờ đối thủ vào phòng — gửi link mời ở trên cho bạn của bạn.'); return; }
    const turn=g.turn(), chk=Engine.isInCheck(g.board(),turn);
    if(st.local){ statusBanner(el,'think','⏳ Đang gửi nước đi…'); return; }
    if(r.you==='spectator'){ statusBanner(el,'think',`👀 Bạn đang xem · lượt ${colorVN(turn)}${chk?' — đang bị chiếu!':''}`); return; }
    statusBanner(el, turn===r.you?(chk?'check':'over'):'think', turn===r.you ? `<span class="turn-dot turn-${turn}"></span> Tới lượt bạn${chk?' — <b>bạn đang bị chiếu!</b>':''}` : `Đối thủ đang nghĩ…${chk?' (bạn đang chiếu)':''}`);
  }
  function renderOffer(){
    const el=$('#olOffer'), r=st.room;
    if(!r || !r.offer){ el.innerHTML=''; return; }
    const what={draw:'xin hoà', takeback:'xin đi lại nước vừa rồi', rematch:'muốn tái đấu (đổi màu quân)'}[r.offer.kind];
    if(r.offer.by===r.you){ el.innerHTML=`<div class="ol-offer"><span>⏳ Bạn ${what}. Đang chờ đối thủ trả lời…</span><button type="button" class="btn btn-outline btn-sm" data-ol="cancel">Huỷ</button></div>`; }
    else if(r.you!=='spectator'){ const who=esc((r.seats[r.offer.by]||{}).name||'Đối thủ');
      el.innerHTML=`<div class="ol-offer ol-offer-in"><span>📨 <b>${who}</b> ${what}.</span><button type="button" class="btn btn-primary btn-sm" data-ol="accept">Đồng ý</button><button type="button" class="btn btn-outline btn-sm" data-ol="decline">Từ chối</button></div>`; }
    else el.innerHTML=`<div class="ol-offer"><span>${esc((r.seats[r.offer.by]||{}).name||'')} ${what}.</span></div>`;
    $$('[data-ol]',el).forEach(b=>b.addEventListener('click',()=>{
      const a=b.dataset.ol; send(a==='cancel'?{type:'cancel'}:{type:'reply', accept:a==='accept'});
    }));
  }
  function renderChat(){
    const r=st.room, el=$('#olChat');
    if(!r){ el.innerHTML=''; return; }
    const atBottom = el.scrollHeight-el.scrollTop-el.clientHeight < 40;
    el.innerHTML = r.chat.length ? r.chat.map(m=> m.sys ? `<div class="ol-msg ol-sys">${esc(m.text)}</div>`
      : `<div class="ol-msg ${m.seat && m.seat===r.you?'ol-mine':''}"><b>${esc(m.by)}${m.seat?'':' 👀'}:</b> ${esc(m.text)}</div>`).join('')
      : '<div class="hint-text small">Chưa có tin nhắn.</div>';
    if(atBottom || st.chatSeen!==r.chat.length) el.scrollTop=el.scrollHeight;
    if(st.chatSeen!=null && r.chat.length>st.chatSeen && r.chat.slice(st.chatSeen).some(m=>!m.sys && m.seat!==r.you)) sideTabNotify('#olChat');
    st.chatSeen=r.chat.length;
  }
  function renderInvite(){
    const r=st.room, el=$('#olInvite');
    const waiting = r && r.you!=='spectator' && !r.seats[other(r.you)];
    if(!waiting && !st.showInvite){ el.hidden=true; return; }
    const link=inviteLink(st.code);
    el.hidden=false;
    el.innerHTML=`<div><b>Mời bạn vào phòng</b> — gửi link này (Zalo, Messenger…), hoặc đọc mã phòng <b class="ol-bigcode">${st.code}</b></div>
      <div class="btn-row mt10"><input class="field ol-link" readonly value="${esc(link)}" aria-label="Link mời">
      <button type="button" class="btn btn-primary btn-sm" id="olCopy">📋 Sao chép</button>${navigator.share?'<button type="button" class="btn btn-outline btn-sm" id="olShare">📤 Chia sẻ</button>':''}</div>`;
    $('#olCopy',el).addEventListener('click', async ()=>{
      const inp=$('.ol-link',el); inp.select();
      try{ await navigator.clipboard.writeText(link); flash('Đã sao chép link mời.'); }catch(e){ flash('Hãy tự sao chép link trong ô (Ctrl/⌘+C).'); }
    });
    const sh=$('#olShare',el); if(sh) sh.addEventListener('click',()=>navigator.share({title:'Đánh cờ tướng với mình', text:`Vào phòng ${st.code} đánh cờ tướng với mình nhé!`, url:link}).catch(()=>{}));
  }
  function render(){
    const r=st.room;
    $('#olCode').textContent=st.code||'';
    renderInvite();
    if(!r){ st.widget.setBoard(Engine.initialBoard(),{}); $('#olTop').innerHTML=''; $('#olBottom').innerHTML=''; renderStatus(); renderChat(); $('#olOffer').innerHTML=''; return; }
    const me = r.you==='spectator' ? 'red' : r.you;
    const bottom = st.flipped ? 'black' : 'red';
    $('#olBottom').innerHTML=playerHTML(bottom); $('#olTop').innerHTML=playerHTML(other(bottom));
    st.ctl.render();
    renderMoveLog($('#olLog'), (st.local||st.game).moves);
    renderStatus(); renderOffer(); renderChat();
    const seated = r.you!=='spectator', over=!!r.result, hasOpp=!!r.seats[other(me)], pending=!!r.offer;
    $('#olActions').hidden = !seated || over;
    $('#olDraw').disabled = !hasOpp || pending || !r.moves.length;
    $('#olTakeback').disabled = !hasOpp || pending || !r.moves.some((m,i)=>(i%2===0?'red':'black')===r.you);
    $('#olResign').disabled = !hasOpp && !r.moves.length;
    $('#olAfter').hidden = !over;
    $('#olRematch').hidden = !seated || !hasOpp;
    $('#olRematch').disabled = pending;
    $('#olChatInput').placeholder = seated ? 'Nhắn cho đối thủ…' : 'Nhắn với hai kỳ thủ…';
  }
  function noticeText(){
    const web=`<a href="${ONLINE_WEB_URL}" target="_blank" rel="noopener">${ONLINE_WEB_URL}</a>`;
    if(isArtifact() && (st.conn==='blocked' || !server()))
      return `Khung xem này không cho kết nối ra ngoài. Hãy mở ${web} để đấu với bạn bè.`;
    if(st.conn==='blocked')
      return `Không kết nối được server Sa trường. Kiểm tra mạng rồi bấm “← Sảnh” và vào lại phòng; nếu vẫn lỗi, thử bản web ${web}.`;
    if(!server()) return 'Chưa cấu hình server Sa trường. Xem hướng dẫn trong README (mục “Sa trường”) hoặc nhập địa chỉ server ở mục ⚙️ Server bên dưới.';
    return '';
  }
  function isArtifact(){ try{ return !!(window.claude && window.claude.use); }catch(e){ return false; } }
  function renderNotice(){
    const el=$('#olNotice'); if(!el) return;
    const t=noticeText();
    el.innerHTML = t ? `<div class="status-banner status-fail" role="status">${t}</div>` : '';
    $('#olCreate').disabled = !server(); $('#olJoin').disabled = !server();
  }
  function renderLobby(){
    renderNotice();
    const rc=recent();
    $('#olRecent').innerHTML = rc.length ? `<div class="ol-list">${rc.map(r=>`<button type="button" class="ol-item" data-code="${esc(r.code)}">
        <b>${esc(r.code)}</b> <span>${r.you==='spectator'?'👀 xem: ':r.you?`cầm ${colorVN(r.you)}${r.opp?' · với ':''}`:''}${esc(r.opp||'')}</span>
        <small class="hint-text">${r.result?esc(Game.resultText(r.result)):r.n?`đang đánh · ${Math.ceil(r.n/2)} nước`:'chưa đi'}</small></button>`).join('')}</div>`
      : '<p class="hint-text">Chưa có phòng nào.</p>';
    $$('.ol-item',$('#olRecent')).forEach(b=>b.addEventListener('click',()=>enterRoom(b.dataset.code)));
    const h=history();
    $('#olHistory').innerHTML = h.length ? `<div class="ol-list">${h.map(r=>{ const rs=resultForHuman(r);
        return `<div class="ol-item ol-hist"><span class="badge ${rs.cls}">${rs.txt}</span> <span>với <b>${esc(r.oppName)}</b> · cầm ${colorVN(r.human)} · ${Math.ceil(r.moves.length/2)} nước</span>
        <small class="hint-text">${new Date(r.date).toLocaleDateString('vi-VN')}${r.analysis?' · đã phân tích':''}</small>
        <button type="button" class="btn btn-jade btn-sm" data-review="${esc(r.id)}">📊 Phân tích</button></div>`; }).join('')}</div>`
      : '<p class="hint-text">Ván đấu với bạn bè sẽ được lưu ở đây để xem lại và phân tích.</p>';
    $$('[data-review]',$('#olHistory')).forEach(b=>b.addEventListener('click',()=>review(b.dataset.review)));
  }
  function showLobby(){ $('#olLobby').hidden=false; $('#olRoom').hidden=true; renderLobby(); setRoomParam(null); }
  function setRoomParam(code){
    try{
      if(!/^https?:$/.test(location.protocol)) return;
      const u=new URL(location.href);
      if(code) u.searchParams.set('room',code); else u.searchParams.delete('room');
      history_replace(u);
    }catch(e){}
  }
  function history_replace(u){ try{ window.history.replaceState(null,'',u.toString()); }catch(e){} }

  /* ---------- hành động ---------- */
  function ensureName(){
    let n=$('#olName').value.trim();
    if(!n){ $('#olName').focus(); $('#olJoinMsg').textContent='Hãy nhập tên của bạn trước.'; return false; }
    safeLS_set('xq_online_name', n.slice(0,24)); return true;
  }
  function enterRoom(code, create){
    if(!myName() && !ensureName()) { showLobby(); return; }
    disconnect();
    st.code=code; st.everOpen=false; st.create=create||null; st.room=null; st.local=null; st.showInvite=false; st.lastMoves=-1; st.chatSeen=0;
    $('#olLobby').hidden=true; $('#olRoom').hidden=false;
    setRoomParam(code);
    render(); connect();
    revealBoard($('#olBoardCard'));
  }
  function review(id){
    const rec=history().find(r=>r.id===id); if(!rec) return;
    showTab('may'); openReview(rec);
  }

  function init(){
    st.widget=createBoardWidget($('#olBoard'), {onSquareClick:(r,c)=>st.ctl.click(r,c), label:'Bàn cờ Sa trường'});
    st.ctl=makeClickController({ widget:st.widget, getBoard:board, turn:()=>(st.local||st.game||Game.create()).turn(), canMove, onMove, extraMeta:meta,
      legalMoves:()=>(st.game?st.game.legalMoves():[]) });
    st.game=Game.create();
    $('#olName').value=myName();
    $('#olName').addEventListener('change',()=>{ const v=$('#olName').value.trim(); if(v) safeLS_set('xq_online_name',v.slice(0,24)); });
    $('#olServer').value=safeLS_get('xq_online_server')||'';
    $('#olServerSave').addEventListener('click',()=>{
      const raw=$('#olServer').value.trim(), v=normServer(raw);
      if(raw && !v){ $('#olServerMsg').textContent='Địa chỉ phải bắt đầu bằng wss:// (hoặc https://).'; return; }
      safeLS_set('xq_online_server', v); $('#olServerMsg').textContent = v ? 'Đã lưu.' : 'Đã chuyển về server mặc định.'; renderLobby();
    });
    $('#olCreate').addEventListener('click',()=>{
      if(!ensureName()) return;
      enterRoom(newCode(), ($('input[name="olColor"]:checked')||{}).value||'red');
    });
    const join=()=>{
      if(!ensureName()) return;
      const code=parseCode($('#olJoinCode').value);
      if(!code){ $('#olJoinMsg').textContent='Mã phòng gồm 4–12 chữ cái/số, ví dụ K7M2QX.'; return; }
      $('#olJoinMsg').textContent=''; enterRoom(code);
    };
    $('#olJoin').addEventListener('click',join);
    $('#olJoinCode').addEventListener('keydown',e=>{ if(e.key==='Enter') join(); });
    $('#olLeave').addEventListener('click',()=>{ disconnect(); showLobby(); });
    $('#olInviteBtn').addEventListener('click',()=>{ st.showInvite=!st.showInvite; renderInvite(); });
    $('#olFlip').addEventListener('click',()=>{ st.flipped=!st.flipped; st.widget.setFlipped(st.flipped); render(); });
    $('#olDraw').addEventListener('click',()=>send({type:'offer', kind:'draw'}));
    $('#olTakeback').addEventListener('click',()=>send({type:'offer', kind:'takeback'}));
    $('#olRematch').addEventListener('click',()=>send({type:'offer', kind:'rematch'}));
    $('#olResign').addEventListener('click',()=>{ if(confirm('Bạn chắc chắn muốn đầu hàng ván này?')) send({type:'resign'}); });
    $('#olReview').addEventListener('click',()=>{ const r=st.room; if(r) review(`ol-${r.code}-${r.game}`); });
    $('#olChips').innerHTML=ONLINE_QUICK.map(q=>`<button type="button" class="ol-chip">${esc(q)}</button>`).join('');
    $$('.ol-chip').forEach(b=>b.addEventListener('click',()=>send({type:'chat', text:b.textContent})));
    $('#olChatForm').addEventListener('submit',e=>{
      e.preventDefault(); const inp=$('#olChatInput'), t=inp.value.trim();
      if(t && send({type:'chat', text:t})) inp.value='';
    });
    document.addEventListener('zoneshown',e=>{ if(e.detail==='satruong' && !st.code) renderLobby(); });
    const code=parseCode(params().get('room')||'');
    if(code && myName()) enterRoom(code);
    else { showLobby(); if(code){ $('#olJoinCode').value=code; $('#olJoinMsg').textContent=`Bạn được mời vào phòng ${code}. Nhập tên rồi bấm “Vào phòng”.`; $('#olName').focus(); } }
  }
  return {init, wantsZone:()=>!!parseCode(params().get('room')||''), history, saveRecord, state:st, parseCode, normServer, inviteLink};
})();
function initOnline(){ Online.init(); }
