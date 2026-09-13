// Editable copy and provisional dimensions. One 3D scene unit = one metre.
export const exhibition = { title: '写真展：鳥瞰図', englishTitle: 'AFTER HOURS' };
export const room = { width:4.6, length:9.4, height:2.95, columnDepth:.24, columnWidth:.32,
  columns:[2.45,.05,-2.75], slots:[3.4,1.75,.85,-.95,-1.85,-3.7], seats:[1.55,.9,-1.4,-2.05], hangingHeight:1.5 };
export const files=['P1000523.JPG','P1011571.jpg','P1011578.jpg','IMG_8814.JPG','P1011576.jpg','P1011437.jpg','P1011820.jpg','P1011815.JPG','P1011828.JPG','P1011541.JPEG','P1011579.JPEG','P1011801.JPG'];
// 作品 01〜12 の場所。各行の「東京」を編集すると、作品名の下に反映されます。
export const locations=[
  '東京', // 01
  '東京', // 02
  '東京', // 03
  '東京', // 04
  '東京', // 05
  '東京', // 06
  '東京', // 07
  '東京', // 08
  '東京', // 09
  '東京', // 10
  '東京', // 11
  '東京', // 12
];
export const descriptions=[
  '青い夜の大通りを、オレンジと白の光跡が伸びる。',
  '斜め上空から見下ろした交差点と、重なり合う街の明かり。',
  'ビルの間を縦に貫く、夜の街路と看板の光。',
  '街角の風景を横切り、幾重にも流れていく光。',
  '真上に近い視点から見た、大きな交差点と走る車。',
  'オレンジ色の街灯と、二方向に分かれる長い光跡。',
  'オレンジに輝く東京タワーと、広がる夜の街。',
  '斜めに傾いた街の中を、明るい幹線道路が貫く。',
  '深い闇の中に浮かぶ東京タワーと、青白い道路の光。',
  'ガラス越しの街の明かりに、室内の光と人影が重なる。',
  '高い場所から見下ろした街。交差点と建物が幾何学的に重なる。',
  '濃い青の夜空の下、街の中心をまっすぐに伸びる光。'];
export function printSize(aspect){return aspect>=1?{width:.594,height:.420}:{width:.420,height:.594};}
export function fittedImage(aspect,width,height,margin=.022){const w=width-margin*2,h=height-margin*2;return aspect>w/h?{width:w,height:w/aspect}:{width:h*aspect,height:h};}
export function placement(index){const left=index<6;return{x:(left?-1:1)*(room.width/2-.023),y:room.hangingHeight,z:room.slots[left?index:11-index],rotation:left?Math.PI/2:-Math.PI/2,side:left?'left':'right'};}
