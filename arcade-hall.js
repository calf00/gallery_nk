import * as THREE from './vendor/three.module.min.js';
import { entrance } from './entry-path.js';

const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const eye = entrance.eyeHeight;

export const arcadeHall = Object.freeze({
  width: 8.8, height: 2.95, nearZ: 4.7, farZ: 9.8,
  viewPosition: Object.freeze([-.65, eye, 6.5]),
  viewTarget: Object.freeze([-3.5, 1.45, 6.5]),
  openMs: 700, closeMs: 700,
});

// Rounded polyline corners stay in the convex hull of the waypoints: unlike
// an interpolating spline they cannot bow through the doorway or a seat.
function roundedPath(points) {
  const clean = points.filter((point, index) => !index || point.distanceTo(points[index - 1]) > .001);
  const curve = new THREE.CurvePath();
  if (clean.length === 1) clean.push(clean[0].clone().add(new THREE.Vector3(0, 0, .0001)));
  let previous = clean[0];
  for (let index = 1; index < clean.length - 1; index++) {
    const centre = clean[index], before = clean[index - 1], after = clean[index + 1];
    const cut = Math.min(.22, centre.distanceTo(before) * .24, centre.distanceTo(after) * .24);
    const entry = centre.clone().lerp(before, cut / centre.distanceTo(before));
    const exit = centre.clone().lerp(after, cut / centre.distanceTo(after));
    curve.add(new THREE.LineCurve3(previous, entry));
    curve.add(new THREE.QuadraticBezierCurve3(entry, centre, exit));
    previous = exit;
  }
  curve.add(new THREE.LineCurve3(previous, clean.at(-1)));
  return curve;
}

const point = (x, z) => new THREE.Vector3(x, eye, z);

export function createArcadePath(roomLength, startPosition, direction = 'out') {
  if (direction !== 'out' && direction !== 'in') throw new Error('Unknown arcade journey direction');
  const start = startPosition.clone ? startPosition.clone() : new THREE.Vector3(...startPosition);
  start.y = eye;
  const doorZ = roomLength / 2;
  let approachPoints, crossingPoints;
  if (direction === 'out') {
    // Current artwork positions are already in the clear side aisles. Use the
    // nearest aisle rather than sweeping across the four central seats.
    const side = start.x < -.1 ? -1 : 1;
    const lane = side * .85;
    approachPoints = [start];
    if (start.z < doorZ - 1.8) {
      approachPoints.push(point(lane, start.z), point(lane, doorZ - 1.8));
    }
    approachPoints.push(point(0, doorZ - 1.3));
    crossingPoints = [point(0, doorZ - 1.3), point(0, doorZ + 1.15), point(-.65, doorZ + 1.8)];
  } else {
    approachPoints = [start, point(0, doorZ + 1.3)];
    crossingPoints = [point(0, doorZ + 1.3), point(0, 3.25), point(.85, 2.35), point(.85, .35), point(0, 0)];
  }
  const approach = roundedPath(approachPoints), crossing = roundedPath(crossingPoints);
  const approachMs = Math.max(550, Math.min(4000, approach.getLength() * 650));
  const crossMs = Math.max(2100, Math.min(3900, crossing.getLength() * 580));
  const { openMs, closeMs } = arcadeHall;
  return { direction, approach, crossing, approachMs, openMs, crossMs, closeMs,
    duration: approachMs + openMs + crossMs + closeMs };
}

function forwardTarget(curve, amount, position) {
  const tangent = curve.getTangentAt(Math.min(.99999, amount));
  const target = position.clone().addScaledVector(tangent, 3.6);
  target.y = 1.52;
  return target;
}

export function sampleArcadeJourney(path, elapsed) {
  const { approachMs, openMs, crossMs, closeMs, direction } = path;
  const openAt = approachMs, crossAt = openAt + openMs, closeAt = crossAt + crossMs;
  const finalTarget = direction === 'out'
    ? new THREE.Vector3(...arcadeHall.viewTarget) : new THREE.Vector3(0, 1.52, -3.6);
  let position, target, doorAngle, phase;
  if (elapsed < openAt) {
    const amount = smooth(elapsed / approachMs);
    position = path.approach.getPointAt(amount);
    target = forwardTarget(path.approach, amount, position);
    // Settle towards the opening while slowing to a stop in front of it.
    const doorwayTarget = position.clone().add(new THREE.Vector3(0, -.10, direction === 'out' ? 3.6 : -3.6));
    target.lerp(doorwayTarget, smooth((amount - .55) / .45));
    doorAngle = 0; phase = 'approach';
  } else if (elapsed < crossAt) {
    position = path.approach.getPointAt(1);
    target = position.clone().add(new THREE.Vector3(0, -.10, direction === 'out' ? 3.6 : -3.6));
    doorAngle = entrance.openAngle * smooth((elapsed - openAt) / openMs); phase = 'opening';
  } else if (elapsed < closeAt) {
    const amount = smooth((elapsed - crossAt) / crossMs);
    position = path.crossing.getPointAt(amount);
    target = forwardTarget(path.crossing, amount, position);
    target.lerp(finalTarget, smooth((amount - .55) / .45));
    doorAngle = entrance.openAngle; phase = 'crossing';
  } else {
    position = path.crossing.getPointAt(1); target = finalTarget;
    doorAngle = entrance.openAngle * (1 - smooth((elapsed - closeAt) / closeMs));
    phase = elapsed >= path.duration ? 'done' : 'closing';
  }
  return { position, target, doorAngle, phase, complete: elapsed >= path.duration };
}

export function createArcadeHall({ scene }) {
  const group = new THREE.Group(); group.name = 'arcade-hall'; scene.add(group);
  const resources = new Set(), occluders = [];
  const material = (color, properties = {}) => {
    const result = new THREE.MeshStandardMaterial({ color, roughness: .83, ...properties });
    resources.add(result); return result;
  };
  const box = (name, size, position, surface, occludes = true) => {
    const geometry = new THREE.BoxGeometry(...size); resources.add(geometry);
    const mesh = new THREE.Mesh(geometry, surface); mesh.name = name; mesh.position.set(...position);
    mesh.receiveShadow = true; group.add(mesh); if (occludes) occluders.push(mesh); return mesh;
  };
  const wall = material('#b0b4a9'), ceiling = material('#303b38'), floor = material('#68716b');
  const trim = material('#3f4c48', { metalness: .3, roughness: .52 });
  const seam = material('#49554f'), diffuser = material('#f0ecdc', { emissive: '#fff3db', emissiveIntensity: 1.15 });
  const { width, height, nearZ, farZ } = arcadeHall;
  const length = farZ - nearZ, centreZ = (farZ + nearZ) / 2;
  box('hall-floor', [width, .12, length + .1], [0, -.0645, centreZ], floor);
  box('hall-far-wall', [width + .16, height, .16], [0, height / 2, farZ + .08], wall);
  box('hall-ceiling', [width + .16, .12, length], [0, height + .06, centreZ], ceiling);
  for (const side of [-1, 1]) {
    box(`hall-side-wall-${side}`, [.16, height, length + .16], [side * (width / 2 + .08), height / 2, centreZ], wall);
    box(`hall-side-trim-${side}`, [.025, .115, length], [side * (width / 2 - .0125), .0575, centreZ], trim);
  }
  box('hall-far-trim', [width, .115, .025], [0, .0575, farZ - .0125], trim);
  // Long, quiet stone joints run down the corridor without forming trip edges.
  for (let x = -3.3; x <= 3.3; x += 1.1) {
    box('hall-floor-joint', [.007, .001, length], [x, -.0039, centreZ], seam, false);
  }
  for (const z of [6.5, 8.5]) {
    box('hall-light-frame', [6.5, .035, .09], [0, height - .035, z], trim);
    box('hall-light-diffuser', [6.35, .014, .042], [0, height - .06, z], diffuser, false);
    const light = new THREE.PointLight('#fff2da', 4.8, 8, 2);
    light.position.set(0, height - .25, z); group.add(light);
  }
  return { group, occluders, dispose() {
    group.removeFromParent();
    for (const resource of resources) resource.dispose();
    resources.clear(); occluders.length = 0;
  } };
}
