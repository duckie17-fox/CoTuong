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

const Progress = (function(){
  const APP='co-tuong-nhap-mon', VERSION=1, PREFIX='xq_';
  // Các mục không phải "tiến độ học" thì không cần mang theo
  const SKIP=new Set(['xq_last_tab','xq_zone','xq_online_server','xq_auth','xq_user','xq_sync_meta']);
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
