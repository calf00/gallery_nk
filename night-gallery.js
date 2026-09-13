/** Local finishes for the night-photo gallery; restore the original nature palette. */
export function createNightGalleryFinish({ THREE, scene, room, artworks, spots, glowMaterial, materials }) {
  const resources = new Set(), swaps = [], batches = [];
  const own = resource => (resources.add(resource), resource);
  const group = new THREE.Group(); group.name = 'night-gallery-details'; scene.add(group);
  let disposed = false;
  function texture(size, draw, repeatX, repeatY, color = false) {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d'); if (!ctx) return null;
    draw(ctx, size);
    const result = own(new THREE.CanvasTexture(canvas));
    result.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    result.wrapS = result.wrapT = THREE.RepeatWrapping;
    result.repeat.set(repeatX, repeatY); result.anisotropy = 4;
    return result;
  }
  const plaster = texture(128, (ctx, size) => {
    ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, size, size);
    let seed = 4103;
    for (let i = 0; i < 7500; i++) {
      seed = seed * 16807 % 2147483647; const x = seed % size;
      seed = seed * 16807 % 2147483647; const y = seed % size;
      ctx.fillStyle = i % 2 ? '#ffffff12' : '#00000012'; ctx.fillRect(x, y, 1, 1);
    }
  }, 8, 6);
  const weave = texture(256, (ctx, size) => {
    ctx.fillStyle = '#8b8b8b'; ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 4) for (let x = 0; x < size; x += 4) {
      const vertical = (x / 4 + y / 4) % 2 === 0;
      ctx.fillStyle = vertical ? '#999999' : '#818181';
      ctx.fillRect(x, y, vertical ? 2 : 4, vertical ? 4 : 2);
      ctx.fillStyle = '#ffffff0b'; ctx.fillRect(x, y, 1, 1);
    }
  }, room.width * 2, room.length * 2, true);
  const finish = (source, properties) => {
    const result = own(source.clone()); result.setValues(properties); return result;
  };
  const wall = finish(materials.wall, { color: '#e6e2d9', bumpMap: plaster, bumpScale: .0018, roughness: .94 });
  const trim = finish(materials.trim, { color: '#c5c4bd', roughness: .78 });
  const floor = finish(materials.floorMat, { color: '#8d8f92', map: weave, roughness: .98 });
  const ceiling = finish(materials.ceilingMat, { color: '#52585d', map: null, bumpMap: plaster, bumpScale: .004, roughness: .96 });
  const hardware = finish(materials.metal, { color: '#8f9496', metalness: .5, roughness: .46 });
  const upholstery = finish(materials.black, { color: '#34393d', roughness: .94, bumpMap: plaster, bumpScale: .0008 });
  const frameFinish = finish(materials.darkMetal, { color: '#24292d', metalness: .62, roughness: .42 });
  const matFinish = finish(materials.paper, { color: '#f3f0e8', roughness: .96 });
  const replacement = new Map([[materials.wall, wall], [materials.trim, trim], [materials.floorMat, floor],
    [materials.ceilingMat, ceiling], [materials.metal, hardware], [materials.black, upholstery]]);
  const position = new THREE.Vector3(); scene.updateMatrixWorld(true);
  scene.traverse(object => {
    if (!object.isMesh || !replacement.has(object.material)) return;
    object.getWorldPosition(position);
    // Rear gallery wall returns belong here; the shared café floor and furniture do not.
    if (Math.abs(position.x) > room.width / 2 + .08 || position.z < -room.length / 2 - .075 || position.z > room.length / 2) return;
    if (object.material === materials.metal && position.y < 2.5) return;
    swaps.push([object, object.material, replacement.get(object.material)]);
  });
  for (const artwork of artworks) {
    swaps.push([artwork.border, artwork.border.material, frameFinish], [artwork.sheet, artwork.sheet.material, matFinish]);
  }

  const dummy = new THREE.Object3D(), matrix = new THREE.Matrix4();
  function batch(name, geometry, surface, placements) {
    const mesh = new THREE.InstancedMesh(own(geometry), surface, placements.length);
    mesh.name = name; mesh.receiveShadow = true; group.add(mesh); batches.push(mesh);
    for (const [i, item] of placements.entries()) {
      dummy.position.set(...item.position); dummy.rotation.set(0, 0, 0); dummy.scale.set(...item.scale); dummy.updateMatrix();
      matrix.copy(dummy.matrix); if (item.parent) matrix.premultiply(item.parent.matrixWorld);
      mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, new THREE.Color(item.color || '#ffffff'));
    }
    mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  }
  const bevels = [], shadows = [], reveals = [];
  for (const { frame, size } of artworks) {
    const width = size.width + .021, height = size.height + .021;
    for (const side of [-1, 1]) {
      bevels.push({ parent: frame, position: [0, side * height / 2, .0138], scale: [width, .0018, .0012], color: side > 0 ? '#878b8c' : '#3a4145' });
      bevels.push({ parent: frame, position: [side * width / 2, 0, .0138], scale: [.0018, height, .0012], color: '#535b60' });
    }
    shadows.push({ parent: frame, position: [.003, -.004, -.018], scale: [size.width + .09, size.height + .09, 1] });
  }
  const bevelMat = own(new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: .55, roughness: .48 }));
  batch('night-frame-beveled-edges', new THREE.BoxGeometry(1, 1, 1), bevelMat, bevels);
  const shadowMap = texture(256, ctx => {
    ctx.shadowColor = '#000000a6'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 5;
    ctx.fillStyle = '#00000088'; ctx.fillRect(24, 24, 208, 208);
  }, 1, 1, true);
  if (shadowMap) {
    shadowMap.wrapS = shadowMap.wrapT = THREE.ClampToEdgeWrapping;
    const shadowMat = own(new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, opacity: .34, depthWrite: false, toneMapped: false }));
    batch('night-frame-contact-shadows', new THREE.PlaneGeometry(1, 1), shadowMat, shadows);
  }
  // Millimetre-scale reveals give the existing skirting a crisp upper edge.
  for (const side of [-1, 1]) {
    reveals.push({ position: [side * (room.width / 2 - .0018), .100, 0], scale: [.003, .006, room.length] });
    for (const z of room.columns) {
      reveals.push({ position: [side * (room.width / 2 - room.columnDepth - .0018), .104, z], scale: [.003, .006, room.columnWidth + .022] });
      for (const edge of [-1, 1]) reveals.push({ position: [side * (room.width / 2 - room.columnDepth / 2), .104, z + edge * (room.columnWidth / 2 + .012)], scale: [room.columnDepth, .006, .003] });
    }
  }
  batch('night-skirting-reveals', new THREE.BoxGeometry(1, 1, 1), own(new THREE.MeshStandardMaterial({ color: '#787c7a', roughness: 1 })), reveals);
  const originalLights = spots.map(light => ({ light, color: light.color.clone(), intensity: light.intensity }));
  const originalGlow = glowMaterial.opacity;
  function setActive(active) {
    if (disposed) return;
    group.visible = Boolean(active);
    for (const [object, original, refined] of swaps) object.material = active ? refined : original;
    for (const { light, color, intensity } of originalLights) {
      light.color.copy(active ? new THREE.Color('#fff8ee') : color);
      light.intensity = active ? intensity * .62 : intensity;
    }
    glowMaterial.opacity = active ? .20 : originalGlow;
  }
  setActive(true);
  return { group, setActive, dispose() {
    if (disposed) return;
    setActive(false); disposed = true; group.removeFromParent();
    for (const mesh of batches) mesh.dispose();
    for (const resource of resources) resource.dispose(); resources.clear();
  } };
}
