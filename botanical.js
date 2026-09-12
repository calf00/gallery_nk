/**
 * Native Three.js botanical installation. No textures, network requests or lights.
 * Call tick(deltaMs) before rendering, and request another frame while it is true.
 * All objects are owned by this module; dispose() removes and releases them.
 */
export const treePosition = Object.freeze([1.45, 0, -3.78]);

export function createBotanicalScene({ THREE, scene, room, reducedMotion = false }) {
  const WIDTH = room?.width || 4.6, LENGTH = room?.length || 9.4, HEIGHT = room?.height || 2.95;
  const GROW_MS = 5600, SETTLE_MS = 6000, BURST_COUNT = 336, AMBIENT_COUNT = 28;
  const PETAL_COUNT = BURST_COUNT + AMBIENT_COUNT;
  const palette = ['#f3bbc9', '#fff0da', '#d4b9e4', '#f5dfa1', '#edbd98'];
  const resources = new Set(), meshes = [], branchSets = [], leaves = [], flowers = [], centres = [];
  let phase = 'idle', elapsed = 0, growth = 0, disposed = false, activePetals = 0;
  let seed = 17031;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  const mix = (a, b, t) => a + (b - a) * t;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const own = resource => { resources.add(resource); return resource; };
  const vec = (x, y, z) => new THREE.Vector3(x, y, z);
  const group = new THREE.Group();
  group.name = 'nature-botanical-installation';
  group.visible = false;
  group.userData.treePosition = [...treePosition];
  group.userData.nativeGeometry = true;
  scene.add(group);
  const tree = new THREE.Group(); tree.name = 'growing-botanical-tree';
  tree.position.set(...treePosition);tree.scale.set(.8,1,.8);group.add(tree);
  const dummy = new THREE.Object3D(), direction = new THREE.Vector3(), endpoint = new THREE.Vector3();
  const up = vec(0, 1, 0), colour = new THREE.Color();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);

  // A tessellated surface, gently cupped and twisted. Each form has a different
  // silhouette, not just a different aspect ratio: notched cherry, round spoon,
  // softly scalloped cosmos, and a narrow drifting petal / lanceolate leaf.
  function petalGeometry(form) {
    const positions = [], colours = [], uv = [], indices = [];
    const rows = 14, columns = 8;
    for (let j = 0; j <= rows; j++) {
      const t = j / rows;
      for (let i = 0; i <= columns; i++) {
        const u = i / columns * 2 - 1;
        let width, y = t - .45;
        if (form === 0) {
          width = .43 * Math.pow(Math.sin(Math.PI * t * .91), .7);
          y -= .12 * Math.exp(-u * u * 14) * Math.pow(t, 11);
        } else if (form === 1) {
          width = .49 * Math.pow(Math.sin(Math.PI * t), .56) * (.6 + .4 * t);
        } else if (form === 2) {
          width = .48 * Math.pow(Math.sin(Math.PI * t), .72);
          width *= 1 + .1 * Math.cos(u * Math.PI * 3) * Math.pow(t, 4);
          y += .026 * Math.cos(u * Math.PI * 3) * Math.sin(t * Math.PI);
        } else {
          width = .24 * Math.pow(Math.sin(Math.PI * t), .79);
          y = 1.08 * t - .45;
        }
        const x = width * u;
        const z = .105 * Math.sin(Math.PI * t) + .14 * u * u * Math.sin(Math.PI * t)
          + (form === 3 ? .11 : .05) * u * t;
        positions.push(x, y, z);
        const shade = 1 - .09 * Math.abs(u) + .025 * Math.sin(t * Math.PI);
        colours.push(shade, shade, shade);
        uv.push(i / columns, t);
        if (j < rows && i < columns) {
          const a = j * (columns + 1) + i, b = a + columns + 1;
          indices.push(a, a + 1, b, b, a + 1, b + 1);
        }
      }
    }
    const geometry = own(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return geometry;
  }
  const petalGeometries = Array.from({ length: 4 }, (_, i) => petalGeometry(i));
  const petalMaterial = own(new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true,
    side: THREE.DoubleSide, roughness: .74, metalness: 0, emissive: '#f1ded2', emissiveIntensity: .055 }));
  const leafMaterial = own(new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true,
    side: THREE.DoubleSide, roughness: .84, metalness: 0 }));
  const barkMaterial = own(new THREE.MeshStandardMaterial({ color: '#71604b', roughness: .98 }));
  const centreMaterial = own(new THREE.MeshStandardMaterial({ color: '#d8b774', roughness: .86 }));
  function instances(name, geometry, material, count, parent = tree) {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.name = name; mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Small moving petals need no shadow-map pass; the existing lighting shades them.
    mesh.castShadow = false; mesh.receiveShadow = false;
    for (let i = 0; i < count; i++) mesh.setMatrixAt(i, zero);
    parent.add(mesh); meshes.push(mesh); return mesh;
  }

  const trunkSegments = [], smallSegments = [];
  function addSegment(array, a, b, radius, birth, duration) {
    array.push({ a: a.clone(), b: b.clone(), radius, birth, duration });
  }
  const trunkPoints = [vec(0, .008, 0), vec(.014, .31, .008), vec(-.009, .62, .016),
    vec(.024, .96, .023), vec(.05, 1.29, .003), vec(.033, 1.6, -.022),
    vec(.062, 1.89, -.009), vec(.081, 2.14, .013), vec(.058, 2.42, .008)];
  for (let i = 0; i < trunkPoints.length - 1; i++) {
    addSegment(trunkSegments, trunkPoints[i], trunkPoints[i + 1], .064 * Math.pow(.9, i), i * .046, .046);
  }
  // Five shallow roots remain within a 0.20 m footprint.
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 + .2;
    addSegment(smallSegments, vec(Math.cos(a) * .019, .065, Math.sin(a) * .019),
      vec(Math.cos(a) * .176, .012, Math.sin(a) * .176), .023, i * .007, .1);
  }
  function addLeaf(position, size, birth, angle) {
    const rotation = new THREE.Euler(mix(.35, 2.55, random()), angle + mix(-.4, .4, random()),
      mix(-.8, .8, random()));
    leaves.push({ position: position.clone(), rotation, size, birth,
      color: ['#71876a', '#8e9c70', '#a8b78a', '#829879'][Math.floor(random() * 4)] });
  }
  function addFlower(position, size, birth) {
    const axis = new THREE.Quaternion().setFromEuler(new THREE.Euler(mix(-1.25, 1.25, random()),
      random() * Math.PI * 2, random() * Math.PI * 2));
    for (let i = 0; i < 5; i++) {
      const angle = i / 5 * Math.PI * 2;
      const offset = vec(Math.sin(angle) * size * .18, Math.cos(angle) * size * .18, 0).applyQuaternion(axis);
      const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(.24, 0, -angle)).premultiply(axis);
      flowers.push({ position: position.clone().add(offset), quaternion: rotation, size,
        birth: birth + random() * .024, color: random() < .48 ? '#f1ccd5' : '#f7e9d3' });
    }
    centres.push({ position: position.clone(), size: size * .11, birth: birth + .02 });
  }
  // Open, ascending branches keep almost all of the foliage above artwork level.
  // Secondary twigs carry spaced pairs of leaves, rather than opaque canopy blobs.
  for (let b = 0; b < 10; b++) {
    const angle = b * 2.399963 + .3;
    const reach = mix(.57, .79, random()), baseY = mix(1.76, 2.09, b / 9);
    const root = vec(.05, baseY, -.005), points = [root];
    for (let j = 1; j <= 5; j++) {
      const t = j / 5, bend = angle + .15 * Math.sin(t * Math.PI);
      points.push(vec(root.x + Math.cos(bend) * reach * t,
        baseY + (.30 + .15 * (1 - b / 9)) * Math.sin(t * Math.PI * .53),
        root.z + Math.sin(bend) * reach * t));
      addSegment(smallSegments, points[j - 1], points[j], .022 * Math.pow(.74, j - 1),
        .37 + b * .009 + (j - 1) * .045, .045);
    }
    for (let t = 2; t <= 5; t++) {
      const point = points[t];
      const twigAngle = angle + (t % 2 ? -.69 : .72);
      const twigReach = mix(.14, .24, random());
      const tip = point.clone().add(vec(Math.cos(twigAngle) * twigReach,
        mix(.06, .15, random()), Math.sin(twigAngle) * twigReach));
      // Keep the crown within its 0.85 m radius and below 2.55 m.
      const radius = Math.hypot(tip.x - .05, tip.z);
      if (radius > .81) { tip.x = .05 + (tip.x - .05) * .81 / radius; tip.z *= .81 / radius; }
      tip.y = Math.min(2.45, tip.y);
      const mid = point.clone().lerp(tip, .52); mid.y += .018;
      const birth = .57 + t * .023 + b * .004;
      addSegment(smallSegments, point, mid, .0066, birth, .055);
      addSegment(smallSegments, mid, tip, .0049, birth + .055, .09);
      for (let l = 0; l < 6; l++) {
        const s = .18 + l * .15;
        const anchor = point.clone().lerp(tip, s);
        for (const side of [-1, 1]) {
          const leafPosition = anchor.clone().add(vec(Math.cos(twigAngle + Math.PI / 2) * .027 * side,
            .008, Math.sin(twigAngle + Math.PI / 2) * .027 * side));
          addLeaf(leafPosition, mix(.095, .15, random()), birth + .09 + s * .085,
            twigAngle + side * .84);
        }
      }
      if ((b + t) % 3 !== 1) addFlower(tip, mix(.033, .048, random()), birth + .2);
    }
    addLeaf(points[5], .13, .79 + random() * .09, angle);
  }
  // A few small, upright leaves finish the leader at a total height of ~2.50 m.
  for (let i = 0; i < 12; i++) {
    const a = i * 2.4;
    addLeaf(vec(.058 + Math.cos(a) * .032, 2.37 + i * .006, Math.sin(a) * .032),
      mix(.08, .105, random()), .83 + random() * .07, a);
  }
  const trunkGeometry = own(new THREE.CylinderGeometry(.9, 1, 1, 10, 1));
  const branchGeometry = own(new THREE.CylinderGeometry(.74, 1, 1, 8, 1));
  branchSets.push({ mesh: instances('tapered-tree-trunk', trunkGeometry, barkMaterial, trunkSegments.length), data: trunkSegments });
  branchSets.push({ mesh: instances('tapered-branches-and-roots', branchGeometry, barkMaterial, smallSegments.length), data: smallSegments });
  const leafMesh = instances('small-curved-leaves', petalGeometries[3], leafMaterial, leaves.length);
  const flowerMesh = instances('five-petal-tree-blossoms', petalGeometries[0], petalMaterial, flowers.length);
  const centreGeometry = own(new THREE.SphereGeometry(1, 6, 4));
  const centreMesh = instances('flower-centres', centreGeometry, centreMaterial, centres.length);
  leaves.forEach((leaf, i) => leafMesh.setColorAt(i, colour.set(leaf.color)));
  flowers.forEach((flower, i) => flowerMesh.setColorAt(i, colour.set(flower.color)));
  const shadow = new THREE.Mesh(own(new THREE.CircleGeometry(.19, 32)), own(new THREE.MeshBasicMaterial({
    color: '#394636', transparent: true, opacity: .11, depthWrite: false })));
  shadow.name = 'small-root-contact-shadow'; shadow.rotation.x = -Math.PI / 2; shadow.position.y = .003; tree.add(shadow);

  function growTree(amount) {
    growth = clamp(amount, 0, 1);
    for (const { mesh, data } of branchSets) {
      data.forEach((branch, i) => {
        const k = smooth((growth - branch.birth) / branch.duration);
        if (k <= 0) { mesh.setMatrixAt(i, zero); return; }
        endpoint.copy(branch.a).lerp(branch.b, k);
        direction.subVectors(endpoint, branch.a);
        dummy.position.copy(branch.a).add(endpoint).multiplyScalar(.5);
        const length = direction.length();
        dummy.quaternion.setFromUnitVectors(up, direction.normalize());
        dummy.scale.set(branch.radius * (.45 + .55 * k), length, branch.radius * (.45 + .55 * k));
        dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
    const fillFoliage = (mesh, data, kind) => {
      data.forEach((item, i) => {
        const k = smooth((growth - item.birth) / .12);
        if (k <= 0) { mesh.setMatrixAt(i, zero); return; }
        dummy.position.copy(item.position);
        if (item.quaternion) dummy.quaternion.copy(item.quaternion);
        else if (item.rotation) dummy.rotation.copy(item.rotation);
        else dummy.quaternion.identity();
        const size = item.size * k;
        dummy.scale.set(size * (kind === 'leaf' ? 1.5 : 1), size, size);
        dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    fillFoliage(leafMesh, leaves, 'leaf'); fillFoliage(flowerMesh, flowers, 'flower'); fillFoliage(centreMesh, centres, 'centre');
    shadow.scale.setScalar(smooth(growth / .16));
  }

  const capacity = Math.ceil(PETAL_COUNT / 4), petalBatches = [];
  for (let i = 0; i < 4; i++) petalBatches.push(instances(`falling-petals-form-${i + 1}`, petalGeometries[i], petalMaterial, capacity, group));
  const petals = Array.from({ length: PETAL_COUNT }, (_, index) => ({ index, form: index % 4,
    ambient: index >= BURST_COUNT, active: false, release: 0, position: vec(0, 0, 0),
    rotation: new THREE.Euler(), velocity: vec(0, 0, 0), spin: vec(0, 0, 0), age: 0,
    size: .065, flutter: 0, color: palette[index % palette.length] }));
  const xLimit = WIDTH / 2 - .24, zLimit = LENGTH / 2 - .25, ceiling = HEIGHT - .08;
  function spawn(petal, scattered = false) {
    petal.active = true; petal.age = 0;
    petal.position.set(mix(-xLimit + .08, xLimit - .08, random()),
      scattered ? mix(.22, ceiling - .03, random()) : ceiling - random() * .09,
      mix(-zLimit + .08, zLimit - .08, random()));
    petal.rotation.set(random() * Math.PI * 2, random() * Math.PI * 2, random() * Math.PI * 2);
    petal.velocity.set(mix(-.065, .065, random()), petal.ambient ? mix(.16, .24, random()) : mix(.49, .70, random()), mix(-.06, .06, random()));
    petal.spin.set(mix(-1.45, 1.45, random()), mix(-.9, .9, random()), mix(-.9, .9, random()));
    petal.size = mix(.045, .096, random()); petal.flutter = random() * Math.PI * 2;
    if (petal.form === 3) petal.size *= 1.15;
  }
  function drawPetals() {
    const counts = [0, 0, 0, 0]; activePetals = 0;
    for (const petal of petals) {
      if (!petal.active) continue;
      let scale = petal.size;
      if (!reducedMotion) {
        const entrance = smooth(petal.age / .18);
        const floorFade = smooth((petal.position.y - .045) / .19);
        const burstFade = petal.ambient ? 1 : 1 - smooth((elapsed - GROW_MS) / (SETTLE_MS - GROW_MS));
        scale *= entrance * floorFade * burstFade;
      }
      if (scale < .001) continue;
      dummy.position.copy(petal.position); dummy.rotation.copy(petal.rotation); dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      const mesh = petalBatches[petal.form], index = counts[petal.form]++;
      mesh.setMatrixAt(index, dummy.matrix); mesh.setColorAt(index, colour.set(petal.color)); activePetals++;
    }
    petalBatches.forEach((mesh, i) => {
      mesh.count = counts[i]; mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  }
  function resetPetals() {
    for (const petal of petals) { petal.active = false; petal.release = random() * 1250; }
    activePetals = 0; petalBatches.forEach(mesh => { mesh.count = 0; });
  }
  function staticDisplay() {
    phase = 'static'; elapsed = SETTLE_MS; growTree(1); resetPetals();
    // A quiet still composition for visitors who prefer reduced motion.
    for (let i = BURST_COUNT; i < BURST_COUNT + 12; i++) spawn(petals[i], true);
    drawPetals();
  }
  function start() {
    if (disposed) return;
    group.visible = true; elapsed = 0; phase = 'growing'; resetPetals();
    if (reducedMotion) { staticDisplay(); return; }
    growTree(0);
    // The burst begins at the ceiling and is released over its first 1.25 s.
    // Its full population never appears as an opaque sheet in front of the camera.
    for (let i = 0; i < 20; i++) petals[i].release = 0;
    drawPetals();
  }
  function stop() {
    if (disposed) return;
    phase = 'idle'; elapsed = 0; group.visible = false; growth = 0; resetPetals();
  }
  function tick(deltaMs) {
    if (disposed || phase === 'idle' || reducedMotion) return false;
    const dt = clamp(Number.isFinite(deltaMs) ? deltaMs : 0, 0, 64) / 1000;
    elapsed += dt * 1000;
    if (growth < 1) growTree(elapsed / GROW_MS);
    phase = elapsed < GROW_MS ? 'growing' : elapsed < SETTLE_MS ? 'settling' : 'ambient';
    for (const petal of petals) {
      if (!petal.active) {
        if (petal.ambient) { if (elapsed >= GROW_MS) spawn(petal, true); }
        else if (elapsed < GROW_MS && elapsed >= petal.release) { spawn(petal); petal.release = Infinity; }
        else continue;
      }
      if (!petal.active) continue;
      if (!petal.ambient && elapsed >= SETTLE_MS) { petal.active = false; continue; }
      petal.age += dt;
      const sway = Math.sin(petal.age * 2.6 + petal.flutter);
      const drift = Math.cos(petal.age * 1.7 + petal.flutter);
      petal.position.x += (petal.velocity.x + sway * .105) * dt;
      petal.position.z += (petal.velocity.z + drift * .075) * dt;
      petal.position.y -= petal.velocity.y * (1 + .14 * sway) * dt;
      // Reflect at inset room bounds, so no petal crosses a wall or the floor.
      if (petal.position.x < -xLimit || petal.position.x > xLimit) {
        petal.position.x = clamp(petal.position.x, -xLimit, xLimit); petal.velocity.x *= -1;
      }
      if (petal.position.z < -zLimit || petal.position.z > zLimit) {
        petal.position.z = clamp(petal.position.z, -zLimit, zLimit); petal.velocity.z *= -1;
      }
      petal.rotation.x += (petal.spin.x + sway * .4) * dt;
      petal.rotation.y += petal.spin.y * dt; petal.rotation.z += (petal.spin.z + drift * .3) * dt;
      if (petal.position.y <= .06) {
        if (petal.ambient) spawn(petal);
        else petal.active = false;
      }
    }
    drawPetals();
    return true;
  }
  function setReducedMotion(value) {
    const next = Boolean(value);
    if (reducedMotion === next || disposed) return;
    reducedMotion = next;
    if (phase === 'idle') return;
    if (reducedMotion) staticDisplay();
    else {
      phase = 'ambient'; elapsed = SETTLE_MS; growTree(1); resetPetals();
      for (let i = BURST_COUNT; i < PETAL_COUNT; i++) spawn(petals[i], true);
      drawPetals();
    }
  }
  function dispose() {
    if (disposed) return;
    stop(); group.removeFromParent();
    for (const mesh of meshes) mesh.dispose();
    for (const resource of resources) resource.dispose();
    disposed = true;
  }
  return { start, stop, tick, setReducedMotion, dispose, group,
    get phase() { return phase; }, get activePetalCount() { return activePetals; }, get growth() { return growth; } };
}
