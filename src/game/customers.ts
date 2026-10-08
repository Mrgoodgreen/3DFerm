import * as THREE from 'three';
import { ITEMS, CONFIG, SHELF_Z, type ItemId } from '../data';
import { buildHuman, animateHuman, itemGeo, type Human } from '../render/models';
import { MAT } from '../render/mb';
import type { Shelf } from './shelf';
import type { Effects } from './effects';
import type { Labels, Label } from './labels';

type CState = 'in' | 'wait' | 'out';

const SHIRTS = [0xe76f51, 0x2a9d8f, 0xe9c46a, 0x8ab17d, 0x6d6875, 0xb5838d, 0x457b9d, 0xf4a261, 0x9b5de5, 0xf15bb5];
const PANTS = [0x3d405b, 0x6b705c, 0x264653, 0x5e548e, 0x7f5539];
const HAIR = [0x2b1d14, 0x5a3a22, 0xd9a05b, 0x8b4513, 0xc0c0c0, 0xe0712c, 0x1c1c1c];

class Customer {
  h: Human;
  pos: THREE.Vector3;
  rot = 0;
  state: CState = 'in';
  route: THREE.Vector3[] = [];
  want: number;
  got = 0;
  patience = 40;
  t = 0;
  bubble: Label;
  carry: THREE.Mesh[] = [];
  stackRoot = new THREE.Group();
  dead = false;
  speed = 2.4 + Math.random() * 0.6;

  constructor(
    scene: THREE.Scene,
    labels: Labels,
    public shelf: Shelf,
    public spot: number,
  ) {
    const r = Math.random;
    const old = r() < 0.2;
    const female = r() < 0.55;
    this.h = buildHuman({
      shirt: SHIRTS[Math.floor(r() * SHIRTS.length)],
      pants: PANTS[Math.floor(r() * PANTS.length)],
      hair: old ? 0xd8d8d8 : HAIR[Math.floor(r() * HAIR.length)],
      hairStyle: female ? (r() < 0.5 ? 'bun' : 'braids') : r() < 0.15 ? 'bald' : 'short',
      hat: r() < 0.3 ? (r() < 0.5 ? 'straw' : 'cap') : 'none',
      hatColor: [0xf3d27a, 0x4f86c6, 0xd9534f, 0x6ab04c][Math.floor(r() * 4)],
      ribbon: SHIRTS[Math.floor(r() * SHIRTS.length)],
      dress: female && r() < 0.5,
      beard: !female && old ? 0xe0e0e0 : undefined,
      glasses: old && r() < 0.6,
      scale: 0.88 + r() * 0.14,
    });
    this.h.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    this.h.stackAnchor.add(this.stackRoot);
    this.h.stackAnchor.position.set(0, 0.85, 0.35);
    const side = r() < 0.5 ? -1 : 1;
    const roadZ = CONFIG.road.z + (r() - 0.5) * 1.2;
    this.pos = new THREE.Vector3(side * 44, 0, roadZ);
    const sp = shelf.spotPos(spot);
    this.route = [new THREE.Vector3(sp.x, 0, roadZ), sp];
    const price = ITEMS[shelf.def.item].price;
    this.want = price <= 8 ? 2 + Math.floor(r() * 3) : price <= 25 ? 1 + Math.floor(r() * 3) : 1 + Math.floor(r() * 2);
    scene.add(this.h.root);
    this.bubble = labels.add('', new THREE.Vector3(), 'bubble');
    this.bubble.visible = false;
  }

  leave(happy: boolean) {
    this.state = 'out';
    this.shelf.spots[this.spot] = null;
    const roadZ = CONFIG.road.z + (Math.random() - 0.5) * 1.2;
    const exitX = Math.random() < 0.5 ? -46 : 46;
    this.route = [new THREE.Vector3(this.pos.x, 0, roadZ), new THREE.Vector3(exitX, 0, roadZ)];
    this.bubble.setClass('bubble ' + (happy ? 'happy' : 'sad'));
    this.bubble.setHTML(happy ? '😊' : '😞');
    this.bubble.visible = true;
    this.t = 2.0;
  }

  walk(dt: number) {
    if (this.route.length === 0) return true;
    const p = this.route[0];
    const dx = p.x - this.pos.x;
    const dz = p.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.1) {
      this.route.shift();
      return this.route.length === 0;
    }
    const step = Math.min(d, this.speed * dt);
    this.pos.x += (dx / d) * step;
    this.pos.z += (dz / d) * step;
    let diff = Math.atan2(dx, dz) - this.rot;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.rot += diff * Math.min(1, dt * 10);
    return false;
  }

  addCarry(item: ItemId) {
    const m = new THREE.Mesh(itemGeo(item), MAT);
    m.scale.setScalar(0.75);
    let y = 0;
    for (let i = 0; i < this.carry.length; i++) y += ITEMS[item].h * 0.75;
    m.position.y = y;
    this.stackRoot.add(m);
    this.carry.push(m);
  }

  topWorld() {
    const v = new THREE.Vector3(0, this.carry.length * 0.2, 0);
    this.h.root.updateMatrixWorld(true);
    return this.stackRoot.localToWorld(v);
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.h.root);
    this.bubble.remove();
    this.dead = true;
  }
}

export interface CustomerEnv {
  shelves: Shelf[];
  interval: number;
  maxCustomers: number;
  priceFor(item: ItemId): number;
  onSale(shelf: Shelf, item: ItemId, coins: number): void;
}

export class CustomerManager {
  list: Customer[] = [];
  private spawnT = 1;

  constructor(
    private scene: THREE.Scene,
    private labels: Labels,
    private fx: Effects,
  ) {}

  update(dt: number, env: CustomerEnv) {
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = env.interval * (0.7 + Math.random() * 0.6);
      this.trySpawn(env);
    }
    for (const c of this.list) this.updateOne(c, dt, env);
    if (this.list.some((c) => c.dead)) this.list = this.list.filter((c) => !c.dead);
  }

  private trySpawn(env: CustomerEnv) {
    const active = env.shelves.filter((s) => s.active);
    if (!active.length || this.list.filter((c) => c.state !== 'out').length >= env.maxCustomers) return;
    const free = active.filter((s) => s.freeSpot() >= 0);
    if (!free.length) return;
    const stocked = free.filter((s) => s.count > 0);
    const pool = stocked.length && Math.random() < 0.75 ? stocked : free;
    const shelf = pool[Math.floor(Math.random() * pool.length)];
    const spot = shelf.freeSpot();
    const c = new Customer(this.scene, this.labels, shelf, spot);
    shelf.spots[spot] = c;
    this.list.push(c);
  }

  private updateOne(c: Customer, dt: number, env: CustomerEnv) {
    let moving = 0;
    const item = c.shelf.def.item;
    if (c.state === 'in') {
      moving = 1;
      if (c.walk(dt)) {
        c.state = 'wait';
        c.bubble.visible = true;
      }
    } else if (c.state === 'wait') {
      let diff = Math.PI - c.rot;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.rot += diff * Math.min(1, dt * 8);
      c.patience -= dt;
      c.t -= dt;
      if (c.t <= 0 && c.got < c.want && c.shelf.count > 0) {
        c.t = 0.35;
        const from = new THREE.Vector3();
        c.shelf.topWorld(from);
        if (c.shelf.take()) {
          c.got++;
          const shelf = c.shelf;
          const price = env.priceFor(item);
          this.fx.fly(item, from, () => c.topWorld(), 0.3, () => {
            if (!c.dead) c.addCarry(item);
            env.onSale(shelf, item, price);
          });
        }
      }
      if (c.got >= c.want) c.leave(true);
      else if (c.patience <= 0) c.leave(c.got > 0);
      else c.bubble.setHTML(`${ITEMS[item].icon}×${c.want - c.got}`);
    } else {
      moving = 1;
      c.t -= dt;
      if (c.t <= 0) c.bubble.visible = false;
      if (c.walk(dt)) c.dispose(this.scene);
    }
    animateHuman(c.h, dt, moving, c.carry.length > 0);
    c.h.root.position.copy(c.pos);
    c.h.root.rotation.y = c.rot;
    c.bubble.pos.set(c.pos.x, 2.15, c.pos.z);
  }

  waitingAt(shelf: Shelf) {
    return this.list.filter((c) => c.shelf === shelf && c.state === 'wait').reduce((a, c) => a + (c.want - c.got), 0);
  }
}

export { SHELF_Z };
