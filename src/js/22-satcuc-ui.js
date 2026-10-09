/* =========================================================================
   UI SÁT CỤC CƠ BẢN
   SATCUC (data-satcuc-gen.js): mỗi mẫu có idea / why / spot và 3 thế luyện
   đã được máy kiểm tra (chiếu bí 1 nước hoặc ép bí 2 nước).
   ========================================================================= */
const SC_GROUPS = [
  {id:'ma', name:'Mã'}, {id:'phao', name:'Pháo'}, {id:'xe', name:'Xe'},
  {id:'tot', name:'Tốt'}, {id:'tuong', name:'Tướng'}, {id:'ket-hop', name:'Kết hợp'},
];
// Gợi ý ngắn trên thẻ: câu đầu của phần ý tưởng (bỏ thẻ HTML)
function cardHint(t){ return String(t||'').replace(/<[^>]+>/g,'').split(/(?<=\.)\s/)[0]; }
function scSolved(){ return safeJSON('xq_sc_solved',[]); }
function markScSolved(id){ const s=scSolved(); if(!s.includes(id)){ s.push(id); safeLS_set('xq_sc_solved',JSON.stringify(s)); } }
function renderSatcucList(){
  const host=$('#satcucList'); if(!host || typeof SATCUC==='undefined') return;
  const solved=scSolved();
  const total=SATCUC.reduce((a,x)=>a+x.drills.length,0);
  $('#satcucProgress').textContent=`${SATCUC.length} thế · đã giải ${solved.length}/${total}`;
  host.innerHTML = SC_GROUPS.map(g=>{
    const items=SATCUC.filter(x=>x.group===g.id); if(!items.length) return '';
    return `<h4 class="eg-group-h">${esc(g.name)}</h4><div class="topic-grid">${items.map(it=>{
      const done=it.drills.filter((d,i)=>solved.includes(it.key+':'+i)).length;
      return `<button class="opening-card topic-card ${done===it.drills.length&&done?'seen':''}" data-sc="${it.key}">
        <div class="puzzle-top"><h4>${esc(it.name)}</h4><span class="tc-count">${done}/${it.drills.length}</span></div>
        <span class="tc-hint">${esc(cardHint(it.idea))}</span></button>`; }).join('')}</div>`;
  }).join('');
  $$('[data-sc]',host).forEach(b=>b.addEventListener('click',()=>openSatcuc(b.dataset.sc)));
}
function openSatcuc(key){
  const list=SATCUC, idx=list.findIndex(x=>x.key===key), it=list[idx];
  $('#tacticListCard').hidden=true; $('#tacticDetailCard').hidden=false;
  $('#tacticContent').innerHTML = `
    <div class="lesson-head"><h3>${esc(it.name)}</h3></div>
    <div class="lesson-body"><div class="lesson-text">
      <p><b>Ý tưởng.</b> ${esc(it.idea)}</p>
      <p><b>Vì sao hiệu quả?</b> ${esc(it.why)}</p>
      <p><b>Nhận ra khi nào?</b> ${esc(it.spot)}</p>
      <p class="hint-text">Trước khi đi, hãy tự hỏi: <i>Tướng đối phương còn những ô nào để chạy? Quân nào của mình đang khoá các ô đó? Nước chiếu cuối cùng do quân nào thực hiện?</i></p>
    </div><div class="lesson-demos"></div></div>
    <div class="lesson-foot"><button class="btn btn-outline" id="tacPrev" ${idx===0?'disabled':''}><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-left"></use></svg>Trước</button><span class="hint-text">Sát cục ${idx+1}/${list.length}</span><button class="btn btn-jade" id="tacNext" ${idx===list.length-1?'disabled':''}>Tiếp<svg class="ic" aria-hidden="true" focusable="false"><use href="#i-right"></use></svg></button></div>`;
  const host=$('.lesson-demos',$('#tacticContent'));
  const slots=it.drills.map((d,i)=>{
    const slot=document.createElement('div'); slot.className='lesson-demo-slot'; host.appendChild(slot);
    const board=mkBoard(d.pieces.map(p=>[p[0],p[1],p[2],p[3]]));
    const caption = (d.n===1 ? `Đỏ đi, chiếu bí trong 1 nước theo mẫu ${esc(it.name)}.` : `Đỏ đi, ép chiếu bí trong 2 nước (mọi cách đỡ đều thua).`);
    initLessonDemo(slot, {board, toMove:RED, goal:d.n===1?'mate':'mate2', solution:{from:[d.sol[0],d.sol[1]],to:[d.sol[2],d.sol[3]]}, caption,
      explain:`Mẫu ${it.name}: ${it.idea}`, onSolved:()=>{ markScSolved(it.key+':'+i); }});
    return slot;
  });
  // một bàn tại một lúc: Ví dụ · Bài 1 · Bài 2 · Bài 3
  wireDemoTabs(host, slots, it.drills.map((d,i)=>i?'Bài '+i:'Ví dụ'));
  $('#tacPrev').addEventListener('click',()=>openSatcuc(list[idx-1].key));
  $('#tacNext').addEventListener('click',()=>openSatcuc(list[idx+1].key));
  $('#tacticDetailCard').scrollIntoView({block:'start'});
}

