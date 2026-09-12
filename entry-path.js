import { CatmullRomCurve3, Vector3 } from './vendor/three.module.min.js';

export const entrance = Object.freeze({width:1.6,height:2.4,eyeHeight:1.62,openAngle:Math.PI*.54,openMs:1100,walkMs:4000,closeMs:700});
export const entryDuration = entrance.openMs + entrance.walkMs;
const smooth = value => {const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};

// Walk through the opening, pass the seats on their right, then stand at the centre.
export function createEntryPath(length, outsideZ=length/2+3.6) {
  return new CatmullRomCurve3([
    [0,outsideZ],[0,length/2+.35],[0,3.25],[.85,2.35],[.85,.35],[0,0],
  ].map(([x,z])=>new Vector3(x,entrance.eyeHeight,z)),false,'centripetal');
}

export function sampleEntry(path, elapsed) {
  const walking=smooth((elapsed-entrance.openMs)/entrance.walkMs);
  const position=path.getPointAt(walking);
  return {position,target:new Vector3(0,1.52,position.z-3.6),
    doorAngle:entrance.openAngle*smooth(elapsed/entrance.openMs)*(1-smooth((elapsed-entryDuration+entrance.closeMs)/entrance.closeMs)),
    complete:elapsed>=entryDuration};
}
