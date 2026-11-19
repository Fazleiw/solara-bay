// Boats on the water: yachts, sailboats and a ferry moored or drifting around the pier, the
// inlet and the harbour, bobbing and rolling on the swell.
import * as THREE from 'three';
import { WATER_LEVEL } from '../config.js';
import { GeometryBuilder } from '../core/geometryBuilder.js';

function yacht(b, hullColor, stripe) {
  b.taperedBox(0, -0.6, 0, 3.2, 1.6, 11, 2.6, 9.5, hullColor, 0.6);
  b.taperedBox(0, -0.6, 6.2, 3.2, 1.6, 1.6, 0.3, 0.3, hullColor, -0.2);
  b.box(0, 0.4, 0, 3.25, 0.25, 10, stripe);
  b.taperedBox(0, 1.0, -1, 2.4, 1.2, 4.5, 1.9, 3.6, '#f6f6f2');
  b.box(0, 1.5, 0.9, 2.3, 0.5, 0.2, '#22313f');
}

function sailboat(b, hullColor, sailColor) {
  b.taperedBox(0, -0.5, 0, 2.2, 1.2, 7, 1.8, 6, hullColor, 0.3);
  b.taperedBox(0, -0.5, 3.9, 2.2, 1.2, 1, 0.2, 0.2, hullColor);
  b.beam([0, 0.6, 0.6], [0, 11, 0.6], 0.09, 5, '#dddddd');
  const rgb = b.setColor(sailColor);
  b.tri([0.02, 1.2, 0.8], [0.02, 1.2, -2.8], [0.02, 10.6, 0.7], [0, 0], [1, 0], [0, 1], rgb);
  b.tri([-0.02, 1.2, -2.8], [-0.02, 1.2, 0.8], [-0.02, 10.6, 0.7], [0, 0], [1, 0], [0, 1], rgb);
  b.tri([0, 1.2, 1.0], [0, 9.0, 0.7], [0, 1.2, 3.6], [0, 0], [1, 0], [0, 1], rgb);
  b.tri([0, 9.0, 0.7], [0, 1.2, 1.0], [0, 1.2, 3.6], [0, 0], [1, 0], [0, 1], rgb);
}

function ferry(b) {
  b.taperedBox(0, -1.2, 0, 7, 3, 26, 6, 22, '#f2f2f2', 1);
  b.box(0, 1.8, 0, 7.05, 0.5, 22, '#1f4e79');
  b.box(0, 2.3, -2, 6, 2.6, 14, '#ffffff');
  b.box(0, 3.4, -2, 6.05, 0.8, 13.6, '#22313f');
  b.box(0, 4.9, 2, 3, 2.2, 3, '#ffcc33');
}

const FLEET = [
  { kind: 'yacht', x: 420, z: -40, h: 0.3, a: '#ffffff', b: '#1f4e79' },
  { kind: 'sail', x: 470, z: 110, h: 2.2, a: '#ffffff', b: '#fff6e6' },
  { kind: 'sail', x: 520, z: -130, h: 1.1, a: '#264653', b: '#ffffff' },
  { kind: 'yacht', x: 395, z: 85, h: 1.7, a: '#f4f1ea', b: '#c0392b' },
  { kind: 'sail', x: 405, z: 190, h: -0.6, a: '#ffffff', b: '#ffb347' },
  { kind: 'ferry', x: 560, z: 20, h: 1.4 },
  { kind: 'yacht', x: -120, z: -245, h: 1.6, a: '#ffffff', b: '#2a9d8f' },
  { kind: 'sail', x: 230, z: -248, h: -1.4, a: '#ffffff', b: '#ffffff' },
  { kind: 'sail', x: -260, z: -238, h: 0.4, a: '#c0392b', b: '#ffffff' },
  { kind: 'yacht', x: 120, z: 430, h: -1.2, a: '#ffffff', b: '#1f3550' },
];

export function createBoats(scene) {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide });
  const boats = FLEET.map((f, i) => {
    const b = new GeometryBuilder();
    if (f.kind === 'yacht') yacht(b, f.a, f.b);
    else if (f.kind === 'sail') sailboat(b, f.a, f.b);
    else ferry(b);
    const mesh = new THREE.Mesh(b.build(), material);
    mesh.castShadow = true;
    mesh.position.set(f.x, WATER_LEVEL, f.z);
    mesh.rotation.y = f.h;
    scene.add(mesh);
    return { mesh, phase: i * 1.7, drift: f.kind === 'ferry' ? 0 : 0.4, f };
  });
  return {
    update(time) {
      for (const boat of boats) {
        const t = time + boat.phase;
        boat.mesh.position.y = WATER_LEVEL + Math.sin(t * 0.9) * 0.18;
        boat.mesh.rotation.z = Math.sin(t * 0.7) * 0.05;
        boat.mesh.rotation.x = Math.sin(t * 0.55) * 0.03;
        boat.mesh.position.x = boat.f.x + Math.sin(t * 0.05) * boat.drift * 10;
      }
    },
  };
}
