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

/* ---------- Nhạc nền "Xuân phong": sáo trúc thổi giai điệu điệu Cung (ngũ cung trưởng, sáng, nhẹ nhàng),
   đàn tranh rải hợp âm khe khẽ, cổ cầm đệm trầm, thỉnh thoảng tiếng chuông nhỏ. Tự sinh bằng Web Audio ---------- */
const Music = (function(){
  let ctx=null, out=null, noise=null, drone=null, timer=0, next=0, queue=[], prevF=0, playing=false, armed=false, round=0;
  let on = safeLS_get('xq_music')==='on';
  const BEAT=60/72;                                   // vừa phải, khoảng 72 nhịp/phút
  // Điệu Cung (ngũ cung trưởng trên nền Rê): Rê Mi Fa# La Si, từ Rê4 lên
  const SC=[];
  for(let o=0;o<3;o++) for(const st of [0,2,4,7,9]) SC.push(293.66*Math.pow(2,(st+12*o)/12));
  const rnd=a=>a[Math.floor(Math.random()*a.length)];
  // Các câu nhạc soạn sẵn: [bậc trong SC, số phách]; -1 = nghỉ. Đi lên nhiều, kết về chủ âm Rê
  const P={
    a:[[5,1],[6,1],[7,1],[8,1],[7,2],[6,1],[5,1]],
    b:[[8,1],[9,1],[10,2],[9,1],[8,1],[7,2]],
    c:[[7,1],[8,.5],[7,.5],[6,1],[5,1],[3,1],[4,1],[5,2]],
    d:[[3,1],[4,1],[5,1],[7,1],[6,2],[5,1],[4,1]],
    e:[[10,1.5],[9,.5],[8,1],[7,1],[8,1],[9,1],[10,2]],
    f:[[7,1],[6,1],[5,3],[-1,1]],
    g:[[5,.5],[6,.5],[7,1],[8,1],[7,.5],[6,.5],[5,1],[6,2],[-1,1]],
  };
  const FORM=[['a','b','c','f'],['d','g','e','f'],['a','e','c','f'],['d','b','g','f']];
  // Gốc hợp âm cho từng câu (Rê, La, Sol, Si thứ) — quãng trầm
  const BASS={a:[146.83,110],b:[146.83,98],c:[110,146.83],d:[98,110],e:[146.83,123.47],f:[110,146.83],g:[146.83,98]};
  function ac(){
    if(ctx) return ctx;
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return null;
    try{
      ctx=new AC();
      out=ctx.createGain(); out.gain.value=0;
      // vang kiểu sảnh gỗ rộng: xung nhiễu tắt dần, dài
      const len=Math.floor(ctx.sampleRate*4.5), ir=ctx.createBuffer(2,len,ctx.sampleRate);
      for(let ch=0;ch<2;ch++){ const d=ir.getChannelData(ch); for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.5); }
      const rev=ctx.createConvolver(); rev.buffer=ir;
      const wet=ctx.createGain(); wet.gain.value=0.42;
      out.connect(ctx.destination); out.connect(rev); rev.connect(wet); wet.connect(ctx.destination);
      // nhiễu dùng chung cho tiếng hơi thổi
      const n=ctx.sampleRate*2; noise=ctx.createBuffer(1,n,ctx.sampleRate);
      const d=noise.getChannelData(0); for(let i=0;i<n;i++) d[i]=Math.random()*2-1;
    }catch(e){ ctx=null; }
    return ctx;
  }
  // Tiếng tiêu: vào hơi chậm, vuốt từ nốt trước sang, rung hơi về cuối nốt, có tiếng gió nhẹ
  function flute(t, f, dur, v){
    const o=ctx.createOscillator(), o2=ctx.createOscillator(), h=ctx.createGain(), lp=ctx.createBiquadFilter(), g=ctx.createGain();
    const lfo=ctx.createOscillator(), lg=ctx.createGain();
    o.type='sine'; o2.type='triangle'; h.gain.value=0.18;
    if(prevF && Math.abs(prevF-f)>1){ o.frequency.setValueAtTime(prevF,t); o.frequency.exponentialRampToValueAtTime(f,t+0.14); }
    else o.frequency.setValueAtTime(f,t);
    o2.frequency.value=f*2;
    lfo.frequency.value=5.4; lg.gain.setValueAtTime(0,t); lg.gain.setValueAtTime(0,t+Math.min(0.5,dur*0.4)); lg.gain.linearRampToValueAtTime(f*0.008,t+dur);
    lfo.connect(lg); lg.connect(o.frequency);
    lp.type='lowpass'; lp.frequency.value=Math.min(f*4,5000);
    const end=t+dur;
    g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(v,t+0.2); g.gain.setValueAtTime(v,Math.max(t+0.2,end-0.15));
    g.gain.exponentialRampToValueAtTime(0.0001,end+0.35);
    o.connect(lp); o2.connect(h); h.connect(lp); lp.connect(g); g.connect(out);
    for(const x of [o,o2,lfo]){ x.start(t); x.stop(end+0.4); }
    // hơi thổi
    const ns=ctx.createBufferSource(), bp=ctx.createBiquadFilter(), ng=ctx.createGain();
    ns.buffer=noise; ns.loop=true; bp.type='bandpass'; bp.frequency.value=f*1.6; bp.Q.value=3;
    ng.gain.setValueAtTime(0.0001,t); ng.gain.linearRampToValueAtTime(v*0.16,t+0.08); ng.gain.exponentialRampToValueAtTime(v*0.03,t+0.4);
    ng.gain.exponentialRampToValueAtTime(0.0001,end+0.3);
    ns.connect(bp); bp.connect(ng); ng.connect(out); ns.start(t, Math.random()); ns.stop(end+0.35);
    prevF=f;
  }
  // Tiếng cổ cầm trầm: gảy mềm, ngân dài, đôi khi vuốt lên nốt
  function qin(t, f, v){
    const g=ctx.createGain(), lp=ctx.createBiquadFilter();
    lp.type='lowpass'; lp.frequency.setValueAtTime(f*6,t); lp.frequency.exponentialRampToValueAtTime(f*1.5,t+3);
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(v,t+0.012); g.gain.exponentialRampToValueAtTime(0.0001,t+5.5);
    const slide=Math.random()<0.3;
    [[1,1],[2,0.35],[3,0.12]].forEach(([m,a])=>{
      const o=ctx.createOscillator(), og=ctx.createGain(); o.type='sine'; og.gain.value=a;
      if(slide){ o.frequency.setValueAtTime(f*m*0.944,t); o.frequency.exponentialRampToValueAtTime(f*m,t+0.3); } else o.frequency.value=f*m;
      o.connect(og); og.connect(lp); o.start(t); o.stop(t+5.6);
    });
    lp.connect(g); g.connect(out);
  }
  // Đàn tranh rải hợp âm: tiếng gảy sáng, tắt nhanh, rất nhỏ
  function zheng(t, f, v){
    const o=ctx.createOscillator(), g=ctx.createGain(), lp=ctx.createBiquadFilter();
    o.type='triangle'; o.frequency.setValueAtTime(f*1.01,t); o.frequency.exponentialRampToValueAtTime(f,t+0.05);
    lp.type='lowpass'; lp.frequency.setValueAtTime(Math.min(f*6,7000),t); lp.frequency.exponentialRampToValueAtTime(f*1.5,t+1.2);
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(v,t+0.006); g.gain.exponentialRampToValueAtTime(0.0001,t+1.6);
    o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t+1.7);
  }
  function arp(t, root){ [2,3,4,3].forEach((m,i)=>zheng(t+i*BEAT*0.5, root*m, 0.03)); }
  // Bồi âm: tiếng trong, mỏng như chuông nhỏ
  function bell(t, f, v){
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type='sine'; o.frequency.value=f;
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(v,t+0.006); g.gain.exponentialRampToValueAtTime(0.0001,t+3);
    o.connect(g); g.connect(out); o.start(t); o.stop(t+3.1);
  }
  // Xếp một vòng bài vào hàng đợi
  function fill(){
    const form=FORM[round++ % FORM.length];
    form.forEach(key=>{
      const notes=P[key], total=notes.reduce((a,n)=>a+n[1],0), bass=BASS[key];
      queue.push({bass:bass[0]}); if(Math.random()<0.3) queue.push({bell:SC[rnd([10,11,12,13])]});
      let beats=0, half=false;
      notes.forEach(([i,b])=>{
        if(!half && beats>=total/2){ queue.push({bass:bass[1]}); half=true; }
        queue.push(i<0 ? {rest:b} : {i, b});
        beats+=b;
      });
    });
    queue.push({rest:2+Math.random()*2});
  }
  function schedule(){
    if(!playing) return;
    while(next < ctx.currentTime+1.5){
      if(!queue.length) fill();
      const n=queue.shift();
      if(n.bass){ qin(next+0.02, n.bass, 0.09); arp(next+0.02, n.bass); continue; }
      if(n.bell){ bell(next+0.05, n.bell, 0.035); continue; }
      if(n.rest){ prevF=0; next+=n.rest*BEAT; continue; }
      const dur=n.b*BEAT*(0.96+Math.random()*0.08);
      // nốt dài đôi khi có nốt láy từ trên xuống
      if(n.b>=2 && Math.random()<0.3 && n.i+1<SC.length){ flute(next, SC[n.i+1], 0.12, 0.07); flute(next+0.12, SC[n.i], dur-0.12, 0.085); }
      else flute(next, SC[n.i], dur, 0.08+Math.random()*0.015);
      next+=n.b*BEAT;
    }
  }
  function startDrone(){
    const t=ctx.currentTime, g=ctx.createGain(), lfo=ctx.createOscillator(), lg=ctx.createGain();
    g.gain.value=0.016; lfo.frequency.value=0.05; lg.gain.value=0.008; lfo.connect(lg); lg.connect(g.gain);
    const os=[73.42, 146.83, 220].map(f=>{ const o=ctx.createOscillator(); o.type='sine'; o.frequency.value=f; o.connect(g); o.start(t); return o; });
    g.connect(out); lfo.start(t);
    drone={stop(at){ for(const o of os.concat(lfo)) o.stop(at); }};
  }
  function start(){
    if(playing || !ac()) return;
    if(ctx.state==='suspended') ctx.resume();
    playing=true; queue=[]; prevF=0; next=ctx.currentTime+0.5;
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
