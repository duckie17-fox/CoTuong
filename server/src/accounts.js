/* =========================================================================
   ACCOUNTS — tài khoản, phiên đăng nhập, đồng bộ tiến độ, bạn bè, mời đấu, Elo (spec v3)
   Chỉ dùng Web API (Request/Response/crypto.subtle) và một DB kiểu Cloudflare D1
   (prepare().bind().first/all/run, batch) → chạy được ở Worker lẫn Node (tools/d1-shim.js).
   Mật khẩu: trình duyệt băm PBKDF2 trước khi gửi; server băm tiếp SHA-256 + muối riêng.
   ========================================================================= */
const Accounts = (function(){
  const MIN=60000, HOUR=60*MIN, DAY=24*HOUR;
  const SESSION_MS=60*DAY, ONLINE_MS=2*MIN, INVITE_MS=10*MIN, LOCK_MS=15*MIN;
  const MAX_FAILS=5, IP_MAX=30, PROGRESS_MAX=512*1024, BODY_MAX=600*1024;
  const START_ELO=1200, MIN_RATED_PLIES=10, PAIR_DAILY_MAX=10, RANKED_MIN=5;
  const USER_RE=/^[a-z0-9_.]{3,20}$/, HASH_RE=/^[0-9a-f]{64}$/;
  const CODE_ABC='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';     // bỏ I, O, 0, 1 cho dễ đọc
  const DELETED_NAME='Người chơi đã xoá';
  const enc=new TextEncoder();

  /* ---------- tiện ích ---------- */
  const hex = buf => [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
  const rand = n => crypto.getRandomValues(new Uint8Array(n));
  const sha256 = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
  const b64url = u8 => btoa(String.fromCharCode(...u8)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  function codeFrom(n){ const r=rand(n); let s=''; for(const b of r) s+=CODE_ABC[b%CODE_ABC.length]; return s; }
  const recoveryCode = () => codeFrom(16).match(/.{4}/g).join('-');
  const normCode = s => String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const roomCode = () => codeFrom(6);
  function sameHex(a,b){ if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length) return false; let d=0; for(let i=0;i<a.length;i++) d|=a.charCodeAt(i)^b.charCodeAt(i); return d===0; }
  const cleanDisplay = s => String(s||'').replace(/[\u0000-\u001f\u007f<>]/g,'').trim().slice(0,24);
  const normUser = s => String(s||'').trim().toLowerCase();

  class ApiError extends Error { constructor(status, code, extra){ super(code); this.status=status; this.code=code; this.extra=extra; } }
  const MESSAGES = {
    bad_username:'Tên đăng nhập 3–20 ký tự, chỉ gồm chữ không dấu, số, _ và .',
    username_taken:'Tên đăng nhập đã có người dùng',
    bad_display:'Tên hiển thị cần 1–24 ký tự',
    bad_password:'Mật khẩu không hợp lệ',
    bad_credentials:'Sai tên đăng nhập hoặc mật khẩu',
    bad_recovery:'Sai tên đăng nhập hoặc mã khôi phục',
    locked:'Đăng nhập sai nhiều lần, thử lại sau 15 phút.',
    ip_blocked:'Thử quá nhiều lần từ mạng này, hãy đợi khoảng 1 giờ.',
    unauthorized:'Phiên đăng nhập đã hết hạn',
    not_found:'Không tìm thấy',
    not_friends:'Hai bạn chưa kết bạn',
    self:'Không thể làm việc này với chính mình',
    too_large:'Dữ liệu quá lớn',
    bot_daily:'Hôm nay bạn đã đánh đủ số ván xếp hạng, mai quay lại nhé!',
    bad_game:'Ván cờ không hợp lệ',
    bad_result:'Kết quả ván không hợp lệ',
    bad_request:'Yêu cầu không hợp lệ',
  };

  const CORS = {'access-control-allow-origin':'*', 'access-control-allow-headers':'authorization, content-type',
    'access-control-allow-methods':'GET, POST, PUT, PATCH, DELETE, OPTIONS', 'access-control-max-age':'86400'};
  function json(status, obj){ return new Response(JSON.stringify(obj), {status, headers:Object.assign({'content-type':'application/json; charset=utf-8', 'cache-control':'no-store'}, CORS)}); }

  /* ---------- mật khẩu (đã được trình duyệt băm PBKDF2) ---------- */
  async function hashPass(clientHash, salt){ return sha256(salt+':'+clientHash); }
  function checkClientHash(h){ if(typeof h!=='string' || !HASH_RE.test(h)) throw new ApiError(400,'bad_password'); return h; }
  async function newPass(clientHash){ const salt=hex(rand(16)); return {salt, hash:await hashPass(clientHash, salt)}; }
  async function verifyPass(user, clientHash){ return HASH_RE.test(String(clientHash||'')) && sameHex(await hashPass(clientHash, user.pass_salt), user.pass_hash); }
  const hashRecovery = (username, code) => sha256('recovery:'+username+':'+normCode(code));

  /* ---------- hồ sơ công khai ---------- */
  function profile(u, now){
    return {id:u.id, username:u.username, displayName:u.display_name, elo:u.elo, ratedGames:u.rated_games, peakElo:u.peak_elo,
      wins:u.wins, draws:u.draws, losses:u.losses, createdAt:u.created_at, online: now!=null ? (now-(u.last_seen||0) < ONLINE_MS) : undefined,
      ranked: u.rated_games>=RANKED_MIN};
  }

  /* ---------- phiên ---------- */
  async function createSession(db, userId, now, ua){
    const token=b64url(rand(32));
    await db.prepare('INSERT INTO sessions (token_hash,user_id,created_at,expires_at,last_seen,user_agent) VALUES (?,?,?,?,?,?)')
      .bind(await sha256(token), userId, now, now+SESSION_MS, now, String(ua||'').slice(0,160)).run();
    return token;
  }
  // Trả về {user, tokenHash} hoặc null. Gia hạn phiên và cập nhật "đang online" (ghi tối đa mỗi 30 giây)
  async function sessionUser(db, token, now){
    if(typeof token!=='string' || token.length<20 || token.length>100) return null;
    const th=await sha256(token);
    const row=await db.prepare('SELECT s.expires_at, s.last_seen AS s_seen, u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?').bind(th).first();
    if(!row) return null;
    if(row.expires_at<now){ await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(th).run(); return null; }
    if(now-row.s_seen > 30000){
      await db.batch([
        db.prepare('UPDATE sessions SET last_seen=?, expires_at=? WHERE token_hash=?').bind(now, now+SESSION_MS, th),
        db.prepare('UPDATE users SET last_seen=? WHERE id=?').bind(now, row.id),
      ]);
      row.last_seen=now;
    }
    return {user:row, tokenHash:th};
  }
  const bearer = req => { const h=req.headers.get('authorization')||''; const m=h.match(/^Bearer\s+(\S+)$/i); return m?m[1]:null; };

  /* ---------- chặn dò mật khẩu theo IP ---------- */
  async function ipBlocked(db, ip, now){
    const c=await db.prepare('SELECT count FROM login_attempts WHERE ip=? AND hour=?').bind(ip, Math.floor(now/HOUR)).first('count');
    return (c||0)>=IP_MAX;
  }
  async function ipFail(db, ip, now){
    const hour=Math.floor(now/HOUR);
    await db.batch([
      db.prepare('INSERT INTO login_attempts (ip,hour,count) VALUES (?,?,1) ON CONFLICT(ip,hour) DO UPDATE SET count=count+1').bind(ip, hour),
      db.prepare('DELETE FROM login_attempts WHERE hour<?').bind(hour-1),
    ]);
  }
  // Sai mật khẩu / mã khôi phục: tăng đếm, đủ 5 lần thì khoá 15 phút
  async function accountFail(db, u, now){
    const n=u.failed_logins+1;
    if(n>=MAX_FAILS) await db.prepare('UPDATE users SET failed_logins=0, locked_until=? WHERE id=?').bind(now+LOCK_MS, u.id).run();
    else await db.prepare('UPDATE users SET failed_logins=? WHERE id=?').bind(n, u.id).run();
  }

  /* ---------- gộp tiến độ (spec 4.2) ---------- */
  const NO_SYNC = new Set(['xq_last_tab','xq_zone','xq_online_server','xq_online_token','xq_online_rooms','xq_auth','xq_user','xq_sync_meta','xq_ranked_bot']);
  const UNION = new Set(['xq_lessons_done','xq_puzzles_solved','xq_sc_solved','xq_tactics_seen','xq_eg_seen']);
  const HISTORY = new Set(['xq_ai_history','xq_online_history']);
  const HISTORY_MAX = 100;
  const parse = (s, d) => { try{ const v=JSON.parse(s); return v==null?d:v; }catch(e){ return d; } };
  const recTime = r => typeof r.date==='number' ? r.date : Date.parse(r.date)||0;
  function mergeKey(k, a, b){
    if(a==null && b==null) return null;
    if(HISTORY.has(k)){ if(a==null) a='[]'; if(b==null) b='[]'; }
    else { if(a==null) return b; if(b==null) return a; }
    if(UNION.has(k)){ const x=parse(a,[]), y=parse(b,[]); if(!Array.isArray(x)||!Array.isArray(y)) return b; return JSON.stringify([...new Set([...x, ...y])]); }
    if(HISTORY.has(k)){
      const x=parse(a,[]), y=parse(b,[]); if(!Array.isArray(x)||!Array.isArray(y)) return b;
      const byId=new Map();
      for(const r of [...x, ...y]){
        if(!r || typeof r!=='object' || !r.id) continue;
        const o=byId.get(r.id);
        if(!o || (!o.analysis && r.analysis) || (!!o.analysis===!!r.analysis && (r.moves||[]).length>(o.moves||[]).length)) byId.set(r.id, r);
      }
      return JSON.stringify([...byId.values()].sort((p,q)=>recTime(q)-recTime(p)).slice(0,HISTORY_MAX));
    }
    if(k==='xq_srs'){
      const x=parse(a,{}), y=parse(b,{}), out=Object.assign({}, x);
      for(const [id,e] of Object.entries(y)) if(!out[id] || (e&&e.last||0)>(out[id].last||0)) out[id]=e;
      return JSON.stringify(out);
    }
    if(k==='xq_trainer_best'){
      const x=parse(a,{}), y=parse(b,{}), out=Object.assign({}, x);
      for(const [id,v] of Object.entries(y)) if(typeof v==='number' && !(out[id]>=v)) out[id]=v;
      return JSON.stringify(out);
    }
    if(k==='xq_daily'){
      const x=parse(a,{}), y=parse(b,{});
      const later = String(y.lastDone||'')>String(x.lastDone||'') || (y.lastDone===x.lastDone && (y.streak||0)>(x.streak||0)) ? y : x;
      const out=Object.assign({}, later, {best:Math.max(x.best||0, y.best||0, later.streak||0)});
      if(String(y.date||'')>String(out.date||'')) Object.assign(out, {date:y.date, id:y.id, done:y.done});
      return JSON.stringify(out);
    }
    return undefined;   // còn lại: theo thời điểm sửa (xem merge)
  }
  // a, b: {data:{khoá:chuỗi}, t:{khoá:thời điểm sửa}}; b là bản mới gửi lên
  function mergeProgress(a, b){
    const data={}, t={};
    const A=(a&&a.data)||{}, B=(b&&b.data)||{}, tA=(a&&a.t)||{}, tB=(b&&b.t)||{};
    for(const k of new Set([...Object.keys(A), ...Object.keys(B)])){
      if(!k.startsWith('xq_') || NO_SYNC.has(k)) continue;
      const va = typeof A[k]==='string' ? A[k] : null, vb = typeof B[k]==='string' ? B[k] : null;
      let v=mergeKey(k, va, vb);
      if(v===undefined) v = (tB[k]||0) >= (tA[k]||0) ? vb : va;
      if(v==null) continue;
      data[k]=v; t[k]=Math.max(tA[k]||0, tB[k]||0) || undefined;
      if(t[k]===undefined) delete t[k];
    }
    return trimProgress({data, t});
  }
  // Vượt 512 KB: bỏ bớt ván cũ nhất (ưu tiên giữ ván đã phân tích)
  function trimProgress(p){
    let size=JSON.stringify(p).length;
    while(size>PROGRESS_MAX){
      let cut=false;
      for(const k of HISTORY){
        const list=parse(p.data[k]||'[]',[]); if(!list.length) continue;
        let i=list.map(r=>!!r.analysis).lastIndexOf(false); if(i<0) i=list.length-1;
        list.splice(i,1); p.data[k]=JSON.stringify(list); cut=true;
      }
      if(!cut) break;
      size=JSON.stringify(p).length;
    }
    return p;
  }

  /* ---------- Elo (spec 4.4) ---------- */
  const kFactor = games => games<20 ? 40 : 24;
  function eloChange(ra, rb, scoreA, ka){ const ea=1/(1+Math.pow(10,(rb-ra)/400)); return Math.round(ka*(scoreA-ea)); }

  // Ghi ván vừa xong của phòng (rec từ RoomCore.finish) vào D1; tính Elo nếu đủ điều kiện.
  // Trả về {rated, red:{before,after}, black:{before,after}} hoặc null nếu không ai đăng nhập.
  async function recordGame(db, rec, now){
    const ru=rec.red&&rec.red.uid, bu=rec.black&&rec.black.uid;
    if(!ru && !bu) return null;
    const exists=await db.prepare('SELECT id FROM games WHERE room_code=? AND game_no=?').bind(rec.code, rec.game).first();
    if(exists) return null;
    const res=rec.result||{}, winner=res.winner||null;
    let rated = !!rec.rated && ru && bu && ru!==bu && rec.moves.length>=MIN_RATED_PLIES && !rec.takeback;
    let red=null, black=null;
    if(rated){
      const n=await db.prepare('SELECT COUNT(*) AS n FROM games WHERE rated=1 AND ended_at>? AND ((red_user=? AND black_user=?) OR (red_user=? AND black_user=?))')
        .bind(now-DAY, ru, bu, bu, ru).first('n');
      if((n||0)>=PAIR_DAILY_MAX) rated=false;
    }
    if(rated){
      const R=await db.prepare('SELECT id, elo, rated_games FROM users WHERE id=?').bind(ru).first();
      const B=await db.prepare('SELECT id, elo, rated_games FROM users WHERE id=?').bind(bu).first();
      if(!R || !B) rated=false;
      else {
        const sR = winner==='red' ? 1 : winner==='black' ? 0 : 0.5;
        const dR=eloChange(R.elo, B.elo, sR, kFactor(R.rated_games)), dB=eloChange(B.elo, R.elo, 1-sR, kFactor(B.rated_games));
        red={before:R.elo, after:R.elo+dR}; black={before:B.elo, after:B.elo+dB};
        const col = s => s===1 ? 'wins=wins+1' : s===0 ? 'losses=losses+1' : 'draws=draws+1';
        await db.batch([
          db.prepare(`UPDATE users SET elo=?, peak_elo=MAX(peak_elo,?), rated_games=rated_games+1, ${col(sR)} WHERE id=?`).bind(red.after, red.after, ru),
          db.prepare(`UPDATE users SET elo=?, peak_elo=MAX(peak_elo,?), rated_games=rated_games+1, ${col(1-sR)} WHERE id=?`).bind(black.after, black.after, bu),
        ]);
      }
    }
    await db.prepare(`INSERT OR IGNORE INTO games (room_code,game_no,red_user,black_user,red_name,black_name,moves,result,reason,rated,
        elo_red_before,elo_red_after,elo_black_before,elo_black_after,ended_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(rec.code, rec.game, ru||null, bu||null, rec.red&&rec.red.name, rec.black&&rec.black.name, JSON.stringify(rec.moves),
        winner||'draw', res.reason||null, rated?1:0, red&&red.before, red&&red.after, black&&black.before, black&&black.after, now).run();
    return {rated:!!rated, red, black};
  }

  /* ---------- xử lý API ---------- */
  async function body(req){
    const t=await req.text(); if(t.length>BODY_MAX) throw new ApiError(413,'too_large');
    if(!t) return {};
    try{ const v=JSON.parse(t); if(v && typeof v==='object' && !Array.isArray(v)) return v; }catch(e){}
    throw new ApiError(400,'bad_request');
  }
  async function requireUser(c){
    const s=await sessionUser(c.db, bearer(c.req), c.now);
    if(!s) throw new ApiError(401,'unauthorized');
    c.user=s.user; c.tokenHash=s.tokenHash; return s.user;
  }
  const pair = (x,y) => x<y ? [x,y] : [y,x];
  async function friendRow(db, x, y){ const [a,b]=pair(x,y); return db.prepare('SELECT * FROM friends WHERE user_a=? AND user_b=?').bind(a,b).first(); }
  async function userBy(db, field, v){ return db.prepare(`SELECT * FROM users WHERE ${field}=?`).bind(v).first(); }

  const routes = [];
  const route = (method, path, fn) => routes.push({method, re:new RegExp('^'+path.replace(/:(\w+)/g,'(?<$1>[^/]+)')+'$'), fn});

  route('POST','/api/register', async c=>{
    const b=await body(c.req), db=c.db, now=c.now;
    if(await ipBlocked(db, c.ip, now)) throw new ApiError(429,'ip_blocked');
    const username=normUser(b.username); if(!USER_RE.test(username)) throw new ApiError(400,'bad_username');
    const display=cleanDisplay(b.displayName||username); if(!display) throw new ApiError(400,'bad_display');
    const p=await newPass(checkClientHash(b.passHash));
    if(await userBy(db,'username',username)){ await ipFail(db, c.ip, now); throw new ApiError(409,'username_taken'); }
    const code=recoveryCode();
    const r=await db.prepare('INSERT INTO users (username,display_name,pass_hash,pass_salt,recovery_hash,created_at,last_seen) VALUES (?,?,?,?,?,?,?)')
      .bind(username, display, p.hash, p.salt, await hashRecovery(username, code), now, now).run();
    await ipFail(db, c.ip, now);   // tính cả lượt đăng ký vào giới hạn mỗi IP (chống tạo hàng loạt)
    const id=r.meta.last_row_id, token=await createSession(db, id, now, c.ua);
    return json(201, {token, recoveryCode:code, user:profile(await userBy(db,'id',id))});
  });

  // Đăng nhập và khôi phục dùng chung bước chặn dò
  async function guarded(c, username, check){
    const db=c.db, now=c.now;
    if(await ipBlocked(db, c.ip, now)) throw new ApiError(429,'ip_blocked');
    const u=USER_RE.test(username) ? await userBy(db,'username',username) : null;
    if(u && u.locked_until>now) throw new ApiError(429,'locked', {until:u.locked_until});
    if(!u || !(await check(u))){ await ipFail(db, c.ip, now); if(u) await accountFail(db, u, now); return null; }
    if(u.failed_logins) await db.prepare('UPDATE users SET failed_logins=0 WHERE id=?').bind(u.id).run();
    return u;
  }
  route('POST','/api/login', async c=>{
    const b=await body(c.req);
    const u=await guarded(c, normUser(b.username), u=>verifyPass(u, b.passHash));
    if(!u) throw new ApiError(401,'bad_credentials');
    return json(200, {token:await createSession(c.db, u.id, c.now, c.ua), user:profile(u)});
  });
  route('POST','/api/recover', async c=>{
    const b=await body(c.req), db=c.db, username=normUser(b.username);
    checkClientHash(b.newPassHash);
    const u=await guarded(c, username, async u=>sameHex(await hashRecovery(username, b.recoveryCode), u.recovery_hash));
    if(!u) throw new ApiError(401,'bad_recovery');
    const p=await newPass(b.newPassHash), code=recoveryCode();
    await db.batch([
      db.prepare('UPDATE users SET pass_hash=?, pass_salt=?, recovery_hash=? WHERE id=?').bind(p.hash, p.salt, await hashRecovery(username, code), u.id),
      db.prepare('DELETE FROM sessions WHERE user_id=?').bind(u.id),
    ]);
    return json(200, {token:await createSession(db, u.id, c.now, c.ua), recoveryCode:code, user:profile(u)});
  });
  route('POST','/api/logout', async c=>{ await requireUser(c); await c.db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(c.tokenHash).run(); return json(200,{ok:true}); });
  route('POST','/api/logout-all', async c=>{ const u=await requireUser(c); await c.db.prepare('DELETE FROM sessions WHERE user_id=?').bind(u.id).run(); return json(200,{ok:true}); });

  route('GET','/api/me', async c=>{ const u=await requireUser(c); return json(200, {user:profile(u)}); });
  route('PATCH','/api/me', async c=>{
    const u=await requireUser(c), b=await body(c.req);
    const display=cleanDisplay(b.displayName); if(!display) throw new ApiError(400,'bad_display');
    await c.db.prepare('UPDATE users SET display_name=? WHERE id=?').bind(display, u.id).run();
    return json(200, {user:profile(Object.assign(u,{display_name:display}))});
  });
  route('POST','/api/password', async c=>{
    const u=await requireUser(c), b=await body(c.req);
    checkClientHash(b.newPassHash);
    if(!(await verifyPass(u, b.oldPassHash))) throw new ApiError(401,'bad_credentials');
    const p=await newPass(b.newPassHash);
    await c.db.batch([
      c.db.prepare('UPDATE users SET pass_hash=?, pass_salt=? WHERE id=?').bind(p.hash, p.salt, u.id),
      c.db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').bind(u.id, c.tokenHash),
    ]);
    return json(200, {ok:true});
  });
  route('POST','/api/recovery-code', async c=>{
    const u=await requireUser(c), b=await body(c.req);
    if(!(await verifyPass(u, b.passHash))) throw new ApiError(401,'bad_credentials');
    const code=recoveryCode();
    await c.db.prepare('UPDATE users SET recovery_hash=? WHERE id=?').bind(await hashRecovery(u.username, code), u.id).run();
    return json(200, {recoveryCode:code});
  });
  route('DELETE','/api/me', async c=>{
    const u=await requireUser(c), b=await body(c.req), db=c.db;
    if(normUser(b.username)!==u.username || !(await verifyPass(u, b.passHash))) throw new ApiError(401,'bad_credentials');
    await db.batch([
      db.prepare('UPDATE games SET red_user=NULL, red_name=? WHERE red_user=?').bind(DELETED_NAME, u.id),
      db.prepare('UPDATE games SET black_user=NULL, black_name=? WHERE black_user=?').bind(DELETED_NAME, u.id),
      db.prepare('DELETE FROM sessions WHERE user_id=?').bind(u.id),
      db.prepare('DELETE FROM progress WHERE user_id=?').bind(u.id),
      db.prepare('DELETE FROM friends WHERE user_a=? OR user_b=?').bind(u.id, u.id),
      db.prepare('DELETE FROM invites WHERE from_user=? OR to_user=?').bind(u.id, u.id),
      db.prepare('DELETE FROM match_queue WHERE user_id=?').bind(u.id),
      db.prepare('DELETE FROM bot_games WHERE user_id=?').bind(u.id),
      db.prepare('DELETE FROM users WHERE id=?').bind(u.id),
    ]);
    return json(200, {ok:true});
  });

  /* tiến độ */
  route('GET','/api/progress', async c=>{
    const u=await requireUser(c);
    const r=await c.db.prepare('SELECT data, updated_at FROM progress WHERE user_id=?').bind(u.id).first();
    return json(200, r ? Object.assign(parse(r.data,{data:{},t:{}}), {updatedAt:r.updated_at}) : {data:{}, t:{}, updatedAt:0});
  });
  route('PUT','/api/progress', async c=>{
    const u=await requireUser(c), b=await body(c.req);
    if(!b.data || typeof b.data!=='object') throw new ApiError(400,'bad_request');
    const r=await c.db.prepare('SELECT data FROM progress WHERE user_id=?').bind(u.id).first();
    const merged=mergeProgress(r ? parse(r.data,{}) : {}, {data:b.data, t:b.t||{}});
    const text=JSON.stringify(merged);
    if(text.length>PROGRESS_MAX) throw new ApiError(413,'too_large');
    await c.db.prepare('INSERT INTO progress (user_id,data,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at')
      .bind(u.id, text, c.now).run();
    return json(200, Object.assign(merged, {updatedAt:c.now}));
  });

  /* bạn bè */
  route('GET','/api/users', async c=>{
    const u=await requireUser(c), q=normUser(new URL(c.req.url).searchParams.get('q'));
    if(q.length<3 || !/^[a-z0-9_.]+$/.test(q)) return json(200, {users:[]});
    const {results}=await c.db.prepare("SELECT * FROM users WHERE username LIKE ? ESCAPE '\\' AND id<>? ORDER BY username LIMIT 10")
      .bind(q.replace(/[_%\\]/g, m=>'\\'+m)+'%', u.id).all();
    const out=[];
    for(const x of results){
      const f=await friendRow(c.db, u.id, x.id);
      out.push(Object.assign(profile(x), {relation: !f ? 'none' : f.status==='accepted' ? 'friend' : f.requested_by===u.id ? 'sent' : 'received'}));
    }
    return json(200, {users:out});
  });
  route('POST','/api/friends', async c=>{
    const u=await requireUser(c), b=await body(c.req), db=c.db;
    const x=await userBy(db,'username',normUser(b.username)); if(!x) throw new ApiError(404,'not_found');
    if(x.id===u.id) throw new ApiError(400,'self');
    const f=await friendRow(db, u.id, x.id), [a,bb]=pair(u.id, x.id);
    if(!f) await db.prepare("INSERT INTO friends (user_a,user_b,status,requested_by,created_at) VALUES (?,?,'pending',?,?)").bind(a,bb,u.id,c.now).run();
    else if(f.status==='pending' && f.requested_by!==u.id) await db.prepare("UPDATE friends SET status='accepted' WHERE user_a=? AND user_b=?").bind(a,bb).run();
    const g=await friendRow(db, u.id, x.id);
    return json(200, {relation: g.status==='accepted' ? 'friend' : 'sent'});
  });
  route('POST','/api/friends/:id/accept', async c=>{
    const u=await requireUser(c), id=+c.params.id, f=await friendRow(c.db, u.id, id);
    if(!f || f.status!=='pending' || f.requested_by===u.id) throw new ApiError(404,'not_found');
    const [a,b]=pair(u.id,id);
    await c.db.prepare("UPDATE friends SET status='accepted' WHERE user_a=? AND user_b=?").bind(a,b).run();
    return json(200, {relation:'friend'});
  });
  // Từ chối lời mời / huỷ lời mời đã gửi / huỷ kết bạn
  route('DELETE','/api/friends/:id', async c=>{
    const u=await requireUser(c), [a,b]=pair(u.id, +c.params.id);
    await c.db.batch([
      c.db.prepare('DELETE FROM friends WHERE user_a=? AND user_b=?').bind(a,b),
      c.db.prepare("DELETE FROM invites WHERE status='pending' AND ((from_user=? AND to_user=?) OR (from_user=? AND to_user=?))").bind(a,b,b,a),
    ]);
    return json(200, {relation:'none'});
  });
  route('GET','/api/friends', async c=>{
    const u=await requireUser(c), now=c.now;
    const {results}=await c.db.prepare(`SELECT f.status, f.requested_by, u.* FROM friends f JOIN users u ON u.id = CASE WHEN f.user_a=? THEN f.user_b ELSE f.user_a END
      WHERE f.user_a=? OR f.user_b=? ORDER BY u.display_name`).bind(u.id, u.id, u.id).all();
    const friends=[], incoming=[], outgoing=[];
    for(const r of results){ const p=profile(r, now); if(r.status==='accepted') friends.push(p); else if(r.requested_by===u.id) outgoing.push(p); else incoming.push(p); }
    friends.sort((p,q)=>(q.online-p.online) || p.displayName.localeCompare(q.displayName));
    return json(200, {friends, incoming, outgoing});
  });

  /* mời đấu */
  function inviteView(r){ return {id:r.id, roomCode:r.room_code, color:r.color, rated:!!r.rated, expiresAt:r.expires_at, status:r.status}; }
  route('POST','/api/invites', async c=>{
    const u=await requireUser(c), b=await body(c.req), db=c.db, to=+b.to;
    const f=await friendRow(db, u.id, to);
    if(!f || f.status!=='accepted') throw new ApiError(403,'not_friends');
    const color=['red','black','random'].includes(b.color) ? b.color : 'red';
    const code=roomCode();
    await db.prepare("DELETE FROM invites WHERE from_user=? AND to_user=? AND status='pending'").bind(u.id, to).run();   // thay lời mời cũ
    const r=await db.prepare("INSERT INTO invites (from_user,to_user,room_code,color,rated,created_at,expires_at,status) VALUES (?,?,?,?,?,?,?,'pending')")
      .bind(u.id, to, code, color, b.rated?1:0, c.now, c.now+INVITE_MS).run();
    return json(201, {invite:inviteView(await db.prepare('SELECT * FROM invites WHERE id=?').bind(r.meta.last_row_id).first())});
  });
  route('POST','/api/invites/:id/:act', async c=>{
    const u=await requireUser(c), act=c.params.act;
    if(act!=='accept' && act!=='decline') throw new ApiError(404,'not_found');
    const r=await c.db.prepare("SELECT * FROM invites WHERE id=? AND to_user=? AND status='pending' AND expires_at>?").bind(+c.params.id, u.id, c.now).first();
    if(!r) throw new ApiError(404,'not_found');
    await c.db.prepare('UPDATE invites SET status=? WHERE id=?').bind(act==='accept'?'accepted':'declined', r.id).run();
    return json(200, {invite:Object.assign(inviteView(r), {status:act==='accept'?'accepted':'declined'})});
  });
  // Hộp thư: gọi định kỳ khi app mở (cũng là nhịp "đang online")
  route('GET','/api/inbox', async c=>{
    const u=await requireUser(c), db=c.db, now=c.now;
    await db.prepare('DELETE FROM invites WHERE expires_at<?').bind(now-DAY).run();
    const inv=await db.prepare(`SELECT i.*, u.display_name, u.username, u.elo FROM invites i JOIN users u ON u.id=i.from_user
      WHERE i.to_user=? AND i.status='pending' AND i.expires_at>? ORDER BY i.created_at DESC`).bind(u.id, now).all();
    const sent=await db.prepare(`SELECT i.*, u.display_name, u.username FROM invites i JOIN users u ON u.id=i.to_user
      WHERE i.from_user=? AND i.created_at>? ORDER BY i.created_at DESC LIMIT 10`).bind(u.id, now-INVITE_MS).all();
    const req=await db.prepare("SELECT COUNT(*) AS n FROM friends WHERE (user_a=? OR user_b=?) AND status='pending' AND requested_by<>?").bind(u.id,u.id,u.id).first('n');
    const who = r => ({displayName:r.display_name, username:r.username, elo:r.elo});
    return json(200, {
      invites: inv.results.map(r=>Object.assign(inviteView(r), {from:who(r)})),
      sent: sent.results.map(r=>Object.assign(inviteView(r), {to:who(r)})),
      friendRequests: req||0, user:profile(u, now),
    });
  });

  /* xếp hạng & ván đã đấu */
  route('GET','/api/leaderboard', async c=>{
    const u=await requireUser(c), db=c.db, scope=new URL(c.req.url).searchParams.get('scope')==='all' ? 'all' : 'friends';
    let rows;
    if(scope==='all') rows=(await db.prepare('SELECT * FROM users WHERE rated_games>=? ORDER BY elo DESC, rated_games DESC, id LIMIT 50').bind(RANKED_MIN).all()).results;
    else rows=(await db.prepare(`SELECT * FROM users WHERE id=? OR id IN (SELECT CASE WHEN user_a=? THEN user_b ELSE user_a END FROM friends
      WHERE (user_a=? OR user_b=?) AND status='accepted') ORDER BY (rated_games>=?) DESC, elo DESC, id`).bind(u.id,u.id,u.id,u.id,RANKED_MIN).all()).results;
    let rank=0;
    const list=rows.map(r=>Object.assign(profile(r, c.now), {rank: r.rated_games>=RANKED_MIN ? ++rank : null, me:r.id===u.id}));
    let me=null;
    if(!list.some(x=>x.me)){
      const above=u.rated_games>=RANKED_MIN ? await db.prepare('SELECT COUNT(*) AS n FROM users WHERE rated_games>=? AND elo>?').bind(RANKED_MIN, u.elo).first('n') : null;
      me=Object.assign(profile(u, c.now), {rank: above==null ? null : above+1, me:true});
    }
    return json(200, {scope, list, me, minGames:RANKED_MIN});
  });

  /* ---------- đấu xếp hạng (spec v4): ghép trận, máy thế chỗ khi vắng người ---------- */
  const QUEUE_STALE_MS=15000, BOT_DAILY_MAX=30;   // ván không giới hạn thời gian: ván dở giữ mãi để vào tiếp
  const PIECE_VAL={R:9, H:4, C:4.5, E:2, A:2, S:1, G:0};
  // Chênh lệch quân (bên `color` trừ bên kia) — tốt qua sông tính 2
  function materialDiff(board, color){
    let d=0;
    for(let r=0;r<10;r++) for(let c=0;c<9;c++){
      const p=board[r][c]; if(!p) continue;
      let v=PIECE_VAL[p.type]||0;
      if(p.type==='S' && (p.color==='red' ? r<=4 : r>=5)) v=2;
      d += p.color===color ? v : -v;
    }
    return d;
  }
  // Cập nhật Elo người chơi sau ván với máy (máy không đổi Elo)
  async function settleBot(db, bg, u, score, moves, reason, now){
    const k=kFactor(u.rated_games), d=eloChange(u.elo, bg.bot_elo, score, k), after=u.elo+d;
    const col = score===1 ? 'wins=wins+1' : score===0 ? 'losses=losses+1' : 'draws=draws+1';
    const botColor = bg.color==='red' ? 'black' : 'red';
    const winner = score===1 ? bg.color : score===0 ? botColor : 'draw';
    const meName=u.display_name;
    await db.batch([
      db.prepare(`UPDATE users SET elo=?, peak_elo=MAX(peak_elo,?), rated_games=rated_games+1, ${col} WHERE id=?`).bind(after, after, u.id),
      db.prepare('UPDATE bot_games SET finished_at=?, result=?, reason=?, elo_before=?, elo_after=? WHERE id=?').bind(now, winner, reason, u.elo, after, bg.id),
      db.prepare(`INSERT OR IGNORE INTO games (room_code,game_no,red_user,black_user,red_name,black_name,moves,result,reason,rated,
          elo_red_before,elo_red_after,elo_black_before,elo_black_after,ended_at) VALUES (?,?,?,?,?,?,?,?,?,1,?,?,?,?,?)`)
        .bind('BOT'+bg.id, 1, bg.color==='red'?u.id:null, bg.color==='black'?u.id:null,
          bg.color==='red'?meName:bg.bot_name, bg.color==='black'?meName:bg.bot_name, JSON.stringify(moves||[]), winner, reason,
          bg.color==='red'?u.elo:bg.bot_elo, bg.color==='red'?after:bg.bot_elo, bg.color==='black'?u.elo:bg.bot_elo, bg.color==='black'?after:bg.bot_elo, now),
    ]);
    return {before:u.elo, after, delta:d};
  }
  const queueView = q => q && q.room_code ? {status:'matched', roomCode:q.room_code, color:q.color} : {status:'waiting'};
  // Vào hàng chờ / hỏi tình trạng: ghép với người đang chờ có Elo chênh ≤ 200
  route('POST','/api/match/join', async c=>{
    const u=await requireUser(c), db=c.db, now=c.now;
    await db.prepare('DELETE FROM match_queue WHERE room_code IS NULL AND seen_at<?').bind(now-QUEUE_STALE_MS).run();
    let me=await db.prepare('SELECT * FROM match_queue WHERE user_id=?').bind(u.id).first();
    if(me && me.room_code){ await db.prepare('DELETE FROM match_queue WHERE user_id=?').bind(u.id).run(); return json(200, queueView(me)); }
    if(me) await db.prepare('UPDATE match_queue SET seen_at=?, elo=? WHERE user_id=?').bind(now, u.elo, u.id).run();
    else await db.prepare('INSERT INTO match_queue (user_id,elo,joined_at,seen_at) VALUES (?,?,?,?)').bind(u.id, u.elo, now, now).run();
    const cand=await db.prepare(`SELECT * FROM match_queue WHERE user_id<>? AND room_code IS NULL AND seen_at>=? AND ABS(elo-?)<=?
      ORDER BY ABS(elo-?), joined_at LIMIT 1`).bind(u.id, now-QUEUE_STALE_MS, u.elo, Ranked.ELO_RANGE, u.elo).first();
    if(cand){
      const code=roomCode(), mine=Math.random()<0.5 ? 'red' : 'black', theirs = mine==='red' ? 'black' : 'red';
      const r=await db.prepare('UPDATE match_queue SET room_code=?, color=? WHERE user_id=? AND room_code IS NULL').bind(code, theirs, cand.user_id).run();
      if(r.meta.changes===1){
        await db.prepare('DELETE FROM match_queue WHERE user_id=?').bind(u.id).run();
        return json(200, {status:'matched', roomCode:code, color:mine});
      }
    }
    return json(200, {status:'waiting'});
  });
  route('POST','/api/match/cancel', async c=>{
    const u=await requireUser(c);
    const me=await c.db.prepare('SELECT * FROM match_queue WHERE user_id=?').bind(u.id).first();
    await c.db.prepare('DELETE FROM match_queue WHERE user_id=?').bind(u.id).run();
    return json(200, me && me.room_code ? queueView(me) : {status:'cancelled'});
  });
  // Hết thời gian chờ: ghép máy (trừ khi vừa kịp được ghép với người)
  route('POST','/api/match/bot', async c=>{
    const u=await requireUser(c), db=c.db, now=c.now;
    const me=await db.prepare('SELECT * FROM match_queue WHERE user_id=?').bind(u.id).first();
    await db.prepare('DELETE FROM match_queue WHERE user_id=?').bind(u.id).run();
    if(me && me.room_code) return json(200, queueView(me));
    const open=await db.prepare('SELECT * FROM bot_games WHERE user_id=? AND finished_at IS NULL ORDER BY id DESC LIMIT 1').bind(u.id).first();
    if(open) return json(200, {status:'bot', game:botView(open)});
    const n=await db.prepare('SELECT COUNT(*) AS n FROM bot_games WHERE user_id=? AND created_at>?').bind(u.id, now-DAY).first('n');
    if((n||0)>=BOT_DAILY_MAX) throw new ApiError(429,'bot_daily');
    const fresh=await userBy(db,'id',u.id);
    const level=Ranked.botLevelFor(fresh.elo), L=Ranked.BOT_LEVELS[level-1];
    const seed=rand(4).reduce((a,b)=>a*256+b,0);
    const name=Ranked.botNick(seed), botElo=L.elo+Math.round((rand(1)[0]/255-0.5)*60), color=rand(1)[0]<128 ? 'red' : 'black';
    const r=await db.prepare('INSERT INTO bot_games (user_id,level,bot_name,bot_elo,color,created_at) VALUES (?,?,?,?,?,?)').bind(u.id, level, name, botElo, color, now).run();
    return json(201, {status:'bot', game:botView(await db.prepare('SELECT * FROM bot_games WHERE id=?').bind(r.meta.last_row_id).first())});
  });
  function botView(bg){ return {id:bg.id, level:bg.level, botName:bg.bot_name, botElo:bg.bot_elo, color:bg.color, createdAt:bg.created_at}; }
  // Nộp kết quả ván với máy: phát lại nước đi để kiểm tra, rồi tính Elo
  route('POST','/api/match/bot/:id/finish', async c=>{
    const u=await requireUser(c), b=await body(c.req), db=c.db, now=c.now;
    const bg=await db.prepare('SELECT * FROM bot_games WHERE id=? AND user_id=?').bind(+c.params.id, u.id).first();
    if(!bg) throw new ApiError(404,'not_found');
    if(bg.finished_at) return json(200, {result:bg.result, elo:{before:bg.elo_before, after:bg.elo_after, delta:bg.elo_after-bg.elo_before}, already:true});
    const moves=Array.isArray(b.moves) ? b.moves : null;
    if(!moves || moves.length>600) throw new ApiError(400,'bad_request');
    const g=Game.create();
    for(const m of moves){
      if(!Array.isArray(m) || m.length!==4 || g.result) throw new ApiError(400,'bad_game');
      const ok=g.legalMoves().some(x=>x.from[0]===m[0]&&x.from[1]===m[1]&&x.to[0]===m[2]&&x.to[1]===m[3]);
      if(!ok) throw new ApiError(400,'bad_game');
      g.play({from:[m[0],m[1]], to:[m[2],m[3]]});
    }
    const me=bg.color, bot = me==='red' ? 'black' : 'red', reason=String(b.reason||'');
    let score;
    if(g.result){                                   // kết quả tự nhiên phải khớp phát lại
      score = !g.result.winner ? 0.5 : g.result.winner===me ? 1 : 0;
    } else if(reason==='resign' && b.winner===bot){ score=0; }          // mình đầu hàng
    else if(reason==='resign' && b.winner===me){                         // máy đầu hàng: chỉ nhận khi mình hơn rõ
      if(materialDiff(g.board(), me)<6) throw new ApiError(400,'bad_result');
      score=1;
    } else if(reason==='agreed' && !b.winner){                           // hoà thoả thuận
      if(moves.length<60 || Math.abs(materialDiff(g.board(), me))>2) throw new ApiError(400,'bad_result');
      score=0.5;
    } else throw new ApiError(400,'bad_result');
    if(score===1 && !g.result && moves.length<MIN_RATED_PLIES) throw new ApiError(400,'bad_result');   // máy đầu hàng quá sớm: không nhận
    const fresh=await userBy(db,'id',u.id);
    const elo=await settleBot(db, bg, fresh, score, moves, g.result ? g.result.reason : reason, now);
    return json(200, {result: score===1?'win':score===0?'loss':'draw', elo, user:profile(await userBy(db,'id',u.id))});
  });

  route('GET','/api/games', async c=>{
    const u=await requireUser(c);
    const {results}=await c.db.prepare('SELECT * FROM games WHERE red_user=? OR black_user=? ORDER BY ended_at DESC LIMIT 50').bind(u.id, u.id).all();
    return json(200, {games:results.map(g=>({id:g.id, roomCode:g.room_code, gameNo:g.game_no, you:g.red_user===u.id?'red':'black',
      red:g.red_name, black:g.black_name, moves:parse(g.moves,[]), result:g.result, reason:g.reason, rated:!!g.rated,
      eloBefore: g.red_user===u.id ? g.elo_red_before : g.elo_black_before, eloAfter: g.red_user===u.id ? g.elo_red_after : g.elo_black_after, endedAt:g.ended_at}))});
  });

  // Điểm vào: trả về Response cho /api/*, hoặc null nếu không phải đường dẫn API
  async function handle(req, env){
    const url=new URL(req.url);
    if(!url.pathname.startsWith('/api/')) return null;
    if(req.method==='OPTIONS') return new Response(null, {status:204, headers:CORS});
    if(!env.DB) return json(503, {error:'no_db', message:'Máy chủ chưa có cơ sở dữ liệu tài khoản'});
    const c={req, db:env.DB, now: env.now ? env.now() : Date.now(), ip:req.headers.get('cf-connecting-ip')||'local', ua:req.headers.get('user-agent')};
    try{
      for(const r of routes){
        if(r.method!==req.method) continue;
        const m=url.pathname.match(r.re); if(!m) continue;
        c.params=m.groups||{};
        return await r.fn(c);
      }
      return json(404, {error:'not_found', message:MESSAGES.not_found});
    }catch(e){
      if(e instanceof ApiError) return json(e.status, Object.assign({error:e.code, message:MESSAGES[e.code]||e.code}, e.extra||{}));
      console.error(e);
      return json(500, {error:'server', message:'Máy chủ gặp lỗi, thử lại sau'});
    }
  }

  return {handle, sessionUser, recordGame, mergeProgress, eloChange, kFactor, recoveryCode, normCode, hashRecovery, ONLINE_MS, RANKED_MIN, MIN_RATED_PLIES};
})();
