"use strict";
importScripts("./physics3d.js");
self.onmessage=function(event){
  try {
    const p=event.data.params,n=event.data.n;
    if(!Number.isInteger(n)||n<32||n>1000)throw Error("Grid out of range");
    const result=Field3D.compute(p,n);
    const buffers=[];
    for(const ax of Field3D.AXES){
      const fields=result.axes[ax].fields;
      for(const name of Field3D.NAMES)buffers.push(fields[name].buffer);
    }
    self.postMessage({ok:true,result:result,token:event.data.token},buffers);
  }catch(error){
    self.postMessage({ok:false,error:String(error),token:event.data.token});
  }
};