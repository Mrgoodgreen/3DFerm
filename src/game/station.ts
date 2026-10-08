import * as THREE from 'three';
import { ITEMS, type StationDef } from '../data';
import {
  buildBuilding,
  buildCow,
  buildChicken,
  buildSheep,
  buildHive,
  buildBee,
  buildTrough,
  buildPallet,
  fenceLine,
  animateAnimal,
  addFlower,
  type Animal,
  type BuildingModel,
} from '../render/models';
import { MB, box } from '../render/mb';
import { ItemPile } from './pile';
import type { Label } from './labels';
import type { GameCtx } from './ctx';
import type { Collider } from '../render/world';
import { t } from '../i18n';

interface Walker {
  a: Animal;
  x: number;
  z: number;
  tx: number;
  tz: number;
  wait: number;
  rot: number;
  jump: number;
}

export class Station {
  group = new THREE.Group();
  active = false;
  inCount = 0;
  outCount = 0;
  progress = 0;
  workers = 0;
  inZone: THREE.Vector3;
  outZone: THREE.Vector3;
  inPile: ItemPile | null = null;
  outPile: ItemPile;
  collider: Collider;
  private walkers: Walker[] = [];
  private hives: THREE.Object3D[] = [];
  private bees: { m: THREE.Mesh; hive: number; p: number; r: number }[] = [];
  private building: BuildingModel;
  private buildingRoot = new THREE.Group();
  private squash = 0;
  private smokeT = 0;
  private soundT = 5 + Math.random() * 8;
  private inLabel: Label | null = null;
  private outLabel: Label;
  private nameLabel: Label;
  producing = false;

  constructor(
    public def: StationDef,
    private ctx: GameCtx,
  ) {
    const { x, z, w, d } = def;
    this.inZone = new THREE.Vector3(x - w / 2 + 1.2, 0, z + d / 2 + 1.0);
    this.outZone = new THREE.Vector3(x + w / 2 - 1.2, 0, z + d / 2 + 1.0);
    if (def.kind === 'building' && !def.input) this.outZone.set(x, 0, z + d / 2 + 1.0);

    this.building = buildBuilding(def.building, w, d);
    this.buildingRoot.add(this.building.mesh);
    this.group.add(this.buildingRoot);

    const statics = new MB();
    if (def.kind === 'pen') {
      const bd = def.building === 'barn' ? 2.2 : def.building === 'coop' ? 1.5 : 1.6;
      this.buildingRoot.position.set(x, 0, z - d / 2 - bd / 2 - 0.1);
      const x1 = x - w / 2;
      const x2 = x + w / 2;
      const z1 = z - d / 2;
      const z2 = z + d / 2;
      fenceLine(statics, x1, z1, x1, z2);
      fenceLine(statics, x2, z1, x2, z2);
      fenceLine(statics, x1, z2, x2, z2);
      fenceLine(statics, x1, z1, x - 2.0, z1);
      fenceLine(statics, x + 2.0, z1, x2, z1);
      const trough = buildTrough(1.8);
      trough.position.set(this.inZone.x, 0, z2 - 0.55);
      this.group.add(trough);
      this.inPile = new ItemPile(def.input!, def.inCap, 4, 2, 0.38, 0.24, ITEMS[def.input!].h * 0.75);
      this.inPile.mesh.position.set(this.inZone.x, 0.42, z2 - 0.55);
      this.inPile.mesh.scale.setScalar(0.8);
      this.collider = { x1: x1 - 0.15, z1: z1 - bd - 0.3, x2: x2 + 0.15, z2: z2 + 0.15 };
    } else {
      this.buildingRoot.position.set(x, 0, z);
      if (def.input) {
        const crate = buildPallet(1.5, 1.2);
        crate.position.copy(this.inZone);
        this.group.add(crate);
        this.inPile = new ItemPile(def.input, def.inCap, 3, 3, 0.45, 0.38, ITEMS[def.input].h);
        this.inPile.mesh.position.set(this.inZone.x, 0.18, this.inZone.z);
      }
      this.collider = { x1: x - w / 2 + 0.2, z1: z - d / 2, x2: x + w / 2 - 0.2, z2: z + d / 2 - 0.6 };
      if (def.building === 'hives') {
        for (let i = 0; i < 10; i++) addFlower(statics, x - w / 2 + 0.3 + (i % 5) * 0.3, z + d / 2 - 0.2 + Math.floor(i / 5) * 0.3, [0xff6b9a, 0xffd166, 0x9b5de5][i % 3]);
        for (let i = 0; i < 10; i++) addFlower(statics, x + w / 2 - 1.5 + (i % 5) * 0.3, z - d / 2 + 0.2 + Math.floor(i / 5) * 0.3, [0xffffff, 0xff8c42, 0xff6b9a][i % 3]);
      }
    }
    const pallet = buildPallet(1.5, 1.2);
    pallet.position.copy(this.outZone);
    this.group.add(pallet);
    this.outPile = new ItemPile(def.output, def.outCap, 3, 3, 0.45, 0.4, ITEMS[def.output].h);
    this.outPile.mesh.position.set(this.outZone.x, 0.18, this.outZone.z);
    this.group.add(this.outPile.mesh);
    if (this.inPile) this.group.add(this.inPile.mesh);

    // Zone markers
    const zoneMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });
    for (const zp of def.input ? [this.inZone, this.outZone] : [this.outZone]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.2, 28), zoneMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(zp.x, 0.03, zp.z);
      this.group.add(ring);
    }
    statics.add(box(0.01, 0.01, 0.01), 0xffffff);
    this.group.add(statics.mesh(true, true));

    const lblY = def.kind === 'pen' ? 1.5 : 1.7;
    if (def.input) {
      this.inLabel = ctx.labels.add('', new THREE.Vector3(this.inZone.x, lblY, this.inZone.z - 0.6), 'st-label');
    }
    this.outLabel = ctx.labels.add('', new THREE.Vector3(this.outZone.x, 2.3, this.outZone.z), 'max-label');
    const nameY = def.kind === 'pen' ? 3.6 : 4.2;
    this.nameLabel = ctx.labels.add(`${ITEMS[def.output].icon}`, new THREE.Vector3(x, nameY, def.kind === 'pen' ? z - d / 2 - 1 : z), 'icon-label');
    this.group.visible = false;
    this.setLabelsVisible(false);
    ctx.scene.add(this.group);
  }

  private setLabelsVisible(v: boolean) {
    if (this.inLabel) this.inLabel.visible = v;
    this.outLabel.visible = false;
    this.nameLabel.visible = v;
  }

  activate() {
    this.active = true;
    if (!this.def.animal) this.workers = Math.max(this.workers, 1);
    this.group.visible = true;
    this.setLabelsVisible(true);
    this.refreshLabels();
  }

  addAnimal() {
    this.workers++;
    const d = this.def;
    if (d.animal === 'bee') {
      const i = this.hives.length;
      const hive = buildHive();
      hive.position.set(d.x - 1.8 + i * 1.8, 0.15, d.z - 0.8);
      this.group.add(hive);
      this.hives.push(hive);
      for (let k = 0; k < 4; k++) {
        const b = buildBee();
        this.group.add(b);
        this.bees.push({ m: b, hive: i, p: Math.random() * 10, r: 0.6 + Math.random() * 0.7 });
      }
      return;
    }
    if (d.kind !== 'pen') return;
    const a = d.animal === 'cow' ? buildCow() : d.animal === 'chicken' ? buildChicken() : buildSheep();
    const x = d.x + (Math.random() - 0.5) * (d.w - 2);
    const z = d.z + (Math.random() - 0.5) * (d.d - 1.6);
    a.root.position.set(x, 0, z);
    this.group.add(a.root);
    this.walkers.push({ a, x, z, tx: x, tz: z, wait: Math.random() * 2, rot: Math.random() * 6, jump: 0.5 });
  }

  canAccept() {
    return this.active && !!this.def.input && this.inCount < this.def.inCap;
  }

  accept() {
    this.inCount++;
    this.inPile?.set(this.inCount);
    this.refreshLabels();
  }

  inSlotWorld(out: THREE.Vector3) {
    if (!this.inPile) return out.copy(this.inZone);
    return this.inPile.slotWorld(this.inCount, out);
  }

  outSlotWorld(out: THREE.Vector3) {
    return this.outPile.slotWorld(Math.max(0, this.outCount - 1), out);
  }

  take(): boolean {
    if (this.outCount <= 0) return false;
    this.outCount--;
    this.outPile.set(this.outCount, false);
    this.refreshLabels();
    return true;
  }

  refreshLabels() {
    if (this.inLabel && this.def.input) {
      const icon = ITEMS[this.def.input].icon;
      this.inLabel.setHTML(`${icon} ${this.inCount}/${this.def.inCap}`);
      const empty = this.inCount === 0;
      this.inLabel.setClass('st-label' + (empty ? ' empty' : this.inCount >= this.def.inCap ? ' full' : ''));
    }
    const full = this.outCount >= this.def.outCap;
    this.outLabel.setHTML(t('max'));
    this.outLabel.visible = this.active && full;
  }

  update(dt: number, prodMult: number) {
    if (!this.active) return;
    const d = this.def;
    const hasInput = !d.input || this.inCount > 0;
    const hasSpace = this.outCount < d.outCap;
    this.producing = hasInput && hasSpace && this.workers > 0;
    if (this.producing) {
      this.progress += (dt * prodMult * Math.max(1, this.workers)) / d.time;
      while (this.progress >= 1 && (!d.input || this.inCount > 0) && this.outCount < d.outCap) {
        this.progress -= 1;
        if (d.input) {
          this.inCount--;
          this.inPile?.set(this.inCount, false);
        }
        this.outCount++;
        this.outPile.set(this.outCount);
        this.squash = 0.35;
        if (this.walkers.length) this.walkers[Math.floor(Math.random() * this.walkers.length)].jump = 0.4;
        this.refreshLabels();
        this.soundT -= 1;
      }
    } else {
      this.progress = Math.min(this.progress, 0.99);
    }

    // Building squash and effects
    if (this.squash > 0) {
      this.squash -= dt;
      const k = Math.max(0, this.squash) / 0.35;
      const s = Math.sin(k * Math.PI) * 0.06;
      this.buildingRoot.scale.set(1 + s, 1 - s, 1 + s);
    }
    if (this.building.spin) this.building.spin.rotation.z += dt * (this.producing ? 2.4 : 0.4);
    if (this.building.smoke && this.producing) {
      this.smokeT -= dt;
      if (this.smokeT <= 0) {
        this.smokeT = 0.5;
        const p = this.building.smoke.clone().add(this.buildingRoot.position);
        this.ctx.fx.puff(p, 1, 0xf2f2f2);
      }
    }
    this.soundT -= dt * 0.15;
    if (this.soundT <= 0) {
      this.soundT = 6 + Math.random() * 10;
      const near = this.ctx.playerPos.distanceTo(new THREE.Vector3(d.x, 0, d.z)) < 9;
      if (near && d.animal === 'cow') this.ctx.sound('moo');
      else if (near && d.animal === 'chicken') this.ctx.sound('cluck');
      else if (near && d.animal === 'sheep') this.ctx.sound('baa');
    }

    // Animals
    const minX = d.x - d.w / 2 + 0.8;
    const maxX = d.x + d.w / 2 - 0.8;
    const minZ = d.z - d.d / 2 + 0.7;
    const maxZ = d.z + d.d / 2 - 1.1;
    const spd = d.animal === 'chicken' ? 1.1 : 0.7;
    for (const wk of this.walkers) {
      let moving = 0;
      if (wk.wait > 0) {
        wk.wait -= dt;
      } else {
        const dx = wk.tx - wk.x;
        const dz = wk.tz - wk.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.1) {
          wk.wait = 1 + Math.random() * 3;
          const goTrough = this.inCount > 0 && Math.random() < 0.35;
          if (goTrough) {
            wk.tx = this.inZone.x + (Math.random() - 0.5) * 1.2;
            wk.tz = maxZ;
          } else {
            wk.tx = minX + Math.random() * (maxX - minX);
            wk.tz = minZ + Math.random() * (maxZ - minZ);
          }
        } else {
          const step = Math.min(dist, spd * dt);
          wk.x += (dx / dist) * step;
          wk.z += (dz / dist) * step;
          const target = Math.atan2(dx, dz);
          let diff = target - wk.rot;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          wk.rot += diff * Math.min(1, dt * 6);
          moving = 1;
        }
      }
      const eating = wk.wait > 0 && Math.abs(wk.tz - maxZ) < 0.05 && this.inCount > 0;
      animateAnimal(wk.a, dt, moving, eating);
      let y = 0;
      if (wk.jump > 0) {
        wk.jump -= dt;
        y = Math.sin((1 - Math.max(0, wk.jump) / 0.4) * Math.PI) * 0.25;
      }
      wk.a.root.position.set(wk.x, y, wk.z);
      wk.a.root.rotation.y = wk.rot;
    }
    const minD = d.animal === 'cow' ? 1.4 : d.animal === 'sheep' ? 0.95 : 0.5;
    for (let i = 0; i < this.walkers.length; i++) {
      for (let j = i + 1; j < this.walkers.length; j++) {
        const a = this.walkers[i];
        const b = this.walkers[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dd = Math.hypot(dx, dz);
        if (dd < minD && dd > 1e-4) {
          const push = (minD - dd) * 0.5;
          a.x -= (dx / dd) * push;
          a.z -= (dz / dd) * push;
          b.x += (dx / dd) * push;
          b.z += (dz / dd) * push;
        } else if (dd <= 1e-4) b.x += 0.05;
      }
    }
    for (const wk of this.walkers) {
      wk.x = Math.max(minX, Math.min(maxX, wk.x));
      wk.z = Math.max(minZ, Math.min(maxZ, wk.z));
      wk.a.root.position.x = wk.x;
      wk.a.root.position.z = wk.z;
    }
    for (const b of this.bees) {
      b.p += dt * (1.5 + b.r);
      const h = this.hives[b.hive];
      b.m.position.set(
        h.position.x + Math.cos(b.p) * b.r * 1.5,
        1.0 + Math.sin(b.p * 2.3) * 0.4 + b.r * 0.5,
        h.position.z + 0.6 + Math.sin(b.p) * b.r * 1.2,
      );
      b.m.rotation.y = -b.p;
    }
    this.inPile?.update(dt);
    this.outPile.update(dt);
  }
}
