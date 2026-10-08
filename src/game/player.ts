import * as THREE from 'three';
import { ITEMS, CONFIG, type ItemId, type SkinDef } from '../data';
import { buildHuman, animateHuman, skinHumanOpts, itemGeo, buildCat, animateAnimal, type Human, type Animal } from '../render/models';
import { MAT } from '../render/mb';
import type { Collider } from '../render/world';

interface StackItem {
  item: ItemId;
  mesh: THREE.Mesh;
  show: number;
}

const STACK_SCALE = 0.9;

export function collide(pos: THREE.Vector3, r: number, colliders: Collider[]) {
  for (const c of colliders) {
    const cx = Math.max(c.x1, Math.min(pos.x, c.x2));
    const cz = Math.max(c.z1, Math.min(pos.z, c.z2));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * r;
        pos.z = cz + (dz / d) * r;
      } else {
        // Inside the box: push out along the shortest axis
        const l = pos.x - c.x1;
        const rr = c.x2 - pos.x;
        const tp = pos.z - c.z1;
        const b = c.z2 - pos.z;
        const m = Math.min(l, rr, tp, b);
        if (m === l) pos.x = c.x1 - r;
        else if (m === rr) pos.x = c.x2 + r;
        else if (m === tp) pos.z = c.z1 - r;
        else pos.z = c.z2 + r;
      }
    }
  }
}

export class Player {
  h: Human;
  pos = new THREE.Vector3();
  rot = 0;
  moving = 0;
  stack: StackItem[] = [];
  private stackRoot = new THREE.Group();
  private lean = 0;
  private bounce = 0;

  constructor(
    private scene: THREE.Scene,
    skin: SkinDef,
  ) {
    this.h = buildHuman(skinHumanOpts(skin));
    this.attach();
    this.pos.set(CONFIG.playerStart.x, 0, CONFIG.playerStart.z);
  }

  private attach() {
    this.h.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    this.h.stackAnchor.add(this.stackRoot);
    this.scene.add(this.h.root);
  }

  setSkin(skin: SkinDef) {
    this.scene.remove(this.h.root);
    this.h.stackAnchor.remove(this.stackRoot);
    this.h = buildHuman(skinHumanOpts(skin));
    this.attach();
    this.h.root.position.copy(this.pos);
    this.h.root.rotation.y = this.rot;
  }

  update(dt: number, ix: number, iz: number, speed: number, colliders: Collider[]) {
    const mag = Math.min(1, Math.hypot(ix, iz));
    this.moving += (mag - this.moving) * Math.min(1, dt * 12);
    if (mag > 0.01) {
      this.pos.x += ix * speed * dt;
      this.pos.z += iz * speed * dt;
      const target = Math.atan2(ix, iz);
      let diff = target - this.rot;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.rot += diff * Math.min(1, dt * 14);
    }
    const b = CONFIG.bounds;
    this.pos.x = Math.max(b.minX, Math.min(b.maxX, this.pos.x));
    this.pos.z = Math.max(b.minZ, Math.min(b.maxZ, this.pos.z));
    collide(this.pos, 0.38, colliders);
    this.h.root.position.copy(this.pos);
    this.h.root.rotation.y = this.rot;
    animateHuman(this.h, dt, this.moving, false);

    this.lean += (this.moving * 0.14 - this.lean) * Math.min(1, dt * 6);
    this.stackRoot.rotation.x = -this.lean;
    if (this.bounce > 0) this.bounce -= dt;
    const n = this.stack.length;
    for (let i = 0; i < n; i++) {
      const it = this.stack[i];
      const sway = Math.sin(this.h.phase * 0.5 + i * 0.25) * this.moving * 0.012 * i;
      it.mesh.position.x = sway;
      if (it.show > 0) {
        it.show -= dt;
        if (it.show <= 0) it.mesh.visible = true;
      }
    }
  }

  get count() {
    return this.stack.length;
  }

  countOf(item: ItemId) {
    let n = 0;
    for (const s of this.stack) if (s.item === item) n++;
    return n;
  }

  has(item: ItemId) {
    return this.stack.some((s) => s.item === item);
  }

  topWorld(out: THREE.Vector3) {
    this.h.root.updateMatrixWorld(true);
    let y = 0;
    for (const s of this.stack) y += ITEMS[s.item].h * STACK_SCALE;
    out.set(0, y, 0);
    return this.stackRoot.localToWorld(out);
  }

  push(item: ItemId, hideFor = 0) {
    const mesh = new THREE.Mesh(itemGeo(item), MAT);
    mesh.castShadow = true;
    mesh.scale.setScalar(STACK_SCALE);
    mesh.visible = hideFor <= 0;
    this.stackRoot.add(mesh);
    this.stack.push({ item, mesh, show: hideFor });
    this.layout();
  }

  /** Remove the top-most item of the given type; returns its world position. */
  remove(item?: ItemId): { item: ItemId; pos: THREE.Vector3 } | null {
    let idx = -1;
    for (let i = this.stack.length - 1; i >= 0; i--) {
      if (!item || this.stack[i].item === item) {
        idx = i;
        break;
      }
    }
    if (idx < 0) return null;
    const s = this.stack[idx];
    this.h.root.updateMatrixWorld(true);
    const pos = new THREE.Vector3();
    s.mesh.getWorldPosition(pos);
    this.stackRoot.remove(s.mesh);
    this.stack.splice(idx, 1);
    this.layout();
    return { item: s.item, pos };
  }

  restore(items: ItemId[]) {
    for (const it of items) if (ITEMS[it]) this.push(it);
  }

  private layout() {
    let y = 0;
    for (const s of this.stack) {
      s.mesh.position.set(0, y, 0);
      y += ITEMS[s.item].h * STACK_SCALE;
    }
  }
}

export class Pet {
  a: Animal;
  pos = new THREE.Vector3();
  private rot = 0;
  private sitT = 0;

  constructor(scene: THREE.Scene, start: THREE.Vector3) {
    this.a = buildCat();
    this.a.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    scene.add(this.a.root);
    this.pos.copy(start).add(new THREE.Vector3(1, 0, 1));
  }

  update(dt: number, target: THREE.Vector3, targetRot: number, colliders: Collider[]) {
    const back = new THREE.Vector3(Math.sin(targetRot + 2.4) * 1.3, 0, Math.cos(targetRot + 2.4) * 1.3);
    const goal = target.clone().add(back);
    const dx = goal.x - this.pos.x;
    const dz = goal.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    let moving = 0;
    if (d > 0.5) {
      const sp = Math.min(d * 3.2, 9);
      this.pos.x += (dx / d) * sp * dt;
      this.pos.z += (dz / d) * sp * dt;
      const tr = Math.atan2(dx, dz);
      let diff = tr - this.rot;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.rot += diff * Math.min(1, dt * 10);
      moving = Math.min(1, sp / 4);
      this.sitT = 0;
    } else {
      this.sitT += dt;
      const toP = Math.atan2(target.x - this.pos.x, target.z - this.pos.z);
      let diff = toP - this.rot;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.rot += diff * Math.min(1, dt * 3);
    }
    collide(this.pos, 0.25, colliders);
    animateAnimal(this.a, dt, moving);
    this.a.root.position.copy(this.pos);
    this.a.root.rotation.y = this.rot;
    if (this.sitT > 2 && this.a.head) this.a.head.rotation.z = Math.sin(this.sitT * 1.5) * 0.15;
  }
}
