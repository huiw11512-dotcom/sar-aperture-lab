/* SAR & ISAR Atlas — visual-first teaching module, distinct from full multi-mode SAR processing */
(function(){
"use strict";
var host=document.getElementById("radarAtlas");if(!host||host.dataset.ready)return;host.dataset.ready="1";
var C=299792458,PI=Math.PI,TWO=PI*2,$=id=>document.getElementById(id);
var state={B:150,L:80,rot:6,cat:"geometry",sel:"stripmap"},nP=48;
var cats=[
["geometry","观测与扫描方式",[
["stripmap","Stripmap 条带式","平台直线运动，波束固定侧视","连续地形测绘、海岸线、国土普查","已有三维任务动画 + 局部 BP"],
["spotlight","Spotlight 聚束式","波束指向同一地面区域，增大有效孔径","小范围建筑、重点区域高分辨率成像","已有几何动画 + 简化点目标"],
["sliding","Sliding Spotlight","波束旋转中心缓慢沿地面移动","覆盖与分辨率折中","原理示意"],
["scansar","ScanSAR","多距离子带突发轮流照射","广域海冰、洪水、海洋调查","已有几何动画 + 简化点目标"],
["tops","TOPS","方位向连续波束扫描配合突发子带","大幅宽重访、干涉监测","原理示意"],
["circular","Circular SAR","绕目标做圆弧或环绕观测","多角度散射与高精度目标研究","原理示意"],
["mosaic","多航线拼接","平行航迹逐条覆盖，转弯不采集","大范围航测、区域镶嵌","已有多航线动画"]
]],
["motion","目标运动成像",[
["isar","ISAR 逆合成孔径","目标相对旋转产生合成孔径","船舶、转弯航空器的散射结构成像","本模块可运行复数相干点目标实验"],
["gmti","SAR-GMTI","使用多通道或多普勒信息发现运动目标","交通流与海上运动体监测","原理示意"]
]],
["measurement","测量维度与系统结构",[
["insar","InSAR 干涉","两幅相容复数 SAR 数据取干涉相位","高程、地表位移","原理示意"],
["dinsar","DInSAR 差分干涉","多个时相消除或减弱地形相位","沉降、滑坡、震后形变","原理示意"],
["polsar","PolSAR 全极化","HH / HV / VH / VV 复数散射矩阵","植被与地物分类","原理示意"],
["tomo","TomoSAR 层析","多条垂直基线分离高度维散射","森林垂直结构、城市高程","原理示意"],
["bistatic","双站 / 多站 SAR","发射和接收分置、组合多视角","多角度观测与散射机理研究","原理示意"]
]]];
host.innerHTML='<style>'+
'#radarAtlas{font:13px/1.5 system-ui,"Microsoft YaHei",sans-serif;color:#294852}#radarAtlas *{box-sizing:border-box}'+
'#radarAtlas .ra-head{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;margin-bottom:12px}#radarAtlas h2{font-size:20px;margin:3px 0}#radarAtlas h3{font-size:15px;margin:0 0 6px}#radarAtlas p{margin:6px 0;color:#607985;font-size:11px}'+
'#radarAtlas .ra-tag{font-size:10px;color:#a95733;letter-spacing:1px;font-weight:bold}#radarAtlas .ra-controls{display:flex;flex-wrap:wrap;align-items:end;gap:12px;border:1px solid #d5e1e2;background:#f2f6f7;padding:12px}'+
'#radarAtlas .ra-controls label{min-width:135px;flex:1;display:grid;gap:4px;font-size:11px;color:#577480}#radarAtlas .ra-controls label b{color:#21596b}#radarAtlas input{accent-color:#d17f51}#radarAtlas input[type=range]{width:100%}'+
'#radarAtlas button{cursor:pointer;font-family:inherit}#radarAtlas .ra-primary{padding:10px 13px;background:#c66b3c;border:0;color:white;font-size:12px;font-weight:bold;border-radius:3px}'+
'#radarAtlas .ra-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}#radarAtlas .ra-metrics>div{border:1px solid #dce6e8;padding:10px}#radarAtlas .ra-metrics small{display:block;font-size:10px;color:#64818c}#radarAtlas .ra-metrics b{font-size:17px;color:#244f5e}'+
'#radarAtlas .ra-pair{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:10px 0}#radarAtlas .ra-case{min-width:0;border:1px solid #d8e4e6}#radarAtlas .ra-case header{display:flex;justify-content:space-between;gap:6px;padding:10px 12px}#radarAtlas .ra-case header strong{font-size:16px}#radarAtlas .ra-case header small{font-size:10px;color:#637b84}'+
'#radarAtlas .ra-scene{width:100%;height:200px;background:#0c2432;display:block}#radarAtlas .ra-img{width:100%;height:290px;display:block;background:#0c2432}#radarAtlas .ra-caption{display:flex;justify-content:space-between;gap:8px;padding:9px 12px;font-size:10px;color:#4c6e78}'+
'#radarAtlas .ra-modes{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}#radarAtlas .ra-modes button{background:white;border:1px solid #cbdadd;color:#416573;font-size:11px;font-weight:bold;padding:8px 10px;border-radius:3px}#radarAtlas button[aria-pressed=true]{background:#285567;color:white;border-color:#285567}'+
'#radarAtlas .ra-options{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}#radarAtlas .ra-options button{background:#f9fbfb;border:1px solid #d0dfe2;text-align:left;padding:11px;color:#395765;min-height:90px}#radarAtlas .ra-options button[aria-pressed=true]{background:#fff5ea;border:2px solid #d58755;color:#7a492b;padding:10px}#radarAtlas .ra-options b{display:block;font-size:12px}#radarAtlas .ra-options small{display:block;color:#708b94;font-size:10px;margin-top:4px}'+
'#radarAtlas .ra-detail{display:grid;grid-template-columns:1fr 1fr;gap:12px;background:#f1f6f7;border:1px solid #d2e0e4;margin-top:10px;padding:12px}#radarAtlas .ra-detail canvas{display:block;width:100%;height:170px;background:#122b3a}#radarAtlas .ra-tip{font-size:11px;color:#617d87;line-height:1.7;margin:12px 0}'+
'@media(max-width:800px){#radarAtlas .ra-options{grid-template-columns:1fr 1fr}}@media(max-width:620px){#radarAtlas .ra-pair,#radarAtlas .ra-detail{grid-template-columns:1fr}#radarAtlas .ra-metrics{grid-template-columns:1fr 1fr}}'+
'</style>'+
'<div class="ra-head"><div><span class="ra-tag">RADAR ATLAS · INTERACTIVE</span><h2>SAR 与 ISAR · 合成孔径技术图谱</h2><p>先看两种孔径来源，再按观测方式、目标运动和测量维度探索各种技术；演示与实际计算分别标注。</p></div><span class="ra-tag">9.6 GHz · 复数距离像 · 相干反投影</span></div>'+
'<div class="ra-controls"><label>信号带宽 <b id="ra-Bval"></b><input id="ra-B" type="range" min="75" max="300" step="25" value="150"></label><label>SAR 孔径长度 <b id="ra-Lval"></b><input id="ra-L" type="range" min="20" max="160" step="20" value="80"></label><label>ISAR 相对转角 <b id="ra-Aval"></b><input id="ra-A" type="range" min="1" max="12" step="1" value="6"></label><button class="ra-primary" id="ra-run">重新生成两种回波与成像</button></div>'+
'<div class="ra-metrics"><div><small>斜距理论分辨率</small><b id="ra-res"></b></div><div><small>SAR 相对孔径角</small><b id="ra-angle"></b></div><div><small>ISAR 横向理论分辨率</small><b id="ra-cross"></b></div><div><small>计算采样</small><b>48 × 128</b></div></div>'+
'<div class="ra-pair"><article class="ra-case"><header><strong>01 / SAR</strong><small>平台运动、地物静止</small></header><canvas class="ra-scene" id="ra-sar-geo"></canvas><canvas class="ra-img" id="ra-sar-img"></canvas><div class="ra-caption"><b>复数距离像 → SAR 相干 BP</b><span id="ra-sar-note">待计算</span></div></article><article class="ra-case"><header><strong>02 / ISAR</strong><small>雷达固定、目标相对旋转</small></header><canvas class="ra-scene" id="ra-isar-geo"></canvas><canvas class="ra-img" id="ra-isar-img"></canvas><div class="ra-caption"><b>复数距离像 → ISAR 相干 BP</b><span id="ra-isar-note">待计算</span></div></article></div>'+
'<p id="ra-status">复数雷达模型正在初始化…</p><h3>全部雷达方式：三个不同维度，允许合理组合</h3><div id="ra-cats" class="ra-modes"></div><div id="ra-options" class="ra-options"></div><div class="ra-detail"><div><h3 id="ra-name"></h3><p id="ra-description"></p><p><b>典型应用：</b><span id="ra-use"></span></p><p><b>实现程度：</b><span id="ra-status-mode"></span></p><p id="ra-limits"></p></div><canvas id="ra-diagram"></canvas></div>'+
'<p class="ra-tip">例如 Stripmap + PolSAR 和 Stripmap + InSAR 可在数据条件允许时组合；TOPS / ScanSAR 干涉还需要匹配突发采集。ISAR 实际处理还涉及平动补偿、旋转估计与自聚焦，本模块用已知目标转角进行受控仿真。<a target="_blank" rel="noopener" href="https://science.nasa.gov/mission/nisar/get-to-know-sar/">NASA SAR</a> · <a target="_blank" rel="noopener" href="https://appliedsciences.nasa.gov/sites/default/files/2024-12/SAR_Part2_QandA.pdf">NASA InSAR</a> · <a target="_blank" rel="noopener" href="https://eo4society.esa.int/training_uploads/seasar2023/SeaSAR23_Theme_7_Applications.pdf">ESA ISAR</a></p>';
var pSAR=[[-9,-10,1.2,0],[-2,-10,1,.8],[7,-8,1.4,1.4],[8,-1,1,.3],[10,8,1.6,1],[-9,6,1.1,2],[-1,0,2.5,.7],[0,13,.8,2.1]];
var pISAR=[[-12,0,1.2,0],[-8,2,1,.6],[-3,-2,1.5,1.8],[4,-2,1.1,1.2],[12,0,1.7,.8],[-6,0,.8,2],[0,0,2.2,.1],[8,1,.9,1.4]];
function path(mode,k,X,Y){if(mode==="sar"){let px=(k/47-.5)*state.L;return Math.hypot(X-px,Y+1300,820)}
 let a=(k/47-.5)*state.rot*PI/180,x=X*Math.cos(a)-Y*Math.sin(a),y=X*Math.sin(a)+Y*Math.cos(a);return Math.hypot(x,y+1700)}
function sinc(z){return Math.abs(z)<1e-9?1:Math.sin(PI*z)/(PI*z)}
function synth(mode){
 var pts=mode==="sar"?pSAR:pISAR,N=128,P=48,dr=C/(2*state.B*1e6),lambda=C/9.6e9,ref=mode==="sar"?Math.hypot(1300,820):1700,min=-46;
 var re=new Float64Array(P*N),im=new Float64Array(P*N),seed=mode==="sar"?11258:40921;
 function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
 for(let k=0;k<P;k++)for(let b=0;b<N;b++){var r=min+b*dr,u=(rand()-.5)*.05,v=(rand()-.5)*.05;
 for(let pt of pts){var R=path(mode,k,pt[0],pt[1])-ref,am=pt[2]*sinc((R-r)/dr),ph=-4*PI*R/lambda+pt[3];u+=am*Math.cos(ph);v+=am*Math.sin(ph)}
 re[k*N+b]=u;im[k*N+b]=v}
 return {re,im,N,P,dr,lambda,ref,min}
}
function bp(mode,z){var N=88,out=new Float32Array(N*N),peak=0;
 for(let iy=0;iy<N;iy++)for(let ix=0;ix<N;ix++){var X=(ix/(N-1)-.5)*34,Y=(iy/(N-1)-.5)*34,a=0,b=0;
 for(let k=0;k<z.P;k++){var R=path(mode,k,X,Y)-z.ref,t=(R-z.min)/z.dr,j=Math.floor(t);if(j<0||j>=z.N-1)continue;
 var q=k*z.N+j,w=t-j,rr=z.re[q]*(1-w)+z.re[q+1]*w,ii=z.im[q]*(1-w)+z.im[q+1]*w,ph=4*PI*R/z.lambda,c=Math.cos(ph),s=Math.sin(ph);a+=rr*c-ii*s;b+=rr*s+ii*c}
 var m=Math.hypot(a,b),pos=(N-1-iy)*N+ix;out[pos]=m;peak=Math.max(peak,m)}
 return {out,N,peak}
}
function canvas(id,w,h){var e=$(id),ctx=e.getContext("2d"),dpr=Math.min(devicePixelRatio||1,2);e.width=w*dpr;e.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);return ctx}
function drawImage(mode,result){var id=mode==="sar"?"ra-sar-img":"ra-isar-img",e=$(id),w=Math.max(330,Math.round(e.getBoundingClientRect().width||480)),h=300,c=canvas(id,w,h);
 c.fillStyle="#092432";c.fillRect(0,0,w,h);var side=Math.min(h-29,w-70),tile=document.createElement("canvas");tile.width=tile.height=result.N;
 var x=tile.getContext("2d"),data=x.createImageData(result.N,result.N);
 for(let i=0;i<result.out.length;i++){var d=20*Math.log10(Math.max(result.out[i],1e-6)/Math.max(result.peak,1e-6)),v=Math.max(0,Math.min(1,(d+38)/38)),j=i*4;
 data.data[j]=Math.round(13+238*v);data.data[j+1]=Math.round(38+207*v);data.data[j+2]=Math.round(58+185*v);data.data[j+3]=255}
 x.putImageData(data,0,0);c.imageSmoothingEnabled=false;c.drawImage(tile,(w-side)/2,8,side,side);c.fillStyle="#a7c1cb";c.font="11px system-ui";c.fillText("幅度 −38…0 dB",10,16);c.fillText("横向 ← 目标 →",w/2-38,h-5)}
function updateNumbers(){state.B=+$("ra-B").value;state.L=+$("ra-L").value;state.rot=+$("ra-A").value;
 $("ra-Bval").textContent=state.B+" MHz";$("ra-Lval").textContent=state.L+" m";$("ra-Aval").textContent=state.rot+"°";
 $("ra-res").textContent=(C/(2*state.B*1e6)).toFixed(2)+" m";$("ra-angle").textContent=(state.L/Math.hypot(1300,820)*180/PI).toFixed(2)+"°";$("ra-cross").textContent=(C/9.6e9/(2*state.rot*PI/180)).toFixed(2)+" m"}
function run(){var t=performance.now();$("ra-status").textContent="正在计算两套复数距离像和相干反投影…";
 for(let m of ["sar","isar"]){var result=bp(m,synth(m));drawImage(m,result);$(m==="sar"?"ra-sar-note":"ra-isar-note").textContent="48 孔径点 · 88² 像素"}
 $("ra-status").textContent="计算完成（"+Math.round(performance.now()-t)+" ms）：两套 48×128 复数距离像、相位补偿及 BP 成像。此为受控点散射场景，并非真实遥感影像或未知运动 ISAR。"}
function plot(id,t){var c=canvas(id,600,215);c.fillStyle="#102a39";c.fillRect(0,0,600,215);c.strokeStyle="#345565";c.setLineDash([4,5]);c.beginPath();c.moveTo(35,50);c.lineTo(555,50);c.stroke();c.setLineDash([]);
 if(id==="ra-sar-geo"){var x=65+465*t;c.fillStyle="#efb66d";c.beginPath();c.moveTo(x+18,49);c.lineTo(x-18,37);c.lineTo(x-5,50);c.lineTo(x-18,62);c.closePath();c.fill();
 c.fillStyle="#f6b7772c";c.beginPath();c.moveTo(x,55);c.lineTo(x-62,169);c.lineTo(x+62,169);c.fill();
 c.fillStyle="#79aa9e";c.fillRect(20,169,555,12);for(let z of [130,205,311,398,486]){c.fillStyle="#77cedc";c.fillRect(z,155,13,14)}
 c.fillStyle="#e3f0f1";c.font="bold 13px system-ui";c.fillText("平台沿轨道移动 →",370,24);c.fillText("固定地面散射体",374,203);
 }else{c.fillStyle="#eeb776";c.fillRect(61,106,12,18);c.beginPath();c.arc(67,103,18,0,TWO);c.strokeStyle="#eeb776";c.stroke();
 c.save();c.translate(393,110);c.rotate((t-.5)*state.rot*PI/180*7);c.fillStyle="#72a4b0";c.beginPath();c.moveTo(-119,0);c.lineTo(-82,-24);c.lineTo(87,-24);c.lineTo(113,0);c.lineTo(87,26);c.lineTo(-82,26);c.closePath();c.fill();
 c.fillStyle="#e0eff2";for(let x of [-75,-36,7,50])c.fillRect(x,-12,12,10);c.restore();
 c.strokeStyle="#e8b576";c.setLineDash([4,4]);c.beginPath();c.moveTo(88,110);c.lineTo(265,110);c.stroke();c.setLineDash([]);c.fillStyle="#e0eff2";c.font="bold 13px system-ui";c.fillText("固定参考雷达",24,81);c.fillText("船体相对转动 ↻",347,198)}
}
function diagram(){var c=canvas("ra-diagram",520,170);c.fillStyle="#102b39";c.fillRect(0,0,520,170);var m=state.sel;
 function circle(x,y,r,col){c.beginPath();c.arc(x,y,r,0,TWO);c.fillStyle=col;c.fill()}
 function text(s,x,y){c.fillStyle="#e4f0ee";c.font="bold 13px system-ui";c.fillText(s,x,y)}
 if(["insar","dinsar","tomo"].includes(m)){circle(90,57,22,"#ecb977");circle(220,57,22,"#e4cb99");text("多基线 / 多时相复数相位",115,24);text(m==="tomo"?"高度层析反演":"相位差 → 高程 / 位移",290,130);circle(262,118,29,"#6ebaaa")}
 else if(m==="polsar"){["HH","HV","VH","VV"].forEach((k,i)=>{circle(75+i*123,88,36,["#d3a270","#60a8c0","#76bfa1","#b5a2cf"][i]);text(k,63+i*123,94)})}
 else{circle(121,60,33,"#d4a26b");circle(380,114,47,"#6ab1c7");text(["isar","gmti"].includes(m)?"目标运动":"平台运动",83,65);text(["isar","gmti"].includes(m)?"目标的距离 / 多普勒":"形成合成孔径 / 多条带",310,120);c.strokeStyle="#f4c38b";c.lineWidth=2;c.beginPath();c.moveTo(155,76);c.lineTo(319,105);c.stroke()}
}
function options(){var group=cats.find(x=>x[0]===state.cat);
 $("ra-cats").innerHTML=cats.map(x=>'<button data-cat="'+x[0]+'" aria-pressed="'+(x[0]===state.cat)+'">'+x[1]+'</button>').join("");
 $("ra-options").innerHTML=group[2].map(x=>'<button data-tech="'+x[0]+'" aria-pressed="'+(x[0]===state.sel)+'"><b>'+x[1]+'</b><small>'+x[2]+'</small></button>').join("");
 $("ra-cats").querySelectorAll("button").forEach(b=>b.onclick=()=>{state.cat=b.dataset.cat;state.sel=cats.find(x=>x[0]===state.cat)[2][0][0];options()});
 $("ra-options").querySelectorAll("button").forEach(b=>b.onclick=()=>{state.sel=b.dataset.tech;options()});
 var m=group[2].find(x=>x[0]===state.sel);$("ra-name").textContent=m[1];$("ra-description").textContent=m[2];$("ra-use").textContent=m[3];$("ra-status-mode").textContent=m[4];
 $("ra-limits").textContent=state.sel==="isar"?"此处旋转角已知；实际非合作船舶目标还需要运动补偿、自聚焦。":state.cat==="measurement"?"此处仅为结构概念，不将亮度灰度图冒充极化分解或干涉相位结果。":"模式对比中的完整成像需对应真实波束方向图与孔径数据，当前网页已实现的级别如上所示。";diagram()}
["ra-B","ra-L","ra-A"].forEach(id=>$(id).oninput=updateNumbers);$("ra-run").onclick=()=>{updateNumbers();setTimeout(run,20)};options();updateNumbers();
var ani=0,last=0;requestAnimationFrame(function frame(t){if(!host.isConnected)return;if(t-last>65){last=t;ani=(ani+.008)%1;plot("ra-sar-geo",ani);plot("ra-isar-geo",ani)}requestAnimationFrame(frame)});
setTimeout(run,50);
})();