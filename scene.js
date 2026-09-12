import * as THREE from './vendor/three.module.min.js';
import { room, printSize, fittedImage, placement } from './config.js?v=20260911-entry';
import { entrance, createEntryPath, sampleEntry } from './entry-path.js?v=20260912-arcade';
import { createCafe, cafePath, cafePose, cafeDoor } from './cafe.js?v=20260912-viewing-ui';
import { createBotanicalScene, botanicalTiming } from './botanical.js?v=20260912-solid-tree';
import { createClawMachine } from './claw-machine.js?v=20260912-arcade';
import { createArcadeHall, createArcadePath, sampleArcadeJourney } from './arcade-hall.js?v=20260912-arcade';

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
  let entryJourney=null,lastFrame=null,ready=false,journey=null,area='gallery';
  let arcadeJourney=null;
  const disposables = [], hitTargets = [], occluders = [], entranceTargets=[];
  const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
  const botanical=createBotanicalScene({THREE,scene,room,reducedMotion:motionPreference.matches});
  let natureActive=false,exhibitionJourney=null;
  const onMotionChange=()=>{botanical.setReducedMotion(motionPreference.matches);requestFrame();};
  motionPreference.addEventListener?.('change',onMotionChange);
  function requestFrame() { if (!raf && !suspended && !lost) raf = requestAnimationFrame(render); }
  function render(now) {
    raf = 0;
    if(suspended||lost){lastFrame=null;return;}
    const delta=lastFrame===null?0:Math.min(64,now-lastFrame);lastFrame=now;
    if(entryJourney){
      entryJourney.elapsed+=delta;
      const pose=sampleEntry(entryJourney.path,entryJourney.elapsed);
      leftDoor.rotation.y=pose.doorAngle;rightDoor.rotation.y=-pose.doorAngle;
      camera.position.copy(pose.position);camera.lookAt(pose.target);
      if(pose.complete){entryJourney=null;entered=true;if(natureActive)botanical.start();canvas.style.cursor='grab';canvas.setAttribute('aria-label','3D展示室。ドラッグで見回す。左右の矢印キーで作品を巡る。');callbacks.onEntered?.();}
    }
    if(journey){
      journey.elapsed+=delta;
      const t=THREE.MathUtils.clamp((journey.elapsed-cafeDoor.slideMs)/journey.duration,0,1),e=t*t*(3-2*t);
      const closing=journey.elapsed-cafeDoor.slideMs-journey.duration;
      const doorT=closing>0?1-Math.min(1,closing/cafeDoor.slideMs):Math.min(1,journey.elapsed/cafeDoor.slideMs);
      cafe.setDoor(doorT*doorT*(3-2*doorT));
      camera.position.copy(journey.path.getPointAt(e));camera.quaternion.slerpQuaternions(journey.qFrom,journey.qTo,e);
      if(closing>=cafeDoor.slideMs){const done=journey.done;journey=null;notifyCafe();done?.();}
    }
    if(arcadeJourney){
      arcadeJourney.elapsed+=delta;
      const pose=sampleArcadeJourney(arcadeJourney.path,arcadeJourney.elapsed);
      camera.position.copy(pose.position);camera.lookAt(pose.target);
      const lensT=Math.min(1,arcadeJourney.elapsed/arcadeJourney.path.duration);
      camera.fov=THREE.MathUtils.lerp(arcadeJourney.fovFrom,arcadeJourney.direction==='out'?68:(container.getBoundingClientRect().width<700?59:55),lensT);camera.updateProjectionMatrix();
      leftDoor.rotation.y=pose.doorAngle;rightDoor.rotation.y=-pose.doorAngle;
      if(pose.complete){const {direction,done}=arcadeJourney;arcadeJourney=null;area=direction==='out'?'arcade':'gallery';notifyArcade();notifyCafe();done?.();}
    }
    if (tween) {
      tween.elapsed+=delta;const t = Math.min(1,tween.elapsed/tween.duration), e = t*t*(3-2*t);
      camera.position.lerpVectors(tween.from,tween.to,e);
      camera.quaternion.slerpQuaternions(tween.qFrom,tween.qTo,e);
      if (t >= 1) { tween=null; callbacks.onSettled?.(selected); }
    }
    if(exhibitionJourney){
      exhibitionJourney.elapsed+=delta;
      if(!exhibitionJourney.committed&&(exhibitionJourney.elapsed>=700||motionPreference.matches)){
        exhibitionJourney.commit();exhibitionJourney.committed=true;
      }
      if(exhibitionJourney.elapsed>=botanicalTiming.settleMs||motionPreference.matches){
        const resolve=exhibitionJourney.resolve;exhibitionJourney=null;resolve();
      }
    }
    const coffeeAnimating=cafe.tick(delta);
    const petalsAnimating=botanical.tick(delta);
    const clawAnimating=claw.tick(delta);
    renderer.render(scene,camera);if(area!=='arcade'&&!arcadeJourney)cafe.draw(renderer);updateCafeHints();
    if (tween||entryJourney||journey||arcadeJourney||exhibitionJourney||coffeeAnimating||petalsAnimating||clawAnimating) requestFrame();else lastFrame=null;
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
  // The rear opening leads to an actual furnished cafe alcove.
  const cafe=createCafe({scene,room,box,plane,material,canvasTexture,disposables,floorMat,wall,darkMetal,
    onCoffee(state){callbacks.onCoffee?.(state);if(ready)notifyCafe();},
  });
  // A wall-mounted object: its lettering, edges and click surface share one
  // world transform, so looking around cannot separate it from the wall.
  const exhibitionPanel=new THREE.Group();
  exhibitionPanel.name='exhibition-panel';
  exhibitionPanel.position.set(-1.28,1.35,-l/2+.025);
  scene.add(exhibitionPanel);
  box(1.05,1.8,.045,material('#101b19',{metalness:.48,roughness:.56}),0,0,0,exhibitionPanel);
  function panelTexture(mode){
    return canvasTexture(700,1200,ctx=>{
      ctx.fillStyle='#101d1a';ctx.fillRect(0,0,700,1200);
      const sheen=ctx.createRadialGradient(90,100,0,90,100,1100);
      sheen.addColorStop(0,'#2c4238');sheen.addColorStop(.48,'#1a2b24');sheen.addColorStop(1,'#101d1a');
      ctx.fillStyle=sheen;ctx.fillRect(0,0,700,1200);
      // Quiet, fine-grained metal, with no printed border around the panel.
      let grain=37;
      for(let i=0;i<11000;i++){
        grain=grain*16807%2147483647;const x=grain%700;
        grain=grain*16807%2147483647;const y=grain%1200;
        ctx.fillStyle=i%2?'#e4edce08':'#0000000a';ctx.fillRect(x,y,1,1);
      }
      ctx.textAlign='left';
      function trackedText(text,x,y,spacing){
        // Explicit spacing keeps the lettering consistent across browsers.
        for(const letter of text){ctx.fillText(letter,x,y);x+=ctx.measureText(letter).width+spacing;}
      }
      ctx.fillStyle='#eff0df';ctx.font='400 76px "Helvetica Neue", Helvetica, Arial, sans-serif';
      trackedText(mode,76,176,7);
      ctx.fillStyle='#bdcaba';ctx.font='400 40px "Helvetica Neue", Helvetica, Arial, sans-serif';
      trackedText('MODE',79,251,13);
      // Oversized circular arrows make the entire surface read as a switch.
      ctx.strokeStyle='#d8dfc5';ctx.lineWidth=7;ctx.lineCap='round';ctx.lineJoin='round';
      const cx=350,cy=699,radius=213;
      for(const start of [-1.15,Math.PI-1.15]){
        const end=start+2.52;
        ctx.beginPath();ctx.arc(cx,cy,radius,start,end);ctx.stroke();
        const x=cx+radius*Math.cos(end),y=cy+radius*Math.sin(end);
        const tx=-Math.sin(end),ty=Math.cos(end),nx=Math.cos(end),ny=Math.sin(end);
        ctx.beginPath();ctx.moveTo(x-38*tx+30*nx,y-38*ty+30*ny);ctx.lineTo(x,y);
        ctx.lineTo(x-38*tx-30*nx,y-38*ty-30*ny);ctx.stroke();
      }
    });
  }
  const panelTextures={nature:panelTexture('NATURE'),night:panelTexture('NIGHT')};
  for(const texture of Object.values(panelTextures))texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const panelMaterial=new THREE.MeshBasicMaterial({map:panelTextures.nature,toneMapped:false});
  disposables.push(panelMaterial);
  const panelFace=plane(1.05,1.8,panelMaterial,0,0,.026,exhibitionPanel);
  panelFace.name='exhibition-panel-face';
  panelFace.userData={action:'exhibition-switch',destination:'nature'};
  // A real opening: two glazed leaves swing inward about their outer hinges.
  const facade=material('#28393b',{roughness:.8}),entryZ=l/2+.035;
  const leafWidth=entrance.width/2,entryHeight=entrance.height;
  for(const s of [-1,1]){
    box((w-entrance.width)/2,h,.18,facade,s*(w+entrance.width)/4,h/2,entryZ);
    box(.07,entryHeight+.07,.13,darkMetal,s*(leafWidth+.035),entryHeight/2,entryZ+.03);
  }
  box(entrance.width,h-entryHeight,.18,facade,0,entryHeight+(h-entryHeight)/2,entryZ);
  box(entrance.width+.14,.07,.13,darkMetal,0,entryHeight+.035,entryZ+.03);
  box(entrance.width,.016,.2,metal,0,.008,entryZ);
  // Exterior landing, extended side walls and a modest canopy frame the entrance.
  box(w+4,.12,5,material('#333e3f',{roughness:.95}),0,-.065,l/2+2.5);
  for(const s of [-1,1])box(2,h,.18,facade,s*(w/2+1),h/2,entryZ);
  box(w+.3,.12,.95,darkMetal,0,h+.1,entryZ+.35);
  const entranceGlass=new THREE.MeshPhysicalMaterial({color:'#b8d2ce',transparent:true,opacity:.21,roughness:.12,metalness:.05,side:THREE.DoubleSide,depthWrite:false});disposables.push(entranceGlass);
  function makeDoor(side){
    const pivot=new THREE.Group();pivot.position.set(side*leafWidth,0,entryZ);scene.add(pivot);
    const centre=-side*leafWidth/2;
    box(leafWidth-.012,entryHeight,.045,entranceGlass,centre,entryHeight/2,0,pivot);
    for(const x of [centre-leafWidth/2+.026,centre+leafWidth/2-.026])box(.045,entryHeight,.072,darkMetal,x,entryHeight/2,0,pivot);
    for(const y of [.035,entryHeight-.025])box(leafWidth,.06,.072,darkMetal,centre,y,0,pivot);
    box(leafWidth,.035,.07,darkMetal,centre,.7,0,pivot);
    for(const z of [-.075,.075]){
      box(.022,.38,.026,metal,-side*(leafWidth-.13),1.13,z,pivot);
      for(const y of [.97,1.29])box(.024,.023,.1,metal,-side*(leafWidth-.13),y,0,pivot);
    }
    entranceTargets.push(...pivot.children);
    return pivot;
  }
  const leftDoor=makeDoor(-1),rightDoor=makeDoor(1);
  const arcadeHall=createArcadeHall({scene});occluders.push(...arcadeHall.occluders);
  const claw=createClawMachine({scene,onState:state=>callbacks.onClawState?.(state),onWin:()=>callbacks.onClawWin?.()});
  for(const object of entranceTargets)object.userData.action='entrance';
  const entrySign=canvasTexture(1024,256,ctx=>{
    ctx.fillStyle='#182829';ctx.fillRect(0,0,1024,256);ctx.textAlign='center';ctx.fillStyle='#e9ecdf';
    ctx.font='65px "Hiragino Mincho ProN", serif';ctx.fillText('鳥瞰図',512,108);
    ctx.fillStyle='#c4d3c8';ctx.font='23px sans-serif';ctx.fillText('NAGATA KOSHI  /  PHOTOGRAPHY EXHIBITION',512,178);
  });
  const entrySignMat=new THREE.MeshBasicMaterial({map:entrySign,toneMapped:false});disposables.push(entrySignMat);
  plane(1.48,.37,entrySignMat,0,2.7,entryZ+.101);
  const entryLight=new THREE.PointLight('#edf2d8',4,5,2);entryLight.position.set(0,2.75,entryZ+.65);scene.add(entryLight);
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
  const artworkMeshes=[];
  let loaded=0;
  const loadTasks=works.map(async(work,i)=>{
    const pos=placement(i),size=printSize(work.aspect),fit=fittedImage(work.aspect,size.width,size.height);
    const frame=new THREE.Group();frame.position.set(pos.x,pos.y,pos.z);frame.rotation.y=pos.rotation;frame.name=`A2-work-${i+1}`;frame.userData={index:i,paperWidth:size.width,paperHeight:size.height};scene.add(frame);
    const border=box(size.width+.024,size.height+.024,.027,darkMetal,0,0,0,frame);
    const sheet=box(size.width,size.height,.004,paper,0,0,.016,frame);
    const imageMat=new THREE.MeshBasicMaterial({color:'#14282b',toneMapped:false});disposables.push(imageMat);
    work.sceneMaterial=imageMat;
    const image=plane(fit.width,fit.height,imageMat,0,0,.019,frame);image.userData.index=i;
    const target=plane(size.width+.11,size.height+.11,new THREE.MeshBasicMaterial({visible:false}),0,0,.022,frame);disposables.push(target.material);target.userData.index=i;hitTargets.push(target);
    const labelTex=canvasTexture(256,96,(ctx)=>{ctx.fillStyle='#daddd2';ctx.fillRect(0,0,256,96);ctx.fillStyle='#323e39';ctx.font='24px Georgia';ctx.fillText(String(i+1).padStart(2,'0'),15,33);ctx.font='12px sans-serif';ctx.fillText('AFTER HOURS',15,59);ctx.fillStyle='#657166';ctx.font='10px sans-serif';ctx.fillText('A2 · NIGHT PHOTOGRAPHY',15,79);});
    const labelMat=new THREE.MeshBasicMaterial({map:labelTex,toneMapped:false});disposables.push(labelMat);const label=plane(.135,.051,labelMat,-size.width/2+.067,-size.height/2-.082,.005,frame);
    artworkMeshes[i]={frame,border,sheet,image,target,label,size,fit};
    const glow=plane(1.4,2.3,glowMat,pos.x+(pos.side==='left'?.002:-.002),1.62,pos.z);glow.rotation.y=pos.rotation;
    const lamp=new THREE.Group();lamp.position.set(pos.side==='left'?-1.48:1.48,h-.39,pos.z);lamp.lookAt(new THREE.Vector3(pos.x,1.45,pos.z));scene.add(lamp);
    box(.12,.12,.2,metal,0,0,.025,lamp);plane(.087,.087,lampFace,0,0,.129,lamp);
    const light=new THREE.SpotLight('#fff4db',6,4,.58,.85,2);light.position.copy(lamp.position);light.target.position.set(pos.x,1.45,pos.z);scene.add(light,light.target);
    // Start with tiny images. A high resolution image is loaded only on approach.
    try{const texture=await loader.loadAsync(`./assets/${work.thumb_filename}`);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());imageMat.map=texture;imageMat.color.set('#ffffff');imageMat.needsUpdate=true;disposables.push(texture);work.sceneMaterial=imageMat;}catch{callbacks.onTextureError?.(i);}
    loaded++;callbacks.onProgress?.(loaded,works.length);requestFrame();
  });
  // Load the complete next collection before changing any of the visible works.
  async function prepareWorks(nextWorks, collectionLabel='AFTER HOURS'){
    const results=await Promise.allSettled(nextWorks.map(work=>loader.loadAsync(`./assets/${work.thumb_filename}`)));
    if(results.some(result=>result.status==='rejected')){
      for(const result of results)if(result.status==='fulfilled')result.value.dispose();
      throw new Error('Could not load the complete collection');
    }
    return {discard(){for(const result of results)result.value.dispose();},commit(){for(const [i,work] of nextWorks.entries()){
      const m=artworkMeshes[i],size=printSize(work.aspect),fit=fittedImage(work.aspect,size.width,size.height);
      m.border.scale.set((size.width+.024)/(m.size.width+.024),(size.height+.024)/(m.size.height+.024),1);
      m.sheet.scale.set(size.width/m.size.width,size.height/m.size.height,1);
      m.image.scale.set(fit.width/m.fit.width,fit.height/m.fit.height,1);
      m.target.scale.set((size.width+.11)/(m.size.width+.11),(size.height+.11)/(m.size.height+.11),1);
      m.frame.userData.paperWidth=size.width;m.frame.userData.paperHeight=size.height;
      m.label.position.set(-size.width/2+.067,-size.height/2-.082,.005);
      const ctx=m.label.material.map.image.getContext('2d');
      ctx.fillStyle='#daddd2';ctx.fillRect(0,0,256,96);ctx.fillStyle='#323e39';ctx.font='24px Georgia';ctx.fillText(String(i+1).padStart(2,'0'),15,33);ctx.font='12px sans-serif';ctx.fillText(collectionLabel,15,59);ctx.font='10px sans-serif';ctx.fillText('A2 · PHOTOGRAPHY',15,79);m.label.material.map.needsUpdate=true;
      const texture=results[i].value;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
      m.image.material.map?.dispose();m.image.material.map=texture;m.image.material.color.set('#ffffff');m.image.material.needsUpdate=true;disposables.push(texture);
      work.sceneMaterial=m.image.material;work.highLoaded=false;
    }
    works=nextWorks;selected=-1;requestFrame();}};
  }
  async function replaceWorks(nextWorks, collectionLabel='AFTER HOURS'){
    const prepared=await prepareWorks(nextWorks,collectionLabel);prepared.commit();
  }
  async function transitionExhibition(nextWorks,collectionLabel,nature,{animate=true}={}){
    if(exhibitionJourney)throw new Error('An exhibition transition is already in progress');
    const prepared=await prepareWorks(nextWorks,collectionLabel);
    if(lost){prepared.discard();throw new Error('3D rendering is unavailable');}
    const commit=()=>{
      prepared.commit();natureActive=nature;if(!nature)botanical.stop();
      const destination=nature?'night':'nature';
      panelFace.userData.destination=destination;panelMaterial.map=panelTextures[destination];
    };
    if(!animate||!entered){commit();return;}
    overview(true);
    if(!nature){commit();return;}
    botanical.start();
    return new Promise((resolve,reject)=>{
      exhibitionJourney={elapsed:0,committed:false,commit,resolve,reject,discard:prepared.discard};requestFrame();
    });
  }
  function cancelExhibition(){
    if(!exhibitionJourney)return;
    if(!exhibitionJourney.committed)exhibitionJourney.discard();
    exhibitionJourney.reject(new Error('Exhibition transition interrupted'));exhibitionJourney=null;
  }
  function cameraQuaternion(position,target){const c=new THREE.PerspectiveCamera();c.position.copy(position);c.lookAt(target);return c.quaternion.clone();}
  function moveTo(position,target,immediate=false){
    const to=new THREE.Vector3(...position),qTo=cameraQuaternion(to,new THREE.Vector3(...target));
    if(immediate){tween=null;camera.position.copy(to);camera.quaternion.copy(qTo);callbacks.onSettled?.(selected);}else tween={from:camera.position.clone(),to,qFrom:camera.quaternion.clone(),qTo,elapsed:0,duration:1100};
    requestFrame();
  }
  function exteriorPosition(){
    const halfFov=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
    const distance=Math.max(3.6,entrance.width*1.45/(2*halfFov*camera.aspect));
    return [0,entrance.eyeHeight,Math.min(9.2,l/2+distance)];
  }
  function home(){
    cancelExhibition();botanical.stop();
    entryJourney=null;journey=null;arcadeJourney=null;tween=null;lastFrame=null;entered=false;selected=-1;drag=null;area='gallery';claw.close();cafe.reset();notifyCafe();notifyArcade();
    leftDoor.rotation.y=rightDoor.rotation.y=0;camera.fov=container.getBoundingClientRect().width<700?59:55;camera.updateProjectionMatrix();canvas.style.cursor=ready?'pointer':'wait';
    canvas.setAttribute('aria-label','入口のガラス扉。クリック、またはEnterキーで写真展に入る。');
    const position=exteriorPosition();moveTo(position,[0,1.52,position[2]-3.6],true);
  }
  function enter(){
    if(!ready||entered||entryJourney)return;
    selected=-1;tween=null;drag=null;lastFrame=null;canvas.style.cursor='default';
    canvas.setAttribute('aria-label','扉を開けて展示室の中央へ移動中。');
    entryJourney={elapsed:0,path:createEntryPath(l,camera.position.z)};requestFrame();
  }
  function overview(immediate=false){if(entryJourney||journey||arcadeJourney||claw.inGame||cafe.state==='pouring')return;if(area==='cafe'){leaveCafe();return;}if(area==='arcade'){leaveArcade();return;}selected=-1;moveTo([0,entrance.eyeHeight,0],[0,1.52,-3.6],immediate);}
  function focus(index,immediate=false){
    if(entryJourney||journey||arcadeJourney||claw.inGame||cafe.state==='pouring')return;
    if(area==='arcade'){leaveArcade(()=>focus(index,immediate));return;}
    if(area==='cafe'){leaveCafe(()=>focus(index,immediate));return;}
    selected=index;const p=placement(index),sign=p.side==='left'?-1:1;
    const bounds=printSize(works[index].aspect),halfFov=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
    const distance=Math.min(room.width-.55,Math.max(1.15,(bounds.height+.024)*1.5/(2*halfFov),(bounds.width+.024)*1.4/(2*halfFov*camera.aspect)));
    moveTo([p.x-sign*distance,1.54,p.z+.12],[p.x,1.48,p.z],immediate);
    const work=works[index];
    if(work.sceneMaterial&&!work.highLoaded){work.highLoaded=true;loader.loadAsync(`./assets/${work.filename}`).then(t=>{if(works[index]!==work){t.dispose();return;}t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());disposables.push(t);const previous=work.sceneMaterial.map;work.sceneMaterial.map=t;work.sceneMaterial.color.set('#ffffff');work.sceneMaterial.needsUpdate=true;previous?.dispose();requestFrame();}).catch(()=>{work.highLoaded=false;});}
  }
  function notifyCafe(){callbacks.onCafeState?.({area,busy:!!journey||cafe.state==='pouring'});}
  function travel(path,target,done){
    tween=null;drag=null;lastFrame=null;
    journey={path,elapsed:0,duration:Math.max(2400,Math.min(5200,path.getLength()*600)),qFrom:camera.quaternion.clone(),qTo:cameraQuaternion(path.getPointAt(1),new THREE.Vector3(...target)),done};
    notifyCafe();requestFrame();
  }
  function visitCafe(){
    if(!entered||entryJourney||journey||arcadeJourney||area!=='gallery')return;
    selected=-1;area='cafe';callbacks.onCafeVisit?.();
    travel(cafePath(camera.position),cafePose.target);
  }
  function leaveCafe(done){
    if(area!=='cafe'||journey||cafe.state==='pouring')return;
    travel(cafePath(camera.position,true),[0,1.52,-3.6],()=>{area='gallery';selected=-1;notifyCafe();done?.();});
  }
  function faceCafeDoor(){if(area!=='cafe'||journey||cafe.state==='pouring')return;moveTo(camera.position.toArray(),[0,1.4,-l/2]);}
  function pourCoffee(){if(area==='cafe'&&!journey&&cafe.pour())requestFrame();}
  function sipCoffee(){if(!journey&&cafe.sip())requestFrame();}
  function notifyArcade(){callbacks.onArcadeState?.({area,busy:!!arcadeJourney});}
  function travelArcade(direction,done){
    selected=-1;tween=null;drag=null;lastFrame=null;claw.stopMove();
    arcadeJourney={direction,path:createArcadePath(l,camera.position,direction),elapsed:0,fovFrom:camera.fov,done};
    callbacks.onArcadeVisit?.();notifyArcade();requestFrame();
  }
  function visitArcade(){
    if(!entered||entryJourney||journey||arcadeJourney||exhibitionJourney||area!=='gallery')return;
    travelArcade('out');
  }
  function leaveArcade(done){
    if(area!=='arcade'||arcadeJourney||claw.inGame)return;
    travelArcade('in',done);
  }
  function startClaw(){
    if(area!=='arcade'||arcadeJourney||!claw.start())return;
    // A slight view from above keeps both front/back motion and the chute legible.
    moveTo([-.65,1.85,7.12],[-3.5,1.45,6.5]);
    requestFrame();
  }
  function closeClaw(){claw.close();if(area==='arcade')moveTo([-.65,1.62,6.5],[-3.5,1.45,6.5]);requestFrame();}
  function moveClaw(axis,direction){if(claw.move(axis,direction))requestFrame();}
  function nudgeClaw(axis,direction){if(claw.move(axis,direction)){claw.tick(100);claw.stopMove();requestFrame();}}
  function stopClaw(){claw.stopMove();}
  function grabClaw(){if(claw.grab())requestFrame();}
  function updateCafeHints(){
    if(!callbacks.onCafeHints)return;
    const rect=container.getBoundingClientRect();
    const project=point=>{const p=point.clone().project(camera);return {x:(p.x+1)*rect.width/2,y:(1-p.y)*rect.height/2,visible:p.z>-1&&p.z<1&&Math.abs(p.x)<.9&&Math.abs(p.y)<.9};};
    const exit=project(cafe.exitHint),machine=project(cafe.machineHint);
    exit.visible=exit.visible&&entered&&!journey&&area==='cafe'&&cafe.state!=='pouring';
    machine.visible=machine.visible&&entered&&!journey&&area==='cafe'&&cafe.state==='empty';
    callbacks.onCafeHints({exit,machine,cup:cafe.bounds});
  }
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  let drag=null;
  canvas.addEventListener('pointerdown',event=>{if(!ready||entryJourney||journey||arcadeJourney||claw.inGame||exhibitionJourney||cafe.state==='pouring'||event.button!==0)return;canvas.setPointerCapture(event.pointerId);drag={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,moved:false};});
  canvas.addEventListener('pointermove',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>5)drag.moved=true;
    if(drag.moved&&entered){tween=null;const euler=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');euler.y-=(event.clientX-drag.lastX)*.004;euler.x=THREE.MathUtils.clamp(euler.x-(event.clientY-drag.lastY)*.003,-.8,.8);camera.quaternion.setFromEuler(euler);requestFrame();}
    drag.lastX=event.clientX;drag.lastY=event.clientY;
  });
  canvas.addEventListener('pointerup',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    if(!drag.moved){
      const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
      if(!entered){
        if(raycaster.intersectObjects(entranceTargets,false).length)callbacks.onEnterRequest?.();
      }else{
        const targets=area==='cafe'?[cafe.machineTarget,cafe.exitPortal]:area==='arcade'?[claw.hitTarget,...entranceTargets]:[...hitTargets,cafe.portal,panelFace,...entranceTargets];
        const hits=raycaster.intersectObjects(targets,false);
        if(hits.length){const blockers=raycaster.intersectObjects(occluders,false);if(!blockers.length||blockers[0].distance>=hits[0].distance-.001){
          const data=hits[0].object.userData;
          if(data.action==='entrance'){if(area==='arcade')leaveArcade();else visitArcade();}else if(data.action==='claw')startClaw();else if(data.action==='cafe')visitCafe();else if(data.action==='exit-cafe')leaveCafe();else if(data.action==='coffee')pourCoffee();else if(data.action==='exhibition-switch')callbacks.onExhibitionSwitch?.();else callbacks.onSelect?.(data.index);
        }}
      }
    }
    drag=null;
  });
  canvas.addEventListener('pointercancel',()=>{drag=null;});
  canvas.addEventListener('keydown',event=>{
    if(ready&&!entered&&!entryJourney&&(event.key==='Enter'||event.key===' ')){event.preventDefault();callbacks.onEnterRequest?.();}
    else if(entered&&area==='arcade'&&(event.key==='Enter'||event.key===' ')){event.preventDefault();startClaw();}
  });
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;tween=null;lastFrame=null;if(exhibitionJourney){if(!exhibitionJourney.committed)exhibitionJourney.commit();const resolve=exhibitionJourney.resolve;exhibitionJourney=null;resolve();}callbacks.onContextLost?.();});
  canvas.addEventListener('webglcontextrestored',()=>{lost=false;lastFrame=null;callbacks.onContextRestored?.();requestFrame();});
  const resize=()=>{const {width,height}=container.getBoundingClientRect();renderer.setSize(width,height);cafe.resize(width,height);camera.aspect=width/Math.max(1,height);camera.fov=area==='arcade'?68:width<700?59:55;camera.updateProjectionMatrix();if(!entered&&!entryJourney)home();else if(selected>=0&&!entryJourney&&!journey)focus(selected,true);requestFrame();};
  const observer=new ResizeObserver(resize);observer.observe(container);
  resize();
  await Promise.all(loadTasks);
  ready=true;canvas.style.cursor='pointer';requestFrame();
  return {focus,overview,enter,home,visitCafe,leaveCafe,faceCafeDoor,pourCoffee,sipCoffee,replaceWorks,transitionExhibition,visitArcade,leaveArcade,startClaw,closeClaw,moveClaw,nudgeClaw,stopClaw,grabClaw,
    setSuspended(value){suspended=value;lastFrame=null;if(value)claw.stopMove();else requestFrame();},
    dispose(){cancelExhibition();claw.dispose();arcadeHall.dispose();botanical.dispose();motionPreference.removeEventListener?.('change',onMotionChange);observer.disconnect();cancelAnimationFrame(raf);disposables.forEach(x=>x.dispose());renderer.dispose();canvas.remove();},
  };
}
