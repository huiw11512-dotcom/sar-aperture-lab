(function(){
"use strict";
const $=id=>document.getElementById(id),F=Field3D,PI=Math.PI,TWO=2*PI;
const colors=["#177e97","#d17d45","#785cba","#2e9a80","#cc5d80","#988249","#5076b1","#668b93"];
const state={
 freq:10,apX:5,apY:5,eta:.7,n:1000,pointsPerWave:8,centerX:0,centerY:0,savedOverview:null,Lx:50,Ly:50,Lz:60,zMin:0,
 target:{x:0,y:0,z:50},cuts:{x:0,y:0,z:50},
 nodes:[{x:-3,y:-3,z:0,phase:0,power:1},{x:3,y:-3,z:0,phase:0,power:1},{x:-3,y:3,z:0,phase:0,power:1},{x:3,y:3,z:0,phase:0,power:1}],
 t:0,playing:false,speed:.5,mode:"E",data:null,rasters:{},tracePol:0
};
let worker=null,job=0,timer=null,lastTime=0,lastPaint=0,hover=null,rendering=false;
const fmt=(v,d=2)=>Number(v).toFixed(d);
const sci=v=>(Math.abs(v)>=.01&&Math.abs(v)<1000)?Number(v).toFixed(3):Number(v).toExponential(2);
const escapeHTML=x=>String(x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function params(){
 return {freq:state.freq,apX:state.apX,apY:state.apY,eta:state.eta,nodes:state.nodes.map(s=>({...s})),
  target:{...state.target},cuts:{...state.cuts},centerX:state.centerX,centerY:state.centerY,Lx:state.Lx,Ly:state.Ly,Lz:state.Lz,zMin:state.zMin};
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
 F.AXES.forEach(axis=>{
  const input=$("target"+axis.toUpperCase());
  input.addEventListener("change",()=>{
    const num=Number(input.value);
    if(input.value.trim()===""||!Number.isFinite(num)||Math.abs(num)>1e7){input.value=state.target[axis];return;}
    state.target[axis]=num;state.cuts={...state.target};queue();
  });
 });
 $("pointsPerWave").addEventListener("change",()=>{state.pointsPerWave=Number($("pointsPerWave").value);queue();});
 $("localDetail").addEventListener("click",focusLocal);
 $("restoreOverview").addEventListener("click",restoreOverview);
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

 }
 window.addEventListener("blur",hideLens);
 window.addEventListener("scroll",hideLens,true);
}
function setMode(mode){
 state.mode=mode;$("modeE").classList.toggle("selected",mode==="E");$("modeS").classList.toggle("selected",mode==="S");drawDynamic();
}
const MAX_GRID=1000;
const prettyCount=x=>new Intl.NumberFormat("zh-CN",{notation:"compact",maximumFractionDigits:2}).format(x);
function samplingPlan(){
 const lambda=F.C/(state.freq*1e9),step=lambda/state.pointsPerWave;
 const dims={x:Math.ceil(state.Lx/step),y:Math.ceil(state.Ly/step),z:Math.ceil(state.Lz/step)};
 const demanded=Math.max(...Object.values(dims));
 const total=dims.y*dims.z+dims.x*dims.z+dims.x*dims.y;
 return {lambda,step,dims,demanded,total,n:Math.max(64,Math.min(MAX_GRID,demanded)),limited:demanded>MAX_GRID};
}
function updateSampling(){
 const p=samplingPlan();state.n=p.n;
 $("sampleInfo").textContent="λ "+fmt(p.lambda*1e3,2)+" mm · 自动 "+p.n+"² × 3";
 const demandedText=prettyCount(p.total),actualText=prettyCount(3*p.n*p.n);
 $("resolutionSummary").textContent="按 "+state.pointsPerWave+" 点/λ：理论 "+demandedText+" 点 · 本次 "+actualText+" 点";
 $("sampleWarning").style.display=p.limited?"block":"none";
 $("sampleWarning").textContent=p.limited?"全域采样超过浏览器预算；当前为降采样概览，细节与峰值不保证收敛。请使用「局部精细查看」。":"";
 $("restoreOverview").disabled=!state.savedOverview;
 return p;
}
function syncViewInput(){
 for(const key of ["Lx","Ly","Lz","zMin"])$(key).value=Number(state[key].toFixed(6));
}
function focusLocal(){
 if(!state.savedOverview)state.savedOverview={Lx:state.Lx,Ly:state.Ly,Lz:state.Lz,zMin:state.zMin,centerX:state.centerX,centerY:state.centerY};
 const lambda=F.C/(state.freq*1e9),windowSize=0.95*MAX_GRID*lambda/state.pointsPerWave;
 state.Lx=Math.min(state.Lx,windowSize);state.Ly=Math.min(state.Ly,windowSize);state.Lz=Math.min(state.Lz,windowSize);
 state.centerX=state.target.x;state.centerY=state.target.y;state.zMin=state.target.z-state.Lz/2;
 state.cuts={...state.target};
 syncViewInput();queue();
}
function restoreOverview(){
 const view=state.savedOverview;
 if(!view)return;
 for(const key of ["Lx","Ly","Lz","zMin","centerX","centerY"])state[key]=view[key];
 state.cuts={...state.target};state.savedOverview=null;
 syncViewInput();queue();
}
function queue(){
 updateSampling();clearTimeout(timer);++job;
 if(worker){worker.terminate();worker=null;}
 renderScene();$("status").textContent="准备计算…";$("exportPNG").disabled=true;$("exportCSV").disabled=true;
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
   const a=e.data;
   if(!a.ok){worker.terminate();worker=null;$("status").textContent="后台计算失败";return;}
   if(a.preview){complete(a.result,true);return;}
   worker.terminate();worker=null;complete(a.result,false);
  };
  worker.onerror=e=>{if(token!==job)return;worker.terminate();worker=null;$("status").textContent="后台计算失败";};
  worker.postMessage({params:prm,n:state.n,token:token});
 }catch(err){
  $("status").textContent="兼容模式计算…";
  setTimeout(()=>{if(token===job)try{complete(F.compute(prm,state.n));}catch(e){$("status").textContent="计算错误";}},30);
 }
}
function fixedScales(data){
 let maxE=1e-15,maxS=1e-20;
 for(const axis of F.AXES){
  const f=data.axes[axis].fields,len=data.n*data.n;
  for(let i=0;i<len;i++){
   const a=f.erx[i]**2+f.ery[i]**2+f.erz[i]**2;
   const b=f.eix[i]**2+f.eiy[i]**2+f.eiz[i]**2;
   const cross=f.erx[i]*f.eix[i]+f.ery[i]*f.eiy[i]+f.erz[i]*f.eiz[i];
   const ee=(a+b+Math.sqrt((a-b)**2+4*cross*cross))*.5;
   const h=f.hrx[i]**2+f.hry[i]**2+f.hrz[i]**2+f.hix[i]**2+f.hiy[i]**2+f.hiz[i]**2;
   if(ee>maxE*maxE)maxE=Math.sqrt(ee);
   const bs=Math.sqrt((a+b)*h)/1e4;
   if(bs>maxS)maxS=bs;
  }
 }
 return {E:maxE,S:maxS};
}
function complete(data,preview=false){
 state.data=data;state.rasters={};state.fixedScales=fixedScales(data);
 $("status").textContent=preview?"已显示预览 · 高清计算中":"计算完成";
 $("exportPNG").disabled=preview;$("exportCSV").disabled=preview;
 $("lambdaValue").textContent=fmt(data.lambda*1e3,2)+" mm";
 drawDynamic();
}
const paletteE=[[32,58,178],[39,111,236],[46,188,224],[247,249,251],[255,192,110],[237,76,67],[207,25,62]];
const paletteS=paletteE;
function makeColors(p){
 const a=new Uint8Array(768);
 for(let i=0;i<256;i++){
  const u=i/255*(p.length-1),j=Math.min(p.length-2,Math.floor(u)),q=u-j;
  for(let k=0;k<3;k++)a[3*i+k]=Math.round(p[j][k]*(1-q)+p[j+1][k]*q);
 }
 return a;
}
const lutE=makeColors(paletteE),lutS=makeColors(paletteS);
function instantValue(f,index,co,si,mode){
 const ex=f.erx[index]*co+f.eix[index]*si,ey=f.ery[index]*co+f.eiy[index]*si,ez=f.erz[index]*co+f.eiz[index]*si;
 if(mode==="E")return Math.hypot(ex,ey,ez);
 const hx=f.hrx[index]*co+f.hix[index]*si,hy=f.hry[index]*co+f.hiy[index]*si,hz=f.hrz[index]*co+f.hiz[index]*si;
 return Math.hypot(ey*hz-ez*hy,ez*hx-ex*hz,ex*hy-ey*hx)/1e4;
}
function makeValues(axis){
 const f=state.data.axes[axis].fields,sourceN=state.data.n;
 // A 448-pixel plot needs no million-pixel repaints each animation frame.
 // Keep the original high-resolution field arrays for numeric export.
 const n=Math.min(sourceN,512),vals=new Float32Array(n*n),co=Math.cos(TWO*state.t),si=Math.sin(TWO*state.t);
 let max=0;
 for(let j=0;j<n;j++){
  const srcJ=Math.min(sourceN-1,Math.floor((j+.5)*sourceN/n));
  for(let i=0;i<n;i++){
   const srcI=Math.min(sourceN-1,Math.floor((i+.5)*sourceN/n));
   const v=instantValue(f,srcJ*sourceN+srcI,co,si,state.mode);
   vals[j*n+i]=v;if(v>max)max=v;
  }
 }
 return {n,vals,max};
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
 if(!withMarkers)return;
 const pp=F.projectPoint(params(),axis,state.target);
 if(pp.u>=0&&pp.u<=1&&pp.v>=0&&pp.v<=1){
  const x=X0+pp.u*SZ,y=Y0+pp.v*SZ,rad=7;
  ctx.save();ctx.strokeStyle="#fff";ctx.fillStyle="#cb864a";ctx.lineWidth=2.8;
  ctx.beginPath();ctx.moveTo(x,y-rad);ctx.lineTo(x+rad,y);ctx.lineTo(x,y+rad);ctx.lineTo(x-rad,y);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.font="bold 18px Arial";ctx.textAlign="left";ctx.fillText("T",x+10,y-9);ctx.restore();
 }

}
function drawDynamic(){
 $("time").value=state.t;$("timeValue").textContent=fmt(state.t,3)+" T";
 updateExtras();drawTrace();
 if(!state.data||rendering)return;
 rendering=true;
 try{
  const maps={},current={};const max=state.fixedScales[state.mode];
  for(const axis of F.AXES){current[axis]=makeValues(axis);}
  for(const axis of F.AXES){
   maps[axis]=rawRaster(current[axis].vals,max,current[axis].n);
   drawSlice(axis,maps[axis],max);
  }
  state.rasters=maps;state.values=current;state.scale=max;
  $("scaleMax").textContent=sci(max);
  $("scaleUnit").textContent=state.mode==="E"?"瞬时电场强度 |E(t)| · V/m":"瞬时功率通量 |S(t)| · W/cm²";
  if(hover){const m=hover;hover=null;showLens(m.axis,m.event);}
 }finally{rendering=false;}
}
function updateExtras(){
 for(const a of F.AXES)$("label"+a.toUpperCase()).textContent=a+" = "+fmt(state.target[a],2)+" m";
}
// Orbit camera affects only the 3-D view; it never recomputes the electromagnetic field.
const camera={yaw:-.62,pitch:.63,zoom:1};
function cameraBasis(x,y,z){
 const cy=Math.cos(camera.yaw),sy=Math.sin(camera.yaw);
 const rx=cy*x-sy*y,ry=sy*x+cy*y;
 return {x:rx,y:Math.sin(camera.pitch)*ry-Math.cos(camera.pitch)*z};
}
function iso(p){
 const nx=(p.x-state.centerX)/state.Lx,ny=(p.y-state.centerY)/state.Ly,nz=(p.z-state.zMin)/state.Lz-.5;
 const v=cameraBasis(nx,ny,nz),s=170*camera.zoom;
 return {x:325+s*v.x,y:138+s*v.y};
}
function svgPath(arr){return arr.map((p,i)=>(i?"L":"M")+p.x.toFixed(1)+","+p.y.toFixed(1)).join(" ")+"Z";}
function axisGizmo(){
 const ox=564,oy=217,L=36,cs=[["X",1,0,0,"#cf5555"],["Y",0,1,0,"#299d80"],["Z",0,0,1,"#397cda"]];
 let out='<g role="img" aria-label="视角坐标轴：X 红色、Y 绿色、Z 蓝色"><rect x="497" y="155" width="146" height="113" rx="13" fill="#fff" fill-opacity=".92" stroke="#d5e1e8"/>';
 out+='<circle cx="'+ox+'" cy="'+oy+'" r="3.5" fill="#425d6b"/>';
 for(const [name,x,y,z,color] of cs){
  const dir=cameraBasis(x,y,z),ex=ox+L*dir.x,ey=oy+L*dir.y,mag=Math.hypot(ex-ox,ey-oy)||1;
  const px=-(ey-oy)/mag,py=(ex-ox)/mag;
  out+='<path d="M'+ox+','+oy+' L'+ex.toFixed(2)+','+ey.toFixed(2)+'" stroke="'+color+'" stroke-width="3.1" stroke-linecap="round"/>';
  out+='<path d="M'+ex.toFixed(2)+','+ey.toFixed(2)+' l'+(-7*(ex-ox)/mag+3*px).toFixed(2)+','+(-7*(ey-oy)/mag+3*py).toFixed(2)+' M'+ex.toFixed(2)+','+ey.toFixed(2)+' l'+(-7*(ex-ox)/mag-3*px).toFixed(2)+','+(-7*(ey-oy)/mag-3*py).toFixed(2)+'" stroke="'+color+'" stroke-width="2" fill="none"/>';
  out+='<text x="'+(ex+10*dir.x).toFixed(2)+'" y="'+(ey+10*dir.y+5).toFixed(2)+'" fill="'+color+'" font-size="17" font-weight="800" text-anchor="middle">'+name+'</text>';
 }
 return out+'</g>';
}
function renderScene(){
 const svg=$("scene3d");if(!svg)return;
 const z0=state.zMin,z1=z0+state.Lz,x0=state.centerX-state.Lx/2,x1=state.centerX+state.Lx/2,y0=state.centerY-state.Ly/2,y1=state.centerY+state.Ly/2;
 const pts=[];for(const x of [x0,x1])for(const y of [y0,y1])for(const z of [z0,z1])pts.push({x,y,z});
 let html='<g fill="none" stroke="#bacdd8" stroke-width="1.5">';
 for(let a=0;a<pts.length;a++)for(let b=a+1;b<pts.length;b++){
  const p=pts[a],q=pts[b],changes=["x","y","z"].filter(k=>p[k]!==q[k]).length;
  if(changes===1){const u=iso(p),v=iso(q);html+='<path d="M'+u.x+','+u.y+'L'+v.x+','+v.y+'"/>';}
 }
 html+='</g>';
 const planeCorners={
  x:[{x:state.target.x,y:y0,z:z0},{x:state.target.x,y:y1,z:z0},{x:state.target.x,y:y1,z:z1},{x:state.target.x,y:y0,z:z1}],
  y:[{x:x0,y:state.target.y,z:z0},{x:x1,y:state.target.y,z:z0},{x:x1,y:state.target.y,z:z1},{x:x0,y:state.target.y,z:z1}],
  z:[{x:x0,y:y0,z:state.target.z},{x:x1,y:y0,z:state.target.z},{x:x1,y:y1,z:state.target.z},{x:x0,y:y1,z:state.target.z}]
 };
 const planeColors={x:"#44a8bb",y:"#7a8acd",z:"#deab62"};
 for(const ax of F.AXES){
  const lo=ax==="z"?z0:ax==="x"?x0:y0,hi=ax==="z"?z1:ax==="x"?x1:y1;
  if(state.target[ax]<lo||state.target[ax]>hi)continue;
  html+='<path d="'+svgPath(planeCorners[ax].map(iso))+'" fill="'+planeColors[ax]+'" fill-opacity=".14" stroke="'+planeColors[ax]+'" stroke-width="1.7"/>';
 }
 const T=iso(state.target);
 state.nodes.forEach((node,i)=>{
  const a=iso(node);html+='<path d="M'+a.x+','+a.y+'L'+T.x+','+T.y+'" stroke="#c7a480" opacity=".36" stroke-dasharray="4 5"/>';
  html+='<circle cx="'+a.x+'" cy="'+a.y+'" r="6" fill="'+colors[i%colors.length]+'" stroke="white" stroke-width="2"/><text x="'+(a.x+10)+'" y="'+(a.y-8)+'" font-size="15" font-weight="600" fill="#476779">N'+(i+1)+'</text>';
 });
 html+='<circle cx="'+T.x+'" cy="'+T.y+'" r="8" fill="#d28a43" stroke="white" stroke-width="2.5"/><text x="'+(T.x+11)+'" y="'+(T.y-10)+'" font-size="17" font-weight="800" fill="#ae7031">T</text>';
 svg.innerHTML=html+axisGizmo();
}
function initSceneControls(){
 const svg=$("scene3d");let dragging=false,prevX=0,prevY=0;
 svg.addEventListener("pointerdown",e=>{
  if(e.button!==undefined&&e.button!==0)return;
  dragging=true;prevX=e.clientX;prevY=e.clientY;svg.classList.add("dragging");svg.setPointerCapture?.(e.pointerId);e.preventDefault?.();
 });
 svg.addEventListener("pointermove",e=>{
  if(!dragging)return;
  const dx=e.clientX-prevX,dy=e.clientY-prevY;prevX=e.clientX;prevY=e.clientY;
  camera.yaw+=dx*.010;camera.pitch+=dy*.010;
  renderScene();
 });
 function endDrag(e){dragging=false;svg.classList.remove("dragging");if(e?.pointerId!==undefined&&svg.hasPointerCapture?.(e.pointerId))svg.releasePointerCapture?.(e.pointerId);}
 svg.addEventListener("pointerup",endDrag);
 svg.addEventListener("pointercancel",endDrag);
 svg.addEventListener("lostpointercapture",()=>{dragging=false;svg.classList.remove("dragging");});
 svg.addEventListener("wheel",e=>{
  e.preventDefault?.();
  camera.zoom=F.clamp(camera.zoom*Math.exp(-e.deltaY*.0015),.4,5);
  renderScene();
 },{passive:false});
 svg.addEventListener("keydown",e=>{
  if(e.key==="ArrowLeft")camera.yaw-=.12;
  else if(e.key==="ArrowRight")camera.yaw+=.12;
  else if(e.key==="ArrowUp")camera.pitch-=.12;
  else if(e.key==="ArrowDown")camera.pitch+=.12;
  else if(e.key==="+")camera.zoom=F.clamp(camera.zoom*1.15,.4,5);
  else if(e.key==="-")camera.zoom=F.clamp(camera.zoom/1.15,.4,5);
  else return;
  e.preventDefault?.();renderScene();
 });
 $("resetView").addEventListener("click",()=>{camera.yaw=-.62;camera.pitch=.63;camera.zoom=1;renderScene();});
}
function plotUV(canvas,e){
 const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width*580,y=(e.clientY-rect.top)/rect.height*568;
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
 const direct=F.instantaneous(F.fieldAt(params(),xyz),state.t);
 $("lensReading").textContent=sci(state.mode==="E"?direct.E:direct.S)+(state.mode==="E"?" V/m":" W/cm²");
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
 const p=params(),phasors=state.nodes.map((n,i)=>F.fieldAt(p,state.target,i)),total=F.fieldAt(p,state.target);
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
 const c=document.createElement("canvas"),g=c.getContext("2d");c.width=1960;c.height=900;
 g.fillStyle="#fff";g.fillRect(0,0,c.width,c.height);
 g.fillStyle="#1e394d";g.font="bold 37px Arial";g.fillText("Wave Lab · 三维空间正交切片",55,62);
 g.fillStyle="#6c8290";g.font="22px Arial";g.fillText("f = "+state.freq+" GHz     t/T = "+fmt(state.t,3)+"     3 × "+state.n+"²     "+(state.mode==="E"?"|E(t)| / V/m":"|S(t)| / W/cm²"),55,103);
 F.AXES.forEach((axis,i)=>{
  const x=25+i*645,gapY=158;
  g.fillStyle="#24455a";g.font="bold 25px Arial";
  const r=F.ranges(params(),axis);g.fillText(["(a) YZ","(b) XZ","(c) XY"][i]+"　"+axis+" = "+fmt(state.cuts[axis],2)+" m",x+64,145);
  g.drawImage($("plot"+axis.toUpperCase()),x,gapY,640,626);
 });
 const unit=state.mode==="E"?"瞬时电场强度 |E(t)| · V/m":"瞬时功率通量 |S(t)| · W/cm²";
 g.font="bold 22px Arial";g.fillStyle="#40566a";g.textAlign="center";g.fillText(unit,980,824);
 const lut=state.mode==="E"?lutE:lutS;
 for(let i=0;i<256;i++){g.fillStyle="rgb("+lut[3*i]+","+lut[3*i+1]+","+lut[3*i+2]+")";g.fillRect(545+i*870/256,835,870/256+1,19);}
 g.font="21px Arial";g.fillStyle="#4a6474";g.textAlign="right";g.fillText("0",525,853);g.textAlign="left";g.fillText(sci(state.scale),1430,853);
 c.toBlob(b=>{if(b)download(b,"WaveLab_3D_slices.png");},"image/png");
}
function exportCSV(){
 if(!state.data)return;
 const axis=$("csvAxis").value,n=state.data.n,prm=params(),f=state.data.axes[axis].fields,co=Math.cos(TWO*state.t),si=Math.sin(TWO*state.t);
 const lines=["x_m,y_m,z_m,"+(state.mode==="E"?"E_inst_Vpm":"Poynting_inst_Wpcm2")];
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){
  const xyz=F.planePoint(prm,axis,(i+.5)/n,(j+.5)/n);
  lines.push([xyz.x,xyz.y,xyz.z,instantValue(f,j*n+i,co,si,state.mode)].map(x=>Number(x).toPrecision(8)).join(","));
 }
 download(new Blob(["\ufeff",lines.join("\n")],{type:"text/csv;charset=utf-8"}),"WaveLab_3D_"+axis+"_slice.csv");
}
bind();renderNodes();updateExtras();drawTrace();initSceneControls();queue();requestAnimationFrame(tick);
})();