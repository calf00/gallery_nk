import * as THREE from './vendor/three.module.min.js';

export const cafePose = { position:[.48,1.62,-6.08], target:[.48,1.28,-7.4] };
export const pourDuration = 2800;
export const cafeDoor = { width:.8, height:2.42, slideMs:750 };
const ease = t => t*t*(3-2*t);

// Travel through the opening and along the aisle, clear of the four stools.
export function cafePath(position, returning=false) {
  const points=[position.clone()], add=(x,z)=>points.push(new THREE.Vector3(x,1.62,z));
  if(returning){add(0,-5.05);add(0,-4.15);add(.9,-3.45);add(.9,0);add(0,0);}
  else{
    const side=position.x<-.1?-1:1;
    if(position.z>-3.45){add(side*.9,position.z);add(side*.9,-3.45);}
    else add(position.x,-4.02);
    add(0,-4.15);add(0,-5.05);add(cafePose.position[0],cafePose.position[2]);
  }
  const unique=points.filter((p,i)=>!i||p.distanceTo(points[i-1])>.02);
  return new THREE.CatmullRomCurve3(unique,false,'centripetal');
}

export function createCafe({scene,room,box,plane,material,canvasTexture,disposables,floorMat,wall,darkMetal,onCoffee}) {
  const back=-room.length/2, width=3.2, depth=3.2, end=back-depth;
  const opening=cafeDoor.width, height=cafeDoor.height;
  const charcoal=material('#202728'), wood=material('#bf9a65'), steel=material('#747f80',{metalness:.72,roughness:.32});
  const cream=material('#eee9de'), coffee=material('#352015',{roughness:.28});
  const basic=(color)=>{const m=new THREE.MeshBasicMaterial({color,toneMapped:false});disposables.push(m);return m;};
  const cylinder=(top,bottom,h,mat,x,y,z,parent=scene,openEnded=false)=>{
    const g=new THREE.CylinderGeometry(top,bottom,h,40,1,openEnded);disposables.push(g);
    const mesh=new THREE.Mesh(g,mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  };
  for(const side of [-1,1]){
    box((room.width-opening)/2,room.height,.14,wall,side*(room.width+opening)/4,room.height/2,back-.07);
    box(.045,height,.16,darkMetal,side*(opening/2+.02),height/2,back-.02);
  }
  box(opening,room.height-height,.14,wall,0,height+(room.height-height)/2,back-.07);
  box(opening+.09,.045,.16,darkMetal,0,height,back-.02);
  // A lightly tinted automatic sliding door, accessible from both sides.
  const door=new THREE.Group();door.name='cafe-sliding-door';door.position.z=back-.035;scene.add(door);
  const glass=new THREE.MeshPhysicalMaterial({color:'#e1d1b1',transparent:true,opacity:.24,roughness:.16,metalness:0,side:THREE.DoubleSide,depthWrite:false});disposables.push(glass);
  box(opening-.03,height-.055,.018,glass,0,height/2,0,door).castShadow=false;
  for(const x of [-(opening-.02)/2,(opening-.02)/2])box(.018,height,.025,darkMetal,x,height/2,0,door);
  for(const y of [.02,height-.02])box(opening,.025,.025,darkMetal,0,y,0,door);
  box(.14,.055,.045,darkMetal,0,height+.04,back+.025);
  box(width,.12,depth,floorMat,0,-.065,back-depth/2);
  box(width,.12,depth-.16,charcoal,0,2.62,back-depth/2-.08);
  box(.12,2.62,depth-.16,wood,-width/2-.06,1.31,back-depth/2-.08);
  box(.12,2.62,depth-.16,material('#888c86'),width/2+.06,1.31,back-depth/2-.08);
  box(width,2.62,.12,material('#828681'),0,1.31,end-.06);
  // Fine vertical timber joints, as in the reference alcove.
  for(let z=end+.1;z<back;z+=.16)box(.003,2.6,.008,material('#9b794f'),-width/2+.002,1.3,z);
  box(2.85,.81,.57,charcoal,0,.405,end+.33);
  box(2.96,.055,.68,wood,0,.84,end+.37);
  for(const x of [-.96,-.32,.32,.96]){
    box(.6,.69,.018,material('#2c3333'),x,.41,end+.625);
    box(.16,.013,.022,steel,x,.69,end+.645);
  }
  // Sink and tap, and the black exchange box beside the coffee machine.
  box(.46,.012,.3,steel,-.9,.874,end+.36);
  box(.36,.014,.22,darkMetal,-.9,.88,end+.36);
  cylinder(.016,.016,.23,steel,-.9,.97,end+.16);
  box(.032,.032,.14,steel,-.9,1.08,end+.22);
  box(.32,.81,.37,steel,1.07,1.275,end+.3).name='pin-exchange-box';
  box(.28,.4,.025,charcoal,1.07,1.33,end+.5);
  box(.2,.11,.025,darkMetal,1.07,1.63,end+.5);
  // Small table at the left; keep the passage to the counter open.
  box(.73,.045,.62,wood,-1.12,.72,back-1.27);
  for(const x of [-1.41,-.83])for(const z of [back-1.51,back-1.03])box(.028,.7,.028,darkMetal,x,.35,z);
  box(.36,.055,.35,charcoal,-1.12,.44,back-.7);
  for(const x of [-1.26,-.98])for(const z of [back-.83,back-.57])box(.02,.42,.02,darkMetal,x,.21,z);
  box(.36,.29,.03,charcoal,-1.12,.63,back-.52);
  // Warm under-ceiling strip, without a large sign or a new navigation panel.
  box(2.7,.024,.035,basic('#ffedc7'),0,2.49,end+.17);
  const light=new THREE.PointLight('#ffe3b4',8,5,2);light.position.set(.2,2.33,end+1.05);scene.add(light);
  const fillLight=new THREE.PointLight('#eef2eb',2,3,2);fillLight.position.set(.2,1.9,back-.8);scene.add(fillLight);
  const sign=canvasTexture(256,64,ctx=>{ctx.fillStyle='#253332';ctx.fillRect(0,0,256,64);ctx.fillStyle='#e3e5d8';ctx.textAlign='center';ctx.font='26px Georgia';ctx.fillText('café',128,43);});
  const signMat=basic('#ffffff');signMat.map=sign;plane(.48,.12,signMat,0,2.56,back+.015);
  const invisible=new THREE.MeshBasicMaterial({visible:false});disposables.push(invisible);
  const portal=plane(opening,height,invisible,0,height/2,back+.08);portal.userData.action='cafe';portal.name='cafe-opening';
  const exitPortal=plane(opening,height,invisible,0,height/2,back-.12);exitPortal.rotation.y=Math.PI;exitPortal.userData.action='exit-cafe';exitPortal.name='cafe-exit';

  const mx=.48,mz=end+.38,front=mz+.244;
  box(.47,.73,.46,charcoal,mx,1.24,mz).name='coffee-machine';
  box(.48,.045,.47,darkMetal,mx,1.62,mz);
  box(.38,.28,.024,material('#101717'),mx,1.435,front);
  const screen=canvasTexture(256,144,ctx=>{
    ctx.fillStyle='#253f3d';ctx.fillRect(0,0,256,144);ctx.textAlign='center';
    ctx.fillStyle='#e5e9dc';ctx.font='22px Georgia';ctx.fillText('COFFEE',128,53);
    ctx.strokeStyle='#a5b8a5';ctx.lineWidth=2;ctx.strokeRect(103,72,48,34);
    ctx.beginPath();ctx.arc(156,87,8,-Math.PI/2,Math.PI/2);ctx.stroke();
  });
  const screenMat=basic('#ffffff');screenMat.map=screen;plane(.26,.146,screenMat,mx,1.47,front+.014);
  box(.34,.31,.02,material('#0e1313'),mx,1.14,front-.008);
  box(.12,.055,.105,steel,mx,1.315,front+.017);
  cylinder(.014,.014,.054,darkMetal,mx,1.266,front+.065);
  box(.42,.035,.24,steel,mx,.908,front-.007);
  for(let x=mx-.18;x<mx+.19;x+=.035)box(.015,.003,.16,darkMetal,x,.928,front+.01);
  const machineTarget=plane(.5,.78,invisible,mx,1.27,front+.15);machineTarget.userData.action='coffee';machineTarget.name='coffee-target';

  function makeCup(parent) {
    const group=new THREE.Group();parent.add(group);
    const cupWall=cylinder(.125,.091,.34,cream,0,.17,0,group,true);
    cupWall.material.side=THREE.DoubleSide;
    cylinder(.118,.103,.12,material('#293c3c'),0,.165,0,group,true);
    const rimGeo=new THREE.TorusGeometry(.12,.009,10,48);disposables.push(rimGeo);
    const rim=new THREE.Mesh(rimGeo,cream);rim.rotation.x=Math.PI/2;rim.position.y=.34;group.add(rim);
    const liquid=cylinder(.113,.113,.009,coffee,0,.322,0,group);
    return {group,liquid};
  }
  const served=makeCup(scene);served.group.scale.setScalar(.52);served.group.position.set(mx,.934,front+.06);
  const stream=cylinder(.006,.006,1,coffee,mx,1.19,front+.065);stream.name='coffee-stream';stream.visible=false;
  const hud=new THREE.Scene(),hudCamera=new THREE.OrthographicCamera(-1,1,1,-1,.1,2000);hudCamera.position.z=800;
  hud.add(new THREE.HemisphereLight('#ffffff','#667677',2.5));
  const cupLight=new THREE.DirectionalLight('#fff2dc',3);cupLight.position.set(-200,400,600);hud.add(cupLight);
  const held=makeCup(hud);held.group.name='held-coffee';held.group.rotation.set(.28,0,-.12);
  let state='empty',elapsed=0,hudBounds=null;
  const notify=()=>onCoffee?.(state);
  function setDoor(progress){door.position.x=-(opening+.06)*progress;}
  function reset(){state='empty';elapsed=0;setDoor(0);stream.visible=false;served.group.visible=true;served.liquid.position.y=.03;held.group.visible=false;notify();}
  function pour(){if(state!=='empty')return false;state='pouring';elapsed=0;stream.visible=true;notify();return true;}
  function sip(){if(state!=='held')return false;state='sipping';elapsed=0;notify();return true;}
  function tick(delta){
    if(state==='pouring'){
      elapsed+=delta;const t=Math.min(1,elapsed/pourDuration),fill=.95+.155*t;
      served.liquid.position.y=.03+.292*t;
      stream.scale.y=Math.max(.001,1.242-fill);stream.position.y=(1.242+fill)/2;
      if(t===1){stream.visible=false;served.group.visible=false;state='held';elapsed=0;held.group.visible=true;notify();}
    }else if(state==='sipping'){
      elapsed+=delta;const t=Math.min(1,elapsed/1500),lift=Math.sin(Math.PI*ease(t));
      held.group.rotation.z=-.12-.45*lift;held.group.rotation.x=.28+.34*lift;
      if(hudBounds)held.group.position.y=hudBounds.baseY+lift*32;
      if(t===1){state='held';notify();}
    }
    return state==='pouring'||state==='sipping';
  }
  function resize(w,h){
    hudCamera.left=-w/2;hudCamera.right=w/2;hudCamera.top=h/2;hudCamera.bottom=-h/2;hudCamera.updateProjectionMatrix();
    const scale=w<700?240:330,reserve=h<500?12:(w<700?195:w<1100?153:44),cupH=scale*.38;
    const x=w-(w<700?57:76),baseY=-h/2+reserve;
    held.group.scale.setScalar(scale);held.group.position.set(x-w/2,baseY,0);
    hudBounds={x:x-scale*.135,y:h-reserve-cupH-15,width:scale*.33,height:cupH+30,baseY};
  }
  reset();
  return {portal,exitPortal,machineTarget,exchangePosition:new THREE.Vector3(1.07,1.30,end+.53),portalHint:new THREE.Vector3(0,2.55,back+.1),exitHint:new THREE.Vector3(0,1.7,back-.14),machineHint:new THREE.Vector3(mx,1.74,front+.15),hud,hudCamera,
    get state(){return state;},get bounds(){return hudBounds;},reset,pour,sip,tick,resize,setDoor,
    draw(renderer){if(state==='held'||state==='sipping'){renderer.autoClear=false;renderer.clearDepth();renderer.render(hud,hudCamera);renderer.autoClear=true;}},
  };
}
