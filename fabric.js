/* Blue & white: isolated WebGL scenes. Original layouts and editor stay in app.js. */
window.BatikMotion = (() => {
  'use strict';
  const W=1586,H=992,T=window.THREE, sat=x=>Math.max(0,Math.min(1,x)), mix=(a,b,t)=>a+(b-a)*t;
  const smooth=x=>{x=sat(x);return x*x*(3-2*x)}, TAU=Math.PI*2;
  let A, stages={}, ready=false, last=0;
  const matVertex=`varying vec2 vUv;varying vec3 vN;varying vec3 vP;
  void main(){vUv=uv;vN=normalize(normalMatrix*normal);vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
  const matFragment=`uniform sampler2D map;uniform float dye;uniform float wet;uniform float shade;
  varying vec2 vUv;varying vec3 vN;varying vec3 vP;
  void main(){vec4 c=texture2D(map,vUv);if(c.a<.025)discard;
    float white=smoothstep(.32,.77,min(c.r,min(c.g,c.b)));
    vec3 pale=mix(c.rgb,vec3(.39,.54,.64),.42*(1.-white));
    vec3 deep=c.rgb*mix(.63,1.,white);c.rgb=mix(c.rgb,mix(pale,deep,dye),step(0.,dye));
    float light=.86+.14*abs(dot(normalize(vN),normalize(vec3(-.25,.5,1.))));
    c.rgb*=mix(1.,light,shade);c.rgb*=1.-wet*.08*(1.-white);
    float spec=pow(max(0.,dot(normalize(vN),normalize(vec3(.2,.5,1.)))),28.)*wet*.07;
    gl_FragColor=vec4(c.rgb+spec,c.a);
  }`;
  function canvas(w=W,h=H){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
  function texture(source){const t=new T.CanvasTexture(source);t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.anisotropy=4;return t}
  function material(source,opts={}){return new T.ShaderMaterial({uniforms:{map:{value:texture(source)},dye:{value:-1},wet:{value:0},shade:{value:1},...opts},vertexShader:matVertex,fragmentShader:matFragment,transparent:true,side:T.DoubleSide,depthWrite:true})}
  function crop(im,x,y,w,h){const c=canvas(w,h);c.getContext('2d').drawImage(im,x,y,w,h,0,0,w,h);return c}
  function masked(im,d){const c=canvas(),g=c.getContext('2d');g.clip(new Path2D(d));g.drawImage(im,0,0);return c}
  function grid(nx,ny,fn){const geo=new T.BufferGeometry(),p=new Float32Array((nx+1)*(ny+1)*3),uv=new Float32Array((nx+1)*(ny+1)*2),ix=[];
    for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const k=j*(nx+1)+i,u=i/nx,v=j/ny,q=fn(u,v);p.set([q[0]-W/2,H/2-q[1],q[2]||0],k*3);uv.set([u,1-v],k*2);if(i<nx&&j<ny){const a=k,b=k+1,c=k+nx+1,d=c+1;ix.push(a,c,b,b,c,d)}}
    geo.setAttribute('position',new T.BufferAttribute(p,3).setUsage(T.DynamicDrawUsage));geo.setAttribute('uv',new T.BufferAttribute(uv,2));geo.setIndex(ix);geo.computeVertexNormals();geo.userData={nx,ny,rest:p.slice()};return geo;
  }
  function deform(geo,fn){const {nx,ny}=geo.userData,p=geo.attributes.position.array;for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const k=j*(nx+1)+i,q=fn(i/nx,j/ny,k);p[k*3]=q[0]-W/2;p[k*3+1]=H/2-q[1];p[k*3+2]=q[2]||0}geo.attributes.position.needsUpdate=true;geo.computeVertexNormals()}
  class Stage{
    constructor(n,parent){this.n=n;this.renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(1);this.renderer.setSize(W,H,false);this.renderer.setClearColor(0,0);this.renderer.outputColorSpace=T.LinearSRGBColorSpace;
      this.el=this.renderer.domElement;this.el.className='webgl-layer';this.el.setAttribute('aria-hidden','true');parent.insertBefore(this.el,parent.querySelector('.surface'));
      this.scene=new T.Scene();this.camera=n==='flight'?new T.PerspectiveCamera(2*Math.atan(H/3000)*180/Math.PI,W/H,1,6000):new T.OrthographicCamera(-W/2,W/2,H/2,-H/2,1,6000);this.camera.position.z=1500;this.prev=0;
      this.el.addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;A.notice('图形上下文暂时中断，请刷新后重试。')});
    }
    mesh(geo,mat){const m=new T.Mesh(geo,mat);m.frustumCulled=false;this.scene.add(m);return m}
    draw(){this.renderer.render(this.scene,this.camera)}
    visible(on){this.el.hidden=!on}
  }
  /* Position-based constraints keep material edge lengths stable. Goal forces carry
     the sheet; immersion adds drag. No CSS clipping and no moving background image. */
  class FabricSolver{
    constructor(geo){this.geo=geo;this.rest=geo.userData.rest;this.p=this.rest.slice();this.old=this.p.slice();this.links=[];const {nx,ny}=geo.userData;
      const add=(a,b)=>{let d=0;for(let k=0;k<3;k++)d+=(this.rest[a*3+k]-this.rest[b*3+k])**2;this.links.push([a,b,Math.sqrt(d)])};
      for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){let a=j*(nx+1)+i;if(i<nx)add(a,a+1);if(j<ny)add(a,a+nx+1);if(i<nx&&j<ny){add(a,a+nx+2);add(a+1,a+nx+1)}}
      this.depth=0;this.velocity=0;
    }
    step(dt,target,t,water,wet){dt=Math.min(dt,.024);const before=this.depth;this.velocity+=(target-this.depth)*18*dt;this.velocity*=Math.exp(-6.5*dt);this.depth+=this.velocity*dt;
      const p=this.p,old=this.old,r=this.rest,{nx,ny}=this.geo.userData;const feed=this.depth-before;for(let k=1;k<p.length;k+=3){p[k]-=feed;old[k]-=feed}
      for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){let k=(j*(nx+1)+i)*3,s=j/ny,under=H/2-p[k+1]>water,drag=under?.79:(.94-wet*.015),wave=Math.sin(t*1.7+s*5+i*.31)*7*Math.sin(Math.PI*s);
        const goals=[r[k]+wave*(1-wet*.35),r[k+1]-this.depth,r[k+2]+Math.sin(t*1.4+s*7+i*.38)*12*s];
        for(let q=0;q<3;q++){let prev=p[k+q],vel=(prev-old[k+q])*drag;p[k+q]=prev+vel+(goals[q]-prev)*(q===1?35:18)*dt*dt;old[k+q]=prev}
        if(j===0){p[k]=r[k];p[k+1]=r[k+1]-this.depth;p[k+2]=r[k+2];old.set(p.subarray(k,k+3),k)}
      }
      for(let iter=0;iter<5;iter++)for(const [aa,bb,len]of this.links){let a=aa*3,b=bb*3,dx=p[b]-p[a],dy=p[b+1]-p[a+1],dz=p[b+2]-p[a+2],d=Math.hypot(dx,dy,dz)||1,f=(d-len)/d*.46,wa=aa<=nx?0:1,wb=bb<=nx?0:1;
        p[a]+=dx*f*wa;p[a+1]+=dy*f*wa;p[a+2]+=dz*f*wa;p[b]-=dx*f*wb;p[b+1]-=dy*f*wb;p[b+2]-=dz*f*wb;
      }
      this.geo.attributes.position.array.set(p);this.geo.attributes.position.needsUpdate=true;this.geo.computeVertexNormals();return (this.depth-before)/Math.max(dt,.001);
    }
  }
  function foreground(stage,img,y){const geo=grid(1,1,(u,v)=>[u*W,mix(y,H,v),170]);stage.mesh(geo,material(crop(img,0,y,W,H-y),{shade:{value:0}}))}
  function pointAt(profile,y){if(y<=profile[0][0])return profile[0][1];for(let i=1;i<profile.length;i++)if(y<=profile[i][0]){let a=profile[i-1],b=profile[i];return mix(a[1],b[1],(y-a[0])/(b[0]-a[0]))}return profile.at(-1)[1]}
  function dyeXY(u,v){let y=mix(-1100,510+182*u,v);const left=pointAt([[0,735],[140,682],[250,665],[400,618],[510,578],[590,790],[640,1004],[700,1190]],y),right=pointAt([[0,1246],[140,1215],[400,1195],[700,1193]],y);return [mix(left,right,u),y,0]}
  function dyeTexture(){const c=canvas(768,2048),g=c.getContext('2d'),src=A.images[4].getContext('2d').getImageData(0,0,W,H).data,out=g.createImageData(c.width,c.height);
    for(let j=0;j<c.height;j++)for(let i=0;i<c.width;i++){const u=i/(c.width-1),v=j/(c.height-1);let [x,y]=dyeXY(u,v);
      if(y<0){let h=(-y)%1000;h=h>500?1000-h:h;const a=pointAt([[0,735],[140,682],[250,665],[400,618],[510,578]],h),b=pointAt([[0,1246],[140,1215],[400,1195],[700,1193]],h);x=mix(a,b,u);y=h}
      const clearNav=y>18&&y<54&&x>1070;
      const q=(Math.max(0,Math.min(H-1,Math.round(y)))*W+Math.max(0,Math.min(W-1,Math.round(x))))*4,k=(j*c.width+i)*4;out.data.set(src.subarray(q,q+3),k);if(clearNav){const xx=Math.max(0,Math.min(W-1,Math.round(x))),a=(12*W+xx)*4,b=(62*W+xx)*4;const baseline=mix(Math.min(src[a],src[a+1],src[a+2]),Math.min(src[b],src[b+1],src[b+2]),(y-12)/50),light=Math.min(src[q],src[q+1],src[q+2]);if(light>baseline+22)for(let ch=0;ch<3;ch++)out.data[k+ch]=mix(src[a+ch],src[b+ch],(y-12)/50)}out.data[k+3]=255;
    }g.putImageData(out,0,0);return c;
  }
  function initDye(){const s=stages[4]=new Stage(4,A.scenes[4].el),geo=grid(34,104,dyeXY),m=material(dyeTexture());s.cloth=s.mesh(geo,m);s.solver=new FabricSolver(geo);s.ink=0;s.hold=false;s.wet=0;s.flow=0;
    // A depth-tested pool surface hides immersed material; the sheet continues below it.
    const water=grid(32,8,(u,v)=>[mix(500,1370,u),mix(694,790,v),110]);const waterMat=material(crop(A.images.plate4,500,694,870,96),{shade:{value:0}});s.mesh(water,waterMat);foreground(s,A.images.plate4,785);
    s.ripple=water;s.lastDepth=0;const ui=canvas(),ug=ui.getContext('2d');ui.className='webgl-ui';A.scenes[4].el.insertBefore(ui,A.scenes[4].el.querySelector('.surface'));ug.drawImage(ink(A.images[4],[1070,15,470,40]),1070,15);
  }
  function initWax(){const s=stages[5]=new Stage(5,A.scenes[5].el),geo=grid(36,64,(u,v)=>[mix(815,1300,u),mix(85,685,v),0]);
    s.cloth=s.mesh(geo,material(crop(A.sprites.dewax,815,85,485,600),{wet:{value:1}}));s.solver=new FabricSolver(geo);s.solver.depth=450;
    for(let k=1;k<s.solver.p.length;k+=3){s.solver.p[k]-=450;s.solver.old[k]-=450}
    s.pole=s.mesh(grid(1,1,(u,v)=>[mix(1240,1586,u),mix(101,198,v),35]),material(crop(A.sprites.pole,1240,101,346,97),{shade:{value:0}}));
    foreground(s,A.images.plate5,683);s.target=450;s.lift=false;
  }
  function initGallery(){const s=stages[10]=new Stage(10,A.scenes[10].el);s.panels=[];
    const specs=[['M493 0 L559 0 Q662 50 782 91 L775 726 L444 698 Z',[435,0,350,735]],['M909 143 Q1020 180 1134 196 L1141 723 L861 732 Z',[850,140,300,600]],['M1258 204 Q1390 177 1491 136 L1541 695 L1211 721 Z',[1200,130,350,600]]];
    for(const [d,b]of specs){const tex=crop(masked(A.images[10],d),...b),geo=grid(24,180,(u,v)=>[b[0]+u*b[2],b[1]+v*b[3],0]);s.panels.push({geo,b,mesh:s.mesh(geo,material(tex))})}
  }
  function clothTexture(){const c=crop(A.images[8],530,180,520,540),tx=texture(c);tx.wrapS=tx.wrapT=T.MirroredRepeatWrapping;return tx}
  function distanceField(im){const w=256,h=160,c=canvas(w,h),g=c.getContext('2d');g.drawImage(im,0,0,w,h);const pixels=g.getImageData(0,0,w,h),d=new Float32Array(w*h);for(let i=0;i<d.length;i++)d[i]=pixels.data[i*4+3]>70?0:10000;
    for(let j=0;j<h;j++)for(let i=0;i<w;i++){let k=j*w+i;if(i)d[k]=Math.min(d[k],d[k-1]+1);if(j)d[k]=Math.min(d[k],d[k-w]+1);if(i&&j)d[k]=Math.min(d[k],d[k-w-1]+1.414)}
    for(let j=h-1;j>=0;j--)for(let i=w-1;i>=0;i--){let k=j*w+i;if(i<w-1)d[k]=Math.min(d[k],d[k+1]+1);if(j<h-1)d[k]=Math.min(d[k],d[k+w]+1);if(i<w-1&&j<h-1)d[k]=Math.min(d[k],d[k+w+1]+1.414)}
    let max=1;for(let x of d)max=Math.max(max,x);for(let i=0;i<d.length;i++){let v=Math.round(d[i]/max*230);pixels.data.set([v,v,v,255],i*4)}g.putImageData(pixels,0,0);return texture(c);
  }
  function ribbonTexture(){const c=canvas(3072,384),g=c.getContext('2d'),src=A.images[11].getContext('2d').getImageData(0,0,W,H).data,out=g.createImageData(c.width,c.height);
    for(let i=0;i<c.width;i++){let q=i/(c.width-1),a=Math.PI+q*TAU,x=793+630*Math.cos(a),y=435+300*Math.sin(a),dx=-630*Math.sin(a),dy=300*Math.cos(a),len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len,width=250+65*Math.cos(a*2);
      for(let j=0;j<c.height;j++){let off=(j/(c.height-1)-.5)*width,sx=Math.max(0,Math.min(W-1,Math.round(x+nx*off))),sy=Math.max(0,Math.min(H-1,Math.round(y+ny*off))),k=(j*c.width+i)*4,from=(sy*W+sx)*4;out.data.set(src.subarray(from,from+4),k)}}g.putImageData(out,0,0);return texture(c);
  }
  function ribbonPoint(s){if(s>=0){let a=Math.PI+s*TAU;return [793+630*Math.cos(a),435+300*Math.sin(a),45*Math.sin(a*2)]}
    if(s<-.38)return [mix(-1400,133,(s+.38)/.38),655,0];const q=(s+.38)/.38,h00=2*q**3-3*q*q+1,h10=q**3-2*q*q+q,h01=-2*q**3+3*q*q,h11=q**3-q*q;return [h00*(-1400)+h10*1300+h01*163,h00*655+h01*435+h11*(-700),0];
  }
  function initEnding(){const s=stages[11]=new Stage(11,A.scenes[11].el);s.geo=grid(240,20,()=>[0,0,0]);const m=material(A.images[11]);m.uniforms.map.value=ribbonTexture();s.mesh(s.geo,m);const uv=s.geo.attributes.uv.array;for(let j=0;j<=20;j++)for(let i=0;i<=240;i++){let k=(j*241+i)*2;uv[k]=i/240;uv[k+1]=j/20}uv.needsUpdate=true;
  }
  function tick(n,t,age){if(!ready||!stages[n])return;const s=stages[n],dt=Math.min(.032,(t-(s.prev||t-16))/1000);s.prev=t;const seconds=t/1000;
    if(n===4){if(s.hold){s.ink=Math.min(1,s.ink+dt*.13);s.wet=Math.min(1,s.wet+dt*.35)}let target=s.hold?410:0;s.flow=s.solver.step(dt,target,seconds,695,s.wet);s.cloth.material.uniforms.dye.value=s.ink;s.cloth.material.uniforms.wet.value=s.wet;
      deform(s.ripple,(u,v)=>[mix(500,1370,u),mix(694,790,v)+Math.sin(u*30-seconds*3)*Math.sin(v*Math.PI)*1.4,110]);
      const phase=s.hold?'浸染中':s.solver.depth>4?'正在提起':'已提起';A.scenes[4].el.dataset.dyeState=phase;A.scenes[4].el.dataset.depth=s.solver.depth.toFixed(1);A.scenes[4].el.dataset.ink=s.ink.toFixed(3);A.onDye?.(s.ink,phase,s.solver.depth,s.flow);
    }
    if(n===5){s.solver.step(dt,s.target,seconds,680,1);s.pole.position.y=-s.solver.depth;const d=s.solver.depth;A.pole.style.top=((101+d)/H*100)+'%';A.scenes[5].el.dataset.lift=(1-d/450).toFixed(3);A.onWax?.(d,s.solver.velocity)}
    if(n===10){let complete=true;s.panels.forEach((panel,i)=>{let p=smooth((age/1000-i*.24)/2.6);if(p<1)complete=false;const b=panel.b,L=b[3],released=p*L,R=18*(1-p)+1;
      deform(panel.geo,(u,v)=>{let l=v*L,y=l,z=0;if(l>released){let a=(l-released)/R,r=R+a*.22;y=released+Math.sin(a)*r;z=R-Math.cos(a)*r}else{z=Math.sin(u*8+seconds)*Math.sin(v*Math.PI)*5*(1-p)}return [b[0]+u*b[2],b[1]+y,z]});panel.mesh.material.uniforms.shade.value=1-p;
    });s.visible(!complete);A.scenes[10].el.dataset.unfurled=String(complete)}
    if(n===11){const p=mix(-.18,1,smooth(age/3600));deform(s.geo,(u,v)=>{const along=p-1+u,c=ribbonPoint(along),b=ribbonPoint(along+.0005),dx=b[0]-c[0],dy=b[1]-c[1],len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
      const a=Math.PI+along*TAU,twist=.58*Math.sin(a*2)+.12*Math.sin(a*3+seconds*.55),width=250+65*Math.cos(a*2),off=(v-.5)*width,breathe=(age>3600?1:0)*Math.sin(a*3+seconds*.7)*3;
      return [c[0]+nx*off*Math.cos(twist)+breathe,c[1]+ny*off*Math.cos(twist),c[2]+off*Math.sin(twist)+Math.sin(v*Math.PI*5+u*TAU*3+seconds*.7)*9*Math.sin(v*Math.PI)];});A.scenes[11].el.dataset.formed=String(p>=1);
    }s.draw();
  }
  function ink(im,rect,dark=false){const c=crop(im,...rect),g=c.getContext('2d'),p=g.getImageData(0,0,c.width,c.height);for(let k=0;k<p.data.length;k+=4){const d=p.data,light=Math.min(d[k],d[k+1],d[k+2]);d[k+3]=Math.round(255*(dark?1-smooth((Math.max(d[k],d[k+1],d[k+2])-50)/100):smooth((light-130)/90)))}g.putImageData(p,0,0);return c}
  let ui1=[],ui2=[],endUI=[];
  function setupUI(){const r1=[[65,178,485,220],[65,426,465,34],[65,490,165,100],[0,0,W,84],[710,875,175,68]];ui1=r1.map(r=>({r,im:ink(A.images[1],r)}));
    const r2=[[75,165,590,140],[80,326,460,36],[83,399,215,58],[0,0,W,85],[20,794,1060,145]];ui2=r2.map((r,i)=>({r,im:crop(A.images[2],...r)}));
    const re=[[591,240,440,220],[612,510,410,40],[591,574,188,51],[807,574,190,51],[0,870,W,122],[0,0,W,85]];endUI=re.map((r,i)=>({r,im:i<2||i===5?ink(A.images[11],r):crop(A.images[11],...r)}));
    // Thin lettering needs its own matte; the full header also contains fabric.
    for(const i of [1,5]){const r=re[i],c=canvas(r[2],r[3]),g=c.getContext('2d');g.drawImage(A.images[11],...r,0,0,r[2],r[3]);const p=g.getImageData(0,0,c.width,c.height),d=p.data;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const k=(y*c.width+x)*4,allowed=i===1||x<285||(x>1070&&x<1485);const lum=Math.min(d[k],d[k+1],d[k+2]);d[k+3]=allowed?Math.round(255*smooth((lum-45)/110)):0;d[k]=239;d[k+1]=226;d[k+2]=205}g.putImageData(p,0,0);endUI[i].im=c}
  }
  function drawEnding(g,age){const gr=g.createRadialGradient(800,410,30,800,410,1000);gr.addColorStop(0,'#122e44');gr.addColorStop(1,'#03131e');g.fillStyle=gr;g.fillRect(0,0,W,H);
    const delays=[3500,3900,4110,4250,4480,450];endUI.forEach(({r,im},i)=>{const p=smooth((age-delays[i])/(i===0?1100:700));if(!p)return;g.save();g.globalAlpha=p;if(i===0)g.filter=`blur(${(1-p)*12}px)`;g.drawImage(im,r[0],r[1]+(i<2?(1-p)*8:0));g.restore()});A.scenes[11].el.classList.toggle('motion-blocked',age<4800);
  }
  function secondBoundary(u){return {top:pointAt([[0,600],[.2,580],[.4,550],[.55,405],[.7,265],[.82,145],[.91,105],[1,0]],u),bottom:pointAt([[0,720],[.3,764],[.65,805],[.85,880],[1,992]],u)}}
  let flightStage=null,flightClock={s:0},flightTimeline=null;
  async function flight(){if(!ready)return false;const layer=document.querySelector('#flight'),bg=layer.querySelector('canvas'),g=bg.getContext('2d');layer.hidden=false;bg.style.top='0';
    if(!flightStage){flightStage=new Stage('flight',layer);const geo=grid(100,70,(u,v)=>[u*W,v*H,0]);const uv2=new Float32Array(geo.attributes.uv.array.length);for(let j=0;j<=70;j++)for(let i=0;i<=100;i++){const u=i/100,v=j/70,b=secondBoundary(u),k=(j*101+i)*2;uv2[k]=u;uv2[k+1]=1-mix(b.top,b.bottom,v)/H}geo.setAttribute('targetUV',new T.BufferAttribute(uv2,2));
      const mat=new T.ShaderMaterial({uniforms:{bird:{value:texture(A.sprites.bird)},cloth:{value:clothTexture()},destination:{value:texture(A.images[2])},morph:{value:0},land:{value:0},time:{value:0},distanceField:{value:distanceField(A.sprites.bird)}},vertexShader:`attribute vec2 targetUV;varying vec2 vUv;varying vec2 vTarget;varying vec3 vN;void main(){vUv=uv;vTarget=targetUV;vN=normalMatrix*normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform sampler2D bird,cloth,destination,distanceField;uniform float morph,land,time;varying vec2 vUv,vTarget;varying vec3 vN;void main(){vec4 a=texture2D(bird,vUv);vec4 fabric=texture2D(destination,vTarget);vec4 b=texture2D(destination,vTarget);float grow=smoothstep(.1,.9,morph);float distance=texture2D(distanceField,vUv).r;float edge=max(a.a,1.-smoothstep(grow*.91-.004,grow*.91+.004,distance));if(edge<.02)discard;vec3 c=mix(a.a>.1?a.rgb:fabric.rgb,fabric.rgb,grow);float shade=.85+.15*abs(normalize(vN).z);gl_FragColor=vec4(c*mix(shade,1.,land),edge);}`,transparent:true,side:T.DoubleSide});flightStage.mesh=flightStage.mesh(geo,mat);flightStage.geo=geo;
    }
    const s=flightStage;flightClock.s=0;document.body.classList.add('transitioning');A.scenes[1].el.dataset.transition='running';
    const draw=()=>{const t=flightClock.s,fly=smooth((t-.65)/1.8),morph=smooth((t-1.9)/1.05),land=smooth((t-3.05)/1.15),near=Math.sin(Math.PI*morph/2),cover=morph;
      // The background changes only while an opaque, oversized cloth is in front of the camera.
      const destination=t>=3.04;g.clearRect(0,0,W,H);g.drawImage(destination?A.images[2]:A.images.clean1,0,0);if(destination){ui2.forEach(({r})=>g.drawImage(A.images.clean2,...r,...r))}
      if(!destination)ui1.forEach(({r,im},i)=>{g.save();g.globalAlpha=1-smooth((t-i*.06)/.65);g.drawImage(im,r[0],r[1]-smooth(t/.8)*8);g.restore()});
      deform(s.geo,(u,v)=>{let x=u*W,y=v*H,tail=smooth((v-.35)/.6),wing=smooth((.72-u)/.5)*(1-tail*.5),phase=t*2.7+u*2-v*5;
        let fx=x-fly*760-tail*fly*240,fy=y-Math.sin(fly*Math.PI)*65+Math.sin(phase)*25*wing*fly,fz=fly*240+Math.sin(phase)*80*wing*fly;
        // Tail vertices spread into a real continuous rectangular sheet at the lens.
        const cx=(u-.5)*2500+W/2,cy=(v-.5)*1700+H/2,cz=420+Math.sin(u*8+v*6-t*2)*95;
        x=mix(fx,cx,cover);y=mix(fy,cy,cover);let z=mix(fz,cz,cover);const bounds=secondBoundary(u),tx=u*W,ty=mix(bounds.top,bounds.bottom,v);
        x=mix(x,tx,land);y=mix(y,ty,land);z=mix(z,0,land);return [x,y,z];});
      s.mesh.material.uniforms.morph.value=morph;s.mesh.material.uniforms.land.value=land;s.mesh.material.uniforms.time.value=t;s.draw();
      if(destination){ui2.forEach(({r,im},i)=>{g.save();g.globalAlpha=smooth((t-3.32-i*.08)/.5);g.drawImage(im,r[0],r[1]);g.restore()})}
      layer.dataset.time=t.toFixed(3);
    };
    await new Promise(resolve=>{flightTimeline=gsap.timeline({onUpdate:draw,onComplete:resolve});flightTimeline.to(flightClock,{s:4.2,duration:4.2,ease:'none'});});
    document.body.classList.remove('transitioning');A.scenes[2].el.scrollIntoView({behavior:'instant',block:'start'});layer.hidden=true;A.scenes[1].el.dataset.transition='complete';return true;
  }
  function init(api){A=api;try{initDye();initWax();initGallery();initEnding();setupUI();ready=true;document.documentElement.dataset.fabricEngine='webgl';return true}catch(e){console.error('WebGL initialization failed',e);Object.values(stages).forEach(s=>s.visible(false));A.notice('当前浏览器无法启用 WebGL；已保留静态页面，请使用支持硬件加速的浏览器体验布料动画。');return false}}
  const reviewAges={};
  function validate(){const geo=grid(34,104,dyeXY),solver=new FabricSolver(geo);let maximum=0,finite=true,peakDepth=0;
    for(let f=0;f<480;f++){solver.step(1/60,f<240?410:0,f/60,695,1);peakDepth=Math.max(peakDepth,solver.depth);if(f%30===0)for(const [a,b,len]of solver.links){const p=solver.p,d=Math.hypot(p[a*3]-p[b*3],p[a*3+1]-p[b*3+1],p[a*3+2]-p[b*3+2]);maximum=Math.max(maximum,Math.abs(d/len-1));finite=finite&&Number.isFinite(d)}}
    const p0=ribbonPoint(0),p1=ribbonPoint(1),seam=Math.hypot(...p0.map((v,i)=>v-p1[i]));return {finite,maximumStrain:maximum,peakDepth,finalDepth:solver.depth,ribbonSeamError:seam,vertices:geo.attributes.position.count,triangles:geo.index.count/3};
  }
  return {init,tick,flight,drawEnding,validate,age(n,a){return reviewAges[n]??a},reviewAge(n,s){reviewAges[n]=s*1000},clearReview(){for(const k in reviewAges)delete reviewAges[k]},get ready(){return ready},reviewFlight(t){if(flightTimeline){flightTimeline.pause();flightTimeline.time(t,false)}},resumeFlight(){flightTimeline?.play()},hold(on){if(stages[4])stages[4].hold=on},setDye(v){if(stages[4])stages[4].ink=v},lift(){if(stages[5]){stages[5].target=0;stages[5].lift=true}},resetWax(){if(stages[5])stages[5].target=450},get dye(){return stages[4]},get wax(){return stages[5]}};
})();
