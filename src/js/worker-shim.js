self.onmessage=function(e){
  const d=e.data;
  try{
    if(d.cmd==='think'){ postMessage({id:d.id,result:XQSearch.think(d.args)}); }
    else if(d.cmd==='analyze'){
      const out=[];
      d.args.positions.forEach(function(p,i){
        out.push(XQSearch.think({board:p.board,turn:p.turn,timeMs:d.args.timeMs,maxDepth:d.args.maxDepth,historyKeys:p.historyKeys,historyChecks:p.historyChecks}));
        postMessage({id:d.id,progress:i+1});
      });
      postMessage({id:d.id,result:out});
    }
  }catch(err){ postMessage({id:d.id,error:String(err)}); }
};
