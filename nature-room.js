/** Reversible grass flooring and a few wall-clinging vines for NATURE MODE. */
export function createNatureRoom({ THREE, scene, room }) {
  const group = new THREE.Group(); group.name = 'nature-room'; group.visible = false; scene.add(group);
  const resources = new Set(), own = resource => (resources.add(resource), resource);
  let disposed = false;
  const random = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const rng = random(42091);
  const material = (color, properties = {}) => own(new THREE.MeshStandardMaterial({ color, roughness: 1, ...properties }));
  const mesh = (name, geometry, surface) => {
    const result = new THREE.Mesh(own(geometry), surface); result.name = name; result.receiveShadow = true; group.add(result); return result;
  };

  // A small seamless tile supplies the dense ground cover; the short geometry
  // above it catches the light without requiring thousands of draw calls.
  function turfTexture() {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const context = canvas.getContext('2d'); if (!context) return null;
    const textureRandom = random(19327);
    context.fillStyle = '#617344'; context.fillRect(0, 0, 512, 512);
    const shades = ['#70834b', '#4c6136', '#829257', '#53683a', '#657d43', '#909d6538'];
    for (let i = 0; i < 30000; i++) {
      const x = textureRandom() * 512, y = textureRandom() * 512;
      context.strokeStyle = shades[Math.floor(textureRandom() * shades.length)];
      context.lineWidth = .6 + textureRandom() * .9;
      const dx = (textureRandom() - .5) * 7, dy = 2 + textureRandom() * 7;
      context.beginPath(); context.moveTo(x, y); context.lineTo(x + dx, y - dy); context.stroke();
      // Repeat any edge-crossing stroke on the opposite edge of the tile.
      if (y < dy) { context.beginPath(); context.moveTo(x, y + 512); context.lineTo(x + dx, y + 512 - dy); context.stroke(); }
      if (x + dx < 0 || x + dx > 512) {
        const wrap = x + dx < 0 ? 512 : -512;
        context.beginPath(); context.moveTo(x + wrap, y); context.lineTo(x + wrap + dx, y - dy); context.stroke();
      }
    }
    const texture = own(new THREE.CanvasTexture(canvas)); texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(room.width * 1.25, room.length * 1.25); texture.anisotropy = 4;
    return texture;
  }
  const turfMap = turfTexture();
  const turf = mesh('nature-grass-floor', new THREE.PlaneGeometry(room.width, room.length),
    material(turfMap ? '#ffffff' : '#617344', turfMap ? { map: turfMap } : {}));
  turf.rotation.x = -Math.PI / 2; turf.position.y = -.0038;

  const grassPositions = [], grassIndices = [];
  for (let blade = 0; blade < 3; blade++) {
    const angle = blade * Math.PI * 2 / 3, cos = Math.cos(angle), sin = Math.sin(angle), start = grassPositions.length / 3;
    for (const [x, y, z] of [[-.0048, 0, 0], [.0048, 0, 0], [-.0025, .57, .004], [.0025, .57, .004], [0, 1, .014]]) {
      grassPositions.push(x * cos - z * sin, y, x * sin + z * cos);
    }
    grassIndices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2, start + 2, start + 3, start + 4);
  }
  const grassGeometry = own(new THREE.BufferGeometry());
  grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute(grassPositions, 3));
  grassGeometry.setIndex(grassIndices); grassGeometry.computeVertexNormals();
  const grassCount = Math.round(room.width * room.length * 110);
  const grass = new THREE.InstancedMesh(grassGeometry, material('#ffffff', {
    side: THREE.DoubleSide, emissive: '#394722', emissiveIntensity: .16,
  }), grassCount);
  grass.name = 'nature-grass-blades'; grass.receiveShadow = true; group.add(grass);
  const transform = new THREE.Object3D(), tint = new THREE.Color();
  for (let i = 0; i < grassCount; i++) {
    transform.position.set((rng() - .5) * (room.width - .06), -.0035, (rng() - .5) * (room.length - .09));
    transform.rotation.set(0, rng() * Math.PI * 2, 0);
    const width = .7 + rng() * .8;
    transform.scale.set(width, .019 + rng() * .034, width); transform.updateMatrix();
    grass.setMatrixAt(i, transform.matrix);
    tint.set('#829858').offsetHSL((rng() - .5) * .025, (rng() - .5) * .08, (rng() - .5) * .18);
    grass.setColorAt(i, tint);
  }
  grass.instanceMatrix.needsUpdate = true; grass.instanceColor.needsUpdate = true;
  grass.computeBoundingBox(); grass.computeBoundingSphere();

  // Five plants sit in gaps on the side walls. One peeks into the central
  // rear-wall view, clear of both the cafe opening and exhibition switch.
  const plantSites = [
    { wall: 'back', x: -2.07, height: 1.29 }, { side: -1, z: -.38, height: 1.24 }, { side: -1, z: 4.08, height: 1.63 },
    { side: 1, z: -3.18, height: .73 }, { side: 1, z: -.38, height: 1.08 }, { side: 1, z: 4.08, height: 1.41 },
  ];
  // One shared leaf texture and instanced mesh keep all six plants inexpensive.
  // The lobed silhouette is geometry: there are no overlapping transparent cards.
  function ivyTexture() {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d'); if (!ctx) return null;
    const leafRandom = random(71309);
    const wash = ctx.createLinearGradient(35, 450, 400, 30);
    wash.addColorStop(0, '#587244'); wash.addColorStop(.45, '#8caa65'); wash.addColorStop(1, '#c5c783');
    ctx.fillStyle = wash; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1800; i++) {
      const x = leafRandom() * 512, y = leafRandom() * 512, size = 2 + leafRandom() * 18;
      const cloud = ctx.createRadialGradient(x, y, 0, x, y, size);
      cloud.addColorStop(0, i % 3 ? '#c2c78318' : '#173f2820'); cloud.addColorStop(1, '#49673700');
      ctx.fillStyle = cloud; ctx.fillRect(x - size, y - size, size * 2, size * 2);
    }
    const pixel = ([x, y]) => [(x + .5) * 512, (1 - y) * 512];
    function vein(points, width, color) {
      ctx.beginPath(); points.forEach((point, i) => { const [x, y] = pixel(point); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.lineWidth = width; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    }
    const veins = [
      [[0, .05], [-.012, .36], [.012, .65], [0, .98]],
      [[0, .13], [-.17, .29], [-.41, .37]], [[0, .18], [.20, .31], [.44, .39]],
      [[0, .24], [-.17, .47], [-.37, .70]], [[0, .26], [.20, .51], [.37, .73]],
    ];
    for (const path of veins) {
      vein(path, 8, '#1c442b35'); vein(path, 4, '#e1dfaeac');
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1], b = path[i];
        for (let j = 1; j <= 3; j++) {
          const t = j / 4, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
          for (const side of [-1, 1]) {
            const reach = .035 + leafRandom() * .04;
            vein([[x, y], [x + side * reach * .6, y + .025], [x + side * reach, y + .06]], 1.2, '#dce3b378');
          }
        }
      }
    }
    const texture = own(new THREE.CanvasTexture(canvas)); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
    return texture;
  }
  const leafMap = ivyTexture();
  const stems = material('#ffffff', { vertexColors: true, roughness: .92 });
  const leafMaterial = material(leafMap ? '#ffffff' : '#8caa65', { map: leafMap, side: THREE.DoubleSide, roughness: .77 });
  const outline = new THREE.Shape(); outline.moveTo(0, .06);
  outline.bezierCurveTo(-.07, -.015, -.20, .025, -.23, .15);
  outline.bezierCurveTo(-.25, .23, -.40, .25, -.45, .37);
  outline.bezierCurveTo(-.32, .35, -.28, .42, -.24, .44);
  outline.bezierCurveTo(-.31, .50, -.35, .62, -.38, .72);
  outline.bezierCurveTo(-.25, .68, -.17, .68, -.14, .64);
  outline.bezierCurveTo(-.09, .73, -.05, .90, 0, 1);
  outline.bezierCurveTo(.065, .91, .10, .74, .16, .65);
  outline.bezierCurveTo(.23, .72, .31, .71, .39, .75);
  outline.bezierCurveTo(.35, .61, .29, .49, .26, .45);
  outline.bezierCurveTo(.32, .42, .39, .44, .46, .40);
  outline.bezierCurveTo(.40, .28, .29, .27, .24, .18);
  outline.bezierCurveTo(.20, .05, .07, -.01, 0, .06);
  const edge = outline.getPoints(4); edge.pop();
  const leafVertices = [], leafUV = [], leafIndices = [], rings = 4;
  const addLeafVertex = (x, y) => {
    // A raised midrib and gently cupped edges catch light as the view changes.
    const bend = Math.sin(y * Math.PI) * (.013 - Math.abs(x) * .034) + Math.pow(y, 3) * .009;
    leafVertices.push(x * .155, y * .15, bend); leafUV.push(x + .5, y);
  };
  addLeafVertex(0, .43);
  for (let ring = 1; ring <= rings; ring++) for (const point of edge) {
    const t = ring / rings; addLeafVertex(point.x * t, .43 + (point.y - .43) * t);
  }
  for (let j = 0; j < edge.length; j++) {
    const next = (j + 1) % edge.length;
    leafIndices.push(0, 1 + j, 1 + next);
    for (let ring = 1; ring < rings; ring++) {
      const a = 1 + (ring - 1) * edge.length + j, b = 1 + (ring - 1) * edge.length + next;
      const c = a + edge.length, d = b + edge.length;
      leafIndices.push(a, c, b, b, c, d);
    }
  }
  const leafGeometry = own(new THREE.BufferGeometry());
  leafGeometry.setAttribute('position', new THREE.Float32BufferAttribute(leafVertices, 3));
  leafGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(leafUV, 2));
  leafGeometry.setIndex(leafIndices); leafGeometry.computeVertexNormals();
  const leafPlacements = [];
  const wallQuaternion = new THREE.Quaternion(), localQuaternion = new THREE.Quaternion();
  for (const [index, site] of plantSites.entries()) {
    // Work in wall-local coordinates; keep growth inside the existing clear gap.
    const wallPoint = p => site.wall === 'back'
      ? new THREE.Vector3(site.x + p.x, p.y, -room.length / 2 + p.z)
      : new THREE.Vector3(site.side * (room.width / 2 - p.z), p.y, site.z + site.side * p.x);
    if (site.wall === 'back') wallQuaternion.identity();
    else wallQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -site.side * Math.PI / 2);
    const stemVertices = [], stemNormals = [], stemColors = [];
    function stem(curve, radius, segments, color) {
      const tube = new THREE.TubeGeometry(curve, segments, radius, 5, false);
      const p = tube.attributes.position;
      // Thin growing tips instead of a pipe with an abrupt, blunt end.
      for (let i = 0; i < p.count; i++) {
        const t = Math.floor(i / 6) / segments, center = curve.getPointAt(t), taper = 1 - t * .76;
        p.setXYZ(i, center.x + (p.getX(i) - center.x) * taper, center.y + (p.getY(i) - center.y) * taper, center.z + (p.getZ(i) - center.z) * taper);
      }
      tube.computeVertexNormals();
      for (const i of tube.index.array) {
        stemVertices.push(p.getX(i), p.getY(i), p.getZ(i));
        const n = tube.attributes.normal; stemNormals.push(n.getX(i), n.getY(i), n.getZ(i));
        stemColors.push(color.r, color.g, color.b);
      }
      tube.dispose();
    }
    function leafAt(localPosition, angle, size, young = false) {
      const base = localPosition.clone(), tip = base.clone();
      tip.x -= Math.sin(angle) * .023; tip.y += Math.cos(angle) * .023; tip.z += .007;
      stem(new THREE.CatmullRomCurve3([wallPoint(base), wallPoint(base.clone().lerp(tip, .55)), wallPoint(tip)]), .0014, 3, new THREE.Color('#79834b'));
      localQuaternion.setFromEuler(new THREE.Euler((rng() - .5) * .26, (rng() - .5) * .32, angle, 'XYZ'));
      const colors = young ? ['#f5efa4', '#d5e5a6', '#fff0b1'] : ['#ffffff', '#d6e5af', '#9dbca6', '#c8d8b4', '#eac58b'];
      leafPlacements.push({ position: wallPoint(tip), quaternion: wallQuaternion.clone().multiply(localQuaternion),
        size, width: .82 + rng() * .30, color: new THREE.Color(colors[Math.floor(rng() * colors.length)]) });
    }
    const points = [];
    for (let step = 0; step <= 10; step++) {
      const t = step / 10;
      const curl = Math.sin(t * Math.PI * (1.8 + index * .11) + index * .8) * .047 + Math.sin(t * 11 + index) * .013;
      points.push(new THREE.Vector3(curl, .028 + site.height * t, .021 + Math.sin(t * Math.PI) * .003));
    }
    const localCurve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    stem(new THREE.CatmullRomCurve3(points.map(wallPoint), false, 'centripetal'), .0042, 32, new THREE.Color('#756e46'));
    const nodes = 9 + Math.round(site.height * 3);
    for (let node = 0; node < nodes; node++) {
      const t = (node + .5 + rng() * .3) / nodes, point = localCurve.getPointAt(t), side = node % 2 ? -1 : 1;
      leafAt(point, side * (.65 + rng() * (t > .78 ? .6 : 1.5)), (.65 + rng() * .25) * (1 - t * .30), t > .78);
      if (node > 1 && node < nodes - 2 && node % 3 === index % 3) {
        const reach = .06 + rng() * .038, height = .13 + rng() * .09;
        const branch = [point, new THREE.Vector3(point.x + side * reach * .65, point.y + height * .4, .026),
          new THREE.Vector3(point.x + side * reach, point.y + height, .024)];
        const branchCurve = new THREE.CatmullRomCurve3(branch);
        stem(new THREE.CatmullRomCurve3(branch.map(wallPoint)), .0022, 10, new THREE.Color('#73824a'));
        for (const tBranch of [.28, .61, .9]) leafAt(branchCurve.getPointAt(tBranch), side * (.40 + rng() * 1.25), .41 + rng() * .23, tBranch > .8);
      }
    }
    const stemGeometry = new THREE.BufferGeometry();
    stemGeometry.setAttribute('position', new THREE.Float32BufferAttribute(stemVertices, 3));
    stemGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(stemNormals, 3));
    stemGeometry.setAttribute('color', new THREE.Float32BufferAttribute(stemColors, 3));
    mesh(`nature-ivy-stem-${index + 1}`, stemGeometry, stems);
  }
  const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, leafPlacements.length);
  leaves.name = 'nature-wall-ivy-leaves'; leaves.receiveShadow = true; group.add(leaves);
  for (const [index, leaf] of leafPlacements.entries()) {
    transform.position.copy(leaf.position); transform.quaternion.copy(leaf.quaternion);
    transform.scale.set(leaf.size * leaf.width, leaf.size, leaf.size); transform.updateMatrix();
    leaves.setMatrixAt(index, transform.matrix); leaves.setColorAt(index, leaf.color);
  }
  leaves.instanceMatrix.needsUpdate = true; leaves.instanceColor.needsUpdate = true;
  leaves.computeBoundingBox(); leaves.computeBoundingSphere();

  return { group, setActive(active) { if (!disposed) group.visible = Boolean(active); }, dispose() {
    if (disposed) return;
    disposed = true; group.visible = false; group.removeFromParent();
    grass.dispose(); leaves.dispose();
    for (const resource of resources) resource.dispose(); resources.clear();
  } };
}
