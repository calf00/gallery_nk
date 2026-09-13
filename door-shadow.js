import * as THREE from './vendor/three.module.min.js';

/** A small greeting peeking around the right-hand entrance jamb. */
export function createDoorShadow({ scene, doorZ, reducedMotion = false }) {
  const group = new THREE.Group(); group.name = 'entrance-shadow';
  // Looking from inside towards +Z, the viewer's right is world -X.
  group.position.set(-.79, 0, doorZ + .28); group.visible = false; scene.add(group);
  const resources = new Set();
  const silhouette = new THREE.MeshBasicMaterial({ color: '#17201e', transparent: true, opacity: 1, depthWrite: false });
  resources.add(silhouette);
  function mesh(name, geometry, position, parent = group, scale = [1, 1, 1]) {
    resources.add(geometry);
    const object = new THREE.Mesh(geometry, silhouette);
    object.name = name; object.position.set(...position); object.scale.set(...scale); parent.add(object); return object;
  }
  function oval(name, radius, position, scale, parent = group) {
    return mesh(name, new THREE.SphereGeometry(radius, 24, 16), position, parent, scale);
  }
  function roundedSegment(name, from, to, radius, parent) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), axis = b.clone().sub(a);
    const object = mesh(name, new THREE.CapsuleGeometry(radius, Math.max(.001, axis.length() - radius * 2), 6, 14),
      a.clone().add(b).multiplyScalar(.5).toArray(), parent);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize()); return object;
  }
  // Most of the shoulder stays behind the facade. The overlapping head reaches
  // just into the glass opening: a peek, rather than an unsupported full figure.
  oval('shadow-peeking-shoulder', .15, [-.105, 1.445, .015], [1.16, .65, .53]);
  const head = oval('shadow-head', .148, [.044, 1.603, 0], [1, 1.055, .73]);
  head.rotation.z = -.13;
  const hand = new THREE.Group(); hand.name = 'shadow-waving-hand';
  hand.position.set(.275, 1.435, -.008); group.add(hand);
  // A bent arm runs from behind the jamb into the fixed wrist pivot, so the
  // waving palm is always visibly connected to the peeking shoulder.
  const elbow = [.22, 1.29, -.008];
  roundedSegment('shadow-upper-arm', [-.105, 1.425, .015], elbow, .030, group);
  oval('shadow-elbow', .031, elbow, [1, 1, 1]);
  roundedSegment('shadow-forearm', elbow, hand.position.toArray(), .028, group);
  oval('shadow-wrist-joint', .028, hand.position.toArray(), [1, 1, 1]);
  // One open hand, with four separated fingers and an outward thumb. Only the
  // wrist moves; the head and the little visible shoulder remain perfectly still.
  roundedSegment('shadow-wrist', [0, .003, 0], [0, .085, 0], .026, hand);
  oval('shadow-palm', .05, [0, .104, 0], [.93, 1.12, .48], hand);
  const fingers = [
    { x: -.038, endX: -.055, length: .082 },
    { x: -.013, endX: -.018, length: .103 },
    { x: .013, endX: .020, length: .097 },
    { x: .037, endX: .051, length: .073 },
  ];
  for (const [index, finger] of fingers.entries()) {
    roundedSegment(`shadow-finger-${index + 1}`, [finger.x, .133, 0], [finger.endX, .133 + finger.length, 0], .0105, hand);
  }
  roundedSegment('shadow-thumb', [.030, .081, 0], [.083, .147, 0], .014, hand);

  let armed = false, dismissed = false, disposed = false, wavingMs = 0, fadeMs = null;
  let motionReduced = Boolean(reducedMotion);
  const fadeDuration = 1000;
  const frustum = new THREE.Frustum(), projection = new THREE.Matrix4();
  const direction = new THREE.Vector3(), toward = new THREE.Vector3(), centre = new THREE.Vector3();
  const bounds = new THREE.Box3(), low = new THREE.Vector3(), high = new THREE.Vector3();
  const smooth = value => value * value * (3 - 2 * value);
  function pose() { hand.rotation.z = -.08 + (motionReduced ? 0 : .24 * Math.sin(wavingMs / 1800 * Math.PI * 2)); }
  function arm() {
    if (disposed) return;
    armed = true; dismissed = false; wavingMs = 0; fadeMs = null;
    silhouette.opacity = 1; group.visible = false; pose();
  }
  function dismiss() { dismissed = true; fadeMs = null; silhouette.opacity = 0; group.visible = false; }
  function reset() {
    armed = false; dismissed = false; wavingMs = 0; fadeMs = null;
    silhouette.opacity = 1; group.visible = false; pose();
  }
  function beginFade() {
    if (disposed || !armed || dismissed || fadeMs !== null) return false;
    fadeMs = 0; return true;
  }
  function setReducedMotion(value) { motionReduced = Boolean(value); wavingMs = 0; pose(); }
  function inView(camera) {
    if (!camera || camera.position.z >= doorZ - .02) return false;
    camera.updateMatrixWorld();
    centre.set(group.position.x + .10, 1.59, group.position.z);
    camera.getWorldDirection(direction); toward.copy(centre).sub(camera.position);
    if (direction.dot(toward) <= 0) return false;
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projection);
    low.set(group.position.x - .28, 1.25, group.position.z - .12);
    high.set(group.position.x + .43, 1.80, group.position.z + .12);
    bounds.set(low, high); return frustum.intersectsBox(bounds);
  }
  function tick(deltaMs, { camera, eligible } = {}) {
    if (disposed || !armed || dismissed) { group.visible = false; return false; }
    const delta = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0;
    const visible = Boolean(eligible && inView(camera));
    if (visible && doorZ - camera.position.z < 2.4) beginFade();
    // Once approaching has triggered the fade, finish it even if the visitor
    // looks away. An almost-disappeared hand must not return on a later glance.
    if (fadeMs !== null) {
      fadeMs = Math.min(fadeDuration, fadeMs + delta);
      silhouette.opacity = 1 - smooth(fadeMs / fadeDuration);
      if (fadeMs >= fadeDuration) { dismiss(); return false; }
    }
    group.visible = visible;
    if (visible && !motionReduced) { wavingMs = (wavingMs + delta) % 1800; pose(); }
    return fadeMs !== null || (visible && !motionReduced);
  }
  function dispose() {
    if (disposed) return;
    disposed = true; group.visible = false; group.removeFromParent();
    for (const resource of resources) resource.dispose(); resources.clear();
  }
  pose();
  return { group, arm, beginFade, dismiss, reset, setReducedMotion, tick, dispose };
}
