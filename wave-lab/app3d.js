(function(){
"use strict";
const $=id=>document.getElementById(id),F=Field3D,PI=Math.PI,TWO=2*PI;
const colors=["#177e97","#d17d45","#785cba","#2e9a80","#cc5d80","#988249","#5076b1","#668b93"];
const state={
 freq:10,apX:5,apY:5,eta:.7,n:512,Lx:50,Ly:50,Lz:60,zMin:0,
 target:{x:0,y:0,z:50},probe:{x:0,y:0,z:50},cuts:{x:0,y:0,z:50},
 nodes:[{x:-3,y:-3,z:0,phase:0,power:1},{x:3,y:-3,z:0,phase:0,power:1},{x:-3,y:3,z:0,phase:0,power:1},{x:3,y:3,z:0,phase:0,power:1}],
 t:0,playing:false,speed:.5,mode:"E",data:null,rasters:{},tracePol:0
};
let worker=null,job=0,timer=null,lastTime=0,lastPaint=0,hover=null,rendering=false;
const fmt=(v,d=2)=>Number(v).toFixed(d);
const sci=v=>(Math.abs(v)>=.01&&Math.abs(v)<1000)?Number(v).toFixed(3):Number(v).toExponential(2);
const escapeHTML=x=>String(x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function params(){
 return {freq:state.freq,apX:state.apX,apY:state.apY,eta:state.eta,nodes:state.nodes.map(s=>({...s})),
  target:{...state.target},cuts:{...state.cuts},Lx:state.Lx,Ly:state.Ly,Lz:state.Lz,zMin:state.zMin};
}
function layoutNodes(count){
 const old=state.nodes.slice();
 const cols=Math.ceil(Math.sqrt(count)),rows=Math.ceil(count/cols);
 state.nodes=Array.from({length:count},(_,i)=>old[i]||{x:(i%cols-(cols-1)/2)*6,y:(Math.floor(i/cols)-(rows-1)/2)*6,z:0,phase:0,power:1});
 renderNodes();queue();
}
function renderNodes(){
 const root=$("nodes");root.replaceChildren();
 state.nodes.forEach((nd,i)=>{
  const e=document.createElement("div");e.className="node";
  const hdr=document.createElement("div");hdr.className="node-head";
  hdr.innerHTML='<i class="dot" style="background:'+colors[i%colors.length]+'"></i>节点 '+(i+1);e.appendChild(hdr);
  const cells=document.createElement("div");cells.className="node-fields";
  [["x","X / m"],["y","Y / m"],["z","Z / m"],["phase","相位 / °"],["power","功率 / W"]].forEach(pair=>{
   const d=document.createElement("div"),label=document.createElement("label"),input=document.createElement("input");
   const key=pair[0];label.textContent=pair[1];input.type="number";input.step="any";input.value=nd[key];input.min=key==="power"?"0":"";if(key==="power")input.max="10";
   input.setAttribute("aria-label","节点"+(i+1)+" "+pair[1]);
   input.addEventListener("change",()=>{
    const num=Number(input.value);
    if(!Number.isFinite(num)||input.value.trim()===""||(key==="power"&&(num<0||num>10))){input.value=nd[key];return;}
    nd[key]=num;input.value=String(num);queue();
   });
   d.appendChild(label);d.appendChild(input);cells.appendChild(d);
  });
  e.appendChild(cells);root.appendChild(e);
 });
}
function bind(){
 const numbers=[["freq","freq",.2,100],["apX","apX",.5,30],["apY","apY",.5,30],["eta","eta",.01,1],
 ["Lx","Lx",.05,500],["Ly","Ly",.05,500],["Lz","Lz",.05,500],["zMin","zMin",-1e6,1e6]];
 numbers.forEach(([id,key,lo,hi])=>$(id).addEventListener("change",()=>{
  let v=Number($(id).value);if($(id).value.trim()===""||!Number.isFinite(v)||v<lo||v>hi){$(id).value=state[key];return;}
  state[key]=v;queue();
 }));
 ["x","y","z"].forEach(axis=>{
  [["cut"+axis.toUpperCase(),state.cuts],["target"+axis.toUpperCase(),state.target],["probe"+axis.toUpperCase(),state.probe]]
   .forEach(([id,obj])=>$(id).addEventListener("change",()=>{
    const num=Number($(id).value);
    if($(id).value.trim()===""||!Number.isFinite(num)||Math.abs(num)>1e7){$(id).value=obj[axis];return;}
    obj[axis]=num;
    if(obj===state.probe)drawTrace();
    else queue();
    updateExtras();
   }));
 });
 $("resolution").addEventListener("change",()=>{state.n=Number($("resolution").value);queue();});
 $("count").addEventListener("change",()=>layoutNodes(Number($("count").value)));
 $("equalPhase").addEventListener("click",()=>{state.nodes.forEach(n=>n.phase=0);renderNodes();queue();});
 $("randomPhase").addEventListener("click",()=>{state.nodes.forEach(n=>n.phase=Math.round(Math.random()*360-180));renderNodes();queue();});
 $("modeE").addEventListener("click",()=>setMode("E"));
 $("modeS").addEventListener("click",()=>setMode("S"));
 $("play").addEventListener("click",()=>{state.playing=!state.playing;$("play").textContent=state.playing?"Ⅱ 暂停":"▶ 播放";lastTime=0;});
 $("reset").addEventListener("click",()=>{state.playing=false;state.t=0;$("play").textContent="▶ 播放";drawDynamic();});
 $("speed").addEventListener("change",()=>state.speed=Number($("speed").value));
 $("time").addEventListener("input",()=>{state.t=Number($("time").value);drawDynamic();});
 $("exportPNG").addEventListener("click",exportPNG);
 $("exportCSV").addEventListener("click",exportCSV);
 for(const axis of F.AXES){
  const canvas=$("plot"+axis.toUpperCase());
  canvas.addEventListener("pointermove",e=>showLens(axis,e));
  canvas.addEventListener("pointerleave",hideLens);
  canvas.addEventListener("click",e=>{
   const uv=plotUV(canvas,e);
   if(!uv)return;
   const p=F.planePoint(params(),axis,uv.u,uv.v);
   state.probe={x:p.x,y:p.y,z:p.z};syncProbeInputs();updateExtras();drawDynamic();
  });
 }
 window.addEventListener("blur",hideLens);
 window.addEventListener("scroll",hideLens,true);
}
function syncProbeInputs(){
 for(const a of F.AXES)if(document.activeElement!==$("probe"+a.toUpperCase()))$("probe"+a.toUpperCase()).value=fmt(state.probe[a],4);
}
function setMode(mode){
 state.mode=mode;$("modeE").classList.toggle("selected",mode==="E");$("modeS").classList.toggle("selected",mode==="S");drawDynamic();
}
function queue(){
 clearTimeout(timer);++job;
 if(worker){worker.terminate();worker=null;}
 $("status").textContent="准备计算…";$("exportPNG").disabled=true;$("exportCSV").disabled=true;
 timer=setTimeout(compute,160);
}
function compute(){
 const token=job,prm=params();
 $("status").textContent="计算 3 × "+state.n+"² …";
 try{
  if(typeof Worker==="undefined")throw Error("worker unavailable");
  worker=new Worker("./worker3d.js");
  worker.onmessage=e=>{
   if(token!==job)return;
   const a=e.data;worker.terminate();worker=null;
   if(!a.ok){$("status").textContent="后台计算失败";return;}
   complete(a.result);
  };
  worker.onerror=e=>{if(token!==job)return;worker.terminate();worker=null;$("status").textContent="后台计算失败";};
  worker.postMessage({params:prm,n:state.n,token:token});
 }catch(err){
  $("status").textContent="兼容模式计算…";
  setTimeout(()=>{if(token===job)try{complete(F.compute(prm,state.n));}catch(e){$("status").textContent="计算错误";}},30);
 }
}
function complete(data){
 state.data=data;state.rasters={};
 $("status").textContent="计算完成";$("exportPNG").disabled=false;$("exportCSV").disabled=false;
 $("lambdaValue").textContent=fmt(data.lambda*1e3,2)+" mm";
 drawDynamic();
}
const paletteE=[[246,249,251],[205,227,236],[135,194,207],[42,128,157],[27,67,116]];
const paletteS=[[248,250,251],[206,224,236],[119,184,199],[38,126,155],[20,64,118]];
function makeColors(p){
 const a=new Uint8Array(768);
 for(let i=0;i<256;i++){
  const u=i/255*(p.length-1),j=Math.min(p.length-2,Math.floor(u)),q=u-j;
  for(let k=0;k<3;k++)a[3*i+k]=Math.round(p[j][k]*(1-q)+p[j+1][k]*q);
 }
 return a;
}
const lutE=makeColors(paletteE),lutS=makeColors(paletteS);
function makeValues(axis){
 const d=state.data.axes[axis],f=d.fields,n=state.data.n,vals=new Float32Array(n*n),c=Math.cos(TWO*state.t),s=Math.sin(TWO*state.t);
 let max=0;
 for(let i=0;i<n*n;i++){
  const ex=f.erx[i]*c+f.eix[i]*s,ey=f.ery[i]*c+f.eiy[i]*s,ez=f.erz[i]*c+f.eiz[i]*s;
  let v;
  if(state.mode==="E"){v=Math.hypot(ex,ey,ez);}
  else{
   const hx=f.hrx[i]*c+f.hix[i]*s,hy=f.hry[i]*c+f.hiy[i]*s,hz=f.hrz[i]*c+f.hiz[i]*s;
   const sx=ey*hz-ez*hy,sy=ez*hx-ex*hz,sz=ex*hy-ey*hx;
   v=Math.hypot(sx,sy,sz)/1e4;
  }
  vals[i]=v;if(v>max)max=v;
 }
 return {vals,max};
}
function rawRaster(vals,scale,n){
 const canvas=document.createElement("canvas");canvas.width=n;canvas.height=n;
 const ctx=canvas.getContext("2d",{alpha:false}),img=ctx.createImageData(n,n),buf=img.data,lut=state.mode==="E"?lutE:lutS;
 for(let i=0;i<n*n;i++){
  const v=Math.max(0,Math.min(255,Math.round(255*vals[i]/scale))),k=i*4,t=v*3;
  buf[k]=lut[t];buf[k+1]=lut[t+1];buf[k+2]=lut[t+2];buf[k+3]=255;
 }
 ctx.putImageData(img,0,0);return canvas;
}
const X0=87,Y0=38,SZ=448;
function drawSlice(axis,raster,scale,withMarkers=true,off){
 const canvas=off||$("plot"+axis.toUpperCase()),ctx=canvas.getContext("2d");
 const w=canvas.width,h=canvas.height;
 ctx.clearRect(0,0,w,h);ctx.fillStyle="#fff";ctx.fillRect(0,0,w,h);
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.drawImage(raster,X0,Y0,SZ,SZ);
 ctx.strokeStyle="#93a9b4";ctx.lineWidth=1;ctx.strokeRect(X0+.5,Y0+.5,SZ,SZ);
 const r=F.ranges(params(),axis);
 ctx.font="20px Arial";ctx.fillStyle="#4f6779";ctx.textAlign="center";
 for(let i=0;i<=4;i++){
  const u=i/4,px=X0+u*SZ,py=Y0+u*SZ;
  ctx.beginPath();ctx.moveTo(px,Y0+SZ);ctx.lineTo(px,Y0+SZ+6);ctx.stroke();
  ctx.fillText(fmt(r.hMin+(r.hMax-r.hMin)*u,Math.abs(r.hMax-r.hMin)<2?2:1),px,Y0+SZ+32);
  ctx.beginPath();ctx.moveTo(X0-7,py);ctx.lineTo(X0,py);ctx.stroke();
  ctx.textAlign="right";ctx.fillText(fmt(r.vMax-(r.vMax-r.vMin)*u,Math.abs(r.vMax-r.vMin)<2?2:1),X0-12,py+7);
  ctx.textAlign="center";
 }
 ctx.fillText(r.hName+" (m)",X0+SZ/2,Y0+SZ+64);
 ctx.save();ctx.translate(25,Y0+SZ/2);ctx.rotate(-Math.PI/2);ctx.fillText(r.vName+" (m)",0,0);ctx.restore();
 const lut=state.mode==="E"?lutE:lutS,barY=590,barH=16;
 for(let i=0;i<256;i++){
  ctx.fillStyle="rgb("+lut[i*3]+","+lut[i*3+1]+","+lut[i*3+2]+")";
  ctx.fillRect(X0+SZ*i/256,barY,SZ/256+1,barH);
 }
 ctx.strokeStyle="#bfcdd4";ctx.strokeRect(X0+.5,barY+.5,SZ,barH);
 ctx.font="18px Arial";ctx.fillStyle="#536d7a";ctx.textAlign="left";ctx.fillText("0",X0,barY+35);
 ctx.textAlign="right";ctx.fillText(sci(scale),X0+SZ,barY+35);
 ctx.textAlign="center";ctx.fillText(state.mode==="E"?"|E(t)|  (V/m)":"|S(t)|  (W/cm²)",X0+SZ/2,barY+61);
 if(!withMarkers)return;
 [["target","#cb864a","T",7],["probe","#315b78","Q",5]].forEach(([key,col,label,rad])=>{
  const pp=F.projectPoint(params(),axis,state[key]);
  if(pp.u<0||pp.u>1||pp.v<0||pp.v>1)return;
  const x=X0+pp.u*SZ,y=Y0+pp.v*SZ;
  ctx.save();ctx.strokeStyle="#fff";ctx.fillStyle=col;ctx.lineWidth=2.8;
  if(label==="T"){ctx.beginPath();ctx.moveTo(x,y-rad);ctx.lineTo(x+rad,y);ctx.lineTo(x,y+rad);ctx.lineTo(x-rad,y);ctx.closePath();ctx.fill();ctx.stroke();}
  else{ctx.beginPath();ctx.arc(x,y,rad,0,TWO);ctx.fill();ctx.stroke();}
  ctx.fillStyle=col;ctx.font="bold 17px Arial";ctx.textAlign="left";ctx.fillText(label,x+11,y-9);ctx.restore();
 });
}
function drawDynamic(){
 $("time").value=state.t;$("timeValue").textContent=fmt(state.t,3)+" T";
 updateExtras();drawTrace();
 if(!state.data||rendering)return;
 rendering=true;
 try{
  const maps={},current={};let max=1e-16;
  for(const axis of F.AXES){current[axis]=makeValues(axis);max=Math.max(max,current[axis].max);}
  for(const axis of F.AXES){
   maps[axis]=rawRaster(current[axis].vals,max,state.data.n);
   drawSlice(axis,maps[axis],max);
  }
  state.rasters=maps;state.values=current;state.scale=max;
  if(hover){const m=hover;hover=null;showLens(m.axis,m.event);}
 }finally{rendering=false;}
}
function updateExtras(){
 for(const a of F.AXES){
  $("label"+a.toUpperCase()).textContent=a+" = "+fmt(state.cuts[a],2)+" m";
  $("probe"+a.toUpperCase()).value=fmt(state.probe[a],4);
 }
 const t=state.target,q=state.probe;
 const dist=state.nodes.map((n,i)=>{
  const dt=Math.hypot(t.x-n.x,t.y-n.y,t.z-n.z),dq=Math.hypot(q.x-n.x,q.y-n.y,q.z-n.z);
  return "节点 "+(i+1)+"：到 T "+fmt(dt,2)+" m · 到 Q "+fmt(dq,2)+" m";
 });
 $("distances").innerHTML=dist.map(escapeHTML).join("<br>");
 $("geometryInfo").innerHTML="<span><strong>目标 T</strong> ("+[t.x,t.y,t.z].map(v=>fmt(v,1)).join(", ")+") m</span><span><strong>观察点 Q</strong> ("+[q.x,q.y,q.z].map(v=>fmt(v,1)).join(", ")+") m</span>";
 renderScene();
 if(state.data){
  const p=params(),point=F.fieldAt(p,q),sample=F.instantaneous(point,state.t);
  $("probeInfo").innerHTML="<span><strong>|E|</strong> "+sci(sample.E)+" V/m</span><span><strong>|S|</strong> "+sci(sample.S)+" W/cm²</span>";
  const wl=state.data.lambda,base=Math.min(state.Lx,state.Ly,state.Lz)/state.n;
  $("sampleWarning").textContent=base>wl/2?"空间步长约 "+fmt(base*100,2)+" cm，可能漏采细密条纹；建议缩小范围或增加网格。":"";
  $("sampleWarning").style.display=base>wl/2?"block":"none";
 }
}
function iso(p){
 const nx=p.x/state.Lx,ny=p.y/state.Ly,nz=(p.z-state.zMin)/state.Lz-.5;
 return {x:325+185*nx-145*ny,y:139+76*nx+65*ny-171*nz};
}
function svgPath(arr){return arr.map((p,i)=>(i?"L":"M")+p.x.toFixed(1)+","+p.y.toFixed(1)).join(" ")+"Z";}
function renderScene(){
 const svg=$("scene3d");if(!svg)return;
 const z0=state.zMin,z1=z0+state.Lz,x0=-state.Lx/2,x1=state.Lx/2,y0=-state.Ly/2,y1=state.Ly/2;
 const pts=[];for(const x of [x0,x1])for(const y of [y0,y1])for(const z of [z0,z1])pts.push({x,y,z});
 let html='<g fill="none" stroke="#ccdae2" stroke-width="1.2">';
 for(let a=0;a<pts.length;a++)for(let b=a+1;b<pts.length;b++){
  const p=pts[a],q=pts[b],changes=["x","y","z"].filter(k=>p[k]!==q[k]).length;
  if(changes===1){const u=iso(p),v=iso(q);html+='<path d="M'+u.x+','+u.y+'L'+v.x+','+v.y+'"/>';}
 }
 html+='</g>';
 const planeCorners={
  x:[{x:state.cuts.x,y:y0,z:z0},{x:state.cuts.x,y:y1,z:z0},{x:state.cuts.x,y:y1,z:z1},{x:state.cuts.x,y:y0,z:z1}],
  y:[{x:x0,y:state.cuts.y,z:z0},{x:x1,y:state.cuts.y,z:z0},{x:x1,y:state.cuts.y,z:z1},{x:x0,y:state.cuts.y,z:z1}],
  z:[{x:x0,y:y0,z:state.cuts.z},{x:x1,y:y0,z:state.cuts.z},{x:x1,y:y1,z:state.cuts.z},{x:x0,y:y1,z:state.cuts.z}]
 };
 const planeColors={x:"#42adbc",y:"#7b8dc9",z:"#ddb16d"};
 for(const ax of F.AXES){
  const c=planeCorners[ax],lo=ax==="z"?z0:ax==="x"?x0:y0,hi=ax==="z"?z1:ax==="x"?x1:y1;
  if(state.cuts[ax]<lo||state.cuts[ax]>hi)continue;
  html+='<path d="'+svgPath(c.map(iso))+'" fill="'+planeColors[ax]+'" fill-opacity=".12" stroke="'+planeColors[ax]+'" stroke-width="1.4"/>';
 }
 const T=iso(state.target),Q=iso(state.probe);
 state.nodes.forEach((node,i)=>{
  const a=iso(node);html+='<path d="M'+a.x+','+a.y+'L'+T.x+','+T.y+'" stroke="#c7a480" opacity=".42" stroke-dasharray="4 5"/>';
  html+='<circle cx="'+a.x+'" cy="'+a.y+'" r="6" fill="'+colors[i%colors.length]+'" stroke="white" stroke-width="2"/><text x="'+(a.x+9)+'" y="'+(a.y-7)+'" font-size="13" fill="#466070">N'+(i+1)+'</text>';
 });
 html+='<circle cx="'+T.x+'" cy="'+T.y+'" r="7" fill="#d38b44" stroke="white" stroke-width="2"/><text x="'+(T.x+11)+'" y="'+(T.y-9)+'" font-size="15" font-weight="700" fill="#a97038">T</text>';
 html+='<circle cx="'+Q.x+'" cy="'+Q.y+'" r="5" fill="#315d76" stroke="white" stroke-width="2"/><text x="'+(Q.x+9)+'" y="'+(Q.y+15)+'" font-size="14" font-weight="700" fill="#315d76">Q</text>';
 html+='<text x="38" y="249" font-size="13" fill="#8396a1">轴测空间示意 · 不代表体素场求解</text>';
 svg.innerHTML=html;
}
function plotUV(canvas,e){
 const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width*580,y=(e.clientY-rect.top)/rect.height*675;
 const u=(x-X0)/SZ,v=(y-Y0)/SZ;
 if(u<0||u>1||v<0||v>1)return null;
 return {u,v};
}
function hideLens(){hover=null;$("lens").classList.remove("show");$("lens").setAttribute("aria-hidden","true");}
function showLens(axis,e){
 if(!state.rasters[axis])return;
 const uv=plotUV($("plot"+axis.toUpperCase()),e);
 if(!uv){hideLens();return;}
 hover={axis,event:e};
 const source=state.rasters[axis],n=source.width,sw=Math.min(n,Math.max(8,n*.12));
 const ix=F.clamp(uv.u*n-sw/2,0,n-sw),iy=F.clamp(uv.v*n-sw/2,0,n-sw);
 const lc=$("lensCanvas"),g=lc.getContext("2d");g.imageSmoothingEnabled=false;g.drawImage(source,ix,iy,sw,sw,0,0,444,444);
 const cx=(uv.u*n-ix)/sw*444,cy=(uv.v*n-iy)/sw*444;g.strokeStyle="#fff";g.lineWidth=3;g.strokeRect(cx-11,cy-11,22,22);
 const xyz=F.planePoint(params(),axis,uv.u,uv.v),a=state.values[axis],i=F.clamp(Math.floor(uv.u*n),0,n-1),j=F.clamp(Math.floor(uv.v*n),0,n-1);
 $("lensCoord").textContent=F.AXES.map(k=>k+"="+fmt(xyz[k],2)).join("  ")+" m";
 $("lensReading").textContent=sci(a.vals[j*n+i])+(state.mode==="E"?" V/m":" W/cm²");
 const div=$("lens");div.classList.add("show");div.setAttribute("aria-hidden","false");
 const W=244,H=322;
 let left=e.clientX+17,top=e.clientY+15;
 if(left+W>window.innerWidth-5)left=e.clientX-W-17;
 if(top+H>window.innerHeight-5)top=e.clientY-H-17;
 div.style.left=Math.max(5,left)+"px";div.style.top=Math.max(5,top)+"px";
}
function drawTrace(){
 const c=$("trace"),g=c.getContext("2d"),W=c.width,H=c.height;
 g.clearRect(0,0,W,H);g.fillStyle="#fff";g.fillRect(0,0,W,H);
 const p=params(),phasors=state.nodes.map((n,i)=>F.fieldAt(p,state.probe,i)),total=F.fieldAt(p,state.probe);
 const comps=[["erx","eix"],["ery","eiy"],["erz","eiz"]];
 const magnitudes=comps.map(k=>Math.hypot(total[k[0]],total[k[1]]));
 let dim=magnitudes.indexOf(Math.max(...magnitudes)),k=comps[dim],axisName=["x","y","z"][dim];
 let scale=Math.max(1e-8,...phasors.map(a=>Math.hypot(a[k[0]],a[k[1]])),magnitudes[dim]);
 const x0=68,y0=25,w=W-92,h=H-77;
 g.strokeStyle="#e8eef1";g.lineWidth=1;g.font="16px Arial";g.fillStyle="#718492";g.textAlign="center";
 for(let j=0;j<=4;j++){
  const x=x0+w*j/4,y=y0+h*j/4;g.beginPath();g.moveTo(x,y0);g.lineTo(x,y0+h);g.moveTo(x0,y);g.lineTo(x0+w,y);g.stroke();
  g.fillText(fmt(j/4,2),x,y0+h+27);g.textAlign="right";g.fillText(sci((.5-j/4)*2.3*scale),x0-9,y+4);g.textAlign="center";
 }
 function line(a,color,width){
  g.beginPath();g.strokeStyle=color;g.lineWidth=width;
  for(let j=0;j<=400;j++){
   const t=j/400,v=a[k[0]]*Math.cos(TWO*t)+a[k[1]]*Math.sin(TWO*t),x=x0+t*w,y=y0+h*(.5-v/(2.3*scale));
   if(!j)g.moveTo(x,y);else g.lineTo(x,y);
  }g.stroke();
 }
 phasors.forEach((a,i)=>line(a,colors[i%colors.length],1.7));
 line(total,"#162b38",3.2);
 const tm=x0+state.t*w;g.strokeStyle="#94a4b0";g.setLineDash([5,4]);g.beginPath();g.moveTo(tm,y0);g.lineTo(tm,y0+h);g.stroke();g.setLineDash([]);
 g.fillStyle="#4d6576";g.font="16px Arial";g.fillText("t / T",x0+w/2,H-5);g.textAlign="left";g.fillText("E"+axisName+" (V/m)",x0,y0-9);
 $("legend").innerHTML=phasors.map((a,i)=>'<span><i style="background:'+colors[i%colors.length]+'"></i>节点'+(i+1)+'</span>').join("")+'<span><i style="background:#162b38"></i>合成 E'+axisName+'</span>';
}
function tick(ms){
 if(state.playing&&state.data){
  if(lastTime)state.t=(state.t+F.clamp((ms-lastTime)/1000,0,.13)*state.speed)%1;
  if(ms-lastPaint>95){drawDynamic();lastPaint=ms;}
 }
 lastTime=ms;requestAnimationFrame(tick);
}
function download(blob,name){
 const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function exportPNG(){
 if(!state.data)return;
 const c=document.createElement("canvas"),g=c.getContext("2d");c.width=1960;c.height=940;
 g.fillStyle="#fff";g.fillRect(0,0,c.width,c.height);
 g.fillStyle="#1e394d";g.font="bold 37px Arial";g.fillText("Wave Lab · 三维空间正交切片",55,62);
 g.fillStyle="#6c8290";g.font="22px Arial";g.fillText("f = "+state.freq+" GHz     t/T = "+fmt(state.t,3)+"     3 × "+state.n+"²     "+(state.mode==="E"?"|E(t)| / V/m":"|S(t)| / W/cm²"),55,103);
 F.AXES.forEach((axis,i)=>{
  const x=25+i*645,gapY=158;
  g.fillStyle="#24455a";g.font="bold 25px Arial";
  const r=F.ranges(params(),axis);g.fillText(["(a) YZ","(b) XZ","(c) XY"][i]+"　"+axis+" = "+fmt(state.cuts[axis],2)+" m",x+64,145);
  g.drawImage($("plot"+axis.toUpperCase()),x,gapY,640,745);
 });
 c.toBlob(b=>{if(b)download(b,"WaveLab_3D_slices.png");},"image/png");
}
function exportCSV(){
 if(!state.data)return;
 const axis=$("csvAxis").value,n=state.data.n,prm=params(),vals=state.values[axis].vals;
 const lines=["x_m,y_m,z_m,"+(state.mode==="E"?"E_inst_Vpm":"Poynting_inst_Wpcm2")];
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){
  const xyz=F.planePoint(prm,axis,(i+.5)/n,(j+.5)/n);
  lines.push([xyz.x,xyz.y,xyz.z,vals[j*n+i]].map(x=>Number(x).toPrecision(8)).join(","));
 }
 download(new Blob(["\ufeff",lines.join("\n")],{type:"text/csv;charset=utf-8"}),"WaveLab_3D_"+axis+"_slice.csv");
}
bind();renderNodes();updateExtras();drawTrace();queue();requestAnimationFrame(tick);
})();