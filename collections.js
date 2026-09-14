import { exhibition, descriptions, locations } from './config.js?v=20260914-locations';
export const collections={
  night:{title:exhibition.title, label:exhibition.title, switchLabel:'NIGHT MODE', english:'AFTER HOURS', manifest:'./assets/manifest.json', descriptions, locations, intro:'気になる一枚から、夜を巡る。'},
  nature:{title:'写真展：いきもの', label:'写真展：いきもの', switchLabel:'NATURE MODE', english:'NATURE / LIGHT', manifest:'./assets/nature/manifest.json?v=20260914-photos', locations:Array(12).fill(''), intro:'花、木々、水辺。身近な風景を巡る12枚。', descriptions:[
    '公園の砂山に立つ黄色い落ち葉と、奥の遊具。','濃い緑の葉に囲まれた大きな白い花。','街の建物の間から空へ伸びる裸の街路樹。','霞んだ空へ向かって伸びる二基のクレーン。','青と紫の光に照らされた夜の花木。','水面から出た岩の上で休む鳥たち。','木々に囲まれた空と太陽、その近くを飛ぶ飛行機。','黄緑の木々と岩の間を流れる小さな滝。','青空の下に広がるひまわり畑。','木漏れ日を浴びる木製ベンチ。','茶色い葉の上で白黒の翅を広げた昆虫。','夜の光に照らされた木々と、水面に映るその姿。'
  ]}
};
