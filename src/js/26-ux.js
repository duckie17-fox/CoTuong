/* =========================================================================
   UX — âm thanh nước đi, xuất/nhập tiến độ, bảng cài đặt
   - Âm thanh tổng hợp bằng WebAudio (không cần file ngoài), tắt/bật được.
   - Tiến độ (bài đã học, bài tập đã giải, lịch sử ván…) nằm trong localStorage
     của trình duyệt; xuất ra một đoạn mã/tệp JSON để chuyển sang máy khác.
   ========================================================================= */
const prefersReducedMotion = ()=> !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

const Sound = (function(){
  let ctx=null;
  let enabled = safeLS_get('xq_sound')!=='off';
  function ac(){
    if(ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    try{ ctx=new AC(); }catch(e){ ctx=null; }
    return ctx;
  }
  // Tiếng "cạch" của quân gỗ: nhiễu ngắn qua bộ lọc + một nốt trầm rất ngắn
  function knock(c, t, freq, gain, len){
    const n=Math.floor(c.sampleRate*len), buf=c.createBuffer(1,n,c.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/n,4);
    const src=c.createBufferSource(); src.buffer=buf;
    const bp=c.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=freq; bp.Q.value=1.4;
    const g=c.createGain(); g.gain.value=gain;
    src.connect(bp); bp.connect(g); g.connect(c.destination); src.start(t);
    const o=c.createOscillator(), og=c.createGain();
    o.frequency.setValueAtTime(freq/6,t); og.gain.setValueAtTime(gain*0.5,t); og.gain.exponentialRampToValueAtTime(0.0001,t+len*1.6);
    o.connect(og); og.connect(c.destination); o.start(t); o.stop(t+len*1.7);
  }
  function play(kind){
    if(!enabled) return;
    const c=ac(); if(!c) return;
    try{
      if(c.state==='suspended') c.resume();
      const t=c.currentTime+0.01;
      if(kind==='capture'){ knock(c,t,1500,0.9,0.06); knock(c,t+0.05,1100,0.7,0.07); }
      else if(kind==='check'){ knock(c,t,2200,0.6,0.05); knock(c,t+0.09,2600,0.6,0.05); }
      else if(kind==='end'){ knock(c,t,900,0.7,0.09); knock(c,t+0.12,700,0.7,0.12); }
      else knock(c,t,1300,0.7,0.06);
    }catch(e){}
  }
  return {
    play,
    isOn:()=>enabled,
    set(on){ enabled=!!on; safeLS_set('xq_sound', enabled?'on':'off'); if(enabled) play('move'); },
  };
})();

/* ---------- Nhạc nền: không lời, kiểu đàn tranh ngũ cung — tự sinh bằng Web Audio, không cần tệp nhạc ---------- */
const Music = (function(){
  let ctx=null, out=null, drone=null, timer=0, next=0, phrase=[], cur=7, playing=false, armed=false;
  let on = safeLS_get('xq_music')==='on';
  // Ngũ cung (cung–thương–giốc–chuỷ–vũ) trên nền Rê, ba quãng tám
  const scale=[];
  for(let o=0;o<3;o++) for(const st of [0,2,4,7,9]) scale.push(146.83*Math.pow(2,(st+12*o)/12));
  const rnd=a=>a[Math.floor(Math.random()*a.length)];
  function ac(){
    if(ctx) return ctx;
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return null;
    try{
      ctx=new AC();
      out=ctx.createGain(); out.gain.value=0;
      // vang kiểu phòng rộng: xung nhiễu tắt dần
      const len=Math.floor(ctx.sampleRate*3.2), ir=ctx.createBuffer(2,len,ctx.sampleRate);
      for(let ch=0;ch<2;ch++){ const d=ir.getChannelData(ch); for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3); }
      const rev=ctx.createConvolver(); rev.buffer=ir;
      const wet=ctx.createGain(); wet.gain.value=0.45;
      out.connect(ctx.destination); out.connect(rev); rev.connect(wet); wet.connect(ctx.destination);
    }catch(e){ ctx=null; }
    return ctx;
  }
  // Một tiếng gảy dây: nhấn nhẹ rồi nhả (cao độ trượt về), rung dây cuối nốt, tiếng tắt dần
  function pluck(t, f, v, len){
    const o=ctx.createOscillator(), o2=ctx.createOscillator(), h=ctx.createGain(), lp=ctx.createBiquadFilter(), g=ctx.createGain();
    const lfo=ctx.createOscillator(), lg=ctx.createGain();
    o.type='triangle'; o.frequency.setValueAtTime(f*1.015,t); o.frequency.exponentialRampToValueAtTime(f,t+0.09);
    o2.type='sine'; o2.frequency.setValueAtTime(f*2,t); h.gain.value=0.2;
    lfo.frequency.value=5.2; lg.gain.setValueAtTime(0,t); lg.gain.linearRampToValueAtTime(f*0.007,t+0.7);
    lfo.connect(lg); lg.connect(o.frequency);
    lp.type='lowpass'; lp.frequency.setValueAtTime(Math.min(f*7,6000),t); lp.frequency.exponentialRampToValueAtTime(f*1.4,t+len);
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(v,t+0.008); g.gain.exponentialRampToValueAtTime(0.0001,t+len);
    o.connect(lp); o2.connect(h); h.connect(lp); lp.connect(g); g.connect(out);
    for(const x of [o,o2,lfo]){ x.start(t); x.stop(t+len+0.05); }
  }
  // Một câu nhạc: đôi khi lướt dây, các nốt đi gần nhau, kết về chủ âm, rồi nghỉ
  function makePhrase(){
    const p=[];
    if(Math.random()<0.22){
      const s=3+Math.floor(Math.random()*3);
      for(let k=0;k<6;k++) p.push({i:s+k, v:0.035+k*0.008, len:2, d:0.075});
      p[p.length-1].d=0.7; cur=s+5;
    }
    const n=4+Math.floor(Math.random()*4);
    for(let k=0;k<n;k++){
      cur=Math.max(4, Math.min(12, cur+rnd([-2,-1,-1,0,1,1,2])));
      p.push({i:cur, v:0.09+Math.random()*0.04, len:2.8, d:rnd([0.6,0.85,0.85,1.2,1.7]), bass: k===0 ? rnd([0,3]) : null});
    }
    cur=rnd([5,5,8]); p.push({i:cur, v:0.1, len:4.5, d:2.4});
    p.push({rest:true, d:1.8+Math.random()*2.6});
    return p;
  }
  function schedule(){
    if(!playing) return;
    while(next < ctx.currentTime+1.2){
      if(!phrase.length) phrase=makePhrase();
      const n=phrase.shift();
      if(!n.rest){
        pluck(next, scale[n.i], n.v, n.len);
        if(n.bass!=null) pluck(next, scale[n.bass], 0.08, 5);
      }
      next+=n.d;
    }
  }
  function startDrone(){
    const t=ctx.currentTime, g=ctx.createGain(), lfo=ctx.createOscillator(), lg=ctx.createGain();
    g.gain.value=0.022; lfo.frequency.value=0.07; lg.gain.value=0.012; lfo.connect(lg); lg.connect(g.gain);
    const os=[73.42, 110, 146.83].map(f=>{ const o=ctx.createOscillator(); o.type='sine'; o.frequency.value=f; o.connect(g); o.start(t); return o; });
    g.connect(out); lfo.start(t);
    drone={stop(at){ for(const o of os.concat(lfo)) o.stop(at); }};
  }
  function start(){
    if(playing || !ac()) return;
    if(ctx.state==='suspended') ctx.resume();
    playing=true; phrase=[]; next=ctx.currentTime+0.4;
    out.gain.cancelScheduledValues(ctx.currentTime);
    out.gain.setValueAtTime(out.gain.value, ctx.currentTime); out.gain.linearRampToValueAtTime(1, ctx.currentTime+3);
    startDrone(); schedule(); timer=setInterval(schedule, 250);
  }
  function stop(){
    if(!playing) return;
    playing=false; clearInterval(timer);
    const t=ctx.currentTime;
    out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(0, t+0.8);
    if(drone){ drone.stop(t+0.9); drone=null; }
  }
  // Trình duyệt chỉ cho phát tiếng sau khi người dùng chạm/bấm: chờ lần chạm đầu tiên
  function arm(){
    if(armed) return; armed=true;
    const go=()=>{ document.removeEventListener('pointerdown',go,true); document.removeEventListener('keydown',go,true); armed=false; if(on) start(); };
    document.addEventListener('pointerdown',go,true); document.addEventListener('keydown',go,true);
  }
  document.addEventListener('visibilitychange',()=>{
    if(!ctx) return;
    if(document.hidden) ctx.suspend().catch(()=>{}); else if(on) ctx.resume().catch(()=>{});
  });
  function set(v){
    on=!!v; safeLS_set('xq_music', on?'on':'off');
    if(on) start(); else stop();
    document.dispatchEvent(new CustomEvent('musicchange'));
  }
  if(on) arm();
  return {isOn:()=>on, set, toggle:()=>set(!on), available:()=>!!(window.AudioContext||window.webkitAudioContext)};
})();

const Progress = (function(){
  const APP='co-tuong-nhap-mon', VERSION=1, PREFIX='xq_';
  // Các mục không phải "tiến độ học" thì không cần mang theo
  const SKIP=new Set(['xq_last_tab','xq_zone','xq_online_server','xq_auth','xq_user','xq_sync_meta','xq_ranked_bot']);
  function keys(){
    const out=[];
    try{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k && k.startsWith(PREFIX) && !SKIP.has(k)) out.push(k); } }catch(e){}
    return out.sort();
  }
  function snapshot(){
    const data={}; for(const k of keys()){ const v=safeLS_get(k); if(v!=null) data[k]=v; }
    return {app:APP, version:VERSION, exported:new Date().toISOString(), data};
  }
  function exportText(){ return JSON.stringify(snapshot()); }
  // Trả về số mục đã nhập; ném lỗi (tiếng Việt) nếu dữ liệu không hợp lệ
  function importText(text){
    let obj;
    try{ obj=JSON.parse(String(text||'').trim()); }catch(e){ throw new Error('Mã tiến độ không đọc được (không phải JSON).'); }
    if(!obj || obj.app!==APP || typeof obj.data!=='object' || !obj.data) throw new Error('Đây không phải mã tiến độ của Cờ Tướng Nhập Môn.');
    if(obj.version>VERSION) throw new Error('Mã tiến độ được tạo từ phiên bản mới hơn — hãy cập nhật ứng dụng.');
    let n=0;
    for(const [k,v] of Object.entries(obj.data)){
      if(!k.startsWith(PREFIX) || SKIP.has(k) || typeof v!=='string') continue;
      safeLS_set(k,v); n++;
    }
    return n;
  }
  // Tóm tắt ngắn để người dùng biết mình đang mang theo gì
  function summary(){
    const n=k=>{ const v=safeJSON(k,[]); return Array.isArray(v)?v.length:Object.keys(v||{}).length; };
    return {lessons:n('xq_lessons_done'), puzzles:n('xq_puzzles_solved'), satcuc:n('xq_sc_solved'), games:n('xq_ai_history')};
  }
  return {exportText, importText, summary, keys};
})();

function initUxSettings(){
  const panel=$('#settingsPanel'); if(!panel) return;
  // Âm thanh
  const sndBtns=$$('#soundToggle button');
  const syncSound=()=>sndBtns.forEach(b=>b.setAttribute('aria-pressed', (b.dataset.sound==='on')===Sound.isOn()?'true':'false'));
  sndBtns.forEach(b=>b.addEventListener('click',()=>{ Sound.set(b.dataset.sound==='on'); syncSound(); }));
  syncSound();
  // Nhạc nền: trong Cài đặt và nút nốt nhạc trên đầu trang
  const musBtns=$$('#musicToggle button'), musTop=$('#musicBtn');
  const syncMusic=()=>{
    musBtns.forEach(b=>b.setAttribute('aria-pressed', (b.dataset.music==='on')===Music.isOn()?'true':'false'));
    if(musTop){ musTop.setAttribute('aria-pressed', Music.isOn()?'true':'false'); musTop.innerHTML=icon(Music.isOn()?'music':'musicOff');
      const t=Music.isOn()?'Tắt nhạc nền':'Bật nhạc nền'; musTop.title=t; musTop.setAttribute('aria-label',t); }
  };
  musBtns.forEach(b=>b.addEventListener('click',()=>Music.set(b.dataset.music==='on')));
  if(musTop){ musTop.hidden=!Music.available(); musTop.addEventListener('click',()=>Music.toggle()); }
  document.addEventListener('musicchange',syncMusic);
  syncMusic();
  // Tiến độ
  const msg=$('#progressMsg'), box=$('#progressText');
  const say=(t,ok)=>{ msg.textContent=t; msg.className='hint-text small '+(ok===false?'msg-bad':ok?'msg-good':''); };
  const refreshSummary=()=>{ const s=Progress.summary(); $('#progressSummary').textContent=`Đang lưu trong trình duyệt này: ${s.lessons} bài học, ${s.puzzles} bài tập, ${s.satcuc} bài sát cục đã giải, ${s.games} ván đấu.`; };
  document.addEventListener('zoneshown',e=>{ if(e.detail==='toi') refreshSummary(); });
  refreshSummary();
  $('#progressCopy').addEventListener('click', async ()=>{
    const t=Progress.exportText(); box.value=t; box.select();
    try{ await navigator.clipboard.writeText(t); say('Đã sao chép mã tiến độ. Dán vào ô này ở máy khác rồi bấm “Nhập”.',true); }
    catch(e){ say('Mã tiến độ đã hiện trong ô bên dưới — hãy tự sao chép (Ctrl/⌘+C).'); }
  });
  // Trong khung Artifact: tải tệp phải qua capability "downloads" (người xem xác nhận).
  // Mở file trực tiếp (không có window.claude): dùng link tải thông thường.
  const inArtifact = !!(window.claude && window.claude.use);
  let downloads = null;
  if(inArtifact){
    $('#progressDownload').hidden = true;   // chỉ hiện khi capability sẵn sàng
    window.claude.use('downloads').then(ns=>{ downloads=ns; if(ns) $('#progressDownload').hidden=false; }).catch(()=>{});
  }
  $('#progressDownload').addEventListener('click', async ()=>{
    const t=Progress.exportText();
    const filename='co-tuong-tien-do-'+new Date().toISOString().slice(0,10)+'.json';
    if(downloads){
      try{ await downloads.save({filename, data:t}); say('Đã lưu tệp tiến độ.',true); }
      catch(e){
        if(e && e.code==='declined') say('Đã huỷ lưu tệp.');
        else { box.value=t; say('Không lưu được tệp ở đây — mã tiến độ đã hiện trong ô bên dưới, hãy dùng “Sao chép mã”.'); }
      }
      return;
    }
    try{
      const a=document.createElement('a');
      a.href=URL.createObjectURL(new Blob([t],{type:'application/json'}));
      a.download=filename;
      document.body.appendChild(a); a.click(); a.remove();
      say('Đã tạo tệp tiến độ. Nếu trình duyệt chặn tải xuống, hãy dùng nút “Sao chép mã”.',true);
    }catch(e){ box.value=t; say('Không tải xuống được ở đây — mã tiến độ đã hiện trong ô bên dưới.'); }
  });
  const doImport=text=>{
    try{
      const n=Progress.importText(text);
      say(`Đã nhập ${n} mục. Đang tải lại để áp dụng…`,true);
      setTimeout(()=>location.reload(),600);
    }catch(e){ say(e.message,false); }
  };
  $('#progressImport').addEventListener('click',()=>doImport(box.value));
  $('#progressFile').addEventListener('change',e=>{
    const f=e.target.files&&e.target.files[0]; if(!f) return;
    const r=new FileReader(); r.onload=()=>{ box.value=String(r.result); doImport(r.result); }; r.readAsText(f);
  });
}
