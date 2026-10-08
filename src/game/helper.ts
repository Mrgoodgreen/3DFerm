import * as THREE from 'three';
import { ITEMS, type HelperDef, type ItemId } from '../data';
import { buildHuman, animateHuman, itemGeo, type Human } from '../render/models';
import { MAT } from '../render/mb';
import type { Field } from './field';
import type { Station } from './station';
import type { Shelf } from './shelf';
import type { Effects } from './effects';

const CORRIDORS = [-20.4, -9.4, 2.6];
const VERTICALS = [-13.5, 8, 19.2];

function corridorFor(z: number) {
  for (const c of CORRIDORS) if (c > z - 0.3) return c;
  return CORRIDORS[CORRIDORS.length - 1];
}

export function routeBetween(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3[] {
  const ca = corridorFor(a.z);
  const cb = corridorFor(b.z);
  const pts: THREE.Vector3[] = [new THREE.Vector3(a.x, 0, ca)];
  if (ca !== cb) {
    let vx = VERTICALS[0];
    let best = Infinity;
    for (const v of VERTICALS) {
      const cost = Math.abs(a.x - v) + Math.abs(b.x - v);
      if (cost < best) {
        best = cost;
        vx = v;
      }
    }
    pts.push(new THREE.Vector3(vx, 0, ca), new THREE.Vector3(vx, 0, cb));
  }
  pts.push(new THREE.Vector3(b.x, 0, cb), b.clone());
  return pts;
}

export interface HelperEnv {
  fields: Map<string, Field>;
  stations: Map<string, Station>;
  shelves: Map<ItemId, Shelf>;
  fx: Effects;
  cap: number;
  speed: number;
  onDeliver(target: { station: string } | { shelf: ItemId }, item: ItemId): void;
}

type State = 'toSource' | 'gather' | 'toTarget' | 'deliver';

export class Helper {
  h: Human;
  pos: THREE.Vector3;
  rot = 0;
  carry: { item: ItemId; mesh: THREE.Mesh }[] = [];
  private route: THREE.Vector3[] = [];
  private state: State = 'toSource';
  private t = 0;
  private wait = 0;
  private plot = -1;
  private stackRoot = new THREE.Group();

  constructor(
    public def: HelperDef,
    scene: THREE.Scene,
    start: THREE.Vector3,
  ) {
    const hairs = [0x5a3a22, 0x2b1d14, 0xd9a05b, 0x8b4513];
    this.h = buildHuman({
      shirt: def.shirt,
      pants: 0x5b7fa8,
      hair: hairs[Math.floor(Math.random() * hairs.length)],
      hairStyle: Math.random() < 0.5 ? 'short' : 'bun',
      hat: 'cap',
      hatColor: 0x58b947,
      basket: true,
      scale: 0.92,
    });
    this.h.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    this.h.stackAnchor.add(this.stackRoot);
    this.pos = start.clone();
    scene.add(this.h.root);
  }

  private sourcePoint(env: HelperEnv): THREE.Vector3 {
    const f = this.def.from;
    if ('field' in f) {
      const fd = env.fields.get(f.field)!.def;
      return new THREE.Vector3(fd.x, 0, fd.z);
    }
    return env.stations.get(f.station)!.outZone.clone();
  }

  private targetPoint(env: HelperEnv): THREE.Vector3 {
    const to = this.def.to;
    if ('station' in to) return env.stations.get(to.station)!.inZone.clone();
    return env.shelves.get(to.shelf)!.zone.clone();
  }

  private go(dest: THREE.Vector3) {
    this.route = routeBetween(this.pos, dest);
  }

  private walk(dt: number, speed: number): boolean {
    if (this.route.length === 0) return true;
    const p = this.route[0];
    const dx = p.x - this.pos.x;
    const dz = p.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.12) {
      this.route.shift();
      return this.route.length === 0;
    }
    const step = Math.min(d, speed * dt);
    this.pos.x += (dx / d) * step;
    this.pos.z += (dz / d) * step;
    this.face(Math.atan2(dx, dz), dt);
    return false;
  }

  private walkDirect(dt: number, speed: number, p: THREE.Vector3, stop = 0.45): boolean {
    const dx = p.x - this.pos.x;
    const dz = p.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < stop) return true;
    const step = Math.min(d, speed * dt);
    this.pos.x += (dx / d) * step;
    this.pos.z += (dz / d) * step;
    this.face(Math.atan2(dx, dz), dt);
    return false;
  }

  private face(target: number, dt: number) {
    let diff = target - this.rot;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.rot += diff * Math.min(1, dt * 10);
  }

  private pushItem(item: ItemId) {
    const mesh = new THREE.Mesh(itemGeo(item), MAT);
    mesh.scale.setScalar(0.85);
    mesh.castShadow = true;
    let y = 0;
    for (const c of this.carry) y += ITEMS[c.item].h * 0.85;
    mesh.position.y = y;
    this.stackRoot.add(mesh);
    this.carry.push({ item, mesh });
  }

  private popItem(): THREE.Vector3 | null {
    const c = this.carry.pop();
    if (!c) return null;
    const p = new THREE.Vector3();
    c.mesh.getWorldPosition(p);
    this.stackRoot.remove(c.mesh);
    return p;
  }

  private topWorld() {
    let y = 0;
    for (const c of this.carry) y += ITEMS[c.item].h * 0.85;
    const v = new THREE.Vector3(0, y, 0);
    this.h.root.updateMatrixWorld(true);
    return this.stackRoot.localToWorld(v);
  }

  update(dt: number, env: HelperEnv) {
    let moving = 0;
    const speed = env.speed;
    this.t -= dt;
    switch (this.state) {
      case 'toSource': {
        if (this.route.length === 0) this.go(this.sourcePoint(env));
        moving = 1;
        if (this.walk(dt, speed)) {
          this.state = 'gather';
          this.wait = 0;
        }
        break;
      }
      case 'gather': {
        const f = this.def.from;
        if (this.carry.length >= env.cap) {
          this.releasePlot(env);
          this.state = 'toTarget';
          this.go(this.targetPoint(env));
          break;
        }
        if ('field' in f) {
          const field = env.fields.get(f.field)!;
          if (this.plot < 0 || field.plots[this.plot].g < 1) {
            this.plot = field.nearestRipe(this.pos.x, this.pos.z);
            if (this.plot >= 0) field.plots[this.plot].reserved = true;
          }
          if (this.plot < 0) {
            this.wait += dt;
            if (this.carry.length > 0 && this.wait > 1.2) {
              this.state = 'toTarget';
              this.go(this.targetPoint(env));
            }
            break;
          }
          const p = field.plots[this.plot];
          const target = new THREE.Vector3(p.x, 0, p.z);
          moving = 1;
          if (this.walkDirect(dt, speed, target, 0.5)) {
            const from = field.harvest(this.plot);
            this.plot = -1;
            const item = this.def.item;
            env.fx.fly(item, from, () => this.topWorld(), 0.3, undefined, 0.8);
            this.pushItem(item);
            env.fx.burst(from, 0x7fd35b, 4, 1.6, 0.6);
            this.wait = 0;
          }
        } else {
          const st = env.stations.get(f.station)!;
          if (this.t <= 0 && st.outCount > 0) {
            this.t = 0.16;
            const from = new THREE.Vector3();
            st.outSlotWorld(from);
            if (st.take()) {
              env.fx.fly(this.def.item, from, () => this.topWorld(), 0.25, undefined, 0.8);
              this.pushItem(this.def.item);
              this.wait = 0;
            }
          } else if (st.outCount === 0) {
            this.wait += dt;
            if (this.carry.length > 0 && this.wait > 1.5) {
              this.state = 'toTarget';
              this.go(this.targetPoint(env));
            }
          }
          this.face(0, dt);
        }
        break;
      }
      case 'toTarget': {
        moving = 1;
        if (this.walk(dt, speed)) {
          this.state = 'deliver';
          this.t = 0;
        }
        break;
      }
      case 'deliver': {
        const to = this.def.to;
        if (this.carry.length === 0) {
          this.state = 'toSource';
          this.go(this.sourcePoint(env));
          break;
        }
        if (this.t > 0) break;
        this.t = 0.12;
        if ('station' in to) {
          const st = env.stations.get(to.station)!;
          if (st.canAccept()) {
            const from = this.popItem()!;
            const dest = new THREE.Vector3();
            st.inSlotWorld(dest);
            st.accept();
            env.fx.fly(this.def.item, from, dest, 0.28, undefined, 0.8);
            env.onDeliver(to, this.def.item);
          }
        } else {
          const sh = env.shelves.get(to.shelf)!;
          if (sh.canAccept()) {
            const from = this.popItem()!;
            const dest = new THREE.Vector3();
            sh.slotWorld(dest);
            sh.add();
            env.fx.fly(this.def.item, from, dest, 0.28, undefined, 0.8);
            env.onDeliver(to, this.def.item);
          }
        }
        this.face(Math.PI, dt);
        break;
      }
    }
    animateHuman(this.h, dt, moving, false);
    this.h.root.position.copy(this.pos);
    this.h.root.rotation.y = this.rot;
  }

  private releasePlot(env: HelperEnv) {
    const f = this.def.from;
    if ('field' in f && this.plot >= 0) {
      env.fields.get(f.field)!.plots[this.plot].reserved = false;
      this.plot = -1;
    }
  }
}
