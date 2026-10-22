"use strict";
importScripts("./physics3d.js?v=20261022-zpol2");
self.onmessage=function(event){
  try {
    const p=event.data.params,n=event.data.n;
    if(!Number.isInteger(n)||n<32||n>1000)throw Error("Grid out of range");
    function transferResult(result,preview){
      const buffers=[];
      for(const ax of Field3D.AXES){
        const fields=result.axes[ax].fields;
        for(const name of Field3D.NAMES)buffers.push(fields[name].buffer);
      }
      self.postMessage({ok:true,preview,result,token:event.data.token},buffers);
    }
    if(n>256){
      // Send a quick visible result while the same worker refines all three cuts.
      const preview=Field3D.compute(p,160);
      transferResult(preview,true);
    }
    const result=Field3D.compute(p,n);
    transferResult(result,false);
  }catch(error){
    self.postMessage({ok:false,error:String(error),token:event.data.token});
  }
};