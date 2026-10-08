import * as THREE from 'three';
import { ITEMS, SHELF_Z, SHELF_CAP, type ShelfDef } from '../data';
import { buildStall } from '../render/models';
import { ItemPile } from './pile';
import type { GameCtx } from './ctx';
import type { Label } from './labels';
import type { Collider } from '../render/world';

export class Shelf {
  group = new THREE.Group();
  active = false;
  count = 0;
  coins = 0;
  zone: THREE.Vector3;
  pile: ItemPile;
  coinPile: ItemPile;
  collider: Collider;
  spots: (unknown | null)[] = [null, null];
  private label: Label;
  private coinLabel: Label;

  constructor(
    public def: ShelfDef,
    ctx: GameCtx,
  ) {
    const x = def.x;
    this.zone = new THREE.Vector3(x, 0, SHELF_Z - 2.5);
    const stall = buildStall(def.awning);
    stall.position.set(x, 0, SHELF_Z);
    this.group.add(stall);
    this.pile = new ItemPile(def.item, SHELF_CAP, 5, 2, 0.46, 0.4, ITEMS[def.item].h);
    this.pile.mesh.position.set(x, 0.96, SHELF_Z);
    this.group.add(this.pile.mesh);
    this.coinPile = new ItemPile('coin', 40, 4, 2, 0.36, 0.36, 0.065);
    this.coinPile.mesh.position.set(x + 1.05, 0.02, SHELF_Z - 1.55);
    this.group.add(this.coinPile.mesh);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.05, 1.2, 28),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(this.zone.x, 0.03, this.zone.z);
    this.group.add(ring);
    this.collider = { x1: x - 1.35, z1: SHELF_Z - 0.6, x2: x + 1.35, z2: SHELF_Z + 0.6 };
    this.label = ctx.labels.add('', new THREE.Vector3(x, 3.1, SHELF_Z), 'st-label');
    this.coinLabel = ctx.labels.add('', new THREE.Vector3(x + 1.05, 1.2, SHELF_Z - 1.55), 'float-text');
    this.group.visible = false;
    this.label.visible = false;
    this.coinLabel.visible = false;
    ctx.scene.add(this.group);
  }

  activate() {
    this.active = true;
    this.group.visible = true;
    this.label.visible = true;
    this.refresh();
  }

  spotPos(i: number) {
    return new THREE.Vector3(this.def.x + (i === 0 ? -0.6 : 0.6), 0, SHELF_Z + 1.5);
  }

  freeSpot(): number {
    return this.spots.findIndex((s) => s === null);
  }

  canAccept() {
    return this.active && this.count < SHELF_CAP;
  }

  add() {
    this.count++;
    this.pile.set(this.count);
    this.refresh();
  }

  take(): boolean {
    if (this.count <= 0) return false;
    this.count--;
    this.pile.set(this.count, false);
    this.refresh();
    return true;
  }

  slotWorld(out: THREE.Vector3) {
    return this.pile.slotWorld(this.count, out);
  }

  topWorld(out: THREE.Vector3) {
    return this.pile.slotWorld(Math.max(0, this.count - 1), out);
  }

  addCoins(n: number) {
    this.coins += n;
    this.refreshCoins();
  }

  refreshCoins() {
    const vis = this.coins > 0 ? Math.min(40, Math.max(1, Math.ceil(this.coins / 6))) : 0;
    if (vis !== this.coinPile.count) this.coinPile.set(vis);
    this.coinLabel.visible = this.coins > 0;
    this.coinLabel.setHTML(`🪙${Math.floor(this.coins)}`);
  }

  refresh() {
    const icon = ITEMS[this.def.item].icon;
    this.label.setHTML(`${icon} ${this.count}/${SHELF_CAP}`);
    this.label.setClass('st-label' + (this.count === 0 ? ' empty' : this.count >= SHELF_CAP ? ' full' : ''));
  }

  update(dt: number) {
    this.pile.update(dt);
    this.coinPile.update(dt);
  }
}
