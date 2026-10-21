(function(){
"use strict";
const $=id=>document.getElementById(id),F=Field3D,PI=Math.PI,TWO=2*PI;
const colors=["#177e97","#d17d45","#785cba","#2e9a80","#cc5d80","#988249","#5076b1","#668b93"];
const state={
 freq:10,apX:5,apY:5,eta:.7,n:1000,pointsPerWave:8,centerX:0,centerY:0,savedOverview:null,Lx:50,Ly:50,Lz:60,zMin:0,
 target:{x:0,y:0,z:50},cuts:{x:0,y:0,z:50},
 nodes:[{x:-3,y:-3,z:0,phase:0,power:1},{x:3,y:-3,z:0,phase:0,power:1},{x:-3,y:3,z:0,phase:0,power:1},{x:3,y:3,z:0,phase:0,power:1}],
 t:0,playing:false,speed:.5,mode:"E",data:null,rasters:{},scaleFactor:{E:1,S:1},tracePol:0,
 studyPlane:{axis:"x",coord:0,active:false},scanSpan:5,scanAimMode:"track",scanResult:null,coherenceRatio:null
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
 count=F.clamp(Math.round(Number(count)||4),1,64);$("count").value=String(count);
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
   const key=pair[0];label.textContent=pair[1];input.type="number";input.step="any";input.value=nd[key];input.min=key==="power"?"0":"";
   input.setAttribute("aria-label","节点"+(i+1)+" "+pair[1]);
   input.addEventListener("change",()=>{
    const num=Number(input.value);
    if(!Number.isFinite(num)||input.value.trim()===""||(key==="power"&&num<0)){input.value=nd[key];return;}
    nd[key]=num;input.value=String(num);queue();
   });
   d.appendChild(label);d.appendChild(input);cells.appendChild(d);
  });
  e.appendChild(cells);root.appendChild(e);
 });
}

function ePhasorPower(a){
 return a.erx*a.erx+a.eix*a.eix+a.ery*a.ery+a.eiy*a.eiy+a.erz*a.erz+a.eiz*a.eiz;
}
function updateTargetCoherence(){
 if(!state.data)return;
 const prm=params(),total=F.fieldAt(prm,state.target),combined=ePhasorPower(total);
 let reference=0;
 for(let i=0;i<state.nodes.length;i++)reference+=ePhasorPower(F.fieldAt(prm,state.target,i));
 const ratio=reference>1e-30?combined/reference:NaN;
 state.coherenceRatio=ratio;
 if(!Number.isFinite(ratio)){
  $("coherenceStat").textContent="—";
  $("coherenceSub").textContent="目标点无有效辐射贡献";
 }else{
  $("coherenceStat").textContent=(ratio*100).toFixed(1)+"%";
  $("coherenceSub").textContent=ratio<.999
   ?"相消："+((1-ratio)*100).toFixed(1)+"%（相对各节点电场相量模平方之和）"
   :ratio>1.001
    ?"相长："+((ratio-1)*100).toFixed(1)+"%（相对各节点电场相量模平方之和）"
    :"接近单节点功率和";
 }
}
function selectedStudyAxis(){
 return state.studyPlane.active?state.studyPlane.axis:$("studyAxis").value;
}
function updateStudyPlaneTitle(){
 if(!$("studyPlaneTitle"))return;
 const axis=selectedStudyAxis(),names={x:"YZ",y:"XZ",z:"XY"},coords=state.nodes.map(n=>n[axis]);
 const thickness=Math.max(...coords)-Math.min(...coords);
 $("studyPlaneTitle").textContent=names[axis]+" 平面 · "+axis+" = "+fmt(state.cuts[axis],3)+" m · 节点厚度 "+sci(thickness)+" m";
 $("planeRangeLabel").textContent="当前"+names[axis]+"截面 "+(state.mode==="E"?"电场最小 / 最大":"功率通量最小 / 最大");
 $("scanFieldTitle").textContent=state.mode==="E"?"目标穿面瞬时电场 |E(t)|":"目标穿面瞬时功率通量 |S(t)|";
}
let targetCycleCache={key:"",Emax:NaN,Smax:NaN};
function updateTargetCycleMaximum(prm){
 const key=JSON.stringify({freq:prm.freq,apX:prm.apX,apY:prm.apY,eta:prm.eta,target:prm.target,nodes:prm.nodes});
 if(targetCycleCache.key===key)return targetCycleCache;
 const phasor=F.fieldAt(prm,prm.target);
 let Emax=0,Smax=0;
 // Sample one complete RF period densely; t is normalized to cycles [0,1).
 const samples=4096;
 for(let i=0;i<samples;i++){
  const value=F.instantaneous(phasor,i/samples);
  if(value.E>Emax)Emax=value.E;
  if(value.S>Smax)Smax=value.S;
 }
 targetCycleCache={key,Emax,Smax};
 return targetCycleCache;
}
function updateStudyReadouts(){
 if(!state.data)return;
 const prm=params(),phasor=F.fieldAt(prm,state.target),inst=F.instantaneous(phasor,state.t);
 const cycle=updateTargetCycleMaximum(prm);
 $("targetEStat").textContent=sci(inst.E);
 $("targetEMaxStat").textContent=sci(cycle.Emax);
 $("targetSStat").textContent=sci(inst.S);
 $("targetSMaxStat").textContent=sci(cycle.Smax);
 updateStudyPlaneTitle();
 const axis=selectedStudyAxis(),view=state.values&&state.values[axis];
 if(!view||!view.vals.length)return;
 const vals=view.vals,n=view.n;
 let min=Infinity,max=-Infinity,minI=0,maxI=0;
 for(let i=0;i<vals.length;i++){
  const v=vals[i];
  if(v<min){min=v;minI=i;}
  if(v>max){max=v;maxI=i;}
 }
 const r=F.ranges(params(),axis);
 function position(index){
  const ix=index%n,iy=Math.floor(index/n);
  const h=r.hMin+(ix+.5)/n*(r.hMax-r.hMin),v=r.vMax-(iy+.5)/n*(r.vMax-r.vMin);
  const p={x:state.cuts.x,y:state.cuts.y,z:state.cuts.z};p[r.hName]=h;p[r.vName]=v;
  return p;
 }
 const pMin=position(minI),pMax=position(maxI),unit=state.mode==="E"?"V/m":"W/cm²";
 $("planeRangeStat").textContent=sci(min)+" – "+sci(max)+" "+unit;
 $("planeRangeSub").textContent="最小 ("+fmt(pMin.x,2)+", "+fmt(pMin.y,2)+", "+fmt(pMin.z,2)+") m · 最大 ("+fmt(pMax.x,2)+", "+fmt(pMax.y,2)+", "+fmt(pMax.z,2)+") m";
}
function readStudyControls(){
 const axis=$("studyAxis").value,coord=Number($("studyCoord").value),span=Number($("scanSpan").value);
 if(!["x","y","z"].includes(axis))throw Error("请选择 X、Y 或 Z 法向平面。");
 if($("studyCoord").value.trim()===""||!Number.isFinite(coord)||Math.abs(coord)>1e7)throw Error("平面位置必须是有效的米制坐标。");
 if($("scanSpan").value.trim()===""||!Number.isFinite(span)||span<.1||span>1000)throw Error("穿面半宽范围为 0.1–1000 λ。");
 state.scanSpan=span;
 const aimMode=$("scanAimMode").value;if(!["track","fixed"].includes(aimMode))throw Error("请选择天线朝向模式。");state.scanAimMode=aimMode;
 return {axis,coord,span,aimMode};
}
function activateStudyPlane(plane,shouldQueue=true){
 const changed=!state.studyPlane.active||state.studyPlane.axis!==plane.axis||Math.abs(state.cuts[plane.axis]-plane.coord)>1e-10;
 state.studyPlane={axis:plane.axis,coord:plane.coord,active:true};
 state.cuts={...state.target};state.cuts[plane.axis]=plane.coord;
 $("studyAxis").value=plane.axis;$("studyCoord").value=String(plane.coord);$("scanSpan").value=String(plane.span??state.scanSpan);
 updateStudyPlaneTitle();renderScene();
 if(shouldQueue&&changed)queue();
}
function detectStudyPlane(){
 const axisInfo=F.AXES.map(axis=>{
  const vals=state.nodes.map(n=>n[axis]),min=Math.min(...vals),max=Math.max(...vals);
  return {axis,min,max,spread:max-min,coord:vals.reduce((a,b)=>a+b,0)/vals.length};
 }).sort((a,b)=>a.spread-b.spread);
 const best=axisInfo[0],lambda=F.C/(state.freq*1e9);
 activateStudyPlane({axis:best.axis,coord:best.coord,span:state.scanSpan},true);
 const tolerance=lambda*.05;
 $("status").textContent=best.spread<=tolerance
  ?"已识别共面方向 · 最大厚度 "+sci(best.spread)+" m"
  :"已选择节点最薄方向 · 厚度 "+sci(best.spread)+" m，可投影到该平面";
}
function applyStudyPlane(){
 try{activateStudyPlane(readStudyControls(),true);}
 catch(e){alert(e.message);}
}
function projectNodesToPlane(){
 let plane;
 try{plane=readStudyControls();}
 catch(e){alert(e.message);return;}
 const axisName=plane.axis.toUpperCase();
 if(!confirm("将全部 "+state.nodes.length+" 个节点的 "+axisName+" 坐标改为 "+plane.coord+" m？\n其余坐标、相位和功率保持不变。"))return;
 state.nodes.forEach(n=>n[plane.axis]=plane.coord);
 activateStudyPlane(plane,false);renderNodes();queue();
}
function drawLineChart(canvas,points,key,opts){
 const g=canvas.getContext("2d"),w=canvas.width,h=canvas.height;
 g.clearRect(0,0,w,h);g.fillStyle="#fff";g.fillRect(0,0,w,h);
 const left=92,right=25,top=28,bottom=56,pw=w-left-right,ph=h-top-bottom;
 const values=points.map(p=>p[key]),maxV=opts.reference===undefined?Math.max(1e-30,...values)*1.1:Math.max(opts.reference,...values)*1.12;
 const minV=0,xAt=i=>left+i/Math.max(1,points.length-1)*pw,yAt=v=>top+ph-(v-minV)/(maxV-minV||1)*ph;
 g.font="16px Arial";g.textAlign="right";g.textBaseline="middle";g.fillStyle="#536e7e";
 for(let i=0;i<=4;i++){
  const v=maxV*i/4,y=yAt(v);g.strokeStyle="#e7eef2";g.lineWidth=1;g.beginPath();g.moveTo(left,y);g.lineTo(w-right,y);g.stroke();
  g.fillText(opts.formatY?opts.formatY(v):sci(v),left-12,y);
 }
 const span=opts.span||1;g.textAlign="center";g.textBaseline="top";
 for(let i=0;i<=4;i++){
  const x=left+pw*i/4;g.strokeStyle="#edf2f5";g.beginPath();g.moveTo(x,top);g.lineTo(x,h-bottom);g.stroke();
  g.fillStyle="#536e7e";g.fillText(fmt(-span+2*span*i/4,1),x,h-bottom+11);
 }
 const zeroX=left+pw/2;g.save();g.setLineDash([6,5]);g.strokeStyle="#718a99";g.lineWidth=1.5;g.beginPath();g.moveTo(zeroX,top);g.lineTo(zeroX,h-bottom);g.stroke();g.restore();
 if(opts.reference!==undefined&&opts.reference<=maxV){
  const y=yAt(opts.reference);g.save();g.setLineDash([5,4]);g.strokeStyle="#c77743";g.lineWidth=1.5;g.beginPath();g.moveTo(left,y);g.lineTo(w-right,y);g.stroke();g.restore();
  g.fillStyle="#a76336";g.textAlign="left";g.textBaseline="bottom";g.fillText("100%参考",left+7,y-3);
 }
 g.strokeStyle=opts.color||"#2455c6";g.lineWidth=2.8;g.lineJoin="round";g.lineCap="round";g.beginPath();
 values.forEach((v,i)=>{const x=xAt(i),y=yAt(v);if(i===0)g.moveTo(x,y);else g.lineTo(x,y);});g.stroke();
 let peakI=0;for(let i=1;i<values.length;i++)if(values[i]>values[peakI])peakI=i;
 g.fillStyle=opts.color||"#2455c6";g.beginPath();g.arc(xAt(peakI),yAt(values[peakI]),5,0,TWO);g.fill();
 g.fillStyle="#34586b";g.font="bold 17px Arial";g.textAlign="center";g.textBaseline="bottom";g.fillText(opts.yLabel,left+pw/2,top-6);
 g.font="16px Arial";g.textBaseline="bottom";g.fillText("相对节点平面位置 / λ",left+pw/2,h-4);
}
function drawScanPlot(){
 const c1=$("planeScanField"),c2=$("planeScanRatio");if(!c1||!c2)return;
 const empty=(c,text)=>{
  const g=c.getContext("2d");g.clearRect(0,0,c.width,c.height);g.fillStyle="#fff";g.fillRect(0,0,c.width,c.height);
  g.fillStyle="#6a8291";g.font="bold 20px Arial";g.textAlign="center";g.textBaseline="middle";g.fillText(text,c.width/2,c.height/2);
 };
 if(!state.scanResult){
  empty(c1,"点击“扫描目标穿面”生成场强曲线");empty(c2,"扫描后显示相干合成比");$("exportScan").disabled=true;return;
 }
 const r=state.scanResult,mode=state.mode,key=mode==="E"?"E":"S",unit=mode==="E"?"V/m":"W/cm²";
 $("scanFieldTitle").textContent=mode==="E"?"目标穿面瞬时电场 |E(t)|":"目标穿面瞬时功率通量 |S(t)|";
 const points=r.points.map(p=>({...p,ratioPct:p.ratio*100}));
 drawLineChart(c1,points,key,{span:r.span,color:mode==="E"?"#2455d4":"#d9434e",yLabel:mode==="E"?"|E(t)| · V/m":"|S(t)| · W/cm²"});
 drawLineChart(c2,points,"ratioPct",{span:r.span,color:"#d9434e",reference:100,formatY:v=>v.toFixed(0)+"%",yLabel:"矢量相干合成比 / %"});
 let lo=0,hi=0;for(let i=1;i<points.length;i++){if(points[i][key]<points[lo][key])lo=i;if(points[i][key]>points[hi][key])hi=i;}
 let rMin=Infinity,rMax=-Infinity;for(const p of points){rMin=Math.min(rMin,p.ratioPct);rMax=Math.max(rMax,p.ratioPct);}
 $("scanSummary").textContent="穿面方向 "+r.axis.toUpperCase()+" · 峰值 "+sci(points[hi][key])+" "+unit+"（"+fmt(points[hi].offsetLambda,2)+" λ）· 谷值 "+sci(points[lo][key])+" "+unit+"（"+fmt(points[lo].offsetLambda,2)+" λ）· 相干比 "+fmt(rMin,1)+"%–"+fmt(rMax,1)+"% · "+(r.aimMode==="track"?"节点随目标跟踪":"节点保持当前朝向")+" · t/T="+fmt(r.t,3);
 $("exportScan").disabled=false;
}
function scanThroughPlane(){
 let plane;try{plane=readStudyControls();}catch(e){alert(e.message);return;}
 activateStudyPlane(plane,true);state.scanResult=null;drawScanPlot();
 const lambda=F.C/(state.freq*1e9),points=[],count=121,base=params();
 for(let i=0;i<count;i++){
  const offset=-plane.span+2*plane.span*i/(count-1),coordinate=plane.coord+offset*lambda;
  const xyz={...state.target,[plane.axis]:coordinate},prm={...base,target:xyz};
  const aimTarget=plane.aimMode==="track"?xyz:base.target;
  const total=F.fieldAtAimed(prm,xyz,aimTarget),inst=F.instantaneous(total,state.t);let reference=0;
  for(let k=0;k<state.nodes.length;k++)reference+=ePhasorPower(F.fieldAtAimed(prm,xyz,aimTarget,k));
  const ratio=reference>1e-30?ePhasorPower(total)/reference:0;
  points.push({offsetLambda:offset,coordinate,E:inst.E,S:inst.S,ratio});
 }
 state.scanResult={axis:plane.axis,coord:plane.coord,span:plane.span,lambda,t:state.t,aimMode:plane.aimMode,points};drawScanPlot();
}
function exportScanCSV(){
 if(!state.scanResult)return;
 const r=state.scanResult,lines=["offset_lambda,coordinate_m,E_inst_Vpm,Poynting_inst_Wpcm2,coherent_ratio_percent,time_over_T"];
 r.points.forEach(p=>lines.push([p.offsetLambda,p.coordinate,p.E,p.S,p.ratio*100,r.t].map(v=>Number(v).toPrecision(10)).join(",")));
 download(new Blob(["\ufeff",lines.join("\n")],{type:"text/csv;charset=utf-8"}),"WaveLab_plane_crossing_scan.csv");
}
function configObject(){
 return {
  application:"Wave Lab",schemaVersion:1,exportedAt:new Date().toISOString(),
  parameters:{freq:state.freq,apX:state.apX,apY:state.apY,eta:state.eta,pointsPerWave:state.pointsPerWave,
   Lx:state.Lx,Ly:state.Ly,Lz:state.Lz,zMin:state.zMin,centerX:state.centerX,centerY:state.centerY,
   target:{...state.target},cuts:{...state.cuts},nodes:state.nodes.map(n=>({x:n.x,y:n.y,z:n.z,phase:n.phase,power:n.power}))},
  study:{axis:$("studyAxis").value,coord:Number($("studyCoord").value),active:state.studyPlane.active,scanSpan:state.scanSpan,aimMode:$("scanAimMode").value},
  display:{mode:state.mode,t:state.t,speed:state.speed,scaleFactor:{...state.scaleFactor}}
 };
}
function exportConfig(){
 const json=JSON.stringify(configObject(),null,2),stamp=new Date().toISOString().replace(/[:.]/g,"-");
 download(new Blob([json],{type:"application/json;charset=utf-8"}),"WaveLab_config_"+stamp+".json");
}
function validNumber(value,fallback,min,max,label){
 const v=value===undefined?fallback:Number(value);
 if(!Number.isFinite(v)||v<min||v>max)throw Error("配置参数无效："+label);
 return v;
}
async function importConfig(file){
 try{
  const root=JSON.parse(await file.text()),p=root.parameters||root;
  if(!p||!Array.isArray(p.nodes)||p.nodes.length<1||p.nodes.length>64)throw Error("配置必须包含 1–64 个节点。");
  const num=(v,d,lo,hi,label)=>validNumber(v,d,lo,hi,label);
  const nodeList=p.nodes.map((n,i)=>({
   x:num(n.x,0,-1e7,1e7,"节点"+(i+1)+" X"),y:num(n.y,0,-1e7,1e7,"节点"+(i+1)+" Y"),
   z:num(n.z,0,-1e7,1e7,"节点"+(i+1)+" Z"),phase:num(n.phase,0,-1e12,1e12,"节点"+(i+1)+" 相位"),
   power:num(n.power,1,0,Number.MAX_VALUE,"节点"+(i+1)+" 功率")
  }));
  const target={x:num(p.target?.x,state.target.x,-1e7,1e7,"目标 X"),y:num(p.target?.y,state.target.y,-1e7,1e7,"目标 Y"),z:num(p.target?.z,state.target.z,-1e7,1e7,"目标 Z")};
  const cuts={x:num(p.cuts?.x,target.x,-1e7,1e7,"X 截面"),y:num(p.cuts?.y,target.y,-1e7,1e7,"Y 截面"),z:num(p.cuts?.z,target.z,-1e7,1e7,"Z 截面")};
  state.freq=num(p.freq,state.freq,.2,100,"频率");state.apX=num(p.apX,state.apX,.5,30,"口径长");state.apY=num(p.apY,state.apY,.5,30,"口径宽");state.eta=num(p.eta,state.eta,.01,1,"口面效率");
  const pp=num(p.pointsPerWave,state.pointsPerWave,8,16,"每波长采样");if(![8,16].includes(pp))throw Error("每波长采样只能是 8 或 16。");state.pointsPerWave=pp;
  state.Lx=num(p.Lx,state.Lx,.05,500,"X 范围");state.Ly=num(p.Ly,state.Ly,.05,500,"Y 范围");state.Lz=num(p.Lz,state.Lz,.05,500,"Z 范围");state.zMin=num(p.zMin,state.zMin,-1e6,1e6,"Z 起点");
  state.centerX=num(p.centerX,0,-1e7,1e7,"视图中心 X");state.centerY=num(p.centerY,0,-1e7,1e7,"视图中心 Y");
  state.target=target;state.cuts=cuts;state.nodes=nodeList;
  const st=root.study||{},axis=["x","y","z"].includes(st.axis)?st.axis:"x";
  state.scanSpan=num(st.scanSpan,state.scanSpan,.1,1000,"穿面半宽");state.scanAimMode=st.aimMode==="fixed"?"fixed":"track";
  state.studyPlane={axis,coord:num(st.coord,cuts[axis],-1e7,1e7,"研究平面位置"),active:!!st.active};
  if(state.studyPlane.active)state.cuts[axis]=state.studyPlane.coord;
  const d=root.display||{};
  state.mode=d.mode==="S"?"S":"E";state.t=num(d.t,state.t,0,1,"周期时刻");
  state.speed=[.25,.5,1].includes(Number(d.speed))?Number(d.speed):.5;
  if(d.scaleFactor)for(const m of ["E","S"])if(Number.isFinite(Number(d.scaleFactor[m]))&&Number(d.scaleFactor[m])>0)state.scaleFactor[m]=F.clamp(Number(d.scaleFactor[m]),1e-8,100);
  state.savedOverview=null;state.scanResult=null;state.coherenceRatio=null;
  $("freq").value=state.freq;$("apX").value=state.apX;$("apY").value=state.apY;$("eta").value=state.eta;$("pointsPerWave").value=String(state.pointsPerWave);
  $("Lx").value=state.Lx;$("Ly").value=state.Ly;$("Lz").value=state.Lz;$("zMin").value=state.zMin;
  $("targetX").value=target.x;$("targetY").value=target.y;$("targetZ").value=target.z;
  $("studyAxis").value=axis;$("studyCoord").value=state.studyPlane.coord;$("scanSpan").value=state.scanSpan;$("scanAimMode").value=state.scanAimMode;$("count").value=state.nodes.length;
  $("time").value=state.t;$("speed").value=state.speed;
  $("modeE").classList.toggle("selected",state.mode==="E");$("modeS").classList.toggle("selected",state.mode==="S");
  renderNodes();syncViewInput();drawScanPlot();updateExtras();queue();
 }catch(e){alert("配置导入失败。\n"+(e&&e.message?e.message:String(e)));}
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
    state.target[axis]=num;state.cuts={...state.target};
    if(state.studyPlane.active)state.cuts[state.studyPlane.axis]=state.studyPlane.coord;
    else if(state.studyPlane.axis===axis){state.studyPlane.coord=num;$("studyCoord").value=String(num);}
    if(state.savedOverview){state.centerX=state.target.x;state.centerY=state.target.y;state.zMin=state.target.z-state.Lz/2;syncViewInput();}
    queue();
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
 $("scaleLimit").addEventListener("input",e=>{
  // Logarithmic control: 0 → 0.1%, 1000 → 100% of automatic maximum.
  state.scaleFactor[state.mode]=Math.pow(10,3*(Number(e.target.value)/1000-1));
  recolorOnly();
 });
 $("scaleMax").addEventListener("change",e=>{
  const value=Number(e.target.value),base=state.fixedScales?.[state.mode];
  if(e.target.value.trim()===""||!Number.isFinite(value)||!(value>0)||!(base>0)){syncColorBar();return;}
  state.scaleFactor[state.mode]=F.clamp(value/base,1e-8,100);
  recolorOnly();
 });
 $("scaleAuto").addEventListener("click",()=>{state.scaleFactor[state.mode]=1;recolorOnly();});
 $("play").addEventListener("click",()=>{state.playing=!state.playing;$("play").textContent=state.playing?"Ⅱ 暂停":"▶ 播放";lastTime=0;});
 $("reset").addEventListener("click",()=>{state.playing=false;state.t=0;$("play").textContent="▶ 播放";drawDynamic();});
 $("speed").addEventListener("change",()=>state.speed=Number($("speed").value));
 $("time").addEventListener("input",()=>{state.t=Number($("time").value);drawDynamic();});
 $("exportPNG").addEventListener("click",exportPNG);
 $("exportCSV").addEventListener("click",exportCSV);
 $("exportConfig").addEventListener("click",exportConfig);
 $("importConfig").addEventListener("click",()=>$("importConfigFile").click());
 $("importConfigFile").addEventListener("change",e=>{
  const file=e.target.files&&e.target.files[0];if(file)importConfig(file).finally(()=>{e.target.value="";});
 });
 $("studyAxis").addEventListener("change",()=>{
  const axis=$("studyAxis").value;
  state.studyPlane.axis=axis;state.studyPlane.coord=state.cuts[axis];
  $("studyCoord").value=String(state.studyPlane.coord);updateStudyPlaneTitle();
 });
 $("studyCoord").addEventListener("change",()=>{
  const v=Number($("studyCoord").value);
  if($("studyCoord").value.trim()===""||!Number.isFinite(v)||Math.abs(v)>1e7){$("studyCoord").value=String(state.studyPlane.coord);return;}
  // The typed coordinate is applied only after clicking the plane action.
 });
 $("scanSpan").addEventListener("change",()=>{
  const v=Number($("scanSpan").value);
  if($("scanSpan").value.trim()===""||!Number.isFinite(v)||v<.1||v>1000){$("scanSpan").value=String(state.scanSpan);return;}
  state.scanSpan=v;
 });
 $("detectStudyPlane").addEventListener("click",detectStudyPlane);
 $("applyStudyPlane").addEventListener("click",applyStudyPlane);
 $("projectNodes").addEventListener("click",projectNodesToPlane);
 $("scanThroughPlane").addEventListener("click",scanThroughPlane);
 $("exportScan").addEventListener("click",exportScanCSV);
 for(const axis of F.AXES){
  const canvas=$("plot"+axis.toUpperCase());
  canvas.addEventListener("pointermove",e=>showLens(axis,e));
  canvas.addEventListener("pointerleave",hideLens);

 }
 window.addEventListener("blur",hideLens);
 window.addEventListener("scroll",hideLens,true);
}
function setMode(mode){
 state.mode=mode;$("modeE").classList.toggle("selected",mode==="E");$("modeS").classList.toggle("selected",mode==="S");drawDynamic();drawScanPlot();
}
const MAX_GRID=1000;
function gridLimitForNodes(){return Math.max(128,Math.min(MAX_GRID,Math.floor(MAX_GRID*Math.sqrt(4/state.nodes.length))));}
function samplingPlan(){
 const lambda=F.C/(state.freq*1e9),step=lambda/state.pointsPerWave;
 const dims={x:Math.ceil(state.Lx/step),y:Math.ceil(state.Ly/step),z:Math.ceil(state.Lz/step)};
 const demanded=Math.max(...Object.values(dims));
 const total=dims.y*dims.z+dims.x*dims.z+dims.x*dims.y;
 const gridLimit=gridLimitForNodes();
 return {lambda,step,dims,demanded,total,n:Math.max(64,Math.min(gridLimit,demanded)),limited:demanded>gridLimit};
}
function updateSampling(){
 // Preserve wavelength-based grid selection silently; no on-screen diagnostic microtext.
 const plan=samplingPlan();
 state.n=plan.n;
 $("restoreOverview").disabled=!state.savedOverview;
 return plan;
}
function syncViewInput(){
 for(const key of ["Lx","Ly","Lz","zMin"])$(key).value=Number(state[key].toFixed(6));
}
function focusLocal(){
 if(!state.savedOverview)state.savedOverview={Lx:state.Lx,Ly:state.Ly,Lz:state.Lz,zMin:state.zMin,centerX:state.centerX,centerY:state.centerY};
 const lambda=F.C/(state.freq*1e9),windowSize=0.95*gridLimitForNodes()*lambda/state.pointsPerWave;
 state.Lx=Math.min(state.Lx,windowSize);state.Ly=Math.min(state.Ly,windowSize);state.Lz=Math.min(state.Lz,windowSize);
 state.centerX=state.target.x;state.centerY=state.target.y;state.zMin=state.target.z-state.Lz/2;
 state.cuts={...state.target};if(state.studyPlane.active)state.cuts[state.studyPlane.axis]=state.studyPlane.coord;
 syncViewInput();queue();
}
function restoreOverview(){
 const view=state.savedOverview;
 if(!view)return;
 for(const key of ["Lx","Ly","Lz","zMin","centerX","centerY"])state[key]=view[key];
 state.cuts={...state.target};if(state.studyPlane.active)state.cuts[state.studyPlane.axis]=state.studyPlane.coord;state.savedOverview=null;
 syncViewInput();queue();
}
function queue(){
 state.scanResult=null;drawScanPlot();
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
 drawDynamic();updateTargetCoherence();updateStudyPlaneTitle();
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
// Display-only color upper bound; this must never alter E/H, phase, Poynting values, or exports.
function displayMax(){
 const baseline=state.fixedScales?.[state.mode];
 if(!(baseline>0))return 1;
 return Math.max(1e-30,baseline*state.scaleFactor[state.mode]);
}
function syncColorBar(){
 if(!state.fixedScales)return;
 const ratio=state.scaleFactor[state.mode];
 const logPosition=1000*(1+Math.log10(F.clamp(ratio,.001,1))/3);
 $("scaleLimit").value=String(Math.round(F.clamp(logPosition,0,1000)));
 if(document.activeElement!==$("scaleMax"))$("scaleMax").value=String(Number(displayMax().toPrecision(6)));
 $("scaleAuto").disabled=Math.abs(ratio-1)<1e-12;
 $("scaleLimit").setAttribute("aria-valuetext","显示上限 "+sci(displayMax()));
}
function recolorOnly(){
 if(!state.data||!state.values)return;
 const cap=displayMax(),maps={};
 for(const axis of F.AXES){
  const v=state.values[axis];
  if(!v)continue;
  maps[axis]=rawRaster(v.vals,cap,v.n);
  drawSlice(axis,maps[axis],cap);
 }
 state.rasters=maps;state.scale=cap;
 $("scaleUnit").textContent=state.mode==="E"?"瞬时电场强度 |E(t)| · V/m":"瞬时功率通量 |S(t)| · W/cm²";
 syncColorBar();
 if(hover){const h=hover;hover=null;showLens(h.axis,h.event);}
}
function drawDynamic(){
 $("time").value=state.t;$("timeValue").textContent=fmt(state.t,3)+" T";
 updateExtras();drawTrace();
 if(!state.data||rendering)return;
 rendering=true;
 try{
  const current={};
  for(const axis of F.AXES)current[axis]=makeValues(axis);
  state.values=current;
  recolorOnly();updateStudyReadouts();
 }finally{rendering=false;}
}
function updateExtras(){
 for(const a of F.AXES)$("label"+a.toUpperCase()).textContent=a+" = "+fmt(state.cuts[a],2)+" m";
 updateStudyPlaneTitle();
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
 const n=state.data.n,prm=params(),co=Math.cos(TWO*state.t),si=Math.sin(TWO*state.t);
 const valueName=state.mode==="E"?"E_inst_Vpm":"Poynting_inst_Wpcm2";
 const lines=["plane,x_m,y_m,z_m,"+valueName];
 for(const axis of ["x","y","z"]){
  const f=state.data.axes[axis].fields;
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
   const xyz=F.planePoint(prm,axis,(i+.5)/n,(j+.5)/n);
   lines.push([axis.toUpperCase(),xyz.x,xyz.y,xyz.z,instantValue(f,j*n+i,co,si,state.mode)].map((x,k)=>k===0?x:Number(x).toPrecision(8)).join(","));
  }
 }
 download(new Blob(["\ufeff",lines.join("\n")],{type:"text/csv;charset=utf-8"}),"WaveLab_3D_all_orthogonal_slices.csv");
}
bind();renderNodes();updateExtras();drawTrace();initSceneControls();queue();requestAnimationFrame(tick);
})();