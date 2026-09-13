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
  const stems = material('#445532'), leafMaterial = material('#607746', { side: THREE.DoubleSide });
  const leafShape = new THREE.Shape();
  for (const [index, [x, y]] of [[0, 0], [-.022, .023], [-.046, .031], [-.029, .058], [-.041, .084], [-.016, .079], [0, .125],
    [.017, .079], [.042, .084], [.029, .058], [.046, .031], [.022, .023]].entries()) {
    if (index === 0) leafShape.moveTo(x, y); else leafShape.lineTo(x, y);
  }
  leafShape.closePath();
  const leafGeometry = own(new THREE.ShapeGeometry(leafShape));
  const leafPositions = leafGeometry.attributes.position;
  for (let i = 0; i < leafPositions.count; i++) {
    leafPositions.setZ(i, Math.sin(leafPositions.getY(i) / .125 * Math.PI) * .007);
  }
  leafGeometry.computeVertexNormals();
  const leafPlacements = [];
  const wallQuaternion = new THREE.Quaternion(), localQuaternion = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1);
  for (const [index, site] of plantSites.entries()) {
    const points = [];
    for (let step = 0; step <= 9; step++) {
      const t = step / 9;
      const curl = Math.sin(t * Math.PI * 2.2 + index * .45) * .048 + t * (index % 2 ? -.045 : .035);
      points.push(site.wall === 'back'
        ? new THREE.Vector3(site.x + curl, .028 + site.height * t, -room.length / 2 + .020)
        : new THREE.Vector3(site.side * (room.width / 2 - .020), .028 + site.height * t, site.z + curl));
    }
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    mesh(`nature-ivy-stem-${index + 1}`, new THREE.TubeGeometry(curve, 28, .0035, 5, false), stems);
    const pairs = 7 + Math.round(site.height * 3);
    for (let node = 1; node <= pairs; node++) {
      const t = node / (pairs + 1), position = curve.getPointAt(t), direction = node % 2 ? -1 : 1;
      if (site.wall === 'back') {
        position.z = -room.length / 2 + .029; wallQuaternion.identity();
      } else {
        position.x = site.side * (room.width / 2 - .029);
        wallQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -site.side * Math.PI / 2);
      }
      localQuaternion.setFromAxisAngle(zAxis, direction * (.62 + rng() * .36));
      const scale = .54 + rng() * .28;
      leafPlacements.push({ position, quaternion: wallQuaternion.clone().multiply(localQuaternion), scale });
    }
  }
  const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, leafPlacements.length);
  leaves.name = 'nature-wall-ivy-leaves'; leaves.receiveShadow = true; group.add(leaves);
  for (const [index, leaf] of leafPlacements.entries()) {
    transform.position.copy(leaf.position); transform.quaternion.copy(leaf.quaternion); transform.scale.setScalar(leaf.scale); transform.updateMatrix();
    leaves.setMatrixAt(index, transform.matrix);
    tint.set('#b7c89d').offsetHSL((rng() - .5) * .03, 0, (rng() - .5) * .10); leaves.setColorAt(index, tint);
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
