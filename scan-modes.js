/* Scan geometry visualization. This is mission planning, not mode-specific SAR IQ imaging. */
(function(){
"use strict";
if(window.sarScan || !document.getElementById("geospatial"))return;
const PI=Math.PI;
S.scanMode="mosaic";S.scanPasses=3;S.scanTurnSec=12;S.scanBurstSec=.8;
const labels={mosaic:"多航线条带拼接",stripmap:"单航线条带",spotlight:"聚束 Spotlight",scansar:"ScanSAR 子条带",cone:"锥扫原理演示"};
const desc={mosaic:"蛇形多航线，每一条完成独立地面条带，转弯时暂停采集。",stripmap:"天线固定侧视，单条航线沿飞行方向连续成像。",spotlight:"天线随飞行持续回指固定地面目标，提高有效驻留时间。",scansar:"近、中、远距离子条带轮流突发照射，换取更大的幅宽。",cone:"波束绕中心轴旋转；锥扫是天线扫描方式，不等同于独立 SAR 成像模式。"};
const colors=["#f5aa50","#52b9c9","#7acaab","#dcb6ee","#e5c36a","#b9a1e3"];
let mode="mosaic",t=0,playing=true,last=0,lastDraw=0;
const E=id=>document.getElementById(id),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const count=()=>clamp(S.scanPasses|0,2,6),len=()=>S.speed*S.duration,band=()=>S.swath/3;
const total=()=>mode==="mosaic"?count()*S.duration+(count()-1)*S.scanTurnSec:S.duration;
function state(){
 const L=len(),B=band(),T=total(),sec=clamp(t,0,T);
 let pass=0,u=clamp(sec/S.duration,0,1),turn=false,ay=0,ax=-L/2+u*L,targetY=0,targetX=ax,index=1;
 if(mode==="mosaic"){
   let rem=sec;
   for(let i=0;i<count();i++){
     const off=j=>(j-(count()-1)/2)*B*.92;
     if(rem<=S.duration||i===count()-1){pass=i;u=clamp(rem/S.duration,0,1);ay=off(i);ax=(i%2?L/2:-L/2)+(i%2?-L:L)*u;break}
     rem-=S.duration;
     if(rem<S.scanTurnSec){turn=true;pass=i;u=1;ax=i%2?-L/2:L/2;ay=off(i)+(off(i+1)-off(i))*rem/S.scanTurnSec;break}
     rem-=S.scanTurnSec;
   }
   targetX=ax;targetY=ay;
 }else if(mode==="spotlight"){targetX=0;targetY=0}
 else if(mode==="scansar"){index=Math.floor(sec/Math.max(.2,S.scanBurstSec))%3;targetY=(index-1)*B*.92}
 else if(mode==="cone"){const a=sec*2*PI/(3*Math.max(.2,S.scanBurstSec));targetX=ax+B*.33*Math.cos(a);targetY=B*.33*Math.sin(a)}
 const geom=S.alt*Math.tan(S.inc*PI/180);
 return {mode,ax,ay,tx:targetX,ty:targetY,airY:geom+ay,pass,u,turn,index,T,sec,L,B,
   vx:ax/L*114,vy:-35+ay/S.swath*100,txv:targetX/L*114,tyv:targetY/S.swath*110,
   rx:mode==="spotlight"?12:mode==="cone"?9:23,ry:mode==="spotlight"?11:mode==="cone"?9:Math.max(9,54/count())};
}
function strips(q=state()){
 const a=[];
 if(mode==="spotlight"){const d=Math.min(q.B*.7,580);return [{x1:-d/2,x2:d/2,y1:-d/2,y2:d/2,col:colors[4],done:q.u,spot:true}]}
 const n=mode==="mosaic"?count():mode==="scansar"?3:1;
 for(let i=0;i<n;i++){
   let y=mode==="mosaic"?(i-(count()-1)/2)*q.B*.92:mode==="scansar"?(i-1)*q.B*.92:0;
   let done=mode==="mosaic"?(i<q.pass?1:i===q.pass?q.u:0):mode==="scansar"||mode==="cone"?0:q.u;
   a.push({x1:-q.L/2,x2:q.L/2,y1:y-q.B/2,y2:y+q.B/2,col:colors[i],done,reverse:mode==="mosaic"&&i%2,index:i});
 }
 return a;
}
const style=document.createElement("style");
style.textContent=".scan-modes{display:flex;flex-wrap:wrap;align-items:center;gap:7px;background:#eef5f5;border:1px solid #d5e2e3;padding:10px;margin:8px 0 12px;border-radius:5px}.scan-modes b{font:700 12px system-ui;color:#284c59}.scan-modes button{border:1px solid #bed1d7;color:#345c69;background:white;border-radius:4px;padding:7px 9px;cursor:pointer;font:700 11px system-ui}.scan-modes button[aria-pressed=true]{background:#26566a;border-color:#26566a;color:white}.scan-modes .description{width:100%;font:11px/1.6 system-ui;color:#526b73}.scan-modes .extra{font:11px system-ui;display:flex;gap:13px;flex-wrap:wrap}.scan-modes .extra input{width:48px;border:1px solid #c5d5d8;padding:5px;border-radius:4px}.sar-new-map{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1}.geo-map #mapOverlay>path:first-of-type,.geo-map #mapOverlay>path:nth-of-type(4),.geo-map #mapOverlay>path:nth-of-type(5),.geo-map #mapOverlay>g{display:none}.sar-plan{position:absolute;right:9px;bottom:9px;z-index:4;background:#0b2130ef;border:1px solid #65828e;border-radius:4px;width:270px!important;height:165px!important;pointer-events:none}.sar-mode-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:11px}.sar-mode-stats>div{padding:8px;border:1px solid #dce6e8;border-radius:4px}.sar-mode-stats small{font-size:10px;color:#5e7a82;display:block}.sar-mode-stats strong{display:block;font-size:15px;color:#274c58}.sar-mode-warning{font:11px/1.6 system-ui;color:#5c7780;margin:9px 0}@media(max-width:800px){.sar-mode-stats{grid-template-columns:repeat(2,1fr)}.sar-plan{width:38%!important;height:120px!important}}";
style.textContent+=".sar-psf{margin:12px 0;padding:12px;border:1px solid #dce6e8;border-radius:4px;background:#f8fbfc}.sar-psf strong{font:700 12px system-ui;color:#284b58;display:block;margin-bottom:7px}.sar-psf canvas{display:block;width:100%;height:auto;max-height:180px}.sar-psf small{font:10px/1.5 system-ui;color:#63808a}";style.textContent+=".sar-point{border:1px solid #d7e4e8;padding:10px;margin:9px 0;background:#f9fbfb}.sar-point button{border:0;background:#2b6877;color:#fff;padding:9px 14px;font:700 12px system-ui;cursor:pointer;border-radius:3px}.sar-point button:disabled{opacity:.6}.sar-point>span{display:block;font-size:10px;color:#597582;line-height:1.5;padding:8px 0}.sar-point-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.sar-point-grid>div{border:1px solid #dbe5e7;padding:7px}.sar-point-grid strong,.sar-point-grid small{display:block;font-size:11px;color:#375863}.sar-point-grid small{font-size:10px}.sar-point-grid canvas{width:100%;aspect-ratio:1/1;image-rendering:pixelated}@media(max-width:570px){.sar-point-grid{grid-template-columns:1fr 1fr}}";document.head.appendChild(style);
const html=id=>'<div class="scan-modes" id="'+id+'"><b>扫描模式</b>'+Object.keys(labels).map(k=>'<button data-scan="'+k+'" aria-pressed="'+(k===mode)+'">'+labels[k]+'</button>').join('')+'<span class="description"></span><div class="extra"><label data-only="mosaic">航线数 <input data-count type="number" min="2" max="6" value="3"></label><label data-only="mosaic">转弯秒数 <input data-turn type="number" min="0" max="60" value="12"></label><label data-only="scansar cone">突发周期(s) <input data-burst type="number" min=".2" max="4" step=".2" value=".8"></label></div></div>';
const geo=E("geospatial"),three=E("environment").querySelector(".panel");
geo.querySelector(".geogrid").insertAdjacentHTML("beforebegin",html("modeMap"));
three.querySelector(".sceneWrap").insertAdjacentHTML("beforebegin",html("mode3D"));
three.querySelector(".sceneWrap").insertAdjacentHTML("beforeend",'<canvas id="scanPlan" class="sar-plan" width="270" height="165" aria-label="各条带采集进度俯视图"></canvas>');
three.querySelector(".sceneFoot").insertAdjacentHTML("afterend",'<div id="scanStats" class="sar-mode-stats"></div><p id="scanModeNote" class="sar-mode-warning"></p><div class="sar-psf"><strong>理想点目标方位响应对比 / PSF</strong><canvas id="scanPsf" width="690" height="180" aria-label="Stripmap、Spotlight 和 ScanSAR 的理论方位点扩散函数"></canvas><small>同一高度和载频下的孔径驻留时间趋势比较；下方按钮另有同一接收机参数的实际复数 IQ 点目标仿真。</small></div><div class="sar-point"><button id="sarPointRun" type="button">运行三模式统一点目标 IQ → BP 对比</button><span id="sarPointStatus">仅为局部标准点目标的孔径差异验证，不是 3km 港区的全模式 SAR 成像。</span><div id="sarPointResults" class="sar-point-grid"></div></div>');
const map=E("mapPort"),newSvg=document.createElementNS("http://www.w3.org/2000/svg","svg");
newSvg.setAttribute("class","sar-new-map");newSvg.setAttribute("aria-label","实时多条带与波束覆盖地图");map.appendChild(newSvg);
function controls(){
 document.querySelectorAll("[data-scan]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.scan===mode)));
 document.querySelectorAll(".scan-modes .description").forEach(n=>n.textContent=desc[mode]);
 document.querySelectorAll(".scan-modes [data-only]").forEach(n=>n.style.display=n.getAttribute("data-only").split(" ").includes(mode)?"":"none");
 document.querySelectorAll("[data-count]").forEach(n=>n.value=count());
 document.querySelectorAll("[data-turn]").forEach(n=>n.value=S.scanTurnSec);
 document.querySelectorAll("[data-burst]").forEach(n=>n.value=S.scanBurstSec);
 const lab=document.querySelector('label[for="mission_duration"] span');if(lab)lab.textContent=mode==="mosaic"?"每条航线扫描时间":"扫描时间";
}
function drawPsf(){
 const c=E("scanPsf"),ctx=c.getContext("2d"),W=690,H=180,R=S.alt/Math.cos(S.inc*PI/180),lam=299792458/(S.fc*1e9),dwell=Math.min(.28,S.duration),base=lam*R/(2*S.speed*dwell);
 ctx.fillStyle="#f8fbfc";ctx.fillRect(0,0,W,H);const left=48,right=675,top=25,bottom=140;
 ctx.strokeStyle="#dee6e9";ctx.fillStyle="#627b84";ctx.font="11px system-ui";ctx.lineWidth=1;
 for(let y=0;y<=4;y++){let yy=top+(bottom-top)*y/4;ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(right,yy);ctx.stroke();ctx.fillText((y*-10)+" dB",5,yy+4)}
 const xmax=Math.max(5,base*4);for(let x=-4;x<=4;x++){let xx=left+(x+4)/8*(right-left);ctx.beginPath();ctx.moveTo(xx,top);ctx.lineTo(xx,bottom);ctx.stroke();ctx.fillText((x*xmax/4).toFixed(1),xx-11,bottom+14)}
 let cases=[["Stripmap",base,"#e49547"],["Spotlight",base/3,"#c8a031"],["ScanSAR",base*3,"#398eae"]];
 for(let j=0;j<cases.length;j++){let label=cases[j][0],res=cases[j][1],color=cases[j][2];ctx.beginPath();for(let k=0;k<=450;k++){let x=-xmax+2*xmax*k/450,z=PI*x/res,a=Math.abs(z)<1e-10?1:Math.abs(Math.sin(z)/z),d=Math.max(-40,20*Math.log10(Math.max(1e-9,a))),px=left+(right-left)*k/450,py=top+(-d)/40*(bottom-top);k?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.lineWidth=2;ctx.strokeStyle=color;ctx.stroke();ctx.fillStyle=color;ctx.font="700 11px system-ui";ctx.fillText(label+": "+res.toFixed(2)+"m",left+10+j*205,14)}
 ctx.fillStyle="#637e88";ctx.fillText("方位相对中心位置 / m",275,171);
}
function stats(){
 const q=state(),actualTime=(mode==="mosaic"?count():1)*S.duration,groundWidth=mode==="mosaic"?band()*count()*.92:mode==="scansar"?S.swath:mode==="spotlight"?Math.min(band()*.7,580):band(),area=(mode==="spotlight"?PI*groundWidth*groundWidth/4:len()*groundWidth)/1e6;
 const dwell=Math.min(.28,S.duration)*(mode==="spotlight"?3:mode==="scansar"?1/3:mode==="cone"?0:1);
 const resolution=dwell?(299792458/(S.fc*1e9))*(S.alt/Math.cos(S.inc*PI/180))/(2*S.speed*dwell):0;
 E("scanStats").innerHTML='<div><small>任务总时长 / 含转弯</small><strong>'+q.T.toFixed(0)+' s</strong></div><div><small>覆盖面积估算</small><strong>'+area.toFixed(2)+' km²</strong></div><div><small>有效发射脉冲计划</small><strong>'+Math.round(S.prf*actualTime).toLocaleString()+'</strong></div><div><small>理论方位分辨率趋势</small><strong>'+(dwell?resolution.toFixed(2)+' m':'不适用')+'</strong></div>';
 E("scanModeNote").textContent=desc[mode]+" 覆盖与分辨率是按目标幅宽约三分之一的单条波束和理想等效孔径作的规划估计。右侧大范围图仍为光学散射代理，106m 局部 BP 仍是独立固定基线，并非按本模式生成的实测成像结果。";drawPsf();
}
function renderMap(){
 const p=E("mapOverlay").querySelectorAll(":scope > path")[1];if(!p)return;
 const nums=(p.getAttribute("d")||"").match(/-?\d+(?:\.\d+)?/g);if(!nums||nums.length<8)return;
 const n=nums.map(Number),cx=(Math.max(n[0],n[2],n[4],n[6])+Math.min(n[0],n[2],n[4],n[6]))/2,cy=(Math.max(n[1],n[3],n[5],n[7])+Math.min(n[1],n[3],n[5],n[7]))/2,scale=(Math.max(n[0],n[2],n[4],n[6])-Math.min(n[0],n[2],n[4],n[6]))/S.roiSize;
 const xy=(x,y)=>[(cx+x*scale).toFixed(2),(cy-y*scale).toFixed(2)],q=state(),B=strips(q);
 const path=pts=>pts.map((p,i)=>(i?"L":"M")+xy(p[0],p[1]).join(",")).join(" ")+"Z";
 let o="";
 for(const a of B){o+='<path d="'+path([[a.x1,a.y1],[a.x2,a.y1],[a.x2,a.y2],[a.x1,a.y2]])+'" fill="'+a.col+'1c" stroke="'+a.col+'" stroke-width="1.3" stroke-dasharray="6 4"/>';
   if(mode==="scansar"){
     let dt=Math.max(.2,S.scanBurstSec),cycles=Math.min(180,Math.ceil(q.sec/dt));
     for(let j=0;j<cycles;j++)if(j%3===a.index){let xa=-q.L/2+j*S.speed*dt,xb=Math.min(q.L/2,xa+S.speed*dt);if(xa<xb)o+='<path d="'+path([[xa,a.y1],[xb,a.y1],[xb,a.y2],[xa,a.y2]])+'" fill="'+a.col+'77"/>'}
   }else if(mode==="cone"){const dt=Math.max(.2,S.scanBurstSec/2),steps=Math.min(200,Math.floor(q.sec/dt));for(let j=0;j<steps;j++){let tj=j*dt,px=-q.L/2+S.speed*tj,ang=tj*2*PI/(3*Math.max(.2,S.scanBurstSec)),x=px+q.B*.33*Math.cos(ang),y=q.B*.33*Math.sin(ang),c=xy(x,y);o+='<circle cx="'+c[0]+'" cy="'+c[1]+'" r="'+Math.max(2,q.B*.07*scale).toFixed(2)+'" fill="#b4a3ea22" stroke="#b5a5e088"/>'}}else if(mode==="spotlight"){o+='<path d="'+path([[a.x1,a.y1],[a.x2,a.y1],[a.x2,a.y2],[a.x1,a.y2]])+'" fill="'+a.col+'60"/>'}
   else if(a.done>0){let span=(a.x2-a.x1)*a.done,left=a.reverse?a.x2-span:a.x1,right=a.reverse?a.x2:a.x1+span;o+='<path d="'+path([[left,a.y1],[right,a.y1],[right,a.y2],[left,a.y2]])+'" fill="'+a.col+'77"/>'}
 }
 let air=xy(q.ax,q.airY),aim=xy(q.tx,q.ty);
 o+='<path d="M'+air.join(",")+'L'+aim.join(",")+'" stroke="#ffe3a5" stroke-width="1.7" stroke-dasharray="5 4"/><circle cx="'+aim[0]+'" cy="'+aim[1]+'" r="8" fill="#f8cc7680" stroke="#ffd37b" stroke-width="1.4"/><g transform="translate('+air.join(",")+')"><circle r="10" fill="white" stroke="#d78439" stroke-width="2"/><path d="M-8,0H8 M0,-7V7" stroke="#ae652c" stroke-width="2"/></g>';
 if(q.turn)o+='<text x="'+(Number(air[0])+13)+'" y="'+(Number(air[1])-12)+'" fill="#fff" style="paint-order:stroke;stroke:#294954;stroke-width:3;font:bold 12px system-ui">转弯中（停止采集）</text>';
 newSvg.setAttribute("viewBox","0 0 "+map.clientWidth+" "+map.clientHeight);newSvg.innerHTML=o;
}
function plan(){
 const ctx=E("scanPlan").getContext("2d"),q=state(),W=270,H=165,L=q.L;
 ctx.clearRect(0,0,W,H);ctx.fillStyle="#0b2130";ctx.fillRect(0,0,W,H);ctx.strokeStyle="#335463";for(let x=30;x<=245;x+=30){ctx.beginPath();ctx.moveTo(x,24);ctx.lineTo(x,143);ctx.stroke()}
 const xx=x=>135+x/L*214,yy=y=>82-y/S.swath*106;
 for(const a of strips(q)){let x=xx(a.x1),y=yy(a.y2),w=xx(a.x2)-x,h=yy(a.y1)-y;ctx.fillStyle=a.col+"28";ctx.strokeStyle=a.col;ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);if(a.done){ctx.fillStyle=a.col+"99";let d=w*a.done;ctx.fillRect(a.reverse?x+w-d:x,y,d,h)}}
 ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(xx(q.ax),yy(q.ay),4,0,2*PI);ctx.fill();
 ctx.strokeStyle="#ffd57c";ctx.beginPath();ctx.moveTo(xx(q.ax),yy(q.ay));ctx.lineTo(xx(q.tx),yy(q.ty));ctx.stroke();
 ctx.fillStyle="#dae6ed";ctx.font="bold 10px system-ui";ctx.fillText("覆盖进度 · "+labels[mode],9,14);ctx.font="10px system-ui";ctx.fillText(q.sec.toFixed(1)+" / "+q.T.toFixed(1)+" s"+(q.turn?" · 转弯暂停":" "),10,159);
}
function syncText(){
 const q=state(),mm=v=>String(Math.floor(v/60)).padStart(2,"0")+":"+String(Math.floor(v%60)).padStart(2,"0");
 if(E("clock"))E("clock").textContent=mm(q.sec)+" / "+mm(q.T);
 if(E("flightTime"))E("flightTime").value=Math.round(q.sec/q.T*1000);
 if(E("geoTime"))E("geoTime").textContent=q.T.toFixed(0)+" s";
 if(E("geoTrack"))E("geoTrack").textContent=(len()*(mode==="mosaic"?count():1)/1000).toFixed(2)+" km";
 if(E("geoPulses"))E("geoPulses").textContent=Math.round(S.prf*S.duration*(mode==="mosaic"?count():1)).toLocaleString();
 if(E("playMap"))E("playMap").textContent=playing?"❚❚ 暂停":"▶ 继续";
 if(E("flightInfo"))E("flightInfo").textContent="扫描模式 "+labels[mode]+" | 高度 "+S.alt+" m | "+q.sec.toFixed(1)+" / "+q.T.toFixed(1)+" s"+(q.turn?" · 转弯，不采集":"");
}
function draw(force=false){
 let now=performance.now();if(playing&&last)t=Math.min(total(),t+(now-last)/1000);last=now;if(t>=total())playing=false;
 if(force||now-lastDraw>70){lastDraw=now;renderMap();plan();syncText()}
}
function change(v){if(!labels[v])return;mode=v;S.scanMode=v;t=0;playing=true;last=0;controls();stats();draw(true)}
document.querySelectorAll("[data-scan]").forEach(b=>b.onclick=()=>change(b.dataset.scan));
document.querySelectorAll("[data-count]").forEach(e=>e.onchange=()=>{S.scanPasses=clamp(+e.value||3,2,6);controls();t=0;stats();draw(true)});
document.querySelectorAll("[data-turn]").forEach(e=>e.onchange=()=>{S.scanTurnSec=clamp(+e.value||0,0,60);controls();t=0;stats();draw(true)});
document.querySelectorAll("[data-burst]").forEach(e=>e.onchange=()=>{S.scanBurstSec=clamp(+e.value||.8,.2,4);controls();stats()});
E("flightTime")?.addEventListener("input",e=>{e.stopImmediatePropagation();playing=false;t=(+e.target.value)/1000*total();draw(true)},true);
E("playMap")?.addEventListener("click",e=>{e.stopImmediatePropagation();if(t>=total())t=0;playing=!playing;draw(true)},true);
E("resetFlight")?.addEventListener("click",e=>{e.stopImmediatePropagation();playing=false;t=0;draw(true)},true);
function coverage(out,quad){const q=state(),L=q.L;for(const a of strips(q)){let x1=a.x1/L*114,x2=a.x2/L*114,y1=a.y1/S.swath*110,y2=a.y2/S.swath*110;quad(out,[[x1,y1,.4],[x2,y1,.4],[x2,y2,.4],[x1,y2,.4]],[.18,.76,.88,.12]);if(mode==="scansar"){let dt=Math.max(.2,S.scanBurstSec),steps=Math.min(180,Math.ceil(q.sec/dt));for(let j=0;j<steps;j++){if(j%3!==a.index)continue;let xa=-L/2+j*S.speed*dt,xb=Math.min(L/2,xa+S.speed*dt),p1=xa/L*114,p2=xb/L*114;if(xb>xa)quad(out,[[p1,y1,.65],[p2,y1,.65],[p2,y2,.65],[p1,y2,.65]],[.24,.71,.89,.36])}}if(a.done){let d=(x2-x1)*a.done,left=a.reverse?x2-d:x1,right=a.reverse?x2:x1+d;quad(out,[[left,y1,.6],[right,y1,.6],[right,y2,.6],[left,y2,.6]],a.index%2?[.26,.77,.63,.32]:[.96,.65,.31,.34])}}}
async function runPointComparison(){
 const btn=E("sarPointRun"),info=E("sarPointStatus"),out=E("sarPointResults");
 btn.disabled=true;out.replaceChildren();info.textContent="正在用相同链路参数逐个生成复数 LFM 回波、量化 ADC 和相干 BP...";
 try{
   const modes=[["Stripmap",1,64],["Spotlight (理想回指)",3,192],["ScanSAR (1/3驻留近似)",1/3,21]];
   for(const [label,factor,n] of modes){
     await new Promise(resolve=>setTimeout(resolve,25));
     const p={...S,pulses:n,phaseJitter:0,localDwell:.28*factor,step:S.speed*.28*factor/(n-1)};
     const q=calc(p),point={x:0,y:q.y,rcs:1000,phase:0};
     const data=simulate(localCanvas,p,()=>{},[point]),peak=Math.max(...data.bp),canvas=document.createElement("canvas");
     canvas.width=data.NX;canvas.height=data.NY;
     const ctx=canvas.getContext("2d"),im=ctx.createImageData(data.NX,data.NY);
     for(let j=0;j<data.bp.length;j++){const d=20*Math.log10(Math.max(1e-30,data.bp[j])/Math.max(peak,1e-30)),pix=Math.round(255*Math.max(0,Math.min(1,(d+38)/38))**.86),k=j*4;im.data[k]=im.data[k+1]=im.data[k+2]=pix;im.data[k+3]=255}
     ctx.putImageData(im,0,0);
     const box=document.createElement("div"),heading=document.createElement("strong"),note=document.createElement("small");
     heading.textContent=label;note.textContent="驻留 "+p.localDwell.toFixed(2)+"s · "+n+" 孔径样本 · 像素约0.95m";
     box.append(heading,canvas,note);out.appendChild(box);
     info.textContent="已计算 "+out.children.length+" / 3 个模式点目标（统一相位基准与接收机参数）";
   }
   info.textContent="已完成三模式标准点目标：实际复数 IQ → ADC → 匹配滤波 → BP。Spotlight 理想指向无波束衰减、ScanSAR 以1/3驻留和减少孔径样本近似；三种模式按相近等效孔径采样率设置 64/192/21 个采样点；112像素成像网格不能分辨亚米主瓣，不等同真实完整模式处理。";
 }catch(e){info.textContent="对比计算失败："+e.message;console.error(e)}
 finally{btn.disabled=false}
}
E("sarPointRun").addEventListener("click",runPointComparison);

window.sarScan={state,change,mode:()=>mode,total,coverage,play:v=>{playing=v;last=0},time:()=>t};
E("missionControls")?.addEventListener("input",()=>stats());controls();stats();requestAnimationFrame(function tick(){draw();requestAnimationFrame(tick)});
})();