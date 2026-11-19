// GeometryBuilder: appends boxes, tapered boxes, prisms and cylinders into one non-indexed
// BufferGeometry with positions, normals, uvs and vertex colours. The city merges thousands of
// pieces this way into a handful of meshes per block, which keeps draw calls low.
import * as THREE from 'three';

const tmpColor = new THREE.Color();

export class GeometryBuilder {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.uvs = [];
    this.colors = [];
  }

  get vertexCount() {
    return this.positions.length / 3;
  }

  setColor(color) {
    tmpColor.set(color);
    return [tmpColor.r, tmpColor.g, tmpColor.b];
  }

  /** One triangle with a flat normal. */
  tri(a, b, c, uvA, uvB, uvC, rgb) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    for (const [p, uv] of [[a, uvA], [b, uvB], [c, uvC]]) {
      this.positions.push(p[0], p[1], p[2]);
      this.normals.push(nx, ny, nz);
      this.uvs.push(uv[0], uv[1]);
      this.colors.push(rgb[0], rgb[1], rgb[2]);
    }
  }

  /** A quad a-b-c-d (counter-clockwise seen from the front) with uv rectangle u0..u1, v0..v1. */
  quad(a, b, c, d, rgb, u0 = 0, v0 = 0, u1 = 1, v1 = 1) {
    this.tri(a, b, c, [u0, v0], [u1, v0], [u1, v1], rgb);
    this.tri(a, c, d, [u0, v0], [u1, v1], [u0, v1], rgb);
  }

  /**
   * An axis-aligned box from its base centre (x, y, z) and size. `uvScale` maps metres to
   * texture repeats on the sides (so facades tile by storey); `top` false skips the roof face.
   */
  box(x, y, z, w, h, d, color, { uvScale = 0, top = true, bottom = false, sideColor = null, topColor = null } = {}) {
    const rgb = this.setColor(color);
    const side = sideColor ? this.setColor(sideColor) : rgb;
    const roof = topColor ? this.setColor(topColor) : rgb;
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, y0 = y, y1 = y + h;
    const su = uvScale ? w * uvScale : 1, sd = uvScale ? d * uvScale : 1, sv = uvScale ? h * uvScale : 1;
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], side, 0, 0, su, sv); // +z
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], side, 0, 0, su, sv); // -z
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], side, 0, 0, sd, sv); // +x
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], side, 0, 0, sd, sv); // -x
    if (top) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], roof, 0, 0, uvScale ? w / 8 : 1, uvScale ? d / 8 : 1);
    if (bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], rgb);
    return this;
  }

  /** A box whose top is narrower: car cabins, roofs with slopes, tower crowns. */
  taperedBox(x, y, z, w, h, d, topW, topD, color, topShiftZ = 0) {
    const rgb = this.setColor(color);
    const b = [[x - w / 2, y, z - d / 2], [x + w / 2, y, z - d / 2], [x + w / 2, y, z + d / 2], [x - w / 2, y, z + d / 2]];
    const t = [
      [x - topW / 2, y + h, z - topD / 2 + topShiftZ], [x + topW / 2, y + h, z - topD / 2 + topShiftZ],
      [x + topW / 2, y + h, z + topD / 2 + topShiftZ], [x - topW / 2, y + h, z + topD / 2 + topShiftZ],
    ];
    this.quad(b[3], b[2], t[2], t[3], rgb);
    this.quad(b[1], b[0], t[0], t[1], rgb);
    this.quad(b[2], b[1], t[1], t[2], rgb);
    this.quad(b[0], b[3], t[3], t[0], rgb);
    this.quad(t[3], t[2], t[1], t[0], rgb);
    return this;
  }

  /** A gabled roof prism along x (ridge parallel to x) sitting at height y. */
  gable(x, y, z, w, h, d, color) {
    const rgb = this.setColor(color);
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, y1 = y + h;
    this.quad([x0, y, z1], [x1, y, z1], [x1, y1, z], [x0, y1, z], rgb, 0, 0, w / 4, d / 4);
    this.quad([x1, y, z0], [x0, y, z0], [x0, y1, z], [x1, y1, z], rgb, 0, 0, w / 4, d / 4);
    this.tri([x1, y, z1], [x1, y, z0], [x1, y1, z], [0, 0], [1, 0], [0.5, 1], rgb);
    this.tri([x0, y, z0], [x0, y, z1], [x0, y1, z], [0, 0], [1, 0], [0.5, 1], rgb);
    return this;
  }

  /** An upright cylinder (or cone when r1 differs) from its base centre. */
  cylinder(x, y, z, r0, r1, h, segments, color, { top = true } = {}) {
    const rgb = this.setColor(color);
    for (let i = 0; i < segments; i += 1) {
      const a0 = (i / segments) * Math.PI * 2, a1 = ((i + 1) / segments) * Math.PI * 2;
      const p0 = [x + Math.cos(a0) * r0, y, z + Math.sin(a0) * r0];
      const p1 = [x + Math.cos(a1) * r0, y, z + Math.sin(a1) * r0];
      const q0 = [x + Math.cos(a0) * r1, y + h, z + Math.sin(a0) * r1];
      const q1 = [x + Math.cos(a1) * r1, y + h, z + Math.sin(a1) * r1];
      this.quad(p1, p0, q0, q1, rgb, i / segments, 0, (i + 1) / segments, 1);
      if (top && r1 > 0) this.tri([x, y + h, z], q1, q0, [0.5, 0.5], [0, 0], [1, 0], rgb);
    }
    return this;
  }

  /** A cylinder lying along the axis from point a to point b (cables, poles, rails). */
  beam(a, b, radius, segments, color) {
    const rgb = this.setColor(color);
    const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = dir.length();
    dir.normalize();
    const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(dir, up).normalize();
    const v = new THREE.Vector3().crossVectors(dir, u).normalize();
    for (let i = 0; i < segments; i += 1) {
      const a0 = (i / segments) * Math.PI * 2, a1 = ((i + 1) / segments) * Math.PI * 2;
      const o0 = u.clone().multiplyScalar(Math.cos(a0) * radius).addScaledVector(v, Math.sin(a0) * radius);
      const o1 = u.clone().multiplyScalar(Math.cos(a1) * radius).addScaledVector(v, Math.sin(a1) * radius);
      const p0 = [a[0] + o0.x, a[1] + o0.y, a[2] + o0.z];
      const p1 = [a[0] + o1.x, a[1] + o1.y, a[2] + o1.z];
      const q0 = [p0[0] + dir.x * len, p0[1] + dir.y * len, p0[2] + dir.z * len];
      const q1 = [p1[0] + dir.x * len, p1[1] + dir.y * len, p1[2] + dir.z * len];
      this.quad(p0, p1, q1, q0, rgb);
    }
    return this;
  }

  /** A flat horizontal rectangle at height y (decals, pools, markings). */
  flat(x, y, z, w, d, color, u1 = 1, v1 = 1) {
    const rgb = this.setColor(color);
    this.quad([x - w / 2, y, z + d / 2], [x + w / 2, y, z + d / 2], [x + w / 2, y, z - d / 2], [x - w / 2, y, z - d / 2], rgb, 0, 0, u1, v1);
    return this;
  }

  build() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    return geometry;
  }
}

/** Builds a mesh from a builder only when it holds something; returns null for an empty one. */
export function meshFromBuilder(builder, material, { castShadow = true, receiveShadow = true } = {}) {
  if (builder.vertexCount === 0) return null;
  const mesh = new THREE.Mesh(builder.build(), material);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}
