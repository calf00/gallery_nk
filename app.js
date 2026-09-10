import { exhibition, room, placement, descriptions, locations } from './config.js?v=20260911-1';
const $=id=>document.getElementById(id);
const gallery=$('gallery'), indexDialog=$('index-dialog'), viewer=$('viewer-dialog');
const pad=n=>String(n).padStart(2,'0');
let works=[], scene=null, selected=-1, viewerIndex=0, entered=false, sceneFailed=false;
let noticeTimer;
function announce(text){$('notice').textContent=text;$('notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{$('notice').hidden=true;},4200);}
function syncSuspend(){scene?.setSuspended(document.hidden||indexDialog.open||viewer.open);}
function showIndex(){if(!works.length){location.href='./photos.html';return;}indexDialog.showModal();syncSuspend();}
$('index-button').addEventListener('click',showIndex);
for(const button of document.querySelectorAll('[data-close]'))button.addEventListener('click',()=>$(button.dataset.close).close());
for(const dialog of [indexDialog,viewer]) {
  dialog.addEventListener('close',syncSuspend);
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
}
document.addEventListener('visibilitychange',syncSuspend);
function enter(){
  if(sceneFailed||!scene){showIndex();return;}
  entered=true;gallery.classList.add('entered');gallery.classList.remove('welcome');$('tour-ui').hidden=false;
  $('intro').inert=true;scene.enter();updateSelection(-1);$('next-button').focus({preventScroll:true});
}
$('enter-button').addEventListener('click',enter);
$('home-button').addEventListener('click',()=>{
  entered=false;selected=-1;gallery.classList.remove('entered');gallery.classList.add('welcome');$('tour-ui').hidden=true;$('intro').inert=false;scene?.home();$('enter-button').focus({preventScroll:true});
});
function updateSelection(index){
  selected=index;const has=index>=0;
  $('current-title').textContent=has?`作品 ${pad(index+1)}`:exhibition.title;
  $('current-subtitle').textContent=has?locations[index]:'気になる写真をタップして、その前へ。';
  $('work-counter').textContent=has?`${pad(index+1)} / 12`:'ROOM VIEW';
  $('work-label').textContent=has?`A2 · ${works[index].orientation==='portrait'?'縦位置':'横位置'}`:'展示室を見渡す';
  $('previous-button').disabled=index<=0;$('next-button').disabled=index>=works.length-1;
  $('next-button').setAttribute('aria-label',has?'次の作品へ':'最初の作品へ');
  $('view-button').hidden=!has;
  for(const b of document.querySelectorAll('.map-work'))b.setAttribute('aria-current',String(Number(b.dataset.index)===index));
}
function selectWork(index,{open=false}={}){
  if(!Number.isInteger(index)||index<0||index>=works.length)return;
  if(!scene||sceneFailed){openViewer(index);return;}
  if(!entered)enter();
  const same=selected===index;
  updateSelection(index);scene.focus(index);
  if(open||same)openViewer(index);
}
$('next-button').addEventListener('click',()=>selectWork(selected+1));
$('previous-button').addEventListener('click',()=>selectWork(selected-1));
$('overview-button').addEventListener('click',()=>{updateSelection(-1);scene?.overview();});
$('view-button').addEventListener('click',()=>{if(selected>=0)openViewer(selected);});
function toggleMap(force){const expanded=force??$('map-toggle').getAttribute('aria-expanded')!=='true';$('map-toggle').setAttribute('aria-expanded',String(expanded));$('room-map').hidden=!expanded;$('map-card').classList.toggle('collapsed',!expanded);$('map-toggle').querySelector('span').textContent=expanded?'−':'＋';}
$('map-toggle').addEventListener('click',()=>toggleMap());
if(matchMedia('(max-width:700px), (max-height:650px)').matches)toggleMap(false);
function buildCollection(){
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
function stepViewer(delta){const index=viewerIndex+delta;if(index<0||index>=works.length)return;displayPhoto(index);if(scene&&!sceneFailed){updateSelection(index);scene.focus(index,true);}}
$('viewer-prev').addEventListener('click',()=>stepViewer(-1));$('viewer-next').addEventListener('click',()=>stepViewer(1));
$('viewer-image').addEventListener('error',()=>{$('viewer-error').hidden=false;$('viewer-image').hidden=true;});
$('retry-image').addEventListener('click',()=>displayPhoto(viewerIndex));
$('zoom-button').addEventListener('click',()=>{const zoomed=$('viewer-stage').classList.toggle('zoomed');$('zoom-button').setAttribute('aria-pressed',String(zoomed));$('zoom-button').textContent=zoomed?'全体を見る −':'拡大する ＋';});
window.addEventListener('keydown',event=>{
  if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
  if(event.key!=='ArrowRight'&&event.key!=='ArrowLeft')return;
  if(viewer.open){if($('viewer-stage').classList.contains('zoomed'))return;event.preventDefault();stepViewer(event.key==='ArrowRight'?1:-1);}
  else if(entered&&!indexDialog.open){event.preventDefault();selectWork(selected+(event.key==='ArrowRight'?1:-1));}
});
function fallback(message){sceneFailed=true;gallery.classList.add('fallback');$('scene').querySelector('canvas')?.remove();$('enter-button').disabled=false;$('enter-text').textContent='12枚の写真を見る';$('load-status').textContent=message;}
async function init(){
  try{
    const response=await fetch('./assets/manifest.json');if(!response.ok)throw new Error('manifest');works=await response.json();if(works.length!==12)throw new Error('count');buildCollection();
    const slow=setTimeout(()=>{$('load-status').textContent='読み込み中です。右上の作品一覧からも鑑賞できます。';},10000);
    try{
      const {createGalleryScene}=await import('./scene.js?v=20260911-1');
      scene=await createGalleryScene($('scene'),works,{
        onProgress(n,total){$('load-status').textContent=`展示室を準備中 ${n} / ${total}`;},
        onSelect:i=>selectWork(i),
        onSettled:i=>{if(entered&&i>=0&&i===selected)$('view-button').hidden=false;},
        onTextureError(){announce('一部の写真は、作品一覧からお楽しみください。');},
        onContextLost(){sceneFailed=true;announce('3D表示が中断しました。作品一覧から写真を見られます。');},
        onContextRestored(){sceneFailed=false;announce('3D表示が復帰しました。');},
      });
      syncSuspend();$('enter-button').disabled=false;$('enter-text').textContent='展示室に入る';$('load-status').textContent='お好きなペースで、ごゆっくり。';
    }catch(error){console.error('3D gallery unavailable:',error);fallback('この端末では写真一覧でお楽しみください。');}finally{clearTimeout(slow);}
  }catch(error){console.error('Gallery loading failed:',error);fallback('写真一覧を開いてお楽しみください。');}
}
init();
