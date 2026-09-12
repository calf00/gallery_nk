import { room, placement } from './config.js?v=20260911-entry';
import { collections } from './collections.js?v=20260912-corner';
let collectionKey='night', activeCollection=collections.night, descriptions=activeCollection.descriptions, locations=activeCollection.locations, switching=false;
const $=id=>document.getElementById(id);
const gallery=$('gallery'), indexDialog=$('index-dialog'), viewer=$('viewer-dialog');
const pad=n=>String(n).padStart(2,'0');
let works=[], scene=null, selected=-1, viewerIndex=0, entered=false, entering=false, sceneFailed=false;
let noticeTimer,cafeArea='gallery',cafeBusy=false,coffeeState='empty';
function announce(text){$('notice').textContent=text;$('notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{$('notice').hidden=true;},4200);}
function syncSuspend(){scene?.setSuspended(document.hidden||indexDialog.open||viewer.open);}
function showIndex(){if(switching)return;if(!works.length){location.href='./photos.html';return;}indexDialog.showModal();syncSuspend();}
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
  if(cafeBusy||switching)return;
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
  $('cafe-controls').hidden=area!=='cafe';$('cafe-return').disabled=busy;
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
$('cafe-entry').addEventListener('click',()=>scene?.visitCafe());
$('coffee-tap').addEventListener('click',()=>scene?.pourCoffee());
$('cafe-return').addEventListener('click',()=>scene?.faceCafeDoor());
$('cafe-exit').addEventListener('click',()=>scene?.leaveCafe());
$('coffee-cup').addEventListener('click',()=>scene?.sipCoffee());
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
  else if(entered&&!indexDialog.open&&!switching&&!cafeBusy&&cafeArea!=='cafe'){event.preventDefault();selectWork(selected+(event.key==='ArrowRight'?1:-1));}
});
function fallback(message){sceneFailed=true;gallery.classList.add('fallback');$('scene').querySelector('canvas')?.remove();$('enter-button').disabled=false;$('enter-text').textContent='12枚の写真を見る';$('load-status').textContent=message;}
async function init(){
  try{
    const response=await fetch('./assets/manifest.json');if(!response.ok)throw new Error('manifest');works=await response.json();if(works.length!==12)throw new Error('count');buildCollection();
    const slow=setTimeout(()=>{$('load-status').textContent='読み込み中です。右上の作品一覧からも鑑賞できます。';},10000);
    try{
      const {createGalleryScene}=await import('./scene.js?v=20260912-corner');
      scene=await createGalleryScene($('scene'),works,{
        onProgress(n,total){$('load-status').textContent=`展示室を準備中 ${n} / ${total}`;},
        onEnterRequest:enter,
        onEntered:finishEntry,
        onSelect:i=>selectWork(i),
        onCafeVisit(){updateSelection(-1);},
        onCafeState:syncCafe,
        onCoffee:syncCoffee,
        onCafeHints({portal,exit,machine,exhibitionPortal,cup}){
          for(const [id,point] of [['cafe-entry',portal],['cafe-exit',exit],['coffee-tap',machine],['exhibition-switch',exhibitionPortal]]){
            const button=$(id);button.hidden=!point.visible||switching;button.style.left=id==='exhibition-switch'?`clamp(calc(var(--switch-width)/2 + 10px), ${point.x}px, calc(100% - var(--switch-width)/2 - 10px))`:`${point.x}px`;button.style.top=`${point.y}px`;
          }
          $('cafe-return').hidden=exit.visible;
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
  if(switching||entering||cafeBusy)return;
  switching=true;const nextKey=collectionKey==='night'?'nature':'night',next=collections[nextKey];
  const botanicalTransition=nextKey==='nature'&&entered&&scene&&!sceneFailed;
  const mode=botanicalTransition?'petals':'dark';
  const wasIndex=indexDialog.open;if(wasIndex)indexDialog.close();
  gallery.inert=true;gallery.classList.add('changing-exhibition');transitionLayer.hidden=false;transitionLayer.dataset.mode=mode;
  transitionLayer.style.opacity='0';transitionLayer.style.transform='none';
  $('transition-title').textContent=next.label;$('transition-kicker').textContent='NEXT EXHIBITION';
  try{
    await transitionAnimation([{opacity:0},{opacity:1}],botanicalTransition?250:650);
    const response=await fetch(next.manifest);if(!response.ok)throw new Error('manifest');
    const nextWorks=await response.json();if(nextWorks.length!==12)throw new Error('count');
    if(scene&&!sceneFailed)await scene.transitionExhibition(nextWorks,next.english,nextKey==='nature',{animate:entered});
    works=nextWorks;collectionKey=nextKey;activeCollection=next;descriptions=next.descriptions;locations=next.locations;
    buildCollection();updateSelection(-1);
    $('index-title').textContent=nextKey==='nature'?'自然の12枚':'12の夜景';
    document.querySelector('.index-description').textContent=next.intro;
    document.querySelector('.index-footer').firstChild.textContent=`NAGATA KOSHI — ${next.title}`;
    document.querySelector('.edition').textContent=next.english+' · 12 WORKS';
    const destination=collections[nextKey==='night'?'nature':'night'];
    $('switch-label').textContent=destination.switchLabel;
    $('exhibition-switch').setAttribute('aria-label',`${destination.switchLabel}：${destination.label}に切り替える`);
    $('index-switch').textContent=collections[nextKey==='night'?'nature':'night'].label+'へ ↗';
    $('scene').setAttribute('aria-label',next.label+'、12枚の写真が並ぶ展示室');
    if(entered&&scene&&!sceneFailed)scene.overview(true);
    if((wasIndex&&!entered)||sceneFailed)showIndexAfterSwitch=true;
    await transitionAnimation([{opacity:1},{opacity:0}],botanicalTransition?400:750);
    announce(next.label+'へ切り替わりました。');
  }catch(error){console.error('Collection switch failed:',error);announce('展示を読み込めませんでした。もう一度お試しください。');}
  finally{
    transitionLayer.hidden=true;gallery.inert=false;gallery.classList.remove('changing-exhibition');switching=false;
    if(showIndexAfterSwitch){showIndexAfterSwitch=false;showIndex();}else $('overview-button').focus({preventScroll:true});
    syncSuspend();
  }
}
let showIndexAfterSwitch=false;
$('exhibition-switch').addEventListener('click',switchCollection);
$('index-switch').addEventListener('click',switchCollection);
