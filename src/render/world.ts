import * as THREE from 'three';
import { FIELDS, STATIONS, SHELVES, SHELF_Z, CONFIG, FAIR, UNLOCKS } from '../data';
import { MB, MAT, box, cyl, sph, cone, ico, rng } from './mb';
import {
  roundedRectShape,
  addTree,
  addBush,
  addRock,
  addFlower,
  addFlowerBush,
  addSunflower,
  addHayBale,
  addBarrel,
  addCrate,
  addLantern,
  addWheelbarrow,
  addTomatoBush,
  fenceLine,
  buildHouse,
  plotGeo,
  C,
} from './models';
import type { Stage } from './stage';

export const ISLAND = { minX: -33, maxX: 35, minZ: -36, maxZ: 20 };
const IW = ISLAND.maxX - ISLAND.minX;
const ID = ISLAND.maxZ - ISLAND.minZ;
const ICX = (ISLAND.minX + ISLAND.maxX) / 2;
const ICZ = (ISLAND.minZ + ISLAND.maxZ) / 2;

export interface Collider {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export const HOUSE = { x: -19, z: 7.5 };
export const POND = { x: -27, z: 8, r: 2.6 };

export interface World {
  colliders: Collider[];
  update(dt: number, t: number): void;
}

export const PATHS: [number, number, number, number, number][] = [
  [-25, 2.6, 30, 2.6, 2.4],
  [-25, -9.4, 30, -9.4, 2.0],
  [-25, -20.4, 30, -20.4, 2.0],
  [-13.5, -29, -13.5, 3, 1.8],
  [8, -29, 8, 3, 1.8],
  [19.2, -29, 19.2, 3, 1.8],
  [HOUSE.x, 3, HOUSE.x, 10.5, 1.6],
];

function paintGround(mobile: boolean): HTMLCanvasElement {
  const W = mobile ? 1024 : 2048;
  const H = Math.round((W * ID) / IW);
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d', { willReadFrequently: true })!;
  const sx = W / IW;
  const px = (x: number) => (x - ISLAND.minX) * sx;
  const pz = (z: number) => (z - ISLAND.minZ) * sx;
  const r = rng(7);
  const blades = (x1: number, z1: number, x2: number, z2: number, n: number, cols: string[], len = 0.22) => {
    g.save();
    g.lineCap = 'round';
    g.lineWidth = Math.max(1, sx * 0.06);
    for (let i = 0; i < n; i++) {
      const x = px(x1 + r() * (x2 - x1));
      const y = pz(z1 + r() * (z2 - z1));
      const a = -Math.PI / 2 + (r() - 0.5) * 0.9;
      const l = (len * 0.5 + r() * len) * sx;
      g.strokeStyle = cols[Math.floor(r() * cols.length)];
      g.globalAlpha = 0.45 + r() * 0.4;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    g.restore();
  };

  g.fillStyle = '#76bd41';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 420; i++) {
    const x = r() * W;
    const y = r() * H;
    const rad = (1.2 + r() * 4.5) * sx;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    const c = ['98,170,52', '140,206,82', '86,156,44', '160,214,96'][Math.floor(r() * 4)];
    grd.addColorStop(0, `rgba(${c},0.5)`);
    grd.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  blades(ISLAND.minX, ISLAND.minZ, ISLAND.maxX, ISLAND.maxZ, mobile ? 22000 : 60000, ['#5c9e2f', '#8fd457', '#a8e26b', '#4d8c27', '#6fb53c']);

  const rr = (x1: number, z1: number, x2: number, z2: number, rad: number, fill: string, blur = 0) => {
    g.save();
    if (blur) {
      g.shadowColor = fill;
      g.shadowBlur = blur * (sx / 15);
    }
    g.fillStyle = fill;
    const X = px(Math.min(x1, x2));
    const Y = pz(Math.min(z1, z2));
    const Wd = Math.abs(x2 - x1) * sx;
    const Hd = Math.abs(z2 - z1) * sx;
    const R = Math.min(rad * sx, Wd / 2, Hd / 2);
    g.beginPath();
    g.moveTo(X + R, Y);
    g.arcTo(X + Wd, Y, X + Wd, Y + Hd, R);
    g.arcTo(X + Wd, Y + Hd, X, Y + Hd, R);
    g.arcTo(X, Y + Hd, X, Y, R);
    g.arcTo(X, Y, X + Wd, Y, R);
    g.closePath();
    g.fill();
    g.restore();
  };
  const speckle = (x1: number, z1: number, x2: number, z2: number, n: number, cols: string[], size = 0.08) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = cols[Math.floor(r() * cols.length)];
      g.globalAlpha = 0.5 + r() * 0.4;
      const x = px(x1 + r() * (x2 - x1));
      const y = pz(z1 + r() * (z2 - z1));
      g.beginPath();
      g.ellipse(x, y, size * sx * (0.6 + r()), size * sx * (0.4 + r() * 0.6), r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  };
  const cobbles = (x1: number, z1: number, x2: number, z2: number, base: string, gap: string, size: number) => {
    rr(x1, z1, x2, z2, 0.8, gap, 6);
    for (let z = z1 + 0.05; z < z2 - 0.05; z += size) {
      const off = (Math.round((z - z1) / size) % 2) * size * 0.5;
      for (let x = x1 + 0.05 - off; x < x2 - 0.05; x += size) {
        if (x < x1) continue;
        const c = new Array(3).fill(0).map((_, k) => parseInt(base.slice(1 + k * 2, 3 + k * 2), 16) + Math.round((r() - 0.5) * 26));
        g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        const X = px(x) + 1.5;
        const Y = pz(z) + 1.5;
        const S = size * sx - 3;
        g.beginPath();
        g.roundRect ? g.roundRect(X, Y, Math.min(S, px(x2) - X), S, S * 0.3) : g.rect(X, Y, S, S);
        g.fill();
      }
    }
  };
  const path = (x1: number, z1: number, x2: number, z2: number, w: number) => {
    g.save();
    g.lineCap = 'round';
    g.strokeStyle = '#a97a42';
    g.lineWidth = (w + 0.35) * sx;
    g.beginPath();
    g.moveTo(px(x1), pz(z1));
    g.lineTo(px(x2), pz(z2));
    g.stroke();
    g.strokeStyle = '#d4a565';
    g.lineWidth = w * sx;
    g.stroke();
    g.strokeStyle = 'rgba(232,192,128,0.6)';
    g.lineWidth = w * 0.45 * sx;
    g.stroke();
    g.restore();
    const len = Math.hypot(x2 - x1, z2 - z1);
    const n = Math.round(len * 22);
    for (let i = 0; i < n; i++) {
      const t0 = r();
      const off = (r() - 0.5) * w * 0.9;
      const nx = -(z2 - z1) / len;
      const nz = (x2 - x1) / len;
      const x = x1 + (x2 - x1) * t0 + nx * off;
      const z = z1 + (z2 - z1) * t0 + nz * off;
      g.fillStyle = ['#b98a52', '#e6c48c', '#a8a196', '#c9b9a0', '#9c6f3e'][Math.floor(r() * 5)];
      g.globalAlpha = 0.7;
      g.beginPath();
      g.ellipse(px(x), pz(z), sx * (0.04 + r() * 0.07), sx * (0.03 + r() * 0.05), r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  };

  for (const p of PATHS) path(...p);

  // Market plaza and road: cobblestones
  cobbles(-12, 5.0, 23.5, 10.8, '#dcc69c', '#a99470', 0.62);
  cobbles(ISLAND.minX - 1, CONFIG.road.z - 1.4, ISLAND.maxX + 1, CONFIG.road.z + 1.4, '#c4b498', '#8f8370', 0.55);

  // Fields
  for (const f of FIELDS) {
    const hw = ((f.cols - 1) * f.spacing) / 2 + f.spacing * 0.6;
    const hd = ((f.rows - 1) * f.spacing) / 2 + f.spacing * 0.6;
    if (f.kind === 'wheat' || f.kind === 'carrot') {
      rr(f.x - hw, f.z - hd, f.x + hw, f.z + hd, 0.3, '#6e4224', 6);
      for (let i = 0; i < f.rows; i++) {
        const z = f.z - ((f.rows - 1) * f.spacing) / 2 + i * f.spacing;
        rr(f.x - hw + 0.2, z - 0.42, f.x + hw - 0.2, z + 0.42, 0.3, '#86532e');
        rr(f.x - hw + 0.25, z - 0.36, f.x + hw - 0.25, z - 0.2, 0.08, 'rgba(160,104,62,0.8)');
      }
      speckle(f.x - hw, f.z - hd, f.x + hw, f.z + hd, Math.round(hw * hd * 30), ['#5a341b', '#9a6438', '#4a2a14'], 0.05);
    } else if (f.kind === 'grass') {
      rr(f.x - hw, f.z - hd, f.x + hw, f.z + hd, 1.2, '#69b236', 14);
      blades(f.x - hw, f.z - hd, f.x + hw, f.z + hd, Math.round(hw * hd * 160), ['#4f9a2a', '#9ad85c', '#5fae33'], 0.3);
    } else {
      rr(f.x - hw, f.z - hd, f.x + hw, f.z + hd, 1.5, '#6db63a', 14);
    }
  }
  // Pens (straw) and building yards (packed earth)
  for (const s of STATIONS) {
    if (s.kind === 'pen') {
      rr(s.x - s.w / 2, s.z - s.d / 2, s.x + s.w / 2, s.z + s.d / 2, 0.3, '#c9a35a', 4);
      blades(s.x - s.w / 2, s.z - s.d / 2, s.x + s.w / 2, s.z + s.d / 2, Math.round(s.w * s.d * 60), ['#f0d38a', '#b88c42', '#e3c070'], 0.35);
      rr(s.x - s.w / 2, s.z + s.d / 2 + 0.3, s.x + s.w / 2, s.z + s.d / 2 + 2.9, 0.8, '#cf9f62', 8);
    } else {
      rr(s.x - s.w / 2 - 0.2, s.z - s.d / 2 + 0.2, s.x + s.w / 2 + 0.2, s.z + s.d / 2 + 2.9, 0.8, '#cf9f62', 8);
      speckle(s.x - s.w / 2, s.z + s.d / 2 - 0.5, s.x + s.w / 2, s.z + s.d / 2 + 2.8, 120, ['#b98a52', '#e6c48c', '#a8a196'], 0.07);
    }
  }
  // Fair plaza
  cobbles(FAIR.x - 4, FAIR.z - 3.5, FAIR.x + 4, FAIR.z + 4.6, '#e9d2a6', '#b39a72', 0.6);
  // Flowers in the grass
  const img = g.getImageData(0, 0, W, H).data;
  for (let i = 0; i < (mobile ? 1600 : 3200); i++) {
    const x = r() * W;
    const y = r() * H;
    const k = (Math.floor(y) * W + Math.floor(x)) * 4;
    if (img[k + 1] > 150 && img[k] < 150 && img[k + 2] < 110) {
      g.fillStyle = ['#ffffff', '#ffe066', '#ff9ec7', '#c8a2ff', '#ffffff'][Math.floor(r() * 5)];
      g.globalAlpha = 0.85;
      g.beginPath();
      g.arc(x, y, sx * (0.05 + r() * 0.05), 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }
  }
  return cv;
}

export function buildWorld(stage: Stage, mobile: boolean): World {
  const scene = stage.scene;
  const colliders: Collider[] = [];

  // ---------------- Island
  const shape = roundedRectShape(IW, ID, 7);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 3,
    bevelEnabled: true,
    bevelThickness: 0.4,
    bevelSize: 0.6,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(ICX, -3, ICZ);
  geo.computeBoundingBox();
  const topY = geo.boundingBox!.max.y;
  geo.translate(0, -topY, 0);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - ISLAND.minX) / IW, 1 - (pos.getZ(i) - ISLAND.minZ) / ID);
  }
  const groundCanvas = paintGround(mobile);
  const tex = new THREE.CanvasTexture(groundCanvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const topMat = new THREE.MeshLambertMaterial({ map: tex });
  const sideMat = new THREE.MeshLambertMaterial({ color: 0xc9a36b });
  const island = new THREE.Mesh(geo, [topMat, sideMat]);
  island.receiveShadow = true;
  scene.add(island);

  // Sand rim and water
  const rim = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectShape(IW + 5, ID + 5, 9), 12), new THREE.MeshLambertMaterial({ color: 0xf2deb0 }));
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(ICX, -0.75, ICZ);
  rim.receiveShadow = true;
  scene.add(rim);
  const shallow = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectShape(IW + 14, ID + 14, 13), 12), new THREE.MeshLambertMaterial({ color: 0x7fd6ee, transparent: true, opacity: 0.7 }));
  shallow.rotation.x = -Math.PI / 2;
  shallow.position.set(ICX, -0.82, ICZ);
  scene.add(shallow);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshLambertMaterial({ color: 0x4fb8e0 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(ICX, -0.9, ICZ);
  scene.add(water);

  // Water sparkles
  const sparkGeo = new THREE.PlaneGeometry(0.9, 0.12);
  sparkGeo.rotateX(-Math.PI / 2);
  const sparkCount = 90;
  const sparks = new THREE.InstancedMesh(sparkGeo, new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.8 }), sparkCount);
  const sparkData: { x: number; z: number; p: number }[] = [];
  const sr = rng(99);
  for (let i = 0; i < sparkCount; i++) {
    let x = 0;
    let z = 0;
    do {
      x = ISLAND.minX - 25 + sr() * (IW + 50);
      z = ISLAND.minZ - 25 + sr() * (ID + 50);
    } while (x > ISLAND.minX - 4 && x < ISLAND.maxX + 4 && z > ISLAND.minZ - 4 && z < ISLAND.maxZ + 4);
    sparkData.push({ x, z, p: sr() * 10 });
  }
  scene.add(sparks);

  // ---------------- Bridges for the road
  const bridge = new MB();
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? ISLAND.minX - 0.5 : ISLAND.maxX + 0.5;
    for (let i = 0; i < 40; i++) {
      const x = x0 + side * i * 0.7;
      bridge.add(box(0.62, 0.12, 2.8), i % 2 ? 0xc49a6c : 0xb3895c, { p: [x, -0.15, CONFIG.road.z] });
      if (i % 4 === 0) {
        for (const sz of [-1, 1]) {
          bridge.add(cyl(0.12, 0.12, 2.2, 6), 0x8a5a33, { p: [x, -0.2, CONFIG.road.z + sz * 1.45] });
        }
      }
    }
    const len = 28;
    for (const sz of [-1, 1]) bridge.add(box(len, 0.1, 0.1), 0x8a5a33, { p: [x0 + (side * len) / 2, 0.75, CONFIG.road.z + sz * 1.45] });
  }
  scene.add(bridge.mesh(true, true));

  // ---------------- Decorations (merged)
  const decor = new MB();
  const r = rng(12345);
  const keepOut: Collider[] = [
    { x1: -26, z1: -30.5, x2: 30.5, z2: 11.4 },
    { x1: ISLAND.minX, z1: CONFIG.road.z - 1.8, x2: ISLAND.maxX, z2: CONFIG.road.z + 1.8 },
  ];
  const inKeep = (x: number, z: number, m = 0) => keepOut.some((k) => x > k.x1 - m && x < k.x2 + m && z > k.z1 - m && z < k.z2 + m);
  const insideIsland = (x: number, z: number, m: number) => x > ISLAND.minX + m && x < ISLAND.maxX - m && z > ISLAND.minZ + m && z < ISLAND.maxZ - m;
  const nearHouse = (x: number, z: number) => Math.abs(x - HOUSE.x) < 4.5 && Math.abs(z - HOUSE.z) < 4.5;
  const nearPond = (x: number, z: number) => Math.hypot(x - POND.x, z - POND.z) < POND.r + 1.4;
  const decoSpots = UNLOCKS.filter((u) => u.kind === 'deco');
  const nearDeco = (x: number, z: number) => decoSpots.some((u) => Math.hypot(x - u.x, z - u.z) < 3.4);

  let placed = 0;
  for (let i = 0; i < 2000 && placed < (mobile ? 110 : 150); i++) {
    const x = ISLAND.minX + r() * IW;
    const z = ISLAND.minZ + r() * ID;
    if (!insideIsland(x, z, 1.4) || inKeep(x, z, 0.8) || nearHouse(x, z) || nearPond(x, z) || nearDeco(x, z)) continue;
    const south = z > CONFIG.road.z + 1.8;
    const k = r();
    if (south) {
      if (k < 0.2) addBush(decor, x, z, 0.7 + r() * 0.4, r() < 0.3);
      else if (k < 0.35) addFlowerBush(decor, x, z, 0.8, [0xffffff, 0xff9ec7][Math.floor(r() * 2)]);
      else if (k < 0.5) addRock(decor, x, z, 0.6 + r() * 0.5);
      else addFlower(decor, x, z, [0xff6b9a, 0xffd166, 0xffffff, 0x9b5de5][Math.floor(r() * 4)]);
    } else if (k < 0.62) {
      addTree(decor, x, z, 0.9 + r() * 0.6, r() < 0.55 ? 0 : r() < 0.75 ? 1 : 2, r);
    } else if (k < 0.7) addBush(decor, x, z, 0.8 + r() * 0.5, r() < 0.3);
    else if (k < 0.78) addFlowerBush(decor, x, z, 0.9 + r() * 0.4, [0xffffff, 0xff9ec7, 0xffd166][Math.floor(r() * 3)]);
    else if (k < 0.88) addRock(decor, x, z, 0.7 + r() * 0.6);
    else for (let f = 0; f < 4; f++) addFlower(decor, x + r() - 0.5, z + r() - 0.5, [0xff6b9a, 0xffd166, 0xffffff, 0x9b5de5][Math.floor(r() * 4)]);
    placed++;
  }
  // Accent trees between production areas
  const accents: [number, number, number][] = [
    [-15.5, -6.8, 0], [9.9, -16.8, 2], [-3.0, -24.8, 0], [-11.7, -24.9, 1],
    [-26.8, -12, 1], [30.3, -1.2, 2], [-2.5, -31.5, 1], [9, -31.5, 0],
  ];
  for (const [x, z, v] of accents) addTree(decor, x, z, 0.85, v, r);

  // House garden
  const house = buildHouse();
  house.position.set(HOUSE.x, 0, HOUSE.z - 1);
  scene.add(house);
  colliders.push({ x1: HOUSE.x - 2.3, z1: HOUSE.z - 2.8, x2: HOUSE.x + 2.3, z2: HOUSE.z + 1.0 });
  for (let i = 0; i < 10; i++) addFlower(decor, HOUSE.x - 2.8 + (i % 5) * 0.3, HOUSE.z + 1.5 + Math.floor(i / 5) * 0.3, [0xff6b9a, 0xffd166, 0xff8c42][i % 3]);
  for (let i = 0; i < 10; i++) addFlower(decor, HOUSE.x + 1.6 + (i % 5) * 0.3, HOUSE.z + 1.5 + Math.floor(i / 5) * 0.3, [0x9b5de5, 0xffffff, 0xff6b9a][i % 3]);
  // Mailbox
  decor.add(cyl(0.06, 0.06, 1.0, 6), C.woodD, { p: [HOUSE.x + 1.6, 0.5, HOUSE.z + 3.2] });
  decor.add(box(0.35, 0.3, 0.5), 0x4f86c6, { p: [HOUSE.x + 1.6, 1.1, HOUSE.z + 3.2] });
  decor.add(box(0.04, 0.2, 0.12), 0xd9534f, { p: [HOUSE.x + 1.8, 1.25, HOUSE.z + 3.1] });
  // Well
  const wx = HOUSE.x + 4.6;
  const wz = HOUSE.z - 1.2;
  decor.add(cyl(0.7, 0.75, 0.7, 10), C.stone, { p: [wx, 0.35, wz] });
  decor.add(cyl(0.55, 0.55, 0.05, 10), 0x4fb8e0, { p: [wx, 0.6, wz] });
  for (const sx of [-1, 1]) decor.add(box(0.1, 1.3, 0.1), C.woodD, { p: [wx + sx * 0.6, 1.1, wz] });
  decor.add(cone(0.95, 0.6, 4), 0xb5443b, { p: [wx, 2.0, wz], r: [0, Math.PI / 4, 0] });
  colliders.push({ x1: wx - 0.8, z1: wz - 0.8, x2: wx + 0.8, z2: wz + 0.8 });
  // Pond with lilies
  const pond = new THREE.Mesh(new THREE.CircleGeometry(POND.r, 24), new THREE.MeshLambertMaterial({ color: 0x5cc3e8 }));
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(POND.x, 0.03, POND.z);
  scene.add(pond);
  decor.add(cyl(POND.r + 0.25, POND.r + 0.35, 0.12, 24), 0xd9c9a3, { p: [POND.x, 0.0, POND.z] });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    addRock(decor, POND.x + Math.cos(a) * (POND.r + 0.3), POND.z + Math.sin(a) * (POND.r + 0.3), 0.45);
  }
  for (let i = 0; i < 4; i++) {
    const a = i * 1.6;
    decor.add(cyl(0.3, 0.3, 0.03, 10), 0x5fb546, { p: [POND.x + Math.cos(a) * 1.3, 0.07, POND.z + Math.sin(a) * 1.1] });
  }
  decor.add(sph(0.08, 6, 4), 0xff9ec7, { p: [POND.x + 1.3, 0.12, POND.z] });
  colliders.push({ x1: POND.x - POND.r, z1: POND.z - POND.r, x2: POND.x + POND.r, z2: POND.z + POND.r });

  // Farm props
  for (const [x, z, ry] of [[9.8, -11.2, 0.3], [9.6, -12.2, -0.2], [28.4, 0.4, 0.5], [-24.5, -18.4, 0.1], [-2.0, -18.6, 0.6]] as [number, number, number][]) addHayBale(decor, x, z, ry);
  addHayBale(decor, 9.7, -11.7, 0.1, 0.55);
  for (const [x, z] of [[-15.6, -23.6], [-15.7, -22.7], [-12.4, 6.9], [-12.6, 7.8], [28.6, -2.2]] as [number, number][]) addBarrel(decor, x, z);
  for (const [x, z, sz, y] of [[-12.3, 9.4, 0.6, 0], [-12.3, 9.4, 0.45, 0.6], [23.7, 7.1, 0.6, 0], [24.4, 8.0, 0.55, 0], [-9.9, -27.4, 0.55, 0]] as [number, number, number, number][]) addCrate(decor, x, z, sz, y, 0.2);
  addWheelbarrow(decor, -11.8, 1.1, 0.6);
  for (let i = 0; i < 10; i++) addSunflower(decor, -11.75 + (i % 2) * 0.2, -5.6 + i * 0.55, 1.15 + (i % 3) * 0.15);
  for (let i = 0; i < 6; i++) addSunflower(decor, HOUSE.x - 3.0 - (i % 2) * 0.3, HOUSE.z - 2.6 + i * 0.6, 1.2 + (i % 2) * 0.2);
  for (let i = 0; i < 6; i++) addSunflower(decor, -5.3 + (i % 3) * 0.45, -31.6 + Math.floor(i / 3) * 0.5, 1.3);
  // Vegetable garden next to the pond
  const gx = -24.5;
  const gz = 3.6;
  decor.add(box(3.0, 0.2, 2.0), 0x6e4224, { p: [gx, 0.1, gz] });
  for (const sz of [-1, 1]) decor.add(box(3.1, 0.3, 0.12), 0x9a6a3a, { p: [gx, 0.15, gz + sz * 1.0] });
  for (const sx of [-1, 1]) decor.add(box(0.12, 0.3, 2.1), 0x9a6a3a, { p: [gx + sx * 1.5, 0.15, gz] });
  for (let i = 0; i < 6; i++) addTomatoBush(decor, gx - 1.0 + (i % 3) * 1.0, gz - 0.45 + Math.floor(i / 3) * 0.9);
  fenceLine(decor, gx - 1.9, gz + 1.5, gx + 1.9, gz + 1.5, 0xa8743f, [0.4, 0.6]);
  colliders.push({ x1: gx - 1.6, z1: gz - 1.1, x2: gx + 1.6, z2: gz + 1.1 });
  // Lanterns along the main path and the road
  for (const x of [-12, -5.3, 1.5, 8.3, 15.1, 22.5]) addLantern(decor, x, 4.45, 1.8);
  for (const x of [-10, -1.9, 4.9, 11.7, 18.5, 25]) addLantern(decor, x, 11.3, 1.9);
  // Flower bushes around the farm
  for (const [x, z, c] of [[-15.6, -7.5, 0xffffff], [-11.9, -7.6, 0xff9ec7], [-1.6, -11.0, 0xffffff], [17.5, -7.5, 0xffffff], [29.0, -6.4, 0xffd166], [-15.4, 4.5, 0xffffff], [-22.6, 5.6, 0xff9ec7], [27.8, 4.4, 0xffffff], [-4.6, -26.8, 0xffffff], [16.8, -21.6, 0xc8a2ff]] as [number, number, number][]) addFlowerBush(decor, x, z, 1, c);
  // Wooden sign at entrance
  decor.add(box(0.15, 1.6, 0.15), C.woodD, { p: [-12.5, 0.8, 11.0] });
  decor.add(box(1.8, 0.7, 0.1), C.woodL, { p: [-12.5, 1.6, 11.05] });

  // Stepping stones along path edges
  const stoneGeo = new THREE.IcosahedronGeometry(0.22, 0);
  stoneGeo.scale(1.3, 0.35, 1);
  const stones: THREE.Vector3[] = [];
  for (const [x1, z1, x2, z2, w] of PATHS) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const nx = -(z2 - z1) / len;
    const nz = (x2 - x1) / len;
    for (let d = 0.6; d < len; d += 1.1 + r() * 1.2) {
      const side = r() < 0.5 ? -1 : 1;
      const off = side * (w / 2 + 0.1 + r() * 0.15);
      stones.push(new THREE.Vector3(x1 + ((x2 - x1) * d) / len + nx * off, 0.03, z1 + ((z2 - z1) * d) / len + nz * off));
    }
  }
  const stoneMesh = new THREE.InstancedMesh(stoneGeo, new THREE.MeshLambertMaterial({ color: 0xb3ab9c }), stones.length);
  const sm = new THREE.Matrix4();
  stones.forEach((p, i) => {
    sm.makeRotationY(r() * 6);
    sm.scale(new THREE.Vector3(0.7 + r() * 0.6, 1, 0.7 + r() * 0.6));
    sm.setPosition(p);
    stoneMesh.setMatrixAt(i, sm);
  });
  stoneMesh.receiveShadow = true;
  scene.add(stoneMesh);

  const decorMesh = decor.mesh(true, true);
  scene.add(decorMesh);

  // ---------------- Instanced grass tufts
  const tuftGeo = plotGeo('tuft');
  const tuftCount = mobile ? 260 : 520;
  const tufts = new THREE.InstancedMesh(tuftGeo, MAT, tuftCount);
  const gctx = groundCanvas.getContext('2d', { willReadFrequently: true })!;
  const gdata = gctx.getImageData(0, 0, groundCanvas.width, groundCanvas.height).data;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  let tc = 0;
  for (let i = 0; i < 6000 && tc < tuftCount; i++) {
    const x = ISLAND.minX + 2 + r() * (IW - 4);
    const z = ISLAND.minZ + 2 + r() * (ID - 4);
    const ix = Math.floor(((x - ISLAND.minX) / IW) * groundCanvas.width);
    const iz = Math.floor(((z - ISLAND.minZ) / ID) * groundCanvas.height);
    const k = (iz * groundCanvas.width + ix) * 4;
    const rr = gdata[k];
    const gg = gdata[k + 1];
    const bb = gdata[k + 2];
    if (!(gg > 150 && rr < 160 && bb < 110)) continue;
    if (nearPond(x, z) || nearHouse(x, z) || nearDeco(x, z)) continue;
    if (FIELDS.some((f) => Math.abs(x - f.x) < (f.cols * f.spacing) / 2 + 0.6 && Math.abs(z - f.z) < (f.rows * f.spacing) / 2 + 0.6)) continue;
    if (STATIONS.some((st) => Math.abs(x - st.x) < st.w / 2 + 1 && Math.abs(z - st.z) < st.d / 2 + 2.2)) continue;
    if (SHELVES.some((sh) => Math.abs(x - sh.x) < 2 && Math.abs(z - SHELF_Z) < 3.5)) continue;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6);
    const sc = 0.35 + r() * 0.35;
    s.set(sc, sc * (0.8 + r() * 0.5), sc);
    v.set(x, 0, z);
    m4.compose(v, q, s);
    tufts.setMatrixAt(tc++, m4);
  }
  tufts.count = tc;
  tufts.receiveShadow = true;
  scene.add(tufts);

  // ---------------- Butterflies
  const bfGeo = new MB();
  bfGeo.add(box(0.18, 0.01, 0.14), 0xffffff, { p: [0.09, 0, 0] });
  const butterflies: { m: THREE.Mesh; x: number; z: number; p: number; c: number }[] = [];
  const bfColors = [0xffd166, 0xff9ec7, 0x9bd1ff, 0xffffff, 0xc8a2ff];
  const wingGeo = bfGeo.build();
  for (let i = 0; i < (mobile ? 6 : 12); i++) {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: bfColors[i % bfColors.length], side: THREE.DoubleSide });
    const l = new THREE.Mesh(wingGeo, mat);
    const rgt = new THREE.Mesh(wingGeo, mat);
    rgt.scale.x = -1;
    g.add(l, rgt);
    scene.add(g);
    let x = 0;
    let z = 0;
    do {
      x = ISLAND.minX + 3 + r() * (IW - 6);
      z = ISLAND.minZ + 3 + r() * (ID - 6);
    } while (inKeep(x, z, -4));
    butterflies.push({ m: g as unknown as THREE.Mesh, x, z, p: r() * 10, c: i });
  }

  // ---------------- Distant islets
  const far = new MB();
  const islets: [number, number, number][] = [[-60, -20, 6], [70, -10, 8], [-45, 45, 5], [60, 40, 7], [10, -70, 9]];
  for (const [x, z, s2] of islets) {
    far.add(cyl(s2, s2 * 1.15, 1.5, 12), 0x8fd16a, { p: [x, -0.6, z] });
    for (let i = 0; i < 5; i++) addTree(far, x + (r() - 0.5) * s2, z + (r() - 0.5) * s2, 1.2 + r(), Math.floor(r() * 2), r);
    far.add(ico(s2 * 0.25, 0), C.stone, { p: [x + s2 * 0.5, 0.2, z], flat: true });
  }
  scene.add(far.mesh(false, false));

  return {
    colliders,
    update(dt, t) {
      for (let i = 0; i < sparkData.length; i++) {
        const sp = sparkData[i];
        const a = (Math.sin(t * 1.3 + sp.p) + 1) / 2;
        const sc = 0.2 + a * 0.9;
        q.identity();
        s.set(sc, 1, 1);
        v.set(sp.x + Math.sin(t * 0.3 + sp.p) * 0.6, -0.86, sp.z);
        m4.compose(v, q, s);
        sparks.setMatrixAt(i, m4);
      }
      sparks.instanceMatrix.needsUpdate = true;
      for (const b of butterflies) {
        b.p += dt;
        const g = b.m as unknown as THREE.Group;
        const px2 = b.x + Math.sin(b.p * 0.4 + b.c) * 2.5;
        const pz2 = b.z + Math.cos(b.p * 0.33 + b.c * 2) * 2.5;
        g.position.set(px2, 0.9 + Math.sin(b.p * 2) * 0.3, pz2);
        g.rotation.y = b.p * 0.4 + b.c;
        const flap = Math.sin(b.p * 18) * 0.9;
        (g.children[0] as THREE.Mesh).rotation.z = flap;
        (g.children[1] as THREE.Mesh).rotation.z = -flap;
      }
      void dt;
    },
  };
}