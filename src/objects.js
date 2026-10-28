import * as THREE from 'three';

const SHAPES = {
  cube: () => new THREE.BoxGeometry(0.12, 0.12, 0.12),
  cone: () => new THREE.ConeGeometry(0.07, 0.14, 24),
  sphere: () => new THREE.SphereGeometry(0.07, 24, 16),
};

/** Pastel HSL color (saturation & lightness tuned for soft look). */
function randomPastel() {
  const h = Math.random() * 360;
  return new THREE.Color(`hsl(${h}, 65%, 72%)`);
}

/**
 * Create a placeable mesh for the given shape key.
 * Geometry is centered; caller must offset Y so the base sits on the surface.
 */
export function createObject(shape = 'cube') {
  const factory = SHAPES[shape] ?? SHAPES.cube;
  const geometry = factory();
  const material = new THREE.MeshStandardMaterial({
    color: randomPastel(),
    roughness: 0.45,
    metalness: 0.1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.shape = shape;
  mesh.userData.isPlaced = true;
  return mesh;
}

/** Vertical offset so the object's lowest point rests on y = 0 of its local frame. */
export function baseOffsetY(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  return -box.min.y;
}

/** Dispose geometry + material so we don't leak GPU resources. */
export function disposeObject(mesh) {
  if (mesh.geometry) mesh.geometry.dispose();
  if (mesh.material) {
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m) => m.dispose());
    } else {
      mesh.material.dispose();
    }
  }
}