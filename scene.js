import * as THREE from './vendor/three.module.min.js';
import { room, printSize, fittedImage, placement } from './config.js?v=20260911-1';

// The room is authored in metres; artwork paper sizes are true A2.
export async function createGalleryScene(container, works, callbacks = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#888d86');
  const camera = new THREE.PerspectiveCamera(55, 1, .025, 70);
  const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, matchMedia('(max-width:700px)').matches ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label','3D展示室。ドラッグで見回す。左右の矢印キーで作品を巡る。');
  container.appendChild(canvas);
  let entered = false, selected = -1, raf = 0, tween = null, suspended = false, lost = false;
  const disposables = [], hitTargets = [], occluders = [];
  function requestFrame() { if (!raf && !suspended && !lost) raf = requestAnimationFrame(render); }
  function render(now) {
    raf = 0;
    if (tween) {
      const t = Math.min(1,(now-tween.start)/tween.duration), e = t*t*(3-2*t);
      camera.position.lerpVectors(tween.from,tween.to,e);
      camera.quaternion.slerpQuaternions(tween.qFrom,tween.qTo,e);
      if (t >= 1) { tween=null; callbacks.onSettled?.(selected); }
    }
    renderer.render(scene,camera);
    if (tween) requestFrame();
  }
  function material(color, props={}) { const m=new THREE.MeshStandardMaterial({color,roughness:.86,...props});disposables.push(m);return m; }
  function box(w,h,d,mat,x,y,z,parent=scene) {
    const geo=new THREE.BoxGeometry(w,h,d);disposables.push(geo);
    const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);occluders.push(mesh);return mesh;
  }
  function plane(w,h,mat,x,y,z,parent=scene) {
    const geo=new THREE.PlaneGeometry(w,h);disposables.push(geo);
    const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  }
  function canvasTexture(width,height,draw) {
    const c=document.createElement('canvas');c.width=width;c.height=height;
    draw(c.getContext('2d'),width,height);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;disposables.push(t);return t;
  }
  // Small repeating fibre texture, without external texture services.
  const carpet=canvasTexture(256,256,(ctx,w,h)=>{
    ctx.fillStyle='#747771';ctx.fillRect(0,0,w,h);
    let seed=17;const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
    for(let i=0;i<18000;i++){
      const c=80+Math.floor(rand()*63);ctx.strokeStyle=`rgba(${c},${c+3},${c+2},.4)`;
      const x=rand()*w,y=rand()*h;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+rand()*2,y+2+rand()*10);ctx.stroke();
    }
    ctx.strokeStyle='#515b5533';ctx.strokeRect(.5,.5,w-1,h-1);
  });
  carpet.wrapS=carpet.wrapT=THREE.RepeatWrapping;carpet.repeat.set(room.width*2,room.length*2);
  const concrete=canvasTexture(128,128,(ctx,w,h)=>{
    ctx.fillStyle='#878b83';ctx.fillRect(0,0,w,h);
    let s=23;for(let i=0;i<6000;i++){s=(s*16807)%2147483647;const x=s%128;s=(s*16807)%2147483647;const y=s%128;ctx.fillStyle=i%2?'#454c4322':'#c9cbbb33';ctx.fillRect(x,y,2,2);}
  });concrete.wrapS=concrete.wrapT=THREE.RepeatWrapping;concrete.repeat.set(5,9);
  const wall=material('#dfdfd4'), trim=material('#c8cbc1'), floorMat=material('#b3b9b3',{map:carpet}), ceilingMat=material('#979d91',{map:concrete});
  const metal=material('#c4c9bd',{metalness:.35,roughness:.58}), darkMetal=material('#1b2222',{metalness:.55,roughness:.5});
  const black=material('#171b1c',{roughness:.95}), paper=material('#f1f0e5');
  const w=room.width,l=room.length,h=room.height;
  box(w+.2,.12,l+.25,floorMat,0,-.065,0);
  box(.14,h,l,wall,-w/2-.07,h/2,0);box(.14,h,l,wall,w/2+.07,h/2,0);
  box(w,.15,l,ceilingMat,0,h+.075,0);
  for(const s of [-1,1]) {
    box(.025,.095,l,trim,s*(w/2-.0125),.0475,0);
    for(const z of room.columns){box(room.columnDepth,h,room.columnWidth,wall,s*(w/2-room.columnDepth/2),h/2,z);box(room.columnDepth+.022,.1,room.columnWidth+.022,trim,s*(w/2-room.columnDepth/2),.05,z);}
  }
  // Back wall with the small cafe doorway visible in the reference room.
  const doorW=.86,doorH=2.18;
  box((w-doorW)/2,h,.14,wall,-(w+doorW)/4,h/2,-l/2-.07);
  box((w-doorW)/2,h,.14,wall,(w+doorW)/4,h/2,-l/2-.07);
  box(doorW,h-doorH,.14,wall,0,doorH+(h-doorH)/2,-l/2-.07);
  box(1.8,2.8,1.8,material('#49463b'),0,1.4,-l/2-1.0);
  const doorGlow=new THREE.MeshBasicMaterial({color:'#ad9161',toneMapped:false});disposables.push(doorGlow);
  plane(.65,1.95,doorGlow,0,1.04,-l/2-.075);
  for(const s of [-1,1])box(.04,doorH,.05,darkMetal,s*.45,doorH/2,-l/2+.02);
  box(.94,.05,.05,darkMetal,0,doorH,-l/2+.02);
  const cafe=canvasTexture(256,64,(ctx)=>{ctx.fillStyle='#292f2b';ctx.fillRect(0,0,256,64);ctx.fillStyle='#e4e7d9';ctx.font='24px Georgia';ctx.textAlign='center';ctx.fillText('café',128,42);});
  const cafeMat=new THREE.MeshBasicMaterial({map:cafe,toneMapped:false});disposables.push(cafeMat);plane(.48,.12,cafeMat,0,2.32,-l/2+.012);
  // The glazed front entrance and the evening beyond it.
  const outside=material('#344749');box(w,h,.06,outside,0,h/2,l/2+.12);
  const entranceGlass=new THREE.MeshBasicMaterial({color:'#557578',transparent:true,opacity:.3,side:THREE.DoubleSide});disposables.push(entranceGlass);
  const front=plane(w-1,2.55,entranceGlass,0,1.3,l/2-.01);front.rotation.y=Math.PI;
  for(const x of [-1.68,-.55,.55,1.68])box(.055,2.7,.07,darkMetal,x,1.35,l/2-.015);
  for(const y of [.04,2.12,2.7])box(3.4,.055,.07,darkMetal,0,y,l/2-.015);
  for(const x of [-.12,.12])box(.027,.35,.065,metal,x,1.05,l/2-.07);
  // Exposed beams, pipework and tracks preserve the industrial ceiling.
  for(const z of [-3.55,-1.4,.8,3])box(w,.14,.17,ceilingMat,0,h-.1,z);
  for(const x of [-1.48,0,1.48])box(.035,.04,l-.25,metal,x,h-.3,0);
  for(const x of [-1.85,.78]){
    const geo=new THREE.CylinderGeometry(.065,.065,l-.15,14);disposables.push(geo);
    const pipe=new THREE.Mesh(geo,metal);pipe.rotation.x=Math.PI/2;pipe.position.set(x,h-.17,0);scene.add(pipe);
  }
  for(const z of [-2.3,1.6]){
    box(.85,.12,.65,trim,.1,h-.17,z);
    for(let i=0;i<8;i++)box(.57,.005,.017,darkMetal,.1,h-.234,z-.23+i*.063);
  }
  // Four independent backless black seats, arranged in two pairs on the axis.
  const shadowTex=canvasTexture(128,128,(ctx)=>{const g=ctx.createRadialGradient(64,64,9,64,64,62);g.addColorStop(0,'rgba(0,0,0,.65)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);});
  const contactMat=new THREE.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false,toneMapped:false});disposables.push(contactMat);
  room.seats.forEach((z,i)=>{
    const seat=new THREE.Group();seat.name=`backless-seat-${i+1}`;seat.position.z=z;scene.add(seat);
    const top=box(.59,.14,.51,black,0,.43,0,seat);top.name='cushion';
    box(.51,.035,.43,darkMetal,0,.345,0,seat);
    for(const x of [-.23,.23])for(const p of [-.19,.19])box(.028,.33,.028,darkMetal,x,.165,p,seat);
    const shadow=plane(1.05,.97,contactMat,0,.003,z);shadow.rotation.x=-Math.PI/2;
  });
  scene.add(new THREE.HemisphereLight('#eef3e5','#59615b',1.2));
  scene.add(new THREE.AmbientLight('#edf1e7',.2));
  const sun=new THREE.DirectionalLight('#fff5de',2);sun.position.set(-1,4,5);sun.target.position.set(0,0,-2);sun.castShadow=true;
  Object.assign(sun.shadow.camera,{left:-5,right:5,top:7,bottom:-7,near:.1,far:18});sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;scene.add(sun,sun.target);
  const glowTex=canvasTexture(128,256,(ctx)=>{ctx.save();ctx.scale(1,2);const g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,253,217,.38)');g.addColorStop(.6,'rgba(255,253,217,.14)');g.addColorStop(1,'rgba(255,253,217,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);ctx.restore();});
  const glowMat=new THREE.MeshBasicMaterial({map:glowTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});disposables.push(glowMat);
  const lampFace=new THREE.MeshBasicMaterial({color:'#fff6db',toneMapped:false});disposables.push(lampFace);
  const loader=new THREE.TextureLoader();
  let loaded=0;
  const loadTasks=works.map(async(work,i)=>{
    const pos=placement(i),size=printSize(work.aspect),fit=fittedImage(work.aspect,size.width,size.height);
    const frame=new THREE.Group();frame.position.set(pos.x,pos.y,pos.z);frame.rotation.y=pos.rotation;frame.name=`A2-work-${i+1}`;frame.userData={index:i,paperWidth:size.width,paperHeight:size.height};scene.add(frame);
    box(size.width+.024,size.height+.024,.027,darkMetal,0,0,0,frame);
    box(size.width,size.height,.004,paper,0,0,.016,frame);
    const imageMat=new THREE.MeshBasicMaterial({color:'#14282b',toneMapped:false});disposables.push(imageMat);
    work.sceneMaterial=imageMat;
    const image=plane(fit.width,fit.height,imageMat,0,0,.019,frame);image.userData.index=i;
    const target=plane(size.width+.11,size.height+.11,new THREE.MeshBasicMaterial({visible:false}),0,0,.022,frame);disposables.push(target.material);target.userData.index=i;hitTargets.push(target);
    const labelTex=canvasTexture(256,96,(ctx)=>{ctx.fillStyle='#daddd2';ctx.fillRect(0,0,256,96);ctx.fillStyle='#323e39';ctx.font='24px Georgia';ctx.fillText(String(i+1).padStart(2,'0'),15,33);ctx.font='12px sans-serif';ctx.fillText('AFTER HOURS',15,59);ctx.fillStyle='#657166';ctx.font='10px sans-serif';ctx.fillText('A2 · NIGHT PHOTOGRAPHY',15,79);});
    const labelMat=new THREE.MeshBasicMaterial({map:labelTex,toneMapped:false});disposables.push(labelMat);plane(.135,.051,labelMat,-size.width/2+.067,-size.height/2-.082,.005,frame);
    const glow=plane(1.4,2.3,glowMat,pos.x+(pos.side==='left'?.002:-.002),1.62,pos.z);glow.rotation.y=pos.rotation;
    const lamp=new THREE.Group();lamp.position.set(pos.side==='left'?-1.48:1.48,h-.39,pos.z);lamp.lookAt(new THREE.Vector3(pos.x,1.45,pos.z));scene.add(lamp);
    box(.12,.12,.2,metal,0,0,.025,lamp);plane(.087,.087,lampFace,0,0,.129,lamp);
    const light=new THREE.SpotLight('#fff4db',6,4,.58,.85,2);light.position.copy(lamp.position);light.target.position.set(pos.x,1.45,pos.z);scene.add(light,light.target);
    // Start with tiny images. A high resolution image is loaded only on approach.
    try{const texture=await loader.loadAsync(`./assets/${work.thumb_filename}`);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());imageMat.map=texture;imageMat.color.set('#ffffff');imageMat.needsUpdate=true;disposables.push(texture);work.sceneMaterial=imageMat;}catch{callbacks.onTextureError?.(i);}
    loaded++;callbacks.onProgress?.(loaded,works.length);requestFrame();
  });
  function cameraQuaternion(position,target){const c=new THREE.PerspectiveCamera();c.position.copy(position);c.lookAt(target);return c.quaternion.clone();}
  function moveTo(position,target,immediate=false){
    const to=new THREE.Vector3(...position),qTo=cameraQuaternion(to,new THREE.Vector3(...target));
    if(immediate){tween=null;camera.position.copy(to);camera.quaternion.copy(qTo);callbacks.onSettled?.(selected);}else tween={from:camera.position.clone(),to,qFrom:camera.quaternion.clone(),qTo,start:performance.now(),duration:1100};
    requestFrame();
  }
  function overview(immediate=false){selected=-1;moveTo([.72,1.64,l/2-.42],[-.3,1.3,-1.8],immediate);}
  function focus(index,immediate=false){
    selected=index;const p=placement(index),sign=p.side==='left'?-1:1;
    const bounds=printSize(works[index].aspect),halfFov=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
    const distance=Math.min(room.width-.55,Math.max(1.15,(bounds.height+.024)*1.5/(2*halfFov),(bounds.width+.024)*1.4/(2*halfFov*camera.aspect)));
    moveTo([p.x-sign*distance,1.54,p.z+.12],[p.x,1.48,p.z],immediate);
    const work=works[index];
    if(work.sceneMaterial&&!work.highLoaded){work.highLoaded=true;loader.loadAsync(`./assets/${work.filename}`).then(t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());disposables.push(t);const previous=work.sceneMaterial.map;work.sceneMaterial.map=t;work.sceneMaterial.color.set('#ffffff');work.sceneMaterial.needsUpdate=true;previous?.dispose();requestFrame();}).catch(()=>{work.highLoaded=false;});}
  }
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  let drag=null;
  canvas.addEventListener('pointerdown',event=>{if(!entered)return;canvas.setPointerCapture(event.pointerId);drag={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,moved:false};});
  canvas.addEventListener('pointermove',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>5)drag.moved=true;
    if(drag.moved){tween=null;const euler=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');euler.y-=(event.clientX-drag.lastX)*.004;euler.x=THREE.MathUtils.clamp(euler.x-(event.clientY-drag.lastY)*.003,-.8,.8);camera.quaternion.setFromEuler(euler);requestFrame();}
    drag.lastX=event.clientX;drag.lastY=event.clientY;
  });
  canvas.addEventListener('pointerup',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    if(!drag.moved){const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(hitTargets,false);if(hits.length){const blockers=raycaster.intersectObjects(occluders,false);if(!blockers.length||blockers[0].distance>=hits[0].distance-.001)callbacks.onSelect?.(hits[0].object.userData.index);}}
    drag=null;
  });
  canvas.addEventListener('pointercancel',()=>{drag=null;});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;tween=null;callbacks.onContextLost?.();});
  canvas.addEventListener('webglcontextrestored',()=>{lost=false;callbacks.onContextRestored?.();requestFrame();});
  const resize=()=>{const {width,height}=container.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/Math.max(1,height);camera.fov=width<700?59:55;camera.updateProjectionMatrix();if(selected>=0)focus(selected,true);requestFrame();};
  const observer=new ResizeObserver(resize);observer.observe(container);
  overview(true);resize();
  await Promise.all(loadTasks);
  requestFrame();
  return {focus,overview,enter(){entered=true;overview();},home(){entered=false;overview();},
    setSuspended(value){suspended=value;if(!suspended)requestFrame();},
    dispose(){observer.disconnect();cancelAnimationFrame(raf);disposables.forEach(x=>x.dispose());renderer.dispose();canvas.remove();},
  };
}
