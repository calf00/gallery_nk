/**
 * Native Three.js botanical installation. No textures, network requests or lights.
 * Call tick(deltaMs) before rendering, and request another frame while it is true.
 * All objects are owned by this module; dispose() removes and releases them.
 */
export const treePosition = Object.freeze([1.45, 0, -3.78]);
export const botanicalTiming = Object.freeze({ growMs: 2200, settleMs: 2500 });

export function createBotanicalScene({ THREE, scene, room, reducedMotion = false }) {
  const WIDTH = room?.width || 4.6, LENGTH = room?.length || 9.4, HEIGHT = room?.height || 2.95;
  const GROW_MS = botanicalTiming.growMs, SETTLE_MS = botanicalTiming.settleMs;
  const BURST_COUNT = 336, AMBIENT_COUNT = 28;
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
  function petalGeometry(form, rows = 14, columns = 8) {
    const positions = [], colours = [], uv = [], indices = [];
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
          width = (form === 4 ? .34 : .24) * Math.pow(Math.sin(Math.PI * t), .79);
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
  // The large ceiling canopy uses just 30 triangles per curved leaf.
  const canopyLeafGeometry = petalGeometry(4, 5, 3);
  const petalMaterial = own(new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true,
    side: THREE.DoubleSide, roughness: .74, metalness: 0, emissive: '#f1ded2', emissiveIntensity: .055 }));
  const leafMaterial = own(new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true,
    side: THREE.DoubleSide, roughness: .84, metalness: 0 }));
  const barkMaterial = own(new THREE.MeshStandardMaterial({ color: '#71604b', roughness: .98 }));
  const centreMaterial = own(new THREE.MeshStandardMaterial({ color: '#d8b774', roughness: .86 }));
  function instances(name, geometry, material, count, parent = tree) {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.name = name; mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(parent === tree ? THREE.StaticDrawUsage : THREE.DynamicDrawUsage);
    // Small moving petals need no shadow-map pass; the existing lighting shades them.
    mesh.castShadow = false; mesh.receiveShadow = false;
    for (let i = 0; i < count; i++) mesh.setMatrixAt(i, zero);
    parent.add(mesh); meshes.push(mesh); return mesh;
  }

  const smallSegments = [], canopySegments = [], grownSurfaces = [];
  function addSegment(array, a, b, radius, birth, duration) {
    array.push({ a: a.clone(), b: b.clone(), radius, birth, duration });
  }
  const trunkPoints = [vec(0, .008, 0), vec(.014, .31, -.035), vec(-.009, .62, -.13),
    vec(.024, .96, -.25), vec(.05, 1.29, -.33), vec(.033, 1.6, -.34),
    vec(.062, 1.89, -.27), vec(.081, 2.14, -.13), vec(.058, 2.42, .008)];
  // Continuous, gently fluted bark replaces the thin stack of cylinders.
  const solidBark = own(barkMaterial.clone());solidBark.vertexColors = true;
  function growingSurface(name, rows, columns, duration, surface) {
    const positions = new Float32Array((rows + 1) * (columns + 1) * 3);
    const colors = new Float32Array(positions.length), indices = [];
    for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
      const t = row / rows, angle = col / columns * Math.PI * 2;
      const shade = .81 + .11 * Math.sin(angle * 9 + .3 * Math.sin(t * 7)) + .055 * Math.sin(angle * 17 - t * 2);
      const offset = (row * (columns + 1) + col) * 3;
      colors.set([shade, shade * .96, shade * .89], offset);
      if (row < rows && col < columns) {
        const a = row * (columns + 1) + col, b = a + columns + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geometry = own(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    const mesh = new THREE.Mesh(geometry, solidBark);
    mesh.name = name;mesh.frustumCulled = false;tree.add(mesh);
    grownSurfaces.push({mesh, rows, columns, duration, surface, progress:-1});
    return mesh;
  }
  const trunkCurve = new THREE.CatmullRomCurve3(trunkPoints, false, 'centripetal');
  // Add roughly 15% through the trunk, blending into the established root flare.
  const trunkRadii = [.40, .328, .288, .259, .242, .224, .207, .173, .115];
  growingSurface('tapered-tree-trunk', 48, 28, .368, (t, angle) => {
    const p = trunkCurve.getPoint(t), segment = t * (trunkRadii.length - 1);
    const i = Math.min(trunkRadii.length - 2, Math.floor(segment));
    const radius = mix(trunkRadii[i], trunkRadii[i + 1], segment - i);
    const ridges = 1 + .038 * Math.sin(angle * 9 + t * .55) + .017 * Math.cos(angle * 5 - t * 1.6);
    return p.add(vec(Math.cos(angle) * radius * ridges, 0, Math.sin(angle) * radius * ridges));
  });
  // Seven broad buttress roots emerge from the flare, curve along the floor,
  // and taper to buried tips. Their lower edges stay on the floor throughout.
  for (let i = 0; i < 7; i++) {
    const angle = i / 7 * Math.PI * 2 + .18;
    const towardAisle = Math.cos(angle) < 0 && Math.sin(angle) > -.2;
    const reach = towardAisle ? .46 : .75 + .07 * Math.sin(i * 2.7);
    growingSurface(`buttress-root-${i + 1}`, 20, 16, .19, (t, crossAngle) => {
      const bend = angle + .18 * Math.sin(t * Math.PI) * (i % 2 ? -1 : 1);
      const r = .075 + reach * t;
      const width = .19 * Math.pow(1 - t, 1.2) + .006;
      const height = .14 * Math.pow(1 - t, 1.7) + .002;
      return vec(Math.cos(bend) * r - Math.sin(bend) * Math.cos(crossAngle) * width,
        .002 + height * (1 + Math.sin(crossAngle)),
        Math.sin(bend) * r + Math.cos(bend) * Math.cos(crossAngle) * width);
    });
  }
  const localPoint = world => vec((world.x - treePosition[0]) / .8, world.y, (world.z - treePosition[2]) / .8);
  const worldPoint = local => vec(local.x * .8 + treePosition[0], local.y, local.z * .8 + treePosition[2]);
  const leafVertex = new THREE.Vector3(), leafRotation = new THREE.Quaternion();
  const leafVertices = canopyLeafGeometry.getAttribute('position');
  function addLeaf(worldPosition, size, birth, angle) {
    // Mostly horizontal, with enough pitch and roll to read as individual leaves.
    const rotation = new THREE.Euler(-Math.PI / 2 + mix(-.34, .34, random()),
      angle + mix(-.45, .45, random()), mix(-.22, .22, random()), 'YXZ');
    leafRotation.setFromEuler(rotation);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < leafVertices.count; i++) {
      leafVertex.fromBufferAttribute(leafVertices, i).multiply(vec(size * 1.5, size, size)).applyQuaternion(leafRotation);
      leafVertex.x *= .8; leafVertex.z *= .8;
      minX = Math.min(minX, leafVertex.x); maxX = Math.max(maxX, leafVertex.x);
      minY = Math.min(minY, leafVertex.y); maxY = Math.max(maxY, leafVertex.y);
      minZ = Math.min(minZ, leafVertex.z); maxZ = Math.max(maxZ, leafVertex.z);
    }
    // Constrain actual leaf vertices, not just their centres, to the room and the
    // overhead band. This keeps the photos, café opening and wall panel clear.
    const p = worldPosition.clone();
    p.x = clamp(p.x, -WIDTH / 2 + .035 - minX, WIDTH / 2 - .035 - maxX);
    p.z = clamp(p.z, -LENGTH / 2 + .035 - minZ, LENGTH / 2 - .035 - maxZ);
    p.y = clamp(p.y, 2.45 - minY, Math.min(2.8, HEIGHT - .12) - maxY);
    leaves.push({ position: localPoint(p), rotation, size, birth,
      color: ['#496e50', '#64875b', '#839d6d', '#a1b582'][Math.floor(random() * 4)] });
  }
  function addFlower(position, size, birth) {
    const axis = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 + random() * .45,
      random() * Math.PI * 2, random() * Math.PI * 2));
    for (let i = 0; i < 5; i++) {
      const angle = i / 5 * Math.PI * 2;
      const offset = vec(Math.sin(angle) * size * .18, Math.cos(angle) * size * .18, 0).applyQuaternion(axis);
      const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(.24, 0, -angle)).premultiply(axis);
      flowers.push({ position: position.clone().add(offset), quaternion: rotation, size,
        birth: birth + random() * .018, color: random() < .48 ? '#f1ccd5' : '#f7e9d3' });
    }
    centres.push({ position: position.clone(), size: size * .11, birth: birth + .02 });
  }

  // Four continuous boughs fan out from the existing leader. Three travel the
  // room's length; the fourth reaches across its rear. Smaller branches attach
  // at real bough vertices, so the canopy grows outward from the tree.
  const leader = worldPoint(trunkPoints.at(-1)), spines = [];
  const destinations = [
    vec(-WIDTH / 2 + .52, 2.66, LENGTH / 2 - .4),
    vec(-.05, 2.67, LENGTH / 2 - .38),
    vec(WIDTH / 2 - .47, 2.65, LENGTH / 2 - .4),
    vec(-WIDTH / 2 + .4, 2.64, -LENGTH / 2 + .37),
  ];
  for (const [index, destination] of destinations.entries()) {
    const points = [leader.clone()];
    for (let i = 1; i <= 4; i++) {
      const t = i / 4, point = leader.clone().lerp(destination, t);
      point.y = mix(leader.y, destination.y, Math.sin(t * Math.PI / 2));
      point.x += Math.sin(t * Math.PI) * (index % 2 ? .13 : -.13);
      points.push(point);
    }
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const spine = [], segments = index === 3 ? 10 : 20;
    for (let i = 0; i <= segments; i++) {
      const arrival = .37 + i / segments * .31;
      spine.push({ point: curve.getPoint(i / segments), arrival });
      if (i) addSegment(canopySegments, localPoint(spine[i - 1].point), localPoint(spine[i].point),
        .09 * Math.pow(.85, i - 1), spine[i - 1].arrival, .31 / segments);
    }
    spines.push(spine);
  }

  // Each region receives six sprays of four leaves. Their overlapping, irregular
  // silhouettes form a dense ceiling while remaining a single instanced draw.
  const columns = 9, rows = 19;
  for (let zIndex = 0; zIndex < rows; zIndex++) for (let xIndex = 0; xIndex < columns; xIndex++) {
    const x = mix(-WIDTH / 2 + .30, WIDTH / 2 - .30, xIndex / (columns - 1)) + mix(-.045, .045, random());
    const z = mix(-LENGTH / 2 + .30, LENGTH / 2 - .30, zIndex / (rows - 1)) + mix(-.045, .045, random());
    const centre = vec(x, 2.645 + .025 * Math.sin(x * 2.1 + z * .8), z);
    let anchor = null, distance = Infinity;
    for (const spine of spines) for (const node of spine.slice(1)) {
      const d = Math.hypot(node.point.x - x, node.point.z - z);
      if (d < distance) { distance = d; anchor = node; }
    }
    const mid = anchor.point.clone().lerp(centre, .52); mid.y = Math.max(2.49, mid.y - .018);
    const arrival = anchor.arrival + .004;
    addSegment(smallSegments, localPoint(anchor.point), localPoint(mid), .0105, arrival, .027);
    addSegment(smallSegments, localPoint(mid), localPoint(centre), .0078, arrival + .027, .027);
    const offset = random() * Math.PI * 2;
    for (let spray = 0; spray < 6; spray++) {
      const angle = offset + spray * Math.PI / 3;
      const tip = centre.clone().add(vec(Math.cos(angle) * .25, mix(-.028, .02, random()), Math.sin(angle) * .25));
      tip.x = clamp(tip.x, -WIDTH / 2 + .16, WIDTH / 2 - .16);
      tip.z = clamp(tip.z, -LENGTH / 2 + .16, LENGTH / 2 - .16);
      addSegment(smallSegments, localPoint(centre), localPoint(tip), .0038, arrival + .054, .025);
      for (let l = 0; l < 4; l++) {
        const p = centre.clone().lerp(tip, .28 + l * .24);
        const side = l % 2 ? 1 : -1;
        p.x += Math.cos(angle + Math.PI / 2) * .05 * side;
        p.z += Math.sin(angle + Math.PI / 2) * .05 * side;
        p.y += mix(-.025, .025, random());
        addLeaf(p, mix(.31, .46, random()), arrival + .079 + l * .015 + random() * .025, angle + side * .58);
      }
    }
    if ((xIndex + zIndex) % 5 === 0) addFlower(localPoint(centre), .044, arrival + .12);
  }
  const trunkGeometry = own(new THREE.CylinderGeometry(.9, 1, 1, 10, 1));
  const branchGeometry = own(new THREE.CylinderGeometry(.74, 1, 1, 8, 1));
  branchSets.push({ mesh: instances('connected-ceiling-boughs', trunkGeometry, barkMaterial, canopySegments.length), data: canopySegments });
  branchSets.push({ mesh: instances('tapered-branches-and-roots', branchGeometry, barkMaterial, smallSegments.length), data: smallSegments });
  const leafMesh = instances('small-curved-leaves', canopyLeafGeometry, leafMaterial, leaves.length);
  const flowerMesh = instances('five-petal-tree-blossoms', petalGeometries[0], petalMaterial, flowers.length);
  const centreGeometry = own(new THREE.SphereGeometry(1, 6, 4));
  const centreMesh = instances('flower-centres', centreGeometry, centreMaterial, centres.length);
  leaves.forEach((leaf, i) => leafMesh.setColorAt(i, colour.set(leaf.color)));
  flowers.forEach((flower, i) => flowerMesh.setColorAt(i, colour.set(flower.color)));
  const shadow = new THREE.Group();shadow.name = 'root-contact-shadow';tree.add(shadow);
  for (const [radius, opacity] of [[.76,.025],[.55,.045],[.35,.09]]) {
    const patch = new THREE.Mesh(own(new THREE.CircleGeometry(radius, 48)), own(new THREE.MeshBasicMaterial({
      color:'#18251c', transparent:true, opacity, depthWrite:false })));
    patch.rotation.x = -Math.PI / 2;patch.position.y = .001;shadow.add(patch);
  }

  function growTree(amount) {
    growth = clamp(amount, 0, 1);
    for (const item of grownSurfaces) {
      const progress = smooth(growth / item.duration);
      if (progress === item.progress) continue;
      item.progress = progress;item.mesh.visible = progress > 0;
      const positions = item.mesh.geometry.getAttribute('position');
      for (let row = 0; row <= item.rows; row++) for (let col = 0; col <= item.columns; col++) {
        const p = item.surface(Math.min(row / item.rows, progress), col / item.columns * Math.PI * 2);
        positions.setXYZ(row * (item.columns + 1) + col, p.x, p.y, p.z);
      }
      positions.needsUpdate = true;item.mesh.geometry.computeVertexNormals();
    }
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
    petal.velocity.set(mix(-.065, .065, random()), petal.ambient ? mix(.16, .24, random()) : mix(1.2, 1.6, random()), mix(-.06, .06, random()));
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
    for (const petal of petals) { petal.active = false; petal.release = random() * 650; }
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
    // The burst begins at the ceiling and is released over its first 650 ms.
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
