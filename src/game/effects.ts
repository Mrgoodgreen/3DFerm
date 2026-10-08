import * as THREE from 'three';
import type { ItemId } from '../data';
import { itemGeo } from '../render/models';
import { MAT } from '../render/mb';
import type { Labels } from './labels';

interface Flyer {
  mesh: THREE.Mesh;
  from: THREE.Vector3;
  to: THREE.Vector3 | (() => THREE.Vector3);
  t: number;
  dur: number;
  arc: number;
  spin: number;
  done?: () => void;
}

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  max: number;
  grav: number;
  s0: number;
}

const _to = new THREE.Vector3();

export class Effects {
  private flyers: Flyer[] = [];
  private pool = new Map<string, THREE.Mesh[]>();
  private particles: Particle[] = [];
  private partPool: THREE.Mesh[] = [];
  private partGeo = new THREE.IcosahedronGeometry(0.12, 0);
  private floats: { el: ReturnType<Labels['add']>; t: number; y0: number }[] = [];

  constructor(
    private scene: THREE.Scene,
    private labels: Labels,
  ) {}

  private getMesh(item: ItemId | 'coin') {
    const list = this.pool.get(item);
    const m = list?.pop();
    if (m) {
      m.visible = true;
      return m;
    }
    const mesh = new THREE.Mesh(itemGeo(item), MAT);
    mesh.userData.item = item;
    mesh.castShadow = false;
    this.scene.add(mesh);
    return mesh;
  }

  private release(m: THREE.Mesh) {
    m.visible = false;
    const k = m.userData.item as string;
    let list = this.pool.get(k);
    if (!list) this.pool.set(k, (list = []));
    list.push(m);
  }

  fly(item: ItemId | 'coin', from: THREE.Vector3, to: THREE.Vector3 | (() => THREE.Vector3), dur = 0.32, done?: () => void, arc = 1.4) {
    const mesh = this.getMesh(item);
    mesh.position.copy(from);
    mesh.scale.setScalar(1);
    this.flyers.push({ mesh, from: from.clone(), to: typeof to === 'function' ? to : to.clone(), t: 0, dur, arc, spin: (Math.random() - 0.5) * 8, done });
  }

  burst(pos: THREE.Vector3, color: number, n = 10, speed = 3, size = 1) {
    for (let i = 0; i < n; i++) {
      let m = this.partPool.pop();
      if (!m) {
        m = new THREE.Mesh(this.partGeo, new THREE.MeshLambertMaterial({ color }));
        this.scene.add(m);
      }
      (m.material as THREE.MeshLambertMaterial).color.setHex(color);
      m.visible = true;
      m.position.copy(pos);
      const a = Math.random() * Math.PI * 2;
      const up = 0.5 + Math.random();
      const sp = speed * (0.5 + Math.random() * 0.7);
      const s0 = size * (0.6 + Math.random() * 0.8);
      m.scale.setScalar(s0);
      this.particles.push({ mesh: m, vel: new THREE.Vector3(Math.cos(a) * sp, up * sp, Math.sin(a) * sp), life: 0, max: 0.5 + Math.random() * 0.4, grav: 9, s0 });
    }
  }

  puff(pos: THREE.Vector3, n = 3, color = 0xffffff) {
    for (let i = 0; i < n; i++) {
      let m = this.partPool.pop();
      if (!m) {
        m = new THREE.Mesh(this.partGeo, new THREE.MeshLambertMaterial({ color }));
        this.scene.add(m);
      }
      (m.material as THREE.MeshLambertMaterial).color.setHex(color);
      m.visible = true;
      m.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3));
      const s0 = 1.5 + Math.random();
      m.scale.setScalar(s0);
      this.particles.push({ mesh: m, vel: new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.9 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3), life: 0, max: 1.6, grav: -0.2, s0 });
    }
  }

  floatText(text: string, pos: THREE.Vector3, cls = 'float-text') {
    const p = pos.clone();
    const el = this.labels.add(text, p, cls);
    this.floats.push({ el, t: 0, y0: p.y });
  }

  update(dt: number) {
    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const f = this.flyers[i];
      f.t += dt / f.dur;
      const to = typeof f.to === 'function' ? f.to() : f.to;
      const k = Math.min(1, f.t);
      const e = k * k * (3 - 2 * k);
      _to.copy(f.from).lerp(to, e);
      _to.y += Math.sin(k * Math.PI) * f.arc;
      f.mesh.position.copy(_to);
      f.mesh.rotation.y += f.spin * dt;
      const s = k > 0.85 ? 1 - (k - 0.85) * 2 : 1;
      f.mesh.scale.setScalar(s);
      if (f.t >= 1) {
        this.release(f.mesh);
        this.flyers.splice(i, 1);
        f.done?.();
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.vel.y -= p.grav * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const k = p.life / p.max;
      p.mesh.scale.setScalar(Math.max(0.01, p.s0 * (1 - k)));
      p.mesh.rotation.x += dt * 4;
      if (p.life >= p.max) {
        p.mesh.visible = false;
        this.partPool.push(p.mesh);
        this.particles.splice(i, 1);
      }
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.t += dt;
      f.el.pos.y = f.y0 + f.t * 1.6;
      f.el.el.style.opacity = String(Math.max(0, 1 - f.t / 1.1));
      if (f.t > 1.1) {
        f.el.remove();
        this.floats.splice(i, 1);
      }
    }
  }
}
