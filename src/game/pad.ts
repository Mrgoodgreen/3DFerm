import * as THREE from 'three';
import type { UnlockDef } from '../data';
import { roundedRectShape } from '../render/models';
import type { GameCtx } from './ctx';
import type { Label } from './labels';
import { fmt } from '../i18n';

const frameGeo = (() => {
  const s = roundedRectShape(2.4, 2.4, 0.45);
  const hole = roundedRectShape(2.05, 2.05, 0.3);
  s.holes.push(hole as unknown as THREE.Path);
  const g = new THREE.ShapeGeometry(s, 6);
  g.rotateX(-Math.PI / 2);
  return g;
})();
const fillGeo = (() => {
  const g = new THREE.PlaneGeometry(2.05, 2.05);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, -1.025);
  return g;
})();
const bgGeo = (() => {
  const g = new THREE.ShapeGeometry(roundedRectShape(2.05, 2.05, 0.3), 6);
  g.rotateX(-Math.PI / 2);
  return g;
})();

export class Pad {
  group = new THREE.Group();
  visible = false;
  paid = 0;
  done = false;
  label: Label;
  private fill: THREE.Mesh;
  private frame: THREE.Mesh;
  private pulse = 0;
  payAcc = 0;
  coinT = 0;

  constructor(
    public def: UnlockDef,
    public name: string,
    ctx: GameCtx,
  ) {
    this.frame = new THREE.Mesh(frameGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }));
    this.frame.position.y = 0.05;
    const bg = new THREE.Mesh(bgGeo, new THREE.MeshBasicMaterial({ color: 0x3a6b2a, transparent: true, opacity: 0.35, depthWrite: false }));
    bg.position.y = 0.04;
    this.fill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85, depthWrite: false }));
    this.fill.position.set(0, 0.045, 1.025);
    this.fill.scale.z = 0.0001;
    this.group.add(bg, this.fill, this.frame);
    this.group.position.set(def.x, 0, def.z);
    this.group.visible = false;
    ctx.scene.add(this.group);
    this.label = ctx.labels.add('', new THREE.Vector3(def.x, 0.6, def.z), 'pad-label');
    this.label.visible = false;
  }

  show(paid: number) {
    this.visible = true;
    this.paid = paid;
    this.group.visible = true;
    this.label.visible = true;
    this.group.scale.setScalar(0.01);
    this.pulse = 0.5;
    this.refresh(Infinity);
  }

  hide() {
    this.visible = false;
    this.group.visible = false;
    this.label.visible = false;
  }

  refresh(coins: number) {
    const left = Math.max(0, Math.ceil(this.def.cost - this.paid));
    this.label.setHTML(
      `<div class="pad-icon">${this.def.icon}</div><div class="pad-name">${this.name}</div><div class="pad-cost">🪙 ${fmt(left)}</div>`,
    );
    this.label.setClass('pad-label' + (coins < 1 && left > 0 ? ' locked' : ''));
    this.fill.scale.z = Math.max(0.0001, this.paid / this.def.cost);
  }

  contains(x: number, z: number) {
    return Math.abs(x - this.def.x) < 1.2 && Math.abs(z - this.def.z) < 1.2;
  }

  update(dt: number, standing: boolean) {
    if (!this.visible) return;
    if (this.pulse > 0) {
      this.pulse -= dt;
      const k = 1 - Math.max(0, this.pulse) / 0.5;
      const s = k < 0.7 ? (k / 0.7) * 1.15 : 1.15 - ((k - 0.7) / 0.3) * 0.15;
      this.group.scale.setScalar(Math.max(0.01, s));
    } else {
      const target = standing ? 1.08 : 1;
      const cur = this.group.scale.x;
      this.group.scale.setScalar(cur + (target - cur) * Math.min(1, dt * 10));
    }
    (this.frame.material as THREE.MeshBasicMaterial).color.setHex(standing ? 0xfff3a0 : 0xffffff);
  }
}
