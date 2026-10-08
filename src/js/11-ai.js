/* =========================================================================
   AI — chạy XQSearch trong Web Worker (tạo từ Blob) để giao diện không bị đơ.
   Nếu trình duyệt/trang chặn Worker, tự chuyển sang chạy trên luồng chính.
   ========================================================================= */
// Mã nguồn Web Worker: build (tools/build.js) tự sinh từ 04-xqsearch.js + worker-shim.js
/*@@WORKER@@*/
const AIEngine = (function(){
  let worker=null, mode='main', seq=0;
  const pending=new Map();
  function tryWorker(){
    try{
      if(typeof Worker==='undefined' || typeof XQ_WORKER_SRC==='undefined') return;
      const url=URL.createObjectURL(new Blob([XQ_WORKER_SRC],{type:'text/javascript'}));
      const w=new Worker(url);
      w.onmessage=(e)=>{
        const d=e.data, p=pending.get(d.id); if(!p) return;
        if(d.progress!=null){ if(p.onProgress) p.onProgress(d.progress); return; }
        pending.delete(d.id);
        if(d.error) p.reject(new Error(d.error)); else p.resolve(d.result);
      };
      w.onerror=()=>{ // lỗi khởi tạo (ví dụ bị CSP chặn): chuyển về luồng chính
        if(mode==='worker'){ mode='main'; worker=null; for(const [id,p] of pending){ pending.delete(id); runMain(p.cmd,p.args,p.onProgress).then(p.resolve,p.reject); } }
      };
      worker=w; mode='worker';
    }catch(e){ worker=null; mode='main'; }
  }
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  async function runMain(cmd,args,onProgress){
    await sleep(30); // cho giao diện kịp vẽ "Máy đang suy nghĩ"
    if(cmd==='think') return XQSearch.think(Object.assign({},args,{timeMs:Math.min(args.timeMs||1000, 2500)}));
    if(cmd==='analyze'){
      const out=[];
      for(let i=0;i<args.positions.length;i++){
        const p=args.positions[i];
        out.push(XQSearch.think({board:p.board,turn:p.turn,timeMs:Math.min(args.timeMs,200),maxDepth:args.maxDepth,historyKeys:p.historyKeys,historyChecks:p.historyChecks,rootScores:true}));
        if(onProgress) onProgress(i+1);
        await sleep(0);
      }
      return out;
    }
  }
  function call(cmd,args,onProgress){
    if(!worker && mode!=='main-only') tryWorker();
    if(mode==='worker' && worker){
      const id=++seq;
      return new Promise((resolve,reject)=>{
        pending.set(id,{resolve,reject,onProgress,cmd,args});
        worker.postMessage({id,cmd,args});
      });
    }
    return runMain(cmd,args,onProgress);
  }
  return {
    think:(args)=>call('think',args),
    analyze:(args,onProgress)=>call('analyze',args,onProgress),
    mode:()=>mode,
    init:()=>{ if(!worker) tryWorker(); },
  };
})();

