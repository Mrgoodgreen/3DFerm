import * as THREE from 'three';
import { t } from '../i18n';

export type ZoneKind = 'in' | 'out' | 'sell' | 'bin';

const STYLE: Record<ZoneKind, { fill: string; edge: string; text: string }> = {
  in: { fill: 'rgba(255,150,20,0.78)', edge: '#ffffff', text: 'zone_bring' },
  out: { fill: 'rgba(70,190,50,0.78)', edge: '#ffffff', text: 'zone_take' },
  sell: { fill: 'rgba(40,140,240,0.75)', edge: '#ffffff', text: 'zone_sell' },
  bin: { fill: 'rgba(110,120,135,0.7)', edge: '#ffffff', text: 'zone_bin' },
};

const cache = new Map<string, THREE.CanvasTexture>();

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function chevron(g: CanvasRenderingContext2D, cx: number, cy: number, ang: number, s: number) {
  g.save();
  g.translate(cx, cy);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(-s, -s * 0.8);
  g.lineTo(0, 0);
  g.lineTo(-s, s * 0.8);
  g.stroke();
  g.restore();
}

/** Ground tile texture: item icon, direction chevrons and a short verb ("BRING" / "TAKE"...). */
export function zoneTexture(icon: string, kind: ZoneKind): THREE.CanvasTexture {
  const key = `${kind}|${icon}|${t(STYLE[kind].text)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const g = cv.getContext('2d')!;
  const st = STYLE[kind];
  rr(g, 10, 10, S - 20, S - 20, 46);
  g.fillStyle = st.fill;
  g.fill();
  g.lineWidth = 12;
  g.strokeStyle = st.edge;
  g.setLineDash([30, 16]);
  g.stroke();
  g.setLineDash([]);

  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.beginPath();
  g.arc(S / 2, S / 2 - 14, 66, 0, Math.PI * 2);
  g.fill();
  g.font = '86px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(icon, S / 2, S / 2 - 10);

  g.strokeStyle = st.edge;
  g.lineWidth = 11;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const inward = kind !== 'out';
  const cy = S / 2 - 14;
  for (const side of [-1, 1]) {
    const ang = inward === side < 0 ? 0 : Math.PI;
    for (const d of [34, 56]) chevron(g, S / 2 + side * (S / 2 - d) + (ang === 0 ? 7 : -7), cy, ang, 12);
  }

  g.font = '900 34px "Trebuchet MS","Segoe UI",sans-serif';
  g.lineWidth = 8;
  g.strokeStyle = 'rgba(70,40,10,0.65)';
  const label = t(st.text).toUpperCase();
  g.strokeText(label, S / 2, S - 44, S - 40);
  g.fillStyle = '#ffffff';
  g.fillText(label, S / 2, S - 44, S - 40);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

const geo = (() => {
  const g = new THREE.PlaneGeometry(2.3, 2.3);
  g.rotateX(-Math.PI / 2);
  return g;
})();

export class ZoneMarker {
  mesh: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  private t = Math.random() * 6;
  active = false;

  constructor(parent: THREE.Object3D, pos: THREE.Vector3, icon: string, kind: ZoneKind, size = 1) {
    this.mat = new THREE.MeshBasicMaterial({ map: zoneTexture(icon, kind), transparent: true, depthWrite: false, opacity: 0.9, toneMapped: false });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.position.set(pos.x, 0.045, pos.z);
    this.mesh.scale.setScalar(size);
    this.mesh.renderOrder = 1;
    this.base = size;
    parent.add(this.mesh);
  }

  private base: number;

  update(dt: number) {
    this.t += dt * (this.active ? 6 : 2);
    const k = this.active ? 1 + Math.sin(this.t) * 0.07 : 1;
    this.mesh.scale.setScalar(this.base * k);
    this.mat.opacity = this.active ? 1 : 0.88;
  }
}
