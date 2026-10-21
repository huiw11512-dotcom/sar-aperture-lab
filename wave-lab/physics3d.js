/* Wave Lab 3D: independent, low-power, ideal rectangular-aperture propagation.
   Units: m, Hz, W, peak E (V/m), H (A/m). No finite-aperture near field. */
(function(root){
  "use strict";
  const C=299792458, Z0=376.730313668, TWO=2*Math.PI;
  const clamp=(a,lo,hi)=>Math.max(lo,Math.min(hi,a));
  const sinc=x=>Math.abs(x)<1e-10?1:Math.sin(x)/x;
  const AXES=["x","y","z"];
  const NAMES=["erx","eix","ery","eiy","erz","eiz","hrx","hix","hry","hiy","hrz","hiz"];
  function frame(src,target){
    let nx=target.x-src.x,ny=target.y-src.y,nz=target.z-src.z;
    let r=Math.hypot(nx,ny,nz);
    if(r<1e-8){ nx=0;ny=0;nz=1;r=1; }
    nx/=r;ny/=r;nz/=r;
    let ux,uy,uz,vx,vy,vz;
    if(nz>-0.9999){
      const d=1+nz;
      ux=1-nx*nx/d;uy=-nx*ny/d;uz=-nx;
      vx=-nx*ny/d;vy=1-ny*ny/d;vz=-ny;
    }else{
      ux=1;uy=0;uz=0;vx=0;vy=-1;vz=0;
    }
    return {nx,ny,nz,ux,uy,uz,vx,vy,vz};
  }
  function planePoint(p,axis,u,v){
    const cx=p.centerX||0,cy=p.centerY||0;
    if(axis==="x") return {x:p.cuts.x,y:cy+(u-.5)*p.Ly,z:p.zMin+(1-v)*p.Lz};
    if(axis==="y") return {x:cx+(u-.5)*p.Lx,y:p.cuts.y,z:p.zMin+(1-v)*p.Lz};
    return {x:cx+(u-.5)*p.Lx,y:cy+(.5-v)*p.Ly,z:p.cuts.z};
  }
  function ranges(p,axis){
    if(axis==="x")return {hMin:(p.centerY||0)-p.Ly/2,hMax:(p.centerY||0)+p.Ly/2,vMin:p.zMin,vMax:p.zMin+p.Lz,hName:"y",vName:"z",constant:"x"};
    if(axis==="y")return {hMin:(p.centerX||0)-p.Lx/2,hMax:(p.centerX||0)+p.Lx/2,vMin:p.zMin,vMax:p.zMin+p.Lz,hName:"x",vName:"z",constant:"y"};
    return {hMin:(p.centerX||0)-p.Lx/2,hMax:(p.centerX||0)+p.Lx/2,vMin:(p.centerY||0)-p.Ly/2,vMax:(p.centerY||0)+p.Ly/2,hName:"x",vName:"y",constant:"z"};
  }
  function localPoint(p,axis,x,y){
    const r=ranges(p,axis),u=(x-r.hMin)/(r.hMax-r.hMin),v=(r.vMax-y)/(r.vMax-r.vMin);
    return planePoint(p,axis,u,v);
  }
  function projectPoint(p,axis,world){
    const r=ranges(p,axis),h=world[r.hName],v=world[r.vName];
    return {u:(h-r.hMin)/(r.hMax-r.hMin),v:(r.vMax-v)/(r.vMax-r.vMin),dist:Math.abs(world[axis]-p.cuts[axis])};
  }
  function prepared(p){
    const lambda=C/(p.freq*1e9),k=TWO/lambda;
    const maxD=lambda*Math.hypot(p.apX,p.apY);
    const far=2*maxD*maxD/lambda;
    const gain=4*Math.PI*p.eta*p.apX*p.apY;
    return {lambda,k,far,gain,nodes:p.nodes.map(s=>({src:s,axes:frame(s,p.target)}))};
  }
  function zero(){
    return {erx:0,eix:0,ery:0,eiy:0,erz:0,eiz:0,hrx:0,hix:0,hry:0,hiy:0,hrz:0,hiz:0};
  }
  function add(acc,xyz,node,p,pc){
    const s=node.src,f=node.axes;
    if(!(s.power>0))return;
    const px=xyz.x-s.x,py=xyz.y-s.y,pz=xyz.z-s.z;
    const R=Math.hypot(px,py,pz);
    if(R<Math.max(pc.far,0.01))return; // model invalid in the local element near field
    const dx=px/R,dy=py/R,dz=pz/R;
    const dir=dx*f.nx+dy*f.ny+dz*f.nz;
    if(dir<=0)return;  // forward-hemisphere model only
    const u=dx*f.ux+dy*f.uy+dz*f.uz, v=dx*f.vx+dy*f.vy+dz*f.vz;
    const pat=sinc(Math.PI*p.apX*u)*sinc(Math.PI*p.apY*v)*(1+dir)*0.5;
    const amp=Math.sqrt(2*Z0*s.power*pc.gain/(4*Math.PI*R*R))*pat;
    const dot=f.ux*dx+f.uy*dy+f.uz*dz;
    let ex=f.ux-dot*dx,ey=f.uy-dot*dy,ez=f.uz-dot*dz;
    const pm=Math.hypot(ex,ey,ez);
    if(pm<1e-8)return;
    ex=amp*ex/pm;ey=amp*ey/pm;ez=amp*ez/pm;
    const hx=(dy*ez-dz*ey)/Z0,hy=(dz*ex-dx*ez)/Z0,hz=(dx*ey-dy*ex)/Z0;
    const phase=(pc.k*R+s.phase*Math.PI/180)%TWO,co=Math.cos(phase),si=Math.sin(phase);
    acc.erx+=ex*co;acc.eix+=ex*si;
    acc.ery+=ey*co;acc.eiy+=ey*si;
    acc.erz+=ez*co;acc.eiz+=ez*si;
    acc.hrx+=hx*co;acc.hix+=hx*si;
    acc.hry+=hy*co;acc.hiy+=hy*si;
    acc.hrz+=hz*co;acc.hiz+=hz*si;
  }
  function fieldAtAimed(p,xyz,aimTarget,only){
    const aimed={...p,target:aimTarget||p.target},pc=prepared(aimed),acc=zero();
    for(let i=0;i<pc.nodes.length;i++)if(only===undefined||only===i)add(acc,xyz,pc.nodes[i],aimed,pc);
    return acc;
  }
  function fieldAt(p,xyz,only){ return fieldAtAimed(p,xyz,p.target,only); }
  function instantaneous(a,t){
    const c=Math.cos(TWO*t),s=Math.sin(TWO*t);
    const ex=a.erx*c+a.eix*s,ey=a.ery*c+a.eiy*s,ez=a.erz*c+a.eiz*s;
    const hx=a.hrx*c+a.hix*s,hy=a.hry*c+a.hiy*s,hz=a.hrz*c+a.hiz*s;
    const sx=(ey*hz-ez*hy)/1e4,sy=(ez*hx-ex*hz)/1e4,sz=(ex*hy-ey*hx)/1e4;
    return {ex,ey,ez,hx,hy,hz,E:Math.hypot(ex,ey,ez),S:Math.hypot(sx,sy,sz),sx,sy,sz};
  }
  function compute(p,n,axes=AXES){
    const pc=prepared(p);
    const output={n,lambda:pc.lambda,far:pc.far,axes:{},stats:{cells:0}};
    for(const axis of axes){
      const f={};for(const name of NAMES)f[name]=new Float32Array(n*n);
      for(let j=0;j<n;j++){
        for(let i=0;i<n;i++){
          const xyz=planePoint(p,axis,(i+.5)/n,(j+.5)/n),a=zero();
          for(const node of pc.nodes)add(a,xyz,node,p,pc);
          const k=j*n+i;for(const name of NAMES)f[name][k]=a[name];
        }
      }
      output.axes[axis]={fields:f};
      output.stats.cells+=n*n;
    }
    return output;
  }
  function viewAt(result,axis,index){
    const f=result.axes[axis].fields,a={};
    for(const name of NAMES)a[name]=f[name][index];
    return a;
  }
  root.Field3D={C,Z0,AXES,NAMES,frame,prepared,planePoint,ranges,localPoint,projectPoint,fieldAt,fieldAtAimed,instantaneous,compute,viewAt,clamp};
})(typeof self!=="undefined"?self:globalThis);
