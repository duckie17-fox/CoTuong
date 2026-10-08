/* =========================================================================
   TÀI KHOẢN — đăng ký/đăng nhập, mã khôi phục, đồng bộ tiến độ, trang Tôi,
   bạn bè + mời đấu, xếp hạng (spec v3). Máy chủ: server/src/accounts.js.
   - Mật khẩu băm PBKDF2-SHA256 600.000 vòng ngay trên trình duyệt rồi mới gửi.
   - Phiên: token trong xq_auth, gửi qua "Authorization: Bearer".
   - Đồng bộ: mỗi khoá xq_* nhớ thời điểm sửa (xq_sync_meta); 5 giây sau thay đổi thì gửi lên,
     máy chủ gộp rồi trả về bản đã gộp.
   ========================================================================= */
const Account = (function(){
  const NO_SYNC = new Set(['xq_last_tab','xq_zone','xq_online_server','xq_online_token','xq_online_rooms','xq_auth','xq_user','xq_sync_meta','xq_ranked_bot']);
  const LEARN_KEYS = ['xq_lessons_done','xq_puzzles_solved','xq_sc_solved','xq_tactics_seen','xq_eg_seen','xq_srs','xq_daily','xq_trainer_best','xq_ai_history','xq_online_history'];
  const USER_RE = /^[a-z0-9_.]{3,20}$/;
  const st = { user:null, sync:'idle', syncTimer:0, applying:false, inbox:null, inboxTimer:0, expired:false, seenInvites:new Set(), seenSent:new Set(),
    friends:null, rankScope:'friends', searchTimer:0, lastSync:0 };
  const api = {iterations:600000, reload:()=>location.reload()};   // test có thể chỉnh

  /* ---------- tiện ích ---------- */
  const token = () => safeLS_get('xq_auth');
  const signedIn = () => !!token() && !!st.user;
  function base(){
    const ws = Online.server(); if(!ws) return '';
    return ws.replace(/^ws/i, 'http');
  }
  function isArtifact(){ try{ return !!(window.claude && window.claude.use); }catch(e){ return false; } }
  const available = () => !!base() && !isArtifact();
  const I = n => icon(n);
  const enc = s => new TextEncoder().encode(s);
  async function passHash(username, pw){
    const key=await crypto.subtle.importKey('raw', enc(pw), 'PBKDF2', false, ['deriveBits']);
    const bits=await crypto.subtle.deriveBits({name:'PBKDF2', hash:'SHA-256', salt:enc('cotuong:'+username.toLowerCase()), iterations:api.iterations}, key, 256);
    return [...new Uint8Array(bits)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  class ApiErr extends Error { constructor(status, body){ super((body&&body.message)||'Không kết nối được máy chủ'); this.status=status; this.code=body&&body.error; this.body=body; } }
  async function call(method, path, body){
    const headers={'content-type':'application/json'};
    if(token()) headers.authorization='Bearer '+token();
    let res;
    try{ res=await fetch(base()+path, {method, headers, body: body ? JSON.stringify(body) : undefined}); }
    catch(e){ throw new ApiErr(0, {message:'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'}); }
    let data=null; try{ data=await res.json(); }catch(e){}
    if(!res.ok){
      if(res.status===401 && data && data.error==='unauthorized' && token()) sessionExpired();
      throw new ApiErr(res.status, data);
    }
    return data;
  }
  function initials(name){ const w=String(name||'?').trim().split(/\s+/); return (w.length>1 ? w[0][0]+w[w.length-1][0] : w[0].slice(0,2)).toUpperCase(); }
  function hue(s){ let h=0; for(const ch of String(s)) h=(h*31+ch.charCodeAt(0))>>>0; return h%360; }
  function avatar(u, cls){ const name=u.displayName||u.username; return `<span class="avatar${cls?' '+cls:''}" style="--av:${hue(u.username||name)}" aria-hidden="true">${esc(initials(name))}</span>`; }
  const fmtDate = t => new Date(t).toLocaleDateString('vi-VN');

  /* ---------- lưu phiên ---------- */
  function setUser(u){ st.user=u; if(u) safeLS_set('xq_user', JSON.stringify(u)); render(); }
  function saveSession(tok, u){ safeLS_set('xq_auth', tok); st.expired=false; setUser(u); startInbox(); }
  function clearSession(){
    try{ localStorage.removeItem('xq_auth'); localStorage.removeItem('xq_user'); localStorage.removeItem('xq_sync_meta'); }catch(e){}
    st.user=null; st.inbox=null; clearInterval(st.inboxTimer); clearTimeout(st.syncTimer); st.sync='idle';
    render(); renderBadge();
  }
  function sessionExpired(){
    if(st.expired) return;
    st.expired=true;
    try{ localStorage.removeItem('xq_auth'); }catch(e){}
    clearInterval(st.inboxTimer);
    const was=st.user; st.user=null; render();
    notice({id:'expired', html:`<b>Phiên đăng nhập đã hết hạn.</b> Tiến độ trên máy này vẫn còn nguyên.`, actions:[{label:'Đăng nhập lại', primary:true, run:()=>openLogin(was&&was.username)}]});
  }

  /* ---------- đồng bộ tiến độ ---------- */
  function meta(){ const m=safeJSON('xq_sync_meta',{}); m.t=m.t||{}; return m; }
  function saveMeta(m){ try{ localStorage.setItem('xq_sync_meta', JSON.stringify(m)); }catch(e){} }
  function syncedKeys(){
    const out=[];
    try{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k && k.startsWith('xq_') && !NO_SYNC.has(k)) out.push(k); } }catch(e){}
    return out;
  }
  function collect(){ const d={}; for(const k of syncedKeys()){ const v=safeLS_get(k); if(v!=null) d[k]=v; } return d; }
  function hasLocalProgress(){
    return LEARN_KEYS.some(k=>{ const v=safeJSON(k,null); return v && (Array.isArray(v) ? v.length : Object.keys(v).length); });
  }
  function onLocalChange(key){
    if(st.applying || !key || !key.startsWith('xq_') || NO_SYNC.has(key)) return;
    const m=meta(); m.t[key]=Date.now(); saveMeta(m);
    if(signedIn()){ clearTimeout(st.syncTimer); st.syncTimer=setTimeout(()=>sync(), 5000); }
  }
  // Ghi bản đã gộp từ máy chủ xuống máy; trả về các khoá học tập đã đổi
  function applyRemote(r, replace){
    st.applying=true;
    const changed=[];
    try{
      if(replace) for(const k of syncedKeys()) if(!(k in r.data)){ try{ localStorage.removeItem(k); }catch(e){} changed.push(k); }
      for(const [k,v] of Object.entries(r.data||{})){
        if(NO_SYNC.has(k) || !k.startsWith('xq_')) continue;
        if(safeLS_get(k)!==v){ safeLS_set(k, v); changed.push(k); }
      }
      const m=meta(); m.t=Object.assign({}, r.t||{}); m.last=Date.now(); saveMeta(m);
    } finally { st.applying=false; }
    return changed;
  }
  async function sync(opts){
    opts=opts||{};
    if(!signedIn() || st.sync==='syncing') return null;
    clearTimeout(st.syncTimer);
    st.sync='syncing'; renderSync();
    try{
      const r=await call('PUT','/api/progress',{data:collect(), t:meta().t});
      const changed=applyRemote(r);
      st.sync='ok'; st.lastSync=Date.now();
      renderSync();
      if(!opts.quiet && changed.some(k=>LEARN_KEYS.includes(k)))
        notice({id:'synced', html:'Tiến độ vừa được cập nhật từ máy khác.', actions:[{label:'Tải lại để xem', primary:true, run:()=>api.reload()}]});
      return changed;
    }catch(e){
      st.sync = e.status===401 ? 'idle' : 'error'; renderSync();
      return null;
    }
  }

  /* ---------- hộp thoại ---------- */
  let dlgDone=null, dlgPrevFocus=null;
  function openDialog(html, onMount){
    const root=$('#dlg'), body=$('#dlgBody');
    dlgPrevFocus=document.activeElement;
    body.innerHTML=html; root.hidden=false;
    document.body.classList.add('dlg-open');
    const first=$('input,button:not(.dlg-x)',body); (first||$('.dlg',root)).focus();
    $$('[data-dlg-close]',body).forEach(b=>b.addEventListener('click',closeDialog));
    if(onMount) onMount(body);
  }
  function closeDialog(){
    const root=$('#dlg'); if(root.hidden) return;
    root.hidden=true; $('#dlgBody').innerHTML=''; document.body.classList.remove('dlg-open');
    if(dlgDone){ const f=dlgDone; dlgDone=null; f(); }
    if(dlgPrevFocus && dlgPrevFocus.focus) try{ dlgPrevFocus.focus(); }catch(e){}
  }
  const dlgHead = (title, closable=true) => `<div class="dlg-head"><h2 id="dlgTitle">${title}</h2>${closable?`<button type="button" class="dlg-x" data-dlg-close aria-label="Đóng">${I('x')}</button>`:''}</div>`;
  function fieldHTML(id, label, type, extra){
    const pw=type==='password';
    return `<label class="dlg-field" for="${id}"><span>${label}</span>
      <span class="dlg-input">${`<input class="field" id="${id}" type="${type}" ${extra||''}>`}${pw?`<button type="button" class="pw-eye" data-eye="${id}" aria-label="Hiện mật khẩu" title="Hiện mật khẩu">${I('eye')}</button>`:''}</span>
      <small class="dlg-err" id="${id}Err" aria-live="polite"></small></label>`;
  }
  function wireForm(body, onSubmit){
    $$('[data-eye]',body).forEach(b=>b.addEventListener('click',()=>{ const i=$('#'+b.dataset.eye); const show=i.type==='password'; i.type=show?'text':'password'; b.setAttribute('aria-label', show?'Ẩn mật khẩu':'Hiện mật khẩu'); }));
    const form=$('form',body), btn=$('button[type=submit]',form), msg=$('.dlg-msg',body);
    form.addEventListener('submit', async e=>{
      e.preventDefault();
      $$('.dlg-err',body).forEach(x=>x.textContent=''); if(msg) msg.textContent='';
      const label=btn.innerHTML; btn.disabled=true; btn.innerHTML=`<span class="spinner" aria-hidden="true"></span>${btn.textContent}`;
      try{ await onSubmit(); }
      catch(err){ if(msg) msg.textContent=err.message||'Có lỗi, thử lại sau.'; }
      finally{ if(btn.isConnected){ btn.disabled=false; btn.innerHTML=label; } }
    });
  }
  const fieldErr = (id, t) => { const el=$('#'+id+'Err'); if(el) el.textContent=t; return false; };
  const val = id => ($('#'+id)||{}).value||'';

  function openLogin(prefill){
    if(!available()) return noServerNotice();
    openDialog(`${dlgHead('Đăng nhập')}
      <form novalidate>
        ${fieldHTML('lgUser','Tên đăng nhập','text','autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="20"')}
        ${fieldHTML('lgPass','Mật khẩu','password','autocomplete="current-password"')}
        <p class="dlg-msg" role="alert"></p>
        <button type="submit" class="btn btn-primary dlg-main">Đăng nhập</button>
      </form>
      <div class="dlg-links"><button type="button" class="link-btn" id="lgForgot">Quên mật khẩu?</button><button type="button" class="link-btn" id="lgReg">Chưa có tài khoản? Đăng ký</button></div>`, body=>{
      if(prefill){ $('#lgUser').value=prefill; $('#lgPass').focus(); }
      $('#lgForgot').addEventListener('click',()=>openForgot(val('lgUser')));
      $('#lgReg').addEventListener('click',()=>openRegister());
      wireForm(body, async ()=>{
        const u=val('lgUser').trim().toLowerCase(), p=val('lgPass');
        if(!u) return fieldErr('lgUser','Nhập tên đăng nhập');
        if(!p) return fieldErr('lgPass','Nhập mật khẩu');
        const r=await call('POST','/api/login',{username:u, passHash:await passHash(u,p)});
        await afterSignIn(r, false);
      });
    });
  }
  function openRegister(){
    if(!available()) return noServerNotice();
    openDialog(`${dlgHead('Tạo tài khoản')}
      <form novalidate>
        ${fieldHTML('rgUser','Tên đăng nhập','text','autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="20"')}
        <small class="hint-text small dlg-hint">3–20 ký tự: chữ không dấu, số, dấu _ và dấu chấm. Bạn bè tìm bạn bằng tên này.</small>
        ${fieldHTML('rgName','Tên hiển thị','text','autocomplete="nickname" maxlength="24"')}
        ${fieldHTML('rgPass','Mật khẩu','password','autocomplete="new-password"')}
        ${fieldHTML('rgPass2','Nhập lại mật khẩu','password','autocomplete="new-password"')}
        <p class="dlg-msg" role="alert"></p>
        <button type="submit" class="btn btn-primary dlg-main">Tạo tài khoản</button>
      </form>
      <div class="dlg-links"><button type="button" class="link-btn" id="rgLogin">Đã có tài khoản? Đăng nhập</button></div>`, body=>{
      $('#rgLogin').addEventListener('click',()=>openLogin());
      $('#rgUser').addEventListener('input',()=>{ if(!$('#rgName').dataset.touched) $('#rgName').placeholder=$('#rgUser').value.trim(); });
      $('#rgName').addEventListener('input',()=>{ $('#rgName').dataset.touched='1'; });
      wireForm(body, async ()=>{
        const u=val('rgUser').trim().toLowerCase(), name=val('rgName').trim()||u, p=val('rgPass'), p2=val('rgPass2');
        let ok=true;
        if(!USER_RE.test(u)) ok=fieldErr('rgUser','Tên đăng nhập 3–20 ký tự, chỉ gồm chữ không dấu, số, _ và .');
        if(p.length<8) ok=fieldErr('rgPass','Mật khẩu cần ít nhất 8 ký tự');
        else if(p!==p2) ok=fieldErr('rgPass2','Hai mật khẩu chưa khớp');
        if(!ok) return;
        try{
          const r=await call('POST','/api/register',{username:u, displayName:name, passHash:await passHash(u,p)});
          showRecoveryCode(r.recoveryCode, 'Tài khoản đã tạo xong', ()=>afterSignIn(r, true));
        }catch(e){ if(e.code==='username_taken'||e.code==='bad_username') return fieldErr('rgUser', e.message); throw e; }
      });
    });
  }
  function openForgot(prefill){
    openDialog(`${dlgHead('Lấy lại mật khẩu')}
      <p class="hint-text small">Dùng mã khôi phục bạn đã lưu khi tạo tài khoản (dạng ABCD-EFGH-JKLM-NPQR).</p>
      <form novalidate>
        ${fieldHTML('fgUser','Tên đăng nhập','text','autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="20"')}
        ${fieldHTML('fgCode','Mã khôi phục','text','autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="24"')}
        ${fieldHTML('fgPass','Mật khẩu mới','password','autocomplete="new-password"')}
        ${fieldHTML('fgPass2','Nhập lại mật khẩu mới','password','autocomplete="new-password"')}
        <p class="dlg-msg" role="alert"></p>
        <button type="submit" class="btn btn-primary dlg-main">Đặt mật khẩu mới</button>
      </form>
      <div class="dlg-links"><button type="button" class="link-btn" id="fgBack">Quay lại đăng nhập</button></div>`, body=>{
      if(prefill) $('#fgUser').value=prefill;
      $('#fgBack').addEventListener('click',()=>openLogin(val('fgUser')));
      wireForm(body, async ()=>{
        const u=val('fgUser').trim().toLowerCase(), code=val('fgCode'), p=val('fgPass'), p2=val('fgPass2');
        let ok=true;
        if(!u) ok=fieldErr('fgUser','Nhập tên đăng nhập');
        if(code.replace(/[^A-Za-z0-9]/g,'').length!==16) ok=fieldErr('fgCode','Mã khôi phục gồm 16 chữ và số');
        if(p.length<8) ok=fieldErr('fgPass','Mật khẩu cần ít nhất 8 ký tự');
        else if(p!==p2) ok=fieldErr('fgPass2','Hai mật khẩu chưa khớp');
        if(!ok) return;
        const r=await call('POST','/api/recover',{username:u, recoveryCode:code, newPassHash:await passHash(u,p)});
        showRecoveryCode(r.recoveryCode, 'Đã đặt mật khẩu mới', ()=>afterSignIn(r, false), 'Mã khôi phục cũ đã hết hiệu lực và các máy khác đã bị đăng xuất. Đây là mã mới của bạn:');
      });
    });
  }
  // Hiện mã khôi phục một lần; bắt buộc tích "đã lưu" mới đi tiếp
  function showRecoveryCode(code, title, next, lead){
    const file='ma-khoi-phuc-co-tuong.txt';
    openDialog(`${dlgHead(title, false)}
      <p>${lead||'Đây là <b>mã khôi phục</b> của bạn:'}</p>
      <div class="recovery-code" id="rcCode">${esc(code)}</div>
      <div class="btn-row"><button type="button" class="btn btn-outline btn-sm" id="rcCopy">${I('copy')}Sao chép</button><button type="button" class="btn btn-outline btn-sm" id="rcSave">${I('download')}Tải về</button></div>
      <p class="hint-text small mt10">Không có email nên đây là cách duy nhất để lấy lại tài khoản khi quên mật khẩu. Mã chỉ hiện một lần — hãy chép ra giấy hoặc lưu vào nơi an toàn.</p>
      <label class="check-line"><input type="checkbox" id="rcOk"> Tôi đã lưu mã này</label>
      <p class="dlg-msg" role="alert"></p>
      <button type="button" class="btn btn-primary dlg-main" id="rcNext" disabled>Tiếp tục</button>`, body=>{
      const msg=$('.dlg-msg',body);
      $('#rcOk').addEventListener('change',()=>{ $('#rcNext').disabled=!$('#rcOk').checked; });
      $('#rcCopy').addEventListener('click', async ()=>{ try{ await navigator.clipboard.writeText(code); msg.textContent='Đã sao chép mã.'; }catch(e){ msg.textContent='Hãy tự chép mã ở trên.'; } });
      $('#rcSave').addEventListener('click', async ()=>{
        const text=`Mã khôi phục Cờ Tướng (${ONLINE_WEB_URL})\n${code}\n`;
        try{
          if(window.claude && window.claude.use){ const d=await window.claude.use('downloads'); await d.save({filename:file, data:text}); }
          else { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'})); a.download=file; document.body.appendChild(a); a.click(); a.remove(); }
          msg.textContent='Đã tải tệp mã khôi phục.';
        }catch(e){ msg.textContent='Không tải được tệp — hãy sao chép mã.'; }
      });
      $('#rcNext').addEventListener('click',()=>{ closeDialog(); next && next(); });
    });
  }
  // Sau đăng nhập / đăng ký / khôi phục: lưu phiên, gộp tiến độ
  async function afterSignIn(r, fresh){
    saveSession(r.token, r.user);
    closeDialog();
    if(fresh){ await sync({quiet:true}); toastMsg(`Chào ${r.user.displayName}! Tiến độ trên máy này đã được lưu vào tài khoản.`); return; }
    let remote=null;
    try{ remote=await call('GET','/api/progress'); }catch(e){}
    const remoteHas = remote && Object.keys(remote.data||{}).some(k=>LEARN_KEYS.includes(k));
    if(!hasLocalProgress() || !remoteHas){
      // một bên trống: gộp luôn, không cần hỏi
      const changed=await sync({quiet:true});
      if(changed && changed.some(k=>LEARN_KEYS.includes(k))) api.reload();
      else toastMsg(`Đã đăng nhập: ${r.user.displayName}.`);
      return;
    }
    openDialog(`${dlgHead('Gộp tiến độ?', false)}
      <p>Máy này đã có tiến độ học. Bạn muốn gộp vào tài khoản không?</p>
      <ul class="lesson-list"><li><b>Gộp</b>: giữ cả hai — bài đã học, bài tập đã giải, ván đã đấu ở máy này và trong tài khoản.</li>
      <li><b>Bỏ qua</b>: dùng tiến độ của tài khoản, bỏ tiến độ đang có trên máy này.</li></ul>
      <div class="btn-row mt10"><button type="button" class="btn btn-primary" id="mgMerge">Gộp</button><button type="button" class="btn btn-outline" id="mgSkip">Bỏ qua, dùng tiến độ tài khoản</button></div>`, ()=>{
      $('#mgMerge').addEventListener('click', async ()=>{ closeDialog(); await sync({quiet:true}); api.reload(); });
      $('#mgSkip').addEventListener('click', ()=>{ closeDialog(); applyRemote(remote, true); api.reload(); });
    });
  }
  function noServerNotice(){
    toastMsg(isArtifact() ? 'Đăng nhập chỉ dùng được ở bản web.' : 'Chưa kết nối được máy chủ tài khoản — hãy thử lại sau.');
  }
  function confirmDialog(title, html, okLabel, run, danger){
    openDialog(`${dlgHead(title)}${html}<p class="dlg-msg" role="alert"></p>
      <div class="btn-row mt10"><button type="button" class="btn ${danger?'btn-danger':'btn-primary'}" id="cfOk">${okLabel}</button><button type="button" class="btn btn-outline" data-dlg-close>Huỷ</button></div>`, body=>{
      $('#cfOk').addEventListener('click', async ()=>{
        const b=$('#cfOk'); b.disabled=true;
        try{ await run(body); }catch(e){ $('.dlg-msg',body).textContent=e.message; b.disabled=false; }
      });
    });
  }

  /* ---------- trang Tôi ---------- */
  function renderTop(){
    const lab=$('#meLabel'), ic=$('#meIcon'), u=st.user;
    if(u){ lab.textContent='Tôi'; ic.innerHTML=avatar(u,'avatar-xs'); }
    else { lab.textContent = available() ? 'Đăng nhập' : 'Tôi'; ic.innerHTML=icon('user','zone-ic'); }
    renderSync();
  }
  function renderSync(){
    const b=$('#syncIcon'); if(!b) return;
    b.hidden=!signedIn();
    const s=st.sync, map={syncing:['sync','Đang đồng bộ…','spin'], error:['alert','Đồng bộ lỗi — bấm để thử lại','bad'], ok:['check','Đã đồng bộ',''], idle:['check','Đồng bộ tiến độ','']}[s]||['check','',''];
    b.innerHTML=icon(map[0]); b.title=map[1]; b.setAttribute('aria-label',map[1]); b.className='sync-ic '+map[2];
    const t=$('#meSyncText');
    if(t){
      const m=meta();
      t.textContent = s==='syncing' ? 'Đang đồng bộ…' : s==='error' ? 'Chưa đồng bộ được (mất mạng?). Tiến độ vẫn lưu trên máy này, sẽ thử lại sau.'
        : m.last ? `Lần đồng bộ cuối: ${new Date(m.last).toLocaleString('vi-VN')}. Tiến độ tự đồng bộ vài giây sau mỗi thay đổi.` : 'Chưa đồng bộ lần nào.';
    }
  }
  function statTile(big, small){ return `<div class="dash-tile"><b>${big}</b><span>${small}</span></div>`; }
  function renderMe(){
    const u=st.user;
    $('#meIntro').hidden=!!u; $('#meSigned').hidden=!u; $('#meAccount').hidden=!u;
    $('#meAuthBtns').hidden=!available();
    const ns=$('#meNoServer'); ns.hidden=available();
    ns.innerHTML = isArtifact() ? `Đăng nhập dùng được ở bản web: <a href="${ONLINE_WEB_URL}" target="_blank" rel="noopener">${ONLINE_WEB_URL}</a>` : 'Chưa kết nối được máy chủ tài khoản nên chưa đăng nhập được.';
    if(!u) return;
    $('#meAvatar').outerHTML=`<span class="me-avatar me-letter" id="meAvatar" style="--av:${hue(u.username)}">${esc(initials(u.displayName))}</span>`;
    $('#meName').textContent=u.displayName;
    $('#meSub').textContent=`@${u.username} · tham gia ${fmtDate(u.createdAt)}`;
    $('#meElo').textContent=u.elo;
    const t=Ranked.tierOf(u.elo);
    $('#meEloSub').innerHTML = `<span class="tier tier-${t.key}">${esc(t.label)}</span> · cao nhất ${u.peakElo}`;
    const s=Progress.summary(), ai=loadHistory(), streak=Learn.streak();
    const w=ai.filter(r=>r.result&&r.result.winner===r.human).length, d=ai.filter(r=>r.result&&!r.result.winner).length, l=ai.filter(r=>r.result&&r.result.winner&&r.result.winner!==r.human).length;
    $('#meStats').innerHTML = statTile(`${s.lessons}/${LESSONS.length}`,'bài học đã xem') + statTile(`${s.puzzles}/${PUZZLES.length}`,'bài tập đã giải')
      + statTile(streak||'—','ngày liên tiếp làm bài hôm nay') + statTile(`${w}-${d}-${l}`,'đấu với máy: thắng-hoà-thua')
      + statTile(`${u.wins}-${u.draws}-${u.losses}`,'Sa trường (tính Elo): thắng-hoà-thua') + statTile(u.peakElo,'Elo cao nhất');
    renderSync();
  }
  function render(){
    renderTop(); renderMe();
    const on=signedIn();
    $$('[data-need-login]').forEach(e=>{ e.hidden=on; });
    $$('[data-when-login]').forEach(e=>{ e.hidden=!on; });
    $$('[data-open-login],[data-open-register]').forEach(b=>{ b.disabled=!available(); });
    document.dispatchEvent(new CustomEvent('accountchange'));
  }
  async function refreshMe(){ try{ const r=await call('GET','/api/me'); setUser(r.user); }catch(e){} }

  function initMe(){
    $$('[data-open-login]').forEach(b=>b.addEventListener('click',()=>openLogin()));
    $$('[data-open-register]').forEach(b=>b.addEventListener('click',()=>openRegister()));
    $('#syncIcon').addEventListener('click',()=>sync());
    $('#meSyncNow').addEventListener('click',()=>sync());
    $('#meRename').addEventListener('click',()=>{ $('#meRenameForm').hidden=false; $('#meRename').hidden=true; const i=$('#meRenameInput'); i.value=st.user.displayName; i.focus(); i.select(); });
    $('#meRenameCancel').addEventListener('click',()=>{ $('#meRenameForm').hidden=true; $('#meRename').hidden=false; });
    $('#meRenameForm').addEventListener('submit', async e=>{
      e.preventDefault();
      try{ const r=await call('PATCH','/api/me',{displayName:$('#meRenameInput').value}); setUser(r.user); $('#meRenameForm').hidden=true; $('#meRename').hidden=false; }
      catch(err){ toastMsg(err.message); }
    });
    $('#meChangePass').addEventListener('click',()=>{
      openDialog(`${dlgHead('Đổi mật khẩu')}<form novalidate>
        ${fieldHTML('cpOld','Mật khẩu hiện tại','password','autocomplete="current-password"')}
        ${fieldHTML('cpNew','Mật khẩu mới','password','autocomplete="new-password"')}
        ${fieldHTML('cpNew2','Nhập lại mật khẩu mới','password','autocomplete="new-password"')}
        <p class="dlg-msg" role="alert"></p><button type="submit" class="btn btn-primary dlg-main">Đổi mật khẩu</button></form>`, body=>{
        wireForm(body, async ()=>{
          const o=val('cpOld'), n=val('cpNew'), n2=val('cpNew2'), u=st.user.username;
          if(n.length<8) return fieldErr('cpNew','Mật khẩu cần ít nhất 8 ký tự');
          if(n!==n2) return fieldErr('cpNew2','Hai mật khẩu chưa khớp');
          try{ await call('POST','/api/password',{oldPassHash:await passHash(u,o), newPassHash:await passHash(u,n)}); }
          catch(e){ if(e.status===401) return fieldErr('cpOld','Mật khẩu hiện tại chưa đúng'); throw e; }
          closeDialog(); toastMsg('Đã đổi mật khẩu. Các máy khác đã được đăng xuất.');
        });
      });
    });
    $('#meNewCode').addEventListener('click',()=>{
      openDialog(`${dlgHead('Tạo mã khôi phục mới')}<p class="hint-text small">Mã cũ sẽ hết hiệu lực.</p><form novalidate>
        ${fieldHTML('ncPass','Mật khẩu','password','autocomplete="current-password"')}
        <p class="dlg-msg" role="alert"></p><button type="submit" class="btn btn-primary dlg-main">Tạo mã mới</button></form>`, body=>{
        wireForm(body, async ()=>{
          try{ const r=await call('POST','/api/recovery-code',{passHash:await passHash(st.user.username, val('ncPass'))}); showRecoveryCode(r.recoveryCode,'Mã khôi phục mới',null); }
          catch(e){ if(e.status===401) return fieldErr('ncPass','Mật khẩu chưa đúng'); throw e; }
        });
      });
    });
    $('#meLogout').addEventListener('click',()=>{
      openDialog(`${dlgHead('Đăng xuất')}<p>Giữ tiến độ học trên máy này sau khi đăng xuất?</p>
        <div class="btn-row mt10"><button type="button" class="btn btn-primary" id="loKeep">Đăng xuất, giữ tiến độ</button><button type="button" class="btn btn-outline" id="loWipe">Đăng xuất và xoá tiến độ trên máy này</button></div>`, ()=>{
        $('#loKeep').addEventListener('click',()=>logout(false));
        $('#loWipe').addEventListener('click',()=>logout(true));
      });
    });
    $('#meLogoutAll').addEventListener('click',()=>confirmDialog('Đăng xuất mọi thiết bị','<p>Tất cả các máy đang đăng nhập tài khoản này (kể cả máy này) sẽ bị đăng xuất.</p>','Đăng xuất tất cả', async ()=>{
      await call('POST','/api/logout-all'); closeDialog(); clearSession(); toastMsg('Đã đăng xuất khỏi mọi thiết bị.');
    }));
    $('#meDelete').addEventListener('click',()=>{
      openDialog(`${dlgHead('Xoá tài khoản')}<p><b>Không thể hoàn tác.</b> Tài khoản, tiến độ đã đồng bộ, bạn bè và lời mời sẽ bị xoá. Ván đã đấu vẫn còn trong lịch sử của đối thủ, tên bạn đổi thành “Người chơi đã xoá”.</p>
        <form novalidate>${fieldHTML('dlUser','Gõ lại tên đăng nhập','text','autocomplete="off" autocapitalize="none" spellcheck="false"')}${fieldHTML('dlPass','Mật khẩu','password','autocomplete="current-password"')}
        <p class="dlg-msg" role="alert"></p><button type="submit" class="btn btn-danger dlg-main">Xoá tài khoản vĩnh viễn</button></form>`, body=>{
        wireForm(body, async ()=>{
          const u=st.user.username;
          if(val('dlUser').trim().toLowerCase()!==u) return fieldErr('dlUser','Tên đăng nhập chưa khớp');
          try{ await call('DELETE','/api/me',{username:u, passHash:await passHash(u, val('dlPass'))}); }
          catch(e){ if(e.status===401) return fieldErr('dlPass','Mật khẩu chưa đúng'); throw e; }
          closeDialog(); clearSession(); toastMsg('Đã xoá tài khoản. Tiến độ trên máy này vẫn giữ nguyên.');
        });
      });
    });
    $('#dlg').addEventListener('click',e=>{ if(e.target.id==='dlg' && $('.dlg-x',$('#dlg'))) closeDialog(); });
    document.addEventListener('keydown',e=>{
      if($('#dlg').hidden) return;
      if(e.key==='Escape' && $('.dlg-x',$('#dlg'))) closeDialog();
      if(e.key==='Tab'){   // giữ Tab trong hộp thoại
        const f=$$('button:not([disabled]),input,select,textarea,a[href]',$('#dlg')).filter(x=>!x.hidden); if(!f.length) return;
        const first=f[0], last=f[f.length-1];
        if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
      }
    });
    document.addEventListener('zoneshown',e=>{ if(e.detail==='toi'){ renderMe(); if(signedIn()) refreshMe(); } });
  }
  async function logout(wipe){
    closeDialog();
    if(!wipe) await sync({quiet:true});
    try{ await call('POST','/api/logout'); }catch(e){}
    const keys=syncedKeys();
    clearSession();
    if(wipe){ for(const k of keys) try{ localStorage.removeItem(k); }catch(e){} api.reload(); return; }
    toastMsg('Đã đăng xuất. Tiến độ trên máy này vẫn giữ nguyên.');
  }

  /* ---------- thông báo nổi (lời mời đấu, phiên hết hạn…) ---------- */
  function notice(n){
    const stack=$('#noticeStack'); if(!stack) return;
    const old=$(`[data-notice="${n.id}"]`,stack); if(old) old.remove();
    const el=document.createElement('div'); el.className='notice'; el.dataset.notice=n.id; el.setAttribute('role','status');
    el.innerHTML=`<div class="notice-text">${n.html}</div><div class="btn-row">${(n.actions||[]).map((a,i)=>`<button type="button" class="btn btn-sm ${a.primary?'btn-primary':'btn-outline'}" data-i="${i}">${a.label}</button>`).join('')}</div>`
      +`<button type="button" class="notice-x" aria-label="Đóng">${I('x')}</button>`;
    $$('[data-i]',el).forEach(b=>b.addEventListener('click',()=>{ el.remove(); n.actions[+b.dataset.i].run(); }));
    $('.notice-x',el).addEventListener('click',()=>{ el.remove(); n.onClose && n.onClose(); });
    stack.appendChild(el);
    if(n.timeout) setTimeout(()=>el.remove(), n.timeout);
    return el;
  }
  const dropNotice = id => { const el=$(`#noticeStack [data-notice="${id}"]`); if(el) el.remove(); };
  function toastMsg(text){ notice({id:'toast', html:esc(text), timeout:5000}); }

  /* ---------- hộp thư: lời mời đấu, lời mời kết bạn, nhịp online ---------- */
  function startInbox(){
    clearInterval(st.inboxTimer);
    if(!signedIn()) return;
    pollInbox();
    st.inboxTimer=setInterval(()=>{ if(!document.hidden) pollInbox(); }, 20000);
  }
  async function pollInbox(){
    if(!signedIn()) return;
    let r; try{ r=await call('GET','/api/inbox'); }catch(e){ return; }
    st.inbox=r;
    if(r.user && JSON.stringify(r.user)!==JSON.stringify(st.user)) setUser(Object.assign({}, r.user, {online:undefined}));
    renderBadge();
    for(const inv of r.invites){
      if(st.seenInvites.has(inv.id)) continue;
      st.seenInvites.add(inv.id);
      notice({id:'inv'+inv.id, html:`<b>${esc(inv.from.displayName)}</b> mời bạn đấu một ván ${inv.rated?'(tính Elo)':'(giao hữu)'}.`, actions:[
        {label:'Vào phòng', primary:true, run:()=>answerInvite(inv, true)},
        {label:'Từ chối', run:()=>answerInvite(inv, false)}]});
    }
    for(const s of r.sent){
      if(s.status==='declined' && !st.seenSent.has(s.id)){ st.seenSent.add(s.id); toastMsg(`${s.to.displayName} đã từ chối lời mời đấu.`); }
    }
    if(r.friendRequests && $('[data-stpanel="banbe"]') && !$('[data-stpanel="banbe"]').hidden) loadFriends();
  }
  async function answerInvite(inv, accept){
    try{
      await call('POST',`/api/invites/${inv.id}/${accept?'accept':'decline'}`);
      if(accept){ showStab('phong'); Online.enterRoom(inv.roomCode); }
    }catch(e){ toastMsg(e.status===404 ? 'Lời mời đã hết hạn.' : e.message); }
    pollInbox();
  }
  function renderBadge(){
    const b=$('#zoneBadge'); if(!b) return;
    const n = st.inbox && signedIn() ? st.inbox.invites.length + (st.inbox.friendRequests||0) : 0;
    b.hidden=!n; b.textContent=n>9?'9+':String(n||'');
    const sb=$('.st-btn[data-stab="banbe"]'); if(sb) sb.dataset.count = st.inbox && st.inbox.friendRequests ? st.inbox.friendRequests : '';
  }

  /* ---------- bạn bè ---------- */
  function relBtn(u){
    if(u.relation==='friend') return `<span class="hint-text small">Đã là bạn</span>`;
    if(u.relation==='sent') return `<span class="hint-text small">Đã gửi lời mời</span>`;
    if(u.relation==='received') return `<button type="button" class="btn btn-primary btn-sm" data-accept="${u.id}">Đồng ý kết bạn</button>`;
    return `<button type="button" class="btn btn-outline btn-sm" data-add="${esc(u.username)}">${I('plus')}Kết bạn</button>`;
  }
  function personRow(u, right){
    return `<div class="person">${avatar(u)}<div class="person-main"><b>${esc(u.displayName)}</b>
      <small class="hint-text">@${esc(u.username)} · Elo ${u.elo}${u.online!=null?` · <span class="ol-dot ${u.online?'on':''}"></span>${u.online?'đang online':'không online'}`:''}</small></div>
      <div class="person-act">${right||''}</div></div>`;
  }
  async function search(){
    const q=$('#friendSearch').value.trim().toLowerCase(), out=$('#friendResults');
    if(q.length<3){ out.innerHTML = q ? '<p class="hint-text small">Gõ ít nhất 3 ký tự.</p>' : ''; return; }
    try{
      const r=await call('GET','/api/users?q='+encodeURIComponent(q));
      if($('#friendSearch').value.trim().toLowerCase()!==q) return;
      out.innerHTML = r.users.length ? r.users.map(u=>personRow(u, relBtn(u))).join('') : '<p class="hint-text small">Không tìm thấy ai có tên đăng nhập bắt đầu bằng “'+esc(q)+'”.</p>';
      wireFriendBtns(out);
    }catch(e){ out.innerHTML=`<p class="hint-text small">${esc(e.message)}</p>`; }
  }
  function wireFriendBtns(root){
    $$('[data-add]',root).forEach(b=>b.addEventListener('click', async ()=>{ b.disabled=true; try{ await call('POST','/api/friends',{username:b.dataset.add}); }catch(e){ toastMsg(e.message); } search(); loadFriends(); }));
    $$('[data-accept]',root).forEach(b=>b.addEventListener('click', async ()=>{ b.disabled=true; try{ await call('POST',`/api/friends/${b.dataset.accept}/accept`); }catch(e){ toastMsg(e.message); } loadFriends(); search(); pollInbox(); }));
    $$('[data-remove]',root).forEach(b=>b.addEventListener('click', async ()=>{
      if(b.dataset.confirm!=='1'){ b.dataset.confirm='1'; b.textContent=b.dataset.ask||'Bấm lần nữa để xác nhận'; setTimeout(()=>{ if(b.isConnected){ b.dataset.confirm=''; b.textContent=b.dataset.label; } },3000); return; }
      b.disabled=true; try{ await call('DELETE',`/api/friends/${b.dataset.remove}`); }catch(e){ toastMsg(e.message); } loadFriends(); pollInbox();
    }));
    $$('[data-invite]',root).forEach(b=>b.addEventListener('click',()=>{ const f=(st.friends&&st.friends.friends||[]).find(x=>x.id===+b.dataset.invite); if(f) openInvite(f); }));
  }
  async function loadFriends(){
    if(!signedIn()) return;
    let r; try{ r=await call('GET','/api/friends'); }catch(e){ $('#friendList').innerHTML=`<p class="hint-text">${esc(e.message)}</p>`; return; }
    st.friends=r;
    $('#friendRequestsCard').hidden=!r.incoming.length;
    $('#friendRequests').innerHTML=r.incoming.map(u=>personRow(u, `<button type="button" class="btn btn-primary btn-sm" data-accept="${u.id}">Đồng ý</button><button type="button" class="btn btn-outline btn-sm" data-remove="${u.id}" data-label="Từ chối" data-ask="Bấm lần nữa để từ chối">Từ chối</button>`)).join('');
    $('#friendList').innerHTML = r.friends.length ? r.friends.map(u=>personRow(u, `<button type="button" class="btn btn-primary btn-sm" data-invite="${u.id}">${I('swords')}Mời đấu</button>
        <button type="button" class="btn btn-outline btn-sm" data-remove="${u.id}" data-label="Huỷ kết bạn" data-ask="Bấm lần nữa để huỷ">Huỷ kết bạn</button>`)).join('')
      : '<p class="hint-text">Chưa có bạn nào — tìm theo tên đăng nhập ở trên.</p>';
    $('#friendOutgoing').innerHTML = r.outgoing.length ? `<h3 class="group-h mt16">Đang chờ đồng ý</h3>${r.outgoing.map(u=>personRow(u, `<button type="button" class="btn btn-outline btn-sm" data-remove="${u.id}" data-label="Huỷ lời mời" data-ask="Bấm lần nữa để huỷ">Huỷ lời mời</button>`)).join('')}` : '';
    wireFriendBtns($('[data-stpanel="banbe"]'));
    renderFriendsOnline();
  }
  // Hàng "Bạn bè đang online" ở thẻ Phòng đấu
  function renderFriendsOnline(){
    const el=$('#olFriendsOnline'); if(!el) return;
    const on=signedIn() && st.friends ? st.friends.friends.filter(f=>f.online) : [];
    el.hidden=!on.length;
    el.innerHTML = on.length ? `<h2>Bạn bè đang online</h2><div class="friends-row">${on.map(f=>`<button type="button" class="friend-chip" data-invite="${f.id}" title="Mời ${esc(f.displayName)} đấu">${avatar(f)}<span>${esc(f.displayName)}</span><small>Mời đấu</small></button>`).join('')}</div>` : '';
    $$('[data-invite]',el).forEach(b=>b.addEventListener('click',()=>{ const f=on.find(x=>x.id===+b.dataset.invite); if(f) openInvite(f); }));
  }
  function openInvite(f){
    openDialog(`${dlgHead('Mời '+esc(f.displayName)+' đấu')}
      <fieldset class="setup-field"><legend>Bạn cầm quân</legend><div class="seg-radio">
        <label><input type="radio" name="ivColor" value="red" checked><span>Đỏ</span></label><label><input type="radio" name="ivColor" value="black"><span>Đen</span></label><label><input type="radio" name="ivColor" value="random"><span>Ngẫu nhiên</span></label></div></fieldset>
      <label class="switch mt16"><input type="checkbox" id="ivRated" checked><span class="switch-ui" aria-hidden="true"></span><span><b>Tính Elo</b></span></label>
      <p class="hint-text small mt10">${f.online?'Đang online.':'Không online — lời mời giữ trong 10 phút.'}</p>
      <p class="dlg-msg" role="alert"></p>
      <button type="button" class="btn btn-primary dlg-main" id="ivSend">Mời và vào phòng</button>`, body=>{
      $('#ivSend').addEventListener('click', async ()=>{
        const color=($('input[name="ivColor"]:checked',body)||{}).value||'red', rated=$('#ivRated').checked;
        $('#ivSend').disabled=true;
        try{
          const r=await call('POST','/api/invites',{to:f.id, color, rated});
          closeDialog(); showStab('phong');
          Online.enterRoom(r.invite.roomCode, {color, rated});
        }catch(e){ $('.dlg-msg',body).textContent=e.message; $('#ivSend').disabled=false; }
      });
    });
  }

  /* ---------- xếp hạng ---------- */
  async function loadRank(){
    if(!signedIn()) return;
    const el=$('#rankList');
    $$('#rankScope button').forEach(b=>b.setAttribute('aria-pressed', b.dataset.scope===st.rankScope?'true':'false'));
    let r; try{ r=await call('GET','/api/leaderboard?scope='+st.rankScope); }catch(e){ el.innerHTML=`<p class="hint-text">${esc(e.message)}</p>`; return; }
    const row = x => `<div class="rank-row${x.me?' me':''}"><span class="rank-n">${x.rank!=null?x.rank:'—'}</span>${avatar(x)}
      <span class="rank-name"><span><b>${esc(x.displayName)}</b>${x.me?' <small>(bạn)</small>':''}</span><small class="hint-text">${x.rank!=null?`${x.ratedGames} ván`:`Chưa xếp hạng · còn ${Math.max(0,r.minGames-x.ratedGames)} ván`}</small></span>
      <span class="rank-elo"><span class="tier tier-${Ranked.tierOf(x.elo).key}">${esc(Ranked.tierOf(x.elo).label)}</span>${x.elo}</span></div>`;
    el.innerHTML = (r.list.length ? r.list.map(row).join('') : `<p class="hint-text">${r.scope==='all'?'Chưa có ai đủ 5 ván tính Elo.':'Chưa có bạn bè. Kết bạn ở thẻ Bạn bè.'}</p>`)
      + (r.me ? `<div class="rank-pin">${row(r.me)}</div>` : '');
  }

  function init(){
    LS_HOOK=onLocalChange;
    try{ const u=JSON.parse(safeLS_get('xq_user')||'null'); if(u && token()) st.user=u; }catch(e){}
    initMe();
    $('#friendSearch').addEventListener('input',()=>{ clearTimeout(st.searchTimer); st.searchTimer=setTimeout(search, 300); });
    $$('#rankScope button').forEach(b=>b.addEventListener('click',()=>{ st.rankScope=b.dataset.scope; loadRank(); }));
    document.addEventListener('zoneshown',e=>{
      if(e.detail!=='satruong' || !signedIn()) return;
      if(currentStab==='banbe' || currentStab==='phong') loadFriends();
      if(currentStab==='xephang') loadRank();
    });
    document.addEventListener('visibilitychange',()=>{ if(!document.hidden && signedIn()){ pollInbox(); } });
    render();
    if(token() && available()){ refreshMe().then(()=>{ if(signedIn()){ sync(); startInbox(); } }); }
  }
  return {init, sync, signedIn, user:()=>st.user, setUser, token, api, openLogin, openRegister, call, passHash, state:st, available, applyRemote, collect, meta, notice, closeDialog};
})();
function initAccount(){ Account.init(); }
