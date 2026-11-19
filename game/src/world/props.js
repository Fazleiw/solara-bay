// Instanced street furniture and greenery: palm trees, broadleaf trees, street lamps with the
// warm pools of light they cast at night, and traffic signals whose lamps follow the road
// network's light phase. Each kind is one InstancedMesh, so hundreds cost a few draw calls.
import * as THREE from 'three';
import { BLOCK_SIZE, GRID } from '../config.js';
import { GeometryBuilder } from '../core/geometryBuilder.js';
import { blockCenter, districtOf, isLandDistrict, lineCoord } from './cityLayout.js';

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);

function setInstance(mesh, index, x, y, z, rotY, sx, sy = sx, sz = sx) {
  tmpQuat.setFromAxisAngle(up, rotY);
  tmpMatrix.compose(tmpPos.set(x, y, z), tmpQuat, tmpScale.set(sx, sy, sz));
  mesh.setMatrixAt(index, tmpMatrix);
}

/** A 10 m palm trunk leaning gently, built once and instanced. */
function palmTrunkGeometry() {
  const b = new GeometryBuilder();
  const segments = 7;
  for (let s = 0; s < segments; s += 1) {
    const t0 = s / segments, t1 = (s + 1) / segments;
    const lean0 = Math.pow(t0, 2) * 1.6, lean1 = Math.pow(t1, 2) * 1.6;
    b.beam([lean0, t0 * 10, 0], [lean1, t1 * 10 + 0.05, 0], 0.32 - t0 * 0.1, 7, s % 2 ? '#8a6a4a' : '#9c7b58');
  }
  return { geometry: b.build(), top: [1.6, 10, 0] };
}

/** Drooping fronds radiating from the crown, textured with the painted leaf. */
function palmFrondGeometry(top) {
  const b = new GeometryBuilder();
  const rgb = [1, 1, 1];
  const count = 9;
  for (let n = 0; n < count; n += 1) {
    const a = (n / count) * Math.PI * 2 + (n % 2) * 0.2;
    const dx = Math.cos(a), dz = Math.sin(a);
    const px = -dz * 0.7, pz = dx * 0.7;
    const droop = 0.6 + (n % 3) * 0.35;
    const p0 = [top[0], top[1], top[2]];
    const p1 = [top[0] + dx * 2.6, top[1] + 0.5, top[2] + dz * 2.6];
    const p2 = [top[0] + dx * 4.8, top[1] - droop - 0.6, top[2] + dz * 4.8];
    const quadStrip = (a0, a1, v0, v1, w0, w1) => {
      b.quad(
        [a0[0] - px * w0, a0[1], a0[2] - pz * w0], [a0[0] + px * w0, a0[1], a0[2] + pz * w0],
        [a1[0] + px * w1, a1[1], a1[2] + pz * w1], [a1[0] - px * w1, a1[1], a1[2] - pz * w1], rgb, 0, v0, 1, v1,
      );
    };
    quadStrip(p0, p1, 0, 0.5, 0.6, 1.0);
    quadStrip(p1, p2, 0.5, 1, 1.0, 0.5);
  }
  return b.build();
}

function treeGeometry() {
  const b = new GeometryBuilder();
  b.cylinder(0, 0, 0, 0.25, 0.18, 3, 6, '#6b4f36');
  const canopy = new THREE.IcosahedronGeometry(2.4, 1);
  const pos = canopy.attributes.position;
  const shades = ['#4f8a3a', '#5c9a42', '#467f33'];
  for (const [ox, oy, oz, s, shade] of [[0, 4.2, 0, 1, 0], [0.9, 3.6, 0.6, 0.7, 1], [-0.8, 3.8, -0.5, 0.75, 2]]) {
    const rgb = b.setColor(shades[shade]);
    for (let i = 0; i < pos.count; i += 3) {
      const p = (k) => [pos.getX(i + k) * s + ox, pos.getY(i + k) * s * 0.85 + oy, pos.getZ(i + k) * s + oz];
      b.tri(p(0), p(1), p(2), [0, 0], [1, 0], [0, 1], rgb);
    }
  }
  return b.build();
}

function lampGeometry(tall) {
  const b = new GeometryBuilder();
  const h = tall ? 11 : 6.5;
  b.cylinder(0, 0, 0, 0.12, 0.09, h, 6, '#3d434b');
  b.beam([0, h - 0.1, 0], [1.8, h + 0.3, 0], 0.07, 4, '#3d434b');
  return { geometry: b.build(), head: [1.9, h + 0.15, 0] };
}

export function buildProps(lists, materials, textures, network, scene) {
  const group = new THREE.Group();
  group.name = 'props';

  // Street lamps along every land block's sidewalk, arms reaching over the road.
  const lamps = [...lists.lamps.map((l) => ({ ...l, rot: 0 }))];
  for (let i = 0; i < GRID.cols; i += 1) {
    for (let j = 0; j < GRID.rows; j += 1) {
      const d = districtOf(i, j);
      if (!isLandDistrict(d)) continue;
      const { x, z } = blockCenter(i, j);
      const e = BLOCK_SIZE / 2 - 0.8;
      if (d === 'beach') {
        for (const oz of [-18, 18]) lamps.push({ x: x - e - 6, z: z + oz, rot: Math.PI });
        continue;
      }
      for (const o of [-14, 14]) {
        lamps.push({ x: x + o, z: z - e, rot: Math.PI / 2 });
        lamps.push({ x: x + o, z: z + e, rot: -Math.PI / 2 });
        lamps.push({ x: x - e, z: z + o, rot: Math.PI });
        lamps.push({ x: x + e, z: z + o, rot: 0 });
      }
    }
  }
  for (const s of [-1, 1]) for (const zz of [-262, -230]) lamps.push({ x: lineCoord(6) + s * 7.2, z: zz, rot: s > 0 ? Math.PI : 0 });

  const short = lampGeometry(false);
  const tall = lampGeometry(true);
  const poleMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.6 });
  const shortLamps = lamps.filter((l) => !l.tall), tallLamps = lamps.filter((l) => l.tall);
  const headGeo = new THREE.BoxGeometry(0.9, 0.22, 0.45);
  const poolGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const heads = new THREE.InstancedMesh(headGeo, materials.lamp, lamps.length);
  const pools = new THREE.InstancedMesh(poolGeo, materials.lightPool, lamps.length);
  pools.renderOrder = 1;
  let headIndex = 0;
  for (const [list, kind] of [[shortLamps, short], [tallLamps, tall]]) {
    if (!list.length) continue;
    const poles = new THREE.InstancedMesh(kind.geometry, poleMaterial, list.length);
    poles.castShadow = true;
    list.forEach((lamp, n) => {
      // rot points the arm: 0 = +x. Rotation about y by -rot maps +x onto (cos rot, -sin rot).
      setInstance(poles, n, lamp.x, 0.12, lamp.z, lamp.rot);
      const hx = lamp.x + Math.cos(lamp.rot) * kind.head[0], hz = lamp.z - Math.sin(lamp.rot) * kind.head[0];
      setInstance(heads, headIndex, hx, kind.head[1], hz, lamp.rot, 1);
      setInstance(pools, headIndex, hx, 0.16, hz, 0, lamp.tall ? 16 : 10);
      headIndex += 1;
    });
    group.add(poles);
  }
  group.add(heads, pools);

  // Palms.
  const trunk = palmTrunkGeometry();
  const frondMaterial = new THREE.MeshStandardMaterial({ map: textures.frond, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, color: '#e8ffd8' });
  const trunkMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const trunks = new THREE.InstancedMesh(trunk.geometry, trunkMaterial, lists.palms.length);
  const fronds = new THREE.InstancedMesh(palmFrondGeometry(trunk.top), frondMaterial, lists.palms.length);
  fronds.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: textures.frond, alphaTest: 0.45 });
  trunks.castShadow = fronds.castShadow = true;
  lists.palms.forEach((p, n) => {
    const rot = ((p.x * 12.9898 + p.z * 78.233) % 6.283);
    setInstance(trunks, n, p.x, p.y ?? 0.1, p.z, rot, p.h / 10);
    setInstance(fronds, n, p.x, p.y ?? 0.1, p.z, rot, p.h / 10);
  });
  group.add(trunks, fronds);

  // Broadleaf trees.
  if (lists.trees.length) {
    const trees = new THREE.InstancedMesh(treeGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), lists.trees.length);
    trees.castShadow = true;
    lists.trees.forEach((t, n) => setInstance(trees, n, t.x, 0.12, t.z, (t.x * 3.1) % 6.28, t.s));
    group.add(trees);
  }

  // Traffic signals: a pole on each corner of every junction with lights, two lamp clusters each.
  const lit = network.nodeList.filter((n) => n.hasLights);
  const signalPoles = new GeometryBuilder();
  const lampSlots = { ns: [], ew: [] };
  for (const node of lit) {
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const px = node.x + sx * 7.9, pz = node.z + sz * 7.9;
      signalPoles.cylinder(px, 0.12, pz, 0.11, 0.11, 4.6, 6, '#2f343a');
      signalPoles.box(px - sx * 0.4, 3.4, pz, 0.35, 1.3, 0.35, '#1d2025');
      signalPoles.box(px, 3.4, pz - sz * 0.4, 0.35, 1.3, 0.35, '#1d2025');
      lampSlots.ns.push([px - sx * 0.4, pz]);
      lampSlots.ew.push([px, pz - sz * 0.4]);
    }
  }
  const signalMesh = new THREE.Mesh(signalPoles.build(), poleMaterial);
  signalMesh.castShadow = true;
  group.add(signalMesh);
  const bulbGeo = new THREE.SphereGeometry(0.15, 8, 6);
  const signalColours = { red: '#ff2a2a', amber: '#ffb020', green: '#30ff6a' };
  const signals = {};
  for (const axis of ['ns', 'ew']) {
    signals[axis] = {};
    ['red', 'amber', 'green'].forEach((colour, k) => {
      const material = new THREE.MeshBasicMaterial({ color: signalColours[colour], toneMapped: false });
      const mesh = new THREE.InstancedMesh(bulbGeo, material, lampSlots[axis].length);
      lampSlots[axis].forEach(([x, z], n) => setInstance(mesh, n, x, 3.85 - k * 0.42, z, 0, 1));
      group.add(mesh);
      signals[axis][colour] = material;
    });
  }

  scene.add(group);
  const dim = new THREE.Color('#2a2a2a');
  return {
    group,
    lampCount: lamps.length,
    update(night, time) {
      materials.lightPool.opacity = night * 0.5;
      materials.lamp.emissiveIntensity = 0.2 + night * 3.5;
      for (const axis of ['ns', 'ew']) {
        const state = network.lightState(axis, time);
        for (const colour of ['red', 'amber', 'green']) {
          const target = signals[axis][colour];
          if (colour === state) target.color.set(signalColours[colour]).multiplyScalar(1.4);
          else target.color.copy(dim);
        }
      }
    },
  };
}
