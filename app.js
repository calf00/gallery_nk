import { room, placement } from './config.js?v=20260913-garden';
import { collections } from './collections.js?v=20260913-garden';
let collectionKey='night', activeCollection=collections.night, descriptions=activeCollection.descriptions, locations=activeCollection.locations, switching=false;
const $=id=>document.getElementById(id);
const gallery=$('gallery'), indexDialog=$('index-dialog'), viewer=$('viewer-dialog');
const pad=n=>String(n).padStart(2,'0');
let works=[], scene=null, selected=-1, viewerIndex=0, entered=false, entering=false, sceneFailed=false;
let noticeTimer,cafeArea='gallery',cafeBusy=false,coffeeState='empty';
let arcadeArea='gallery',arcadeBusy=false,clawState={phase:'idle',inGame:false,canMove:false,canGrab:false};
let questState={phase:'empty',item:null,busy:false,escaped:false};
function announce(text){$('notice').textContent=text;$('notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{$('notice').hidden=true;},4200);}
function syncSuspend(){scene?.setSuspended(document.hidden||indexDialog.open||viewer.open);}
function showIndex(){if(switching||arcadeBusy||clawState.inGame||questState.busy||questState.escaped)return;if(!works.length){location.href='./photos.html';return;}indexDialog.showModal();syncSuspend();}
$('index-button').addEventListener('click',showIndex);
for(const button of document.querySelectorAll('[data-close]'))button.addEventListener('click',()=>$(button.dataset.close).close());
for(const dialog of [indexDialog,viewer]) {
  dialog.addEventListener('close',syncSuspend);
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
}
document.addEventListener('visibilitychange',syncSuspend);
function enter(){
  if(entered||entering||switching)return;
  if(sceneFailed||!scene){showIndex();return;}
  entering=true;gallery.classList.add('entering');$('intro').inert=true;
  $('enter-button').disabled=true;$('index-button').disabled=true;
  $('entry-status').hidden=false;scene.enter();
}
function finishEntry(){
  if(!entering)return;
  entering=false;entered=true;gallery.classList.add('entered');gallery.classList.remove('welcome','entering');
  $('tour-ui').hidden=false;$('entry-status').hidden=true;$('index-button').disabled=false;
  updateSelection(-1);$('next-button').focus({preventScroll:true});
}
$('enter-button').addEventListener('click',enter);
$('home-button').addEventListener('click',()=>{
  if(questState.busy||questState.escaped)return;
  entered=false;entering=false;selected=-1;gallery.classList.remove('entered','entering');gallery.classList.add('welcome');
  $('tour-ui').hidden=true;$('entry-status').hidden=true;$('intro').inert=false;
  $('enter-button').disabled=!scene&&!sceneFailed;$('index-button').disabled=false;
  scene?.home();$('enter-button').focus({preventScroll:true});
});
function updateSelection(index){
  selected=index;const has=index>=0;gallery.classList.toggle('viewing-work',has);
  $('current-title').textContent=has?`作品 ${pad(index+1)}`:activeCollection.title;
  $('current-subtitle').textContent=has?locations[index]:'気になる写真をタップして、その前へ。';
  $('work-counter').textContent=has?`${pad(index+1)} / 12`:'GALLERY';
  $('work-label').textContent=has?(locations[index]||activeCollection.label):activeCollection.label;
  $('previous-button').disabled=index<=0;$('next-button').disabled=index>=works.length-1;
  $('next-button').setAttribute('aria-label',has?'次の作品へ':'最初の作品へ');
  $('view-button').hidden=!has;
  for(const b of document.querySelectorAll('.map-work'))b.setAttribute('aria-current',String(Number(b.dataset.index)===index));
}
function selectWork(index,{open=false}={}){
  if(!Number.isInteger(index)||index<0||index>=works.length)return;
  if(!scene||sceneFailed){openViewer(index);return;}
  if(cafeBusy||switching||arcadeBusy||clawState.inGame||questState.busy||questState.escaped)return;
  if(arcadeArea==='arcade'){scene.leaveArcade(()=>selectWork(index,{open}));return;}
  if(cafeArea==='cafe'){scene.leaveCafe(()=>selectWork(index,{open}));return;}
  if(entering)return;
  if(!entered){openViewer(index);return;}
  const same=selected===index;
  updateSelection(index);scene.focus(index);
  if(open||same)openViewer(index);
}
$('next-button').addEventListener('click',()=>selectWork(selected+1));
$('previous-button').addEventListener('click',()=>selectWork(selected-1));
$('overview-button').addEventListener('click',()=>{if(cafeBusy||switching)return;updateSelection(-1);scene?.overview();});
$('view-button').addEventListener('click',()=>{if(selected>=0)openViewer(selected);});
function toggleMap(force){const expanded=force??$('map-toggle').getAttribute('aria-expanded')!=='true';$('map-toggle').setAttribute('aria-expanded',String(expanded));$('room-map').hidden=!expanded;$('map-card').classList.toggle('collapsed',!expanded);$('map-toggle').querySelector('span').textContent=expanded?'−':'＋';}
$('map-toggle').addEventListener('click',()=>toggleMap());
if(matchMedia('(max-width:700px), (max-height:650px)').matches)toggleMap(false);
function syncCafe({area,busy}){
  cafeArea=area;cafeBusy=busy;
  gallery.classList.toggle('in-cafe',area==='cafe');gallery.classList.toggle('cafe-busy',busy);
  $('cafe-controls').hidden=area!=='cafe';
  $('coffee-tap').disabled=busy;$('index-button').disabled=busy||entering;
  $('coffee-cup').disabled=busy||coffeeState==='sipping';
  $('coffee-status').textContent=coffeeState==='pouring'?'コーヒーを注いでいます…':busy?'移動しています…':coffeeState==='empty'?'マシンをタップして、一杯どうぞ。':'コーヒーと一緒に、ゆっくりどうぞ。';
}
function syncCoffee(state){
  const received=coffeeState==='pouring'&&state==='held';coffeeState=state;
  const carrying=state==='held'||state==='sipping';gallery.classList.toggle('has-coffee',carrying);
  $('coffee-cup').hidden=!carrying;$('coffee-cup').disabled=state==='sipping'||cafeBusy;
  if(received){toggleMap(false);announce('コーヒーをどうぞ。右下のカップをタップすると、ひと口。');}
}
$('coffee-tap').addEventListener('click',()=>scene?.pourCoffee());
$('cafe-exit').addEventListener('click',()=>scene?.leaveCafe());
$('coffee-cup').addEventListener('click',()=>scene?.sipCoffee());
const clawHeld=new Map(),clawKeys=new Map();
function applyClawInput(){
  for(const axis of ['x','z']){
    const directions=[...clawHeld.values(),...clawKeys.values()].filter(value=>value.axis===axis);
    scene?.moveClaw(axis,Math.sign(directions.reduce((sum,value)=>sum+value.direction,0)));
  }
}
function stopClawInput(){clawHeld.clear();clawKeys.clear();scene?.stopClaw();for(const button of document.querySelectorAll('[data-claw-axis]'))button.classList.remove('held');}
function syncPrizeButton(){
  $('arcade-start').hidden=clawState.phase==='won'&&questState.phase!=='empty';
  $('arcade-start').textContent=clawState.phase==='won'?'ピンを取る':'タッチしてあそぶ';
}
function syncQuest(state){
  questState=state;gallery.classList.toggle('quest-busy',state.busy);gallery.classList.toggle('escaped',state.escaped);
  $('held-item').hidden=!state.item;$('held-pin').toggleAttribute('hidden',state.item!=='pin');$('held-key').toggleAttribute('hidden',state.item!=='key');
  $('held-item-label').textContent=state.item==='key'?'鍵':'ピン';
  $('held-item').setAttribute('aria-label',state.item==='key'?'持っている鍵':'持っているピン');
  $('exchange-action').textContent=state.phase==='key-ready'?'鍵を取る':'ピンを入れる';
  if(state.busy||state.escaped)$('exchange-action').hidden=true;
  $('escape-ending').hidden=!state.escaped;syncPrizeButton();
}
function syncArcade({area,busy}){
  arcadeArea=area;arcadeBusy=busy;$('index-switch').disabled=area==='arcade'||busy;
  gallery.classList.toggle('in-arcade',area==='arcade');gallery.classList.toggle('arcade-travelling',busy);
  $('arcade-controls').hidden=area!=='arcade'||busy||clawState.inGame;
  syncPrizeButton();
  $('arcade-return').disabled=busy;$('index-button').disabled=busy||clawState.inGame||cafeBusy||entering;
  $('arcade-travel-status').hidden=!busy;
  $('scene').querySelector('canvas')?.setAttribute('aria-label',area==='arcade'?'UFOキャッチャー。タッチ、またはEnterキーでゲーム開始。':'3D展示室。ドラッグで見回す。入口の扉をタップすると廊下へ。');
}
function syncClaw(state){
  clawState=state;if(!state.canMove)stopClawInput();
  if(arcadeArea==='arcade')$('scene').querySelector('canvas')?.setAttribute('aria-label',state.phase==='won'?'UFOキャッチャー。景品獲得、ゲーム終了。':state.inGame?'UFOキャッチャー。矢印ボタンで左右・前後に移動し、つかむボタンで景品を取る。':'UFOキャッチャー。タッチ、またはEnterキーでゲーム開始。');
  gallery.classList.toggle('playing-claw',state.inGame);
  $('claw-controls').hidden=!state.inGame;$('claw-result').hidden=!state.inGame||state.phase!=='won';
  $('claw-inputs').hidden=state.phase==='won';
  $('claw-close').disabled=state.inGame&&!['aiming','won','idle'].includes(state.phase);
  $('claw-grab').disabled=!state.canGrab;
  for(const button of document.querySelectorAll('[data-claw-axis]'))button.disabled=!state.canMove;
  $('claw-status').textContent=state.canMove?'押している間、移動':state.phase==='won'?'':'つかんでいます…';
  $('arcade-controls').hidden=arcadeArea!=='arcade'||arcadeBusy||state.inGame;
  syncPrizeButton();
  $('index-button').disabled=arcadeBusy||state.inGame||cafeBusy||entering;
}
$('hallway-button').addEventListener('click',()=>scene?.visitArcade());
$('arcade-return').addEventListener('click',()=>scene?.leaveArcade());
$('arcade-start').addEventListener('click',()=>clawState.phase==='won'?scene?.collectPrize():scene?.startClaw());
$('arcade-exit').addEventListener('click',()=>scene?.exitArcade());
$('exchange-action').addEventListener('click',()=>scene?.exchangePin());
$('held-item').addEventListener('click',()=>{
  if(questState.item==='pin'){if(cafeArea==='cafe')scene?.exchangePin();else announce('カフェの黒い箱に入れられそう。');}
  else if(questState.item==='key'){if(arcadeArea==='arcade')scene?.exitArcade();else announce('UFOキャッチャーの部屋に出口があります。');}
});
$('claw-close').addEventListener('click',()=>{stopClawInput();scene?.closeClaw();});
$('claw-grab').addEventListener('click',()=>{stopClawInput();scene?.grabClaw();});
for(const button of document.querySelectorAll('[data-claw-axis]')){
  const value={axis:button.dataset.clawAxis,direction:Number(button.dataset.clawDirection)};
  button.addEventListener('pointerdown',event=>{
    if(!clawState.canMove||event.button!==0)return;
    event.preventDefault();button.setPointerCapture(event.pointerId);scene?.nudgeClaw(value.axis,value.direction);clawHeld.set(event.pointerId,value);button.classList.add('held');applyClawInput();
  });
  const release=event=>{clawHeld.delete(event.pointerId);button.classList.remove('held');applyClawInput();};
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
  button.addEventListener('click',event=>{if(event.detail===0&&clawState.canMove)scene?.nudgeClaw(value.axis,value.direction);});
  // Space/Enter on focused movement buttons use the same hold-and-release action.
  button.addEventListener('keydown',event=>{if(![' ','Enter'].includes(event.key)||!clawState.canMove)return;event.preventDefault();clawKeys.set(event.key,value);button.classList.add('held');applyClawInput();});
  button.addEventListener('keyup',event=>{if(![' ','Enter'].includes(event.key))return;event.preventDefault();clawKeys.delete(event.key);button.classList.remove('held');applyClawInput();});
  button.addEventListener('blur',stopClawInput);
}
const clawArrowKeys={ArrowLeft:{axis:'x',direction:-1},ArrowRight:{axis:'x',direction:1},ArrowUp:{axis:'z',direction:-1},ArrowDown:{axis:'z',direction:1}};
window.addEventListener('keydown',event=>{
  if(!clawState.inGame||event.altKey||event.ctrlKey||event.metaKey)return;
  if(clawArrowKeys[event.key]){event.preventDefault();if(clawState.canMove){clawKeys.set(event.key,clawArrowKeys[event.key]);applyClawInput();}}
  if(event.key==='Escape'&&!$('claw-close').disabled){event.preventDefault();scene?.closeClaw();}
});
window.addEventListener('keyup',event=>{if(clawKeys.delete(event.key))applyClawInput();});
window.addEventListener('blur',stopClawInput);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopClawInput();});
function buildCollection(){
  $('works-grid').replaceChildren();$('room-map').replaceChildren();
  works.forEach((work,i)=>{
    const card=document.createElement('button');card.className='work-card';card.setAttribute('aria-label',`作品 ${pad(i+1)} を見る。${descriptions[i]}`);
    const image=document.createElement('img');image.src=`./assets/${work.thumb_filename}`;image.alt=descriptions[i];image.width=work.thumb_width;image.height=work.thumb_height;image.loading='lazy';
    const frame=document.createElement('span');frame.className='thumb-frame';frame.append(image);
    const meta=document.createElement('span');meta.className='card-meta';
    const number=document.createElement('span');number.className='card-number';number.textContent=pad(i+1);
    const size=document.createElement('span');size.textContent=`A2 / ${work.orientation==='portrait'?'縦':'横'}`;meta.append(number,size);card.append(frame,meta);
    card.addEventListener('click',()=>{indexDialog.close();selectWork(i,{open:true});});$('works-grid').append(card);
    const p=placement(i),dot=document.createElement('button');dot.className='map-work';dot.dataset.index=i;dot.textContent=pad(i+1);dot.setAttribute('aria-label',`作品 ${pad(i+1)} の前へ`);dot.setAttribute('aria-current','false');
    dot.style.left=p.side==='left'?'3%':'97%';dot.style.top=`${(room.length/2-p.z)/room.length*100}%`;dot.addEventListener('click',()=>selectWork(i));$('room-map').append(dot);
  });
  for(const z of room.seats){const s=document.createElement('span');s.className='map-seat';s.style.top=`${(room.length/2-z)/room.length*100}%`;s.setAttribute('aria-hidden','true');$('room-map').append(s);}
  for(const z of room.columns)for(const side of ['left','right']){const p=document.createElement('span');p.className='map-column';p.style[side]='0';p.style.top=`${(room.length/2-z)/room.length*100}%`;p.setAttribute('aria-hidden','true');$('room-map').append(p);}
}
function resetZoom(){ $('viewer-stage').classList.remove('zoomed');$('zoom-button').setAttribute('aria-pressed','false');$('zoom-button').textContent='拡大する ＋';$('viewer-stage').scrollTo(0,0); }
function displayPhoto(index){
  viewerIndex=index;resetZoom();const work=works[index],img=$('viewer-image');
  $('viewer-title').textContent=`作品 ${pad(index+1)}`;$('viewer-count').textContent=`${pad(index+1)} / 12`;
  $('viewer-size').textContent=work.orientation==='portrait'?'A2 · 420 × 594 mm':'A2 · 594 × 420 mm';
  $('viewer-error').hidden=true;img.hidden=false;img.alt=descriptions[index];img.src=`./assets/${work.filename}`;
  $('viewer-prev').disabled=index===0;$('viewer-next').disabled=index===works.length-1;
}
function openViewer(index){displayPhoto(index);if(!viewer.open)viewer.showModal();syncSuspend();}
function stepViewer(delta){const index=viewerIndex+delta;if(index<0||index>=works.length)return;displayPhoto(index);if(entered&&scene&&!sceneFailed){updateSelection(index);scene.focus(index,true);}}
$('viewer-prev').addEventListener('click',()=>stepViewer(-1));$('viewer-next').addEventListener('click',()=>stepViewer(1));
$('viewer-image').addEventListener('error',()=>{$('viewer-error').hidden=false;$('viewer-image').hidden=true;});
$('retry-image').addEventListener('click',()=>displayPhoto(viewerIndex));
$('zoom-button').addEventListener('click',()=>{const zoomed=$('viewer-stage').classList.toggle('zoomed');$('zoom-button').setAttribute('aria-pressed',String(zoomed));$('zoom-button').textContent=zoomed?'全体を見る −':'拡大する ＋';});
window.addEventListener('keydown',event=>{
  if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
  if(event.key!=='ArrowRight'&&event.key!=='ArrowLeft')return;
  if(viewer.open){if($('viewer-stage').classList.contains('zoomed'))return;event.preventDefault();stepViewer(event.key==='ArrowRight'?1:-1);}
  else if(entered&&!indexDialog.open&&!switching&&!cafeBusy&&!arcadeBusy&&!clawState.inGame&&arcadeArea!=='arcade'&&cafeArea!=='cafe'){event.preventDefault();selectWork(selected+(event.key==='ArrowRight'?1:-1));}
});
function fallback(message){sceneFailed=true;gallery.classList.add('fallback');$('scene').querySelector('canvas')?.remove();$('enter-button').disabled=false;$('enter-text').textContent='12枚の写真を見る';$('load-status').textContent=message;}
async function init(){
  try{
    const response=await fetch('./assets/manifest.json');if(!response.ok)throw new Error('manifest');works=await response.json();if(works.length!==12)throw new Error('count');buildCollection();
    const slow=setTimeout(()=>{$('load-status').textContent='読み込み中です。右上の作品一覧からも鑑賞できます。';},10000);
    try{
      const {createGalleryScene}=await import('./scene.js?v=20260913-escape');
      scene=await createGalleryScene($('scene'),works,{
        onProgress(n,total){$('load-status').textContent=`展示室を準備中 ${n} / ${total}`;},
        onEnterRequest:enter,
        onEntered:finishEntry,
        onSelect:i=>selectWork(i),
        onExhibitionSwitch:switchCollection,
        onCafeVisit(){updateSelection(-1);},
        onCafeState:syncCafe,
        onArcadeVisit(){updateSelection(-1);},
        onArcadeState:syncArcade,
        onClawState:syncClaw,
        onQuestState:syncQuest,
        onNotice:announce,
        onQuestHint(point){const button=$('exchange-action');button.hidden=!point.visible;button.style.left=`${point.x}px`;button.style.top=`${point.y}px`;},
        onCoffee:syncCoffee,
        onCafeHints({exit,machine,cup}){
          for(const [id,point] of [['cafe-exit',exit],['coffee-tap',machine]]){
            const button=$(id);button.hidden=!point.visible||switching;button.style.left=`${point.x}px`;button.style.top=`${point.y}px`;
          }
          if(cafeArea==='cafe'&&!cafeBusy){
            const message=exit.visible?'ガラスの扉をタップして、展示室へ。':coffeeState==='empty'?'マシンをタップして、一杯どうぞ。':'コーヒーと一緒に、ゆっくりどうぞ。';
            if($('coffee-status').textContent!==message)$('coffee-status').textContent=message;
          }
          if(cup){const button=$('coffee-cup');button.style.left=`${cup.x}px`;button.style.top=`${cup.y}px`;button.style.width=`${cup.width}px`;button.style.height=`${cup.height}px`;}
        },
        onSettled:i=>{if(entered&&i>=0&&i===selected)$('view-button').hidden=false;},
        onTextureError(){announce('一部の写真は、作品一覧からお楽しみください。');},
        onContextLost(){sceneFailed=true;$('index-button').disabled=false;if(entering){scene.home();entering=false;gallery.classList.remove('entering');$('intro').inert=false;$('entry-status').hidden=true;$('enter-button').disabled=false;$('index-button').disabled=false;}announce('3D表示が中断しました。作品一覧から写真を見られます。');},
        onContextRestored(){sceneFailed=false;$('index-button').disabled=cafeBusy;announce('3D表示が復帰しました。');},
      });
      syncSuspend();$('enter-button').disabled=false;$('enter-text').textContent='扉を開けて入る';$('load-status').textContent='扉をクリックして、写真展へ。';
    }catch(error){console.error('3D gallery unavailable:',error);fallback('この端末では写真一覧でお楽しみください。');}finally{clearTimeout(slow);}
  }catch(error){console.error('Gallery loading failed:',error);fallback('写真一覧を開いてお楽しみください。');}
}
init();

// Petals and a growing tree accompany the transition into the nature exhibition.
const transitionLayer=$('collection-transition');
async function transitionAnimation(frames,duration){
  const animation=transitionLayer.animate(frames,{duration:matchMedia('(prefers-reduced-motion: reduce)').matches?1:duration,easing:'ease-in-out',fill:'forwards'});
  await animation.finished;animation.commitStyles();animation.cancel();
}
async function switchCollection(){
  if(switching||entering||cafeBusy||arcadeBusy||clawState.inGame||questState.busy||questState.escaped||arcadeArea==='arcade')return;
  switching=true;const nextKey=collectionKey==='night'?'nature':'night',next=collections[nextKey];
  const botanicalTransition=nextKey==='nature'&&entered&&scene&&!sceneFailed;
  const mode=botanicalTransition?'petals':'dark';
  const wasIndex=indexDialog.open;if(wasIndex)indexDialog.close();
  gallery.inert=true;gallery.classList.add('changing-exhibition');transitionLayer.hidden=false;transitionLayer.dataset.mode=mode;
  transitionLayer.style.opacity='0';transitionLayer.style.transform='none';
  $('transition-title').textContent=next.label;$('transition-kicker').textContent='NEXT EXHIBITION';
  try{
    const [response]=await Promise.all([
      fetch(next.manifest),
      transitionAnimation([{opacity:0},{opacity:1}],botanicalTransition?120:300),
    ]);
    if(!response.ok)throw new Error('manifest');
    const nextWorks=await response.json();if(nextWorks.length!==12)throw new Error('count');
    if(scene&&!sceneFailed)await scene.transitionExhibition(nextWorks,next.english,nextKey==='nature',{animate:entered,title:next.title});
    works=nextWorks;collectionKey=nextKey;activeCollection=next;descriptions=next.descriptions;locations=next.locations;
    buildCollection();updateSelection(-1);
    $('index-title').textContent=next.title;
    document.title=next.title+' — Online Gallery';
    document.querySelector('.brand-name span').textContent=next.title;
    document.querySelector('.japanese-title').textContent=next.title;
    document.querySelector('.index-description').textContent=next.intro;
    document.querySelector('.index-footer').firstChild.textContent=`NAGATA KOSHI — ${next.title}`;
    document.querySelector('.edition').textContent=next.english+' · 12 WORKS';
    $('index-switch').textContent=collections[nextKey==='night'?'nature':'night'].label+'へ ↗';
    $('scene').setAttribute('aria-label',next.label+'、12枚の写真が並ぶ展示室');
    if(entered&&scene&&!sceneFailed)scene.overview(true);
    if((wasIndex&&!entered)||sceneFailed)showIndexAfterSwitch=true;
    await transitionAnimation([{opacity:1},{opacity:0}],botanicalTransition?260:400);
    announce(next.label+'へ切り替わりました。');
  }catch(error){console.error('Collection switch failed:',error);announce('展示を読み込めませんでした。もう一度お試しください。');}
  finally{
    transitionLayer.hidden=true;gallery.inert=false;gallery.classList.remove('changing-exhibition');switching=false;
    if(showIndexAfterSwitch){showIndexAfterSwitch=false;showIndex();}else $('overview-button').focus({preventScroll:true});
    syncSuspend();
  }
}
let showIndexAfterSwitch=false;
$('index-switch').addEventListener('click',switchCollection);
