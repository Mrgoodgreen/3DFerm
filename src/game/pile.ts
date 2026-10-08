import * as THREE from 'three';
import type { ItemId } from '../data';
import { itemGeo } from '../render/models';
import { MAT } from '../render/mb';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Grid pile of identical items rendered with one instanced draw call. */
export class ItemPile {
  mesh: THREE.InstancedMesh;
  count = 0;
  private pop: number[] = [];

  constructor(
    item: ItemId | 'coin',
    public cap: number,
    public cols: number,
    public rows: number,
    public sx: number,
    public sz: number,
    public layerH: number,
  ) {
    this.mesh = new THREE.InstancedMesh(itemGeo(item), MAT, cap);
    this.mesh.count = 0;
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
  }

  slotLocal(i: number, out: THREE.Vector3) {
    const per = this.cols * this.rows;
    const layer = Math.floor(i / per);
    const k = i % per;
    const c = k % this.cols;
    const r = Math.floor(k / this.cols);
    out.set((c - (this.cols - 1) / 2) * this.sx, layer * this.layerH, (r - (this.rows - 1) / 2) * this.sz);
    return out;
  }

  slotWorld(i: number, out: THREE.Vector3) {
    this.slotLocal(Math.max(0, Math.min(i, this.cap - 1)), out);
    this.mesh.updateWorldMatrix(true, false);
    return out.applyMatrix4(this.mesh.matrixWorld);
  }

  set(n: number, animateNew = true) {
    n = Math.max(0, Math.min(this.cap, Math.floor(n)));
    if (animateNew && n > this.count) for (let i = this.count; i < n; i++) this.pop[i] = 0.25;
    this.count = n;
    this.mesh.count = n;
    for (let i = 0; i < n; i++) this.writeSlot(i, 1);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private writeSlot(i: number, s: number) {
    this.slotLocal(i, _p);
    _q.identity();
    _s.set(s, s, s);
    _m.compose(_p, _q, _s);
    this.mesh.setMatrixAt(i, _m);
  }

  update(dt: number) {
    let dirty = false;
    for (let i = 0; i < this.count; i++) {
      const t = this.pop[i];
      if (t && t > 0) {
        this.pop[i] = t - dt;
        const k = 1 - Math.max(0, this.pop[i]) / 0.25;
        const s = k < 0.6 ? (k / 0.6) * 1.25 : 1.25 - ((k - 0.6) / 0.4) * 0.25;
        this.writeSlot(i, Math.max(0.01, s));
        dirty = true;
      }
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }
}
