import * as THREE from 'three';
import type { FieldDef } from '../data';
import { plotGeo } from '../render/models';
import { MAT, MB, box, cyl } from '../render/mb';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export interface Plot {
  x: number;
  z: number;
  g: number;
  rot: number;
  pop: number;
  reserved: boolean;
}

export class Field {
  group = new THREE.Group();
  plots: Plot[] = [];
  inst: THREE.InstancedMesh;
  active = false;

  constructor(public def: FieldDef) {
    const geo = plotGeo(def.kind === 'tree' ? 'apples' : def.kind);
    const n = def.cols * def.rows;
    this.inst = new THREE.InstancedMesh(geo, MAT, n);
    this.inst.castShadow = true;
    this.inst.frustumCulled = false;
    const statics = new MB();
    for (let r = 0; r < def.rows; r++) {
      for (let c = 0; c < def.cols; c++) {
        const x = def.x + (c - (def.cols - 1) / 2) * def.spacing;
        const z = def.z + (r - (def.rows - 1) / 2) * def.spacing;
        this.plots.push({ x, z, g: 1, rot: Math.random() * 6, pop: 0, reserved: false });
        if (def.kind === 'tree') {
          const t = plotGeo('tree');
          t.translate(x, 0, z);
          statics.addGeometry(t);
        } else if (def.kind === 'carrot' || def.kind === 'wheat') {
          statics.add(box(0.9, 0.08, 0.9), 0x7a4e2c, { p: [x, 0.04, z] });
        }
      }
    }
    if (def.kind === 'wheat') {
      // Scarecrow
      const sx = def.x + ((def.cols - 1) * def.spacing) / 2 + 1.1;
      const sz = def.z - ((def.rows - 1) * def.spacing) / 2;
      statics.add(cyl(0.05, 0.05, 1.8, 5), 0x8a5a33, { p: [sx, 0.9, sz] });
      statics.add(box(1.2, 0.06, 0.06), 0x8a5a33, { p: [sx, 1.35, sz] });
      statics.add(box(0.45, 0.55, 0.25), 0x4f86c6, { p: [sx, 1.3, sz] });
      statics.add(box(1.0, 0.18, 0.18), 0xd9534f, { p: [sx, 1.4, sz] });
      statics.add(cyl(0.18, 0.18, 0.3, 8), 0xf2cf63, { p: [sx, 1.75, sz] });
      statics.add(cyl(0.38, 0.38, 0.04, 10), 0xc9a24f, { p: [sx, 1.92, sz] });
      statics.add(cyl(0.18, 0.2, 0.2, 10), 0xc9a24f, { p: [sx, 2.02, sz] });
    }
    if (statics.parts.length) {
      const m = statics.mesh(true, true);
      this.group.add(m);
    }
    this.group.add(this.inst);
    this.group.visible = false;
    this.writeAll();
  }

  activate(instant: boolean) {
    this.active = true;
    this.group.visible = true;
    if (!instant) for (const p of this.plots) p.g = 0.4 + Math.random() * 0.3;
    this.writeAll();
  }

  private writeAll() {
    for (let i = 0; i < this.plots.length; i++) this.write(i);
    this.inst.instanceMatrix.needsUpdate = true;
  }

  private write(i: number) {
    const p = this.plots[i];
    let s = p.g >= 1 ? 1 : 0.12 + p.g * 0.6;
    if (p.pop > 0) s *= 1 + Math.sin((1 - p.pop / 0.3) * Math.PI) * 0.25;
    if (this.def.kind === 'tree') s = p.g >= 1 ? 1 : 0.001;
    _q.setFromAxisAngle(UP, p.rot);
    _p.set(p.x, 0, p.z);
    _s.set(s, s, s);
    _m.compose(_p, _q, _s);
    this.inst.setMatrixAt(i, _m);
  }

  update(dt: number, mult: number) {
    if (!this.active) return;
    let dirty = false;
    for (let i = 0; i < this.plots.length; i++) {
      const p = this.plots[i];
      if (p.g < 1) {
        p.g += (dt * mult) / this.def.regrow;
        if (p.g >= 1) {
          p.g = 1;
          p.pop = 0.3;
        }
        dirty = true;
        this.write(i);
      } else if (p.pop > 0) {
        p.pop -= dt;
        this.write(i);
        dirty = true;
      }
    }
    if (dirty) this.inst.instanceMatrix.needsUpdate = true;
  }

  /** Index of a ripe plot within radius r, or -1. */
  ripeNear(x: number, z: number, r: number): number {
    let best = -1;
    let bd = r * r;
    for (let i = 0; i < this.plots.length; i++) {
      const p = this.plots[i];
      if (p.g < 1) continue;
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  nearestRipe(x: number, z: number, skipReserved = true): number {
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < this.plots.length; i++) {
      const p = this.plots[i];
      if (p.g < 1 || (skipReserved && p.reserved)) continue;
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  ripeCount() {
    let n = 0;
    for (const p of this.plots) if (p.g >= 1) n++;
    return n;
  }

  harvest(i: number): THREE.Vector3 {
    const p = this.plots[i];
    p.g = 0;
    p.reserved = false;
    this.write(i);
    this.inst.instanceMatrix.needsUpdate = true;
    return new THREE.Vector3(p.x, this.def.kind === 'tree' ? 1.9 : 0.4, p.z);
  }

  contains(x: number, z: number, m = 0.8) {
    const hw = ((this.def.cols - 1) * this.def.spacing) / 2 + m;
    const hd = ((this.def.rows - 1) * this.def.spacing) / 2 + m;
    return Math.abs(x - this.def.x) < hw && Math.abs(z - this.def.z) < hd;
  }
}
