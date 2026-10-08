import * as THREE from 'three';

const _v = new THREE.Vector3();

export class Label {
  el: HTMLDivElement;
  inner: HTMLDivElement;
  pos: THREE.Vector3;
  visible = true;
  private shown = true;
  private lastHTML = '';
  private lastX = -1;
  private lastY = -1;

  constructor(
    private owner: Labels,
    html: string,
    pos: THREE.Vector3,
    cls = '',
  ) {
    this.el = document.createElement('div');
    this.el.className = 'wl';
    this.inner = document.createElement('div');
    this.inner.className = 'wl-inner ' + cls;
    this.el.appendChild(this.inner);
    this.pos = pos;
    this.setHTML(html);
    owner.root.appendChild(this.el);
  }

  setHTML(html: string) {
    if (html !== this.lastHTML) {
      this.inner.innerHTML = html;
      this.lastHTML = html;
    }
  }

  setClass(cls: string) {
    const c = 'wl-inner ' + cls;
    if (this.inner.className !== c) this.inner.className = c;
  }

  place(camera: THREE.Camera, w: number, h: number) {
    const show = this.visible;
    if (show) {
      _v.copy(this.pos).project(camera);
      const off = _v.z > 1 || _v.x < -1.3 || _v.x > 1.3 || _v.y < -1.3 || _v.y > 1.4;
      if (!off) {
        const x = Math.round((_v.x * 0.5 + 0.5) * w);
        const y = Math.round((-_v.y * 0.5 + 0.5) * h);
        if (x !== this.lastX || y !== this.lastY) {
          this.el.style.transform = `translate3d(${x}px,${y}px,0)`;
          this.lastX = x;
          this.lastY = y;
        }
      }
      this.setShown(!off);
    } else this.setShown(false);
  }

  private setShown(s: boolean) {
    if (s !== this.shown) {
      this.shown = s;
      this.el.style.display = s ? '' : 'none';
    }
  }

  remove() {
    this.el.remove();
    this.owner.items.delete(this);
  }
}

export class Labels {
  root: HTMLDivElement;
  items = new Set<Label>();

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'labels';
    parent.appendChild(this.root);
  }

  add(html: string, pos: THREE.Vector3, cls = ''): Label {
    const l = new Label(this, html, pos, cls);
    this.items.add(l);
    return l;
  }

  update(camera: THREE.Camera) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const l of this.items) l.place(camera, w, h);
  }
}
