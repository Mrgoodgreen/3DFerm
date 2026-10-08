import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type V3 = [number, number, number];
export interface PartOpts {
  p?: V3;
  r?: V3;
  s?: number | V3;
  flat?: boolean;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Shared lit material: every mesh in the game uses vertex colors. */
export const MAT = new THREE.MeshLambertMaterial({ vertexColors: true });

/** Merge builder: accumulates colored primitives and merges them into one geometry. */
export class MB {
  parts: THREE.BufferGeometry[] = [];

  add(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, o: PartOpts = {}): this {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    geo.dispose();
    for (const k of Object.keys(g.attributes)) {
      if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    }
    g.clearGroups();
    _e.set(o.r?.[0] ?? 0, o.r?.[1] ?? 0, o.r?.[2] ?? 0);
    _q.setFromEuler(_e);
    _v.set(o.p?.[0] ?? 0, o.p?.[1] ?? 0, o.p?.[2] ?? 0);
    if (typeof o.s === 'number') _s.set(o.s, o.s, o.s);
    else if (o.s) _s.set(o.s[0], o.s[1], o.s[2]);
    else _s.set(1, 1, 1);
    _m.compose(_v, _q, _s);
    g.applyMatrix4(_m);
    if (o.flat) g.computeVertexNormals();
    const c = new THREE.Color(color);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.parts.push(g);
    return this;
  }

  /** Append another builder's parts transformed by the given placement. */
  addMB(other: MB, o: PartOpts = {}): this {
    _e.set(o.r?.[0] ?? 0, o.r?.[1] ?? 0, o.r?.[2] ?? 0);
    _q.setFromEuler(_e);
    _v.set(o.p?.[0] ?? 0, o.p?.[1] ?? 0, o.p?.[2] ?? 0);
    if (typeof o.s === 'number') _s.set(o.s, o.s, o.s);
    else if (o.s) _s.set(o.s[0], o.s[1], o.s[2]);
    else _s.set(1, 1, 1);
    _m.compose(_v, _q, _s);
    for (const p of other.parts) {
      const g = p.clone();
      g.applyMatrix4(_m);
      this.parts.push(g);
    }
    return this;
  }

  addGeometry(g: THREE.BufferGeometry): this {
    this.parts.push(g);
    return this;
  }

  build(): THREE.BufferGeometry {
    if (this.parts.length === 0) return new THREE.BufferGeometry();
    const g = mergeGeometries(this.parts, false)!;
    for (const p of this.parts) p.dispose();
    this.parts = [];
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }

  mesh(shadow = true, receive = false): THREE.Mesh {
    const m = new THREE.Mesh(this.build(), MAT);
    m.castShadow = shadow;
    m.receiveShadow = receive;
    return m;
  }
}

export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt: number, rb: number, h: number, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
export const sph = (r: number, ws = 12, hs = 8) => new THREE.SphereGeometry(r, ws, hs);
export const cone = (r: number, h: number, seg = 8) => new THREE.ConeGeometry(r, h, seg);
export const ico = (r: number, detail = 0) => new THREE.IcosahedronGeometry(r, detail);
export const torus = (r: number, t: number, rs = 6, ts = 16, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, rs, ts, arc);
export const capsule = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 4, 8);

/** Simple seeded RNG so decoration layout is stable between sessions. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
