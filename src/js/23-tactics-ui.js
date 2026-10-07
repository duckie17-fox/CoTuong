/* =========================================================================
   UI CHIẾN THUẬT & TÀN CUỘC
   ========================================================================= */
function tacticsDone(){ return safeJSON('xq_tactics_seen',[]); }
function renderTacticLists(){
  const seen=tacticsDone();
  const card=(it,kind)=>`<button class="opening-card topic-card ${seen.includes(kind+':'+it.key)?'seen':''}" data-kind="${kind}" data-key="${it.key}">
      <div class="puzzle-top">${kind==='end' ? `<span class="badge ${it.result==='win'?'badge-easy':'badge-mid'}">${it.result==='win'?'Thắng':'Hoà'}</span>` : `<span class="han-sm">${esc(it.han)}</span>`}${seen.includes(kind+':'+it.key)?'<span class="solved-check">✓</span>':''}</div>
      <h4>${esc(it.title)}</h4></button>`;
  $('#tacticGrid').innerHTML = TACTICS.map(t=>card(t,'tac')).join('');
  $('#endgameGrid').innerHTML = ENDGAMES.map(t=>card(t,'end')).join('');
  renderEndgameTheoryList();
  renderSatcucList();
  $$('#tacticGrid .topic-card, #endgameGrid .topic-card').forEach(b=>b.addEventListener('click',()=>openTactic(b.dataset.kind,b.dataset.key)));
}
function openTactic(kind,key){
  const list = kind==='tac'?TACTICS:ENDGAMES;
  const it=list.find(x=>x.key===key);
  const seen=tacticsDone(); if(!seen.includes(kind+':'+key)){ seen.push(kind+':'+key); safeLS_set('xq_tactics_seen',JSON.stringify(seen)); }
  $('#tacticListCard').hidden=true; $('#tacticDetailCard').hidden=false;
  const idx=list.indexOf(it);
  const badge = kind==='end' ? `<span class="badge ${it.result==='win'?'badge-easy':'badge-mid'}">${it.result==='win'?'Thế thắng':'Thế hoà'}</span>` : '<span class="badge badge-mid">Chiến thuật</span>';
  $('#tacticContent').innerHTML = `
    <div class="lesson-head"><span class="han" aria-hidden="true">${esc(it.han||(it.result==='win'?'勝':'和'))}</span><div>${badge}<h3 style="margin:4px 0 0;">${esc(it.title)}</h3></div></div>
    <div class="lesson-body"><div class="lesson-text">${it.text.map(t=>`<p>${t}</p>`).join('')}</div><div class="lesson-demos"><div class="lesson-demo-slot"></div></div></div>
    <div class="lesson-foot"><button class="btn btn-outline" id="tacPrev" ${idx===0?'disabled':''}>← Trước</button><span class="hint-text">${kind==='tac'?'Chiến thuật':'Tàn cuộc'} ${idx+1}/${list.length}</span><button class="btn btn-jade" id="tacNext" ${idx===list.length-1?'disabled':''}>Tiếp →</button></div>`;
  const demo=Object.assign({}, it.demo, {hero: it.demo.hero ? it.demo.hero.map(h=>h.slice()) : undefined, mateIn: it.mateIn, result: it.result});
  initLessonDemo($('.lesson-demo-slot',$('#tacticContent')), demo);
  $('#tacPrev').addEventListener('click',()=>openTactic(kind,list[idx-1].key));
  $('#tacNext').addEventListener('click',()=>openTactic(kind,list[idx+1].key));
  $('#tacticDetailCard').scrollIntoView({block:'start'});
}
function showTacSub(id){
  $$('#tacticListCard [data-sub]').forEach(b=>{ const on=b.dataset.sub===id; b.classList.toggle('on',on); b.setAttribute('aria-selected',on); });
  $$('#tacticListCard [data-subpanel]').forEach(p=>p.hidden = p.dataset.subpanel!==id);
  safeLS_set('xq_tac_sub',id);
}
function initTactics(){
  renderTacticLists();
  $$('#tacticListCard [data-sub]').forEach(b=>b.addEventListener('click',()=>showTacSub(b.dataset.sub)));
  const sub=safeLS_get('xq_tac_sub')||'satcuc';
  showTacSub(['satcuc','don','tancuoc'].includes(sub)?sub:'satcuc');
  $('#tacticBackBtn').addEventListener('click',()=>{ $('#tacticListCard').hidden=false; $('#tacticDetailCard').hidden=true; renderTacticLists(); });
}

