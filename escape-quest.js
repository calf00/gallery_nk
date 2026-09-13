import * as THREE from './vendor/three.module.min.js';

// The item exchange is shared by the gallery, cafe and arcade visits.
export function createEscapeQuest({scene,exchangePosition,onChange=()=>{}}){
  const group=new THREE.Group();group.name='pin-key-exchange';group.position.copy(exchangePosition);scene.add(group);
  const resources=new Set(),own=value=>(resources.add(value),value);
  const surface=(color,props={})=>own(new THREE.MeshStandardMaterial({color,roughness:.4,...props}));
  const dark=surface('#0d1517'),steel=surface('#939c99',{metalness:.65}),ivory=surface('#f3f0e5'),red=surface('#c43b52');
  const gold=surface('#eac46b',{metalness:.55,roughness:.24,emissive:'#71551b',emissiveIntensity:.16});
  function mesh(geo,mat,xyz,parent=group,name=''){
    const m=new THREE.Mesh(own(geo),mat);m.position.set(...xyz);m.name=name;parent.add(m);return m;
  }
  const box=(w,h,d,mat,x,y,z,parent=group,name='')=>mesh(new THREE.BoxGeometry(w,h,d),mat,[x,y,z],parent,name);
  box(.23,.31,.018,dark,0,.038,0);
  for(const x of [-.118,.118])box(.007,.32,.025,steel,x,.038,0);
  box(.25,.015,.16,steel,0,-.246,.058);
  box(.22,.065,.013,dark,0,-.218,-.003);
  // A small pin silhouette makes the socket recognizable without a text label.
  const outline=mesh(new THREE.LatheGeometry([new THREE.Vector2(.016,0),new THREE.Vector2(.031,.046),new THREE.Vector2(.014,.112),new THREE.Vector2(.012,.149),new THREE.Vector2(.019,.168),new THREE.Vector2(0,.189)],20),steel,[0,-.079,.013]);
  outline.scale.z=.18;
  const inserted=new THREE.Group();inserted.name='inserted-prize-pin';group.add(inserted);inserted.visible=false;
  mesh(new THREE.LatheGeometry([[.025,0],[.046,.052],[.044,.096],[.023,.152],[.017,.199],[.028,.239],[0,.266]].map(([x,y])=>new THREE.Vector2(x,y)),24),ivory,[0,0,0],inserted);
  mesh(new THREE.CylinderGeometry(.019,.019,.014,24),red,[0,.198,0],inserted);
  const key=new THREE.Group();key.name='exchange-key';key.position.set(0,-.19,.065);key.rotation.z=-.6;group.add(key);key.visible=false;
  mesh(new THREE.TorusGeometry(.034,.008,10,28),gold,[0,.04,0],key);
  box(.014,.105,.016,gold,0,-.029,0,key);box(.035,.014,.016,gold,.012,-.062,0,key);box(.029,.013,.016,gold,.009,-.041,0,key);
  const hitMat=own(new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
  const target=box(.32,.66,.012,hitMat,0,.005,.18,group,'exchange-box-target');target.userData.action='exchange-pin';
  const hint=exchangePosition.clone().add(new THREE.Vector3(0,.49,.18));
  let state='empty',elapsed=0,disposed=false;
  const snapshot=()=>({phase:state,item:state==='pin'?'pin':state==='key'?'key':null,busy:state==='exchanging'||state==='exiting',escaped:state==='escaped'});
  const setState=next=>{state=next;onChange(snapshot());};
  return {group,target,hint,
    collectPin(){if(disposed||state!=='empty')return false;setState('pin');return true;},
    insertPin(){if(disposed||state!=='pin')return false;elapsed=0;inserted.visible=true;outline.visible=false;setState('exchanging');return true;},
    collectKey(){if(disposed||state!=='key-ready')return false;key.visible=false;setState('key');return true;},
    beginExit(){if(disposed||state!=='key')return false;setState('exiting');return true;},
    finishExit(){if(disposed||state!=='exiting')return false;setState('escaped');return true;},
    tick(delta){
      if(disposed||state!=='exchanging')return false;
      elapsed+=Math.max(0,Number.isFinite(delta)?delta:0);
      const t=Math.min(1,elapsed/1000),e=t*t*(3-2*t);
      inserted.position.set(0,-.10,.18*(1-e));inserted.scale.setScalar(1-.92*e);
      if(elapsed>=1000){inserted.visible=false;key.visible=true;key.scale.setScalar(Math.min(1,(elapsed-1000)/500));}
      if(elapsed>=1500){key.scale.setScalar(1);setState('key-ready');}
      return state==='exchanging';
    },
    get state(){return snapshot();},
    dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const resource of resources)resource.dispose();resources.clear();}
  };
}
