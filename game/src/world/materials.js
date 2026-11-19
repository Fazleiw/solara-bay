// The shared material set. Facade materials carry an emissive window map whose strength the
// day/night cycle raises after sunset; neon and lamp materials brighten the same way.
import * as THREE from 'three';

export function createMaterials(textures) {
  const facade = (key, { roughness = 0.75, metalness = 0.05 } = {}) => new THREE.MeshStandardMaterial({
    map: textures.facades[key].map,
    emissiveMap: textures.facades[key].emissive,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0,
    vertexColors: true,
    roughness,
    metalness,
  });
  const plain = (map, roughness = 0.9, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness, vertexColors: true, ...extra });

  const materials = {
    glass: facade('glass', { roughness: 0.18, metalness: 0.55 }),
    office: facade('office'),
    stucco: facade('stucco', { roughness: 0.85 }),
    house: facade('house', { roughness: 0.85 }),
    warehouse: facade('warehouse', { roughness: 0.6, metalness: 0.3 }),
    roof: plain(textures.roof),
    road: plain(textures.road, 0.85),
    crossing: plain(textures.crossing, 0.85),
    sidewalk: plain(textures.sidewalk),
    plaza: plain(textures.plaza),
    grass: plain(textures.grass, 1),
    sand: plain(textures.sand, 1),
    concrete: plain(textures.concrete),
    wood: plain(textures.wood, 0.85),
    pool: new THREE.MeshStandardMaterial({ map: textures.pool, roughness: 0.1, metalness: 0.1, emissive: new THREE.Color('#2aa8c8'), emissiveIntensity: 0.15 }),
    /** Untextured vertex-coloured surfaces: trims, awnings, cranes, props. */
    trim: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.1 }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.7 }),
    /** Things that glow at night: lamp heads, lighthouse lamp, neon tubes. */
    lamp: new THREE.MeshStandardMaterial({ color: '#fff3d0', emissive: new THREE.Color('#ffd58a'), emissiveIntensity: 0.2, roughness: 0.4 }),
    neonTube: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    lightPool: new THREE.MeshBasicMaterial({ map: textures.glow, color: '#ffcf8a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
  };
  materials.facades = [materials.glass, materials.office, materials.stucco, materials.house, materials.warehouse];
  return materials;
}
