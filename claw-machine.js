import * as THREE from './vendor/three.module.min.js';

export const clawLocation = Object.freeze({ position: Object.freeze([-3.5, 0, 6.5]), rotationY: Math.PI / 2 });

/** A complete, deterministic three-finger cabinet. Dimensions are in metres. */
export function createClawMachine({ scene, onState = () => {}, onWin = () => {} }) {
  const resources = new Set(), own = value => (resources.add(value), value);
  const group = new THREE.Group(); group.name = 'corridor-claw-machine';
  group.position.set(...clawLocation.position); group.rotation.y = clawLocation.rotationY; scene.add(group);
  const material = (color, props = {}) => own(new THREE.MeshStandardMaterial({ color, roughness: .35, ...props }));
  const red = material('#af263d', { metalness: .28 }), trim = material('#d94a59', { metalness: .2 });
  const ivory = material('#eae8e0', { metalness: .12 }), chrome = material('#b8c3cb', { metalness: .78, roughness: .23 });
  const clawSteel = material('#d5dde2', { metalness: .42, roughness: .28, emissive: '#5b6770', emissiveIntensity: .09 });
  const dark = material('#17202a', { roughness: .62 }), pink = material('#ff408c', { emissive: '#f62f83', emissiveIntensity: .8 });
  const lit = own(new THREE.MeshBasicMaterial({ color: '#fff0ed', toneMapped: false }));
  const glass = own(new THREE.MeshStandardMaterial({ color: '#c2e9eb', transparent: true, opacity: .065,
    metalness: .06, roughness: .1, depthWrite: false, side: THREE.DoubleSide }));
  function mesh(geometry, mat, position, parent = group, name = '') {
    const object = new THREE.Mesh(own(geometry), mat); object.position.set(...position); object.name = name;
    object.castShadow = false; object.receiveShadow = true; parent.add(object); return object;
  }
  const box = (w, h, d, mat, x, y, z, parent = group, name = '') => mesh(new THREE.BoxGeometry(w, h, d), mat, [x, y, z], parent, name);
  const cylinder = (top, bottom, h, mat, x, y, z, parent = group, name = '') =>
    mesh(new THREE.CylinderGeometry(top, bottom, h, 20), mat, [x, y, z], parent, name);
  function rod(a, b, radius, mat, parent = group) {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), vector = to.clone().sub(from);
    const object = cylinder(radius, radius, vector.length(), mat, ...from.clone().add(to).multiplyScalar(.5).toArray(), parent);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.normalize()); return object;
  }
  function label(w, h, x, y, z, draw, parent = group, resolution = 1024) {
    // Headless geometry checks need no DOM; in the gallery these are sharp local canvas textures.
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas'); canvas.width = resolution; canvas.height = Math.round(resolution * h / w);
    const context = canvas.getContext('2d'); if (!context) return null;
    draw(context, canvas.width, canvas.height);
    const texture = own(new THREE.CanvasTexture(canvas)); texture.colorSpace = THREE.SRGBColorSpace;
    const mat = own(new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false, depthWrite: false }));
    return mesh(new THREE.PlaneGeometry(w, h), mat, [x, y, z], parent);
  }
  // Tall cabinet: solid plinth, open prize hatch, and a glazed display with slim metal uprights.
  box(1.18, .11, 1.1, red, 0, .14, 0);
  for (const x of [-.48, .48]) for (const z of [-.42, .42]) cylinder(.052, .058, .11, dark, x, .055, z);
  box(1.12, .65, .07, ivory, 0, .5, -.505);
  box(.075, .65, 1.03, ivory, -.552, .5, .01); box(.075, .65, 1.03, ivory, .552, .5, .01);
  box(.15, .62, .09, ivory, -.505, .49, .515); box(.61, .62, .09, ivory, .275, .49, .515);
  box(.36, .17, .095, ivory, -.245, .75, .515); box(.36, .085, .095, ivory, -.245, .205, .515);
  box(.31, .39, .04, dark, -.28, .44, .40, group, 'prize-retrieval-hatch');
  box(.31, .035, .30, chrome, -.28, .245, .38);
  for (const [mat, y, h] of [[red, .885, .09], [chrome, .948, .045]]) {
    for (const x of [-.575, .575]) box(.05, h, 1.1, mat, x, y, .005);
    for (const z of [-.52, .53]) box(1.1, h, .05, mat, 0, y, z);
  }
  // The front-left deck opening really is a hole; the pin can fall through it.
  box(1.08, .04, .56, ivory, 0, .972, -.225);
  box(.73, .04, .46, ivory, .175, .972, .285);
  box(.07, .04, .46, ivory, -.505, .972, .285);
  const chute = { x: -.345, z: .265, y: .992 };
  box(.29, .03, .35, dark, chute.x, .69, chute.z);
  for (const x of [-.493, -.195]) box(.018, .20, .40, glass, x, 1.1, .28);
  box(.31, .20, .018, glass, -.345, 1.1, .065);
  box(1.12, 1.42, .045, ivory, 0, 1.705, -.515);
  for (const x of [-.563, .563]) for (const z of [-.51, .52]) {
    box(.032, 1.46, .032, chrome, x, 1.72, z);
    cylinder(.018, .018, .023, chrome, x, .94, z);
  }
  const frontGlass = mesh(new THREE.PlaneGeometry(1.08, 1.39), glass, [0, 1.705, .54]); frontGlass.renderOrder = 2;
  for (const x of [-.577, .577]) {
    const sideGlass = mesh(new THREE.PlaneGeometry(1.03, 1.39), glass, [x, 1.705, 0]);
    sideGlass.rotation.y = Math.PI / 2; sideGlass.renderOrder = 2;
  }
  box(1.2, .10, 1.12, chrome, 0, 2.405, 0);
  box(1.22, .245, 1.13, red, 0, 2.555, 0, group, 'ufo-header');
  box(1.225, .018, 1.135, trim, 0, 2.682, 0);
  label(1.08, .18, 0, 2.559, .568, (ctx, w, h) => {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffd4e4';
    ctx.shadowColor = '#ff5da5'; ctx.shadowBlur = 18; ctx.font = `600 ${h * .48}px sans-serif`;
    ctx.fillText('UFO CATCHER', w / 2, h / 2); ctx.shadowBlur = 0;
  });
  for (const x of [-.53, .53]) for (const y of [2.465, 2.645]) {
    const screw = cylinder(.011, .011, .005, chrome, x, y, .569); screw.rotation.x = Math.PI / 2;
  }
  for (const x of [-.43, .43]) box(.015, .018, .9, lit, x, 2.338, 0);
  box(.98, .018, .017, lit, 0, 2.338, -.43);
  const interiorLight = new THREE.PointLight('#fff0e6', 1.8, 2.8, 2); interiorLight.position.set(0, 2.18, .10); group.add(interiorLight);
  // Raised red control deck and physical illuminated controls, visible before starting the game.
  const consoleGroup = new THREE.Group(); consoleGroup.position.set(.17, .86, .63); consoleGroup.rotation.x = .10; group.add(consoleGroup);
  box(.78, .11, .30, red, 0, 0, 0, consoleGroup);
  for (const [x, color, symbol] of [[-.24, trim, '↔'], [0, trim, '↕'], [.24, pink, '↓']]) {
    cylinder(.071, .071, .025, dark, x, .064, 0, consoleGroup);
    cylinder(.057, .061, .020, color, x, .082, 0, consoleGroup);
    const icon = label(.082, .082, x, .093, 0, (ctx, w, h) => {
      ctx.fillStyle = '#fff7ee'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `600 ${h * .82}px sans-serif`; ctx.fillText(symbol, w / 2, h / 2);
    }, consoleGroup, 256);
    if (icon) { icon.rotation.x = -Math.PI / 2; icon.name = `physical-control-${symbol}`; }
  }
  // The suspended XY trolley travels on the two parallel rails.
  for (const x of [-.45, .45]) rod([x, 2.30, -.44], [x, 2.30, .43], .014, chrome);
  const trolley = new THREE.Group(); trolley.name = 'claw-trolley'; group.add(trolley);
  const rail = box(.93, .034, .034, chrome, 0, 2.292, .24, group, 'moving-cross-rail');
  box(.18, .062, .14, chrome, 0, 2.265, 0, trolley);
  box(.10, .045, .08, dark, 0, 2.222, 0, trolley);
  const cord = cylinder(.009, .009, 1, dark, 0, 2.2, 0, trolley, 'claw-suspension');
  const head = new THREE.Group(); head.name = 'three-finger-claw'; head.rotation.y = Math.PI / 6; trolley.add(head);
  cylinder(.074, .069, .082, chrome, 0, 0, 0, head);
  const cap = mesh(new THREE.SphereGeometry(.075, 20, 12), ivory, [0, .027, 0], head); cap.scale.y = .65;
  const medallion = cylinder(.043, .043, .012, pink, 0, -.002, .071, head); medallion.rotation.x = Math.PI / 2;
  const fingers = [];
  for (let i = 0; i < 3; i++) {
    const finger = new THREE.Group(); finger.name = `claw-finger-${i + 1}`; finger.rotation.y = i * Math.PI * 2 / 3; head.add(finger);
    const upper = box(.027, 1, .022, clawSteel, 0, 0, 0, finger);
    const lower = box(.025, 1, .020, clawSteel, 0, 0, 0, finger);
    const joint = mesh(new THREE.SphereGeometry(.024, 12, 8), clawSteel, [0, 0, 0], finger);
    const tip = mesh(new THREE.SphereGeometry(.013, 10, 6), dark, [0, 0, 0], finger);
    fingers.push({ upper, lower, joint, tip });
  }
  const pin = new THREE.Group(); pin.name = 'bowling-pin-prize'; group.add(pin);
  const pinProfile = [[.044, 0], [.063, .01], [.077, .065], [.081, .12], [.074, .18], [.056, .24],
    [.035, .295], [.027, .335], [.029, .373], [.043, .402], [.049, .43], [.039, .455], [.019, .471], [0, .477]];
  mesh(new THREE.LatheGeometry(pinProfile.map(([x, y]) => new THREE.Vector2(x, y)), 28), ivory, [0, 0, 0], pin);
  cylinder(.029, .029, .020, red, 0, .328, 0, pin); cylinder(.030, .028, .012, red, 0, .354, 0, pin);
  const hitMaterial = own(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  const hitTarget = box(1.24, 2.64, 1.22, hitMaterial, 0, 1.34, .055, group, 'claw-machine-hit-target');
  hitTarget.userData.action = 'claw'; hitTarget.castShadow = false;

  const initialClaw = { x: -.26, z: .24 }, initialPin = { x: .16, y: .992, z: -.08 };
  const axes = { x: 0, z: 0 }, bounds = { x: [-.375, .375], z: [-.27, .33] };
  const high = 2.135, low = 1.65, speed = .30, tolerance = .105;
  let phase = 'idle', inGame = false, elapsed = 0, closed = 0, caught = false, disposed = false, wonReported = false;
  let returnFrom = new THREE.Vector3(), releaseY = 0;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const smooth = n => n * n * (3 - 2 * n);
  const stateInfo = () => ({ phase, inGame, canMove: inGame && phase === 'aiming', canGrab: inGame && phase === 'aiming' });
  function notify() { onState(stateInfo()); }
  function setPhase(next) { phase = next; elapsed = 0; notify(); }
  function positionSegment(object, from, to) {
    const diff = to.clone().sub(from); object.position.copy(from).add(to).multiplyScalar(.5); object.scale.y = diff.length();
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), diff.normalize());
  }
  function pose() {
    rail.position.z = trolley.position.z;
    cord.position.y = (2.20 + head.position.y + .04) / 2;
    cord.scale.y = Math.max(.025, 2.20 - head.position.y - .04);
    const shoulder = new THREE.Vector3(.061, -.035, 0);
    const elbow = new THREE.Vector3(THREE.MathUtils.lerp(.174, .113, closed), -.177, 0);
    const end = new THREE.Vector3(THREE.MathUtils.lerp(.207, .030, closed), -.326, 0);
    for (const finger of fingers) {
      positionSegment(finger.upper, shoulder, elbow); positionSegment(finger.lower, elbow, end);
      finger.joint.position.copy(elbow); finger.tip.position.copy(end);
    }
    if (caught && phase !== 'releasing' && phase !== 'won') {
      pin.position.set(trolley.position.x, initialPin.y + head.position.y - low, trolley.position.z);
    }
  }
  function stopMove() { axes.x = 0; axes.z = 0; }
  function home() {
    trolley.position.set(initialClaw.x, 0, initialClaw.z); head.position.y = high;
    pin.position.set(initialPin.x, initialPin.y, initialPin.z); pin.rotation.set(0, 0, 0); pin.visible = true;
    caught = false; closed = 0; pose();
  }
  function start() {
    if (disposed || phase === 'won' || inGame || (phase !== 'idle' && phase !== 'aiming')) return false;
    inGame = true; stopMove(); setPhase('aiming'); return true;
  }
  function move(axis, direction) {
    if (axis !== 'x' && axis !== 'z') return false;
    if (!inGame || phase !== 'aiming' || disposed) return false;
    axes[axis] = Math.sign(Number(direction) || 0); return true;
  }
  function grab() {
    if (!inGame || phase !== 'aiming' || disposed) return false;
    stopMove(); caught = false; setPhase('dropping'); return true;
  }
  function tick(deltaMs) {
    if (disposed) return false;
    let dt = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0;
    // Substeps make fast tests, low frame rates, and all phase boundaries deterministic.
    while (dt > 0) {
      const delta = Math.min(20, dt); dt -= delta;
      if (phase === 'aiming' && inGame) {
        for (const axis of ['x', 'z']) trolley.position[axis] = clamp(trolley.position[axis] + axes[axis] * speed * delta / 1000, ...bounds[axis]);
      } else if (phase === 'dropping') {
        elapsed += delta; const progress = clamp(elapsed / 650, 0, 1);
        head.position.y = THREE.MathUtils.lerp(high, low, smooth(progress));
        closed = clamp((elapsed - 650) / 250, 0, 1);
        if (elapsed >= 900) {
          caught = Math.hypot(trolley.position.x - pin.position.x, trolley.position.z - pin.position.z) <= tolerance;
          setPhase('lifting');
        }
      } else if (phase === 'lifting') {
        elapsed += delta; head.position.y = THREE.MathUtils.lerp(low, high, smooth(clamp(elapsed / 800, 0, 1)));
        if (elapsed >= 800) {
          if (caught) { returnFrom.copy(trolley.position); setPhase('returning'); }
          else { closed = 0; setPhase(inGame ? 'aiming' : 'idle'); }
        }
      } else if (phase === 'returning') {
        elapsed += delta; const t = smooth(clamp(elapsed / 900, 0, 1));
        trolley.position.x = THREE.MathUtils.lerp(returnFrom.x, chute.x, t);
        trolley.position.z = THREE.MathUtils.lerp(returnFrom.z, chute.z, t);
        if (elapsed >= 900) {
          pin.position.set(chute.x, initialPin.y + high - low, chute.z); releaseY = pin.position.y; setPhase('releasing');
        }
      } else if (phase === 'releasing') {
        elapsed += delta; closed = 1 - clamp(elapsed / 170, 0, 1);
        const fall = Math.max(0, elapsed - 170) / 1000;
        pin.position.y = Math.max(.265, releaseY - 4.8 * fall * fall);
        // After passing through the deck, the chute guides the prize into the retrieval tray.
        if (pin.position.y < .65) pin.position.z = THREE.MathUtils.lerp(chute.z, .39, clamp((.65 - pin.position.y) / .385, 0, 1));
        if (pin.position.y <= .265) {
          caught = false; setPhase('won');
          if (!wonReported) { wonReported = true; onWin(); }
        }
      }
      pose();
    }
    return ['dropping', 'lifting', 'returning', 'releasing'].includes(phase) || (phase === 'aiming' && inGame && !!(axes.x || axes.z));
  }
  function close() {
    if (disposed) return; stopMove(); inGame = false;
    // Closing never aborts a prize in flight and never permits replay after a win.
    if (phase === 'aiming') setPhase('idle'); else notify();
  }
  function reset() {
    if (disposed || phase === 'won' || ['dropping', 'lifting', 'returning', 'releasing'].includes(phase)) return false;
    stopMove(); home(); setPhase(inGame ? 'aiming' : 'idle'); return true;
  }
  function dispose() { if (disposed) return; disposed = true; stopMove(); group.removeFromParent(); for (const resource of resources) resource.dispose(); resources.clear(); }
  home();
  return { group, hitTarget, start, move, grab, tick, stopMove, close, reset, dispose,
    get state() { return phase; }, get inGame() { return inGame; } };
}
