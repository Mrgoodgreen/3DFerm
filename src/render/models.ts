import * as THREE from 'three';
import type { ItemId, SkinDef, BuildingKind } from '../data';
import { MB, MAT, box, cyl, sph, cone, ico, torus, capsule } from './mb';

// ---------------------------------------------------------------- palette
export const C = {
  skin: 0xffd7b8,
  blush: 0xff9e9e,
  eye: 0x2b1d14,
  wood: 0xb07a4a,
  woodD: 0x8a5a33,
  woodL: 0xd9a46c,
  white: 0xfffbf2,
  red: 0xd9534f,
  roofRed: 0xb5443b,
  green: 0x7cc957,
  greenD: 0x4f9a3a,
  leaf: 0x67b84a,
  leafD: 0x4e9a38,
  soil: 0x8b5e3c,
  soilD: 0x6e4529,
  hay: 0xf2cf63,
  stone: 0xb9b3a8,
  stoneD: 0x8f887e,
  gold: 0xffc531,
  goldD: 0xe0a100,
};

function prism(w: number, h: number, d: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0, h);
  s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  return g;
}

export function roundedRectShape(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Gable roof made from two slabs plus wall triangles. */
export function gableRoof(mb: MB, w: number, d: number, y: number, rise: number, roof: number, wall: number, over = 0.25) {
  mb.add(prism(w, rise, d - 0.02), wall, { p: [0, y, 0] });
  const half = w / 2 + over;
  const len = Math.sqrt(half * half + rise * rise);
  const ang = Math.atan2(rise, half);
  for (const sgn of [-1, 1]) {
    mb.add(box(len, 0.14, d + over * 2), roof, {
      p: [(sgn * half) / 2, y + rise / 2 + 0.06, 0],
      r: [0, 0, -sgn * ang],
    });
  }
}

// Rotated gable: ridge along X axis (front faces +z).
function gableRoofX(mb: MB, w: number, d: number, y: number, rise: number, roof: number, wall: number, over = 0.25) {
  mb.add(prism(d, rise, w - 0.02), wall, { p: [0, y, 0], r: [0, Math.PI / 2, 0] });
  const half = d / 2 + over;
  const len = Math.sqrt(half * half + rise * rise);
  const ang = Math.atan2(rise, half);
  for (const sgn of [-1, 1]) {
    mb.add(box(w + over * 2, 0.14, len), roof, {
      p: [0, y + rise / 2 + 0.06, (sgn * half) / 2],
      r: [sgn * ang, 0, 0],
    });
  }
}

function windowPane(mb: MB, x: number, y: number, z: number, w = 0.5, h = 0.5, ry = 0, frame = C.white) {
  const dx = Math.sin(ry);
  const dz = Math.cos(ry);
  mb.add(box(w + 0.1, h + 0.1, 0.06), frame, { p: [x, y, z], r: [0, ry, 0] });
  mb.add(box(w, h, 0.07), 0x8fd3f4, { p: [x + dx * 0.01, y, z + dz * 0.01], r: [0, ry, 0] });
  mb.add(box(0.05, h, 0.08), frame, { p: [x + dx * 0.02, y, z + dz * 0.02], r: [0, ry, 0] });
  mb.add(box(w, 0.05, 0.08), frame, { p: [x + dx * 0.02, y, z + dz * 0.02], r: [0, ry, 0] });
}

// ---------------------------------------------------------------- items
const itemCache = new Map<string, THREE.BufferGeometry>();

export function itemGeo(id: ItemId | 'coin'): THREE.BufferGeometry {
  const cached = itemCache.get(id);
  if (cached) return cached;
  const mb = new MB();
  switch (id) {
    case 'grass':
      mb.add(box(0.5, 0.2, 0.34), 0x79c64e, { p: [0, 0.1, 0] });
      mb.add(box(0.08, 0.215, 0.35), 0xc79a55, { p: [0.12, 0.1, 0] });
      mb.add(box(0.08, 0.215, 0.35), 0xc79a55, { p: [-0.12, 0.1, 0] });
      for (let i = 0; i < 4; i++) mb.add(cone(0.06, 0.14, 4), 0x93d96a, { p: [-0.18 + i * 0.12, 0.25, (i % 2) * 0.08 - 0.04] });
      break;
    case 'milk':
      mb.add(cyl(0.12, 0.13, 0.26, 10), 0xffffff, { p: [0, 0.13, 0] });
      mb.add(cyl(0.135, 0.135, 0.09, 10), 0x5aa9e6, { p: [0, 0.13, 0] });
      mb.add(cyl(0.06, 0.11, 0.06, 10), 0xffffff, { p: [0, 0.29, 0] });
      mb.add(cyl(0.065, 0.065, 0.05, 10), 0x3b82c4, { p: [0, 0.34, 0] });
      break;
    case 'wheat':
      mb.add(cyl(0.11, 0.11, 0.46, 8), 0xf2cf63, { p: [0, 0.11, 0], r: [0, 0, Math.PI / 2] });
      mb.add(cyl(0.115, 0.115, 0.07, 8), 0xc0812c, { p: [0, 0.11, 0], r: [0, 0, Math.PI / 2] });
      for (const sx of [-1, 1]) mb.add(cone(0.13, 0.12, 8), 0xf7dc84, { p: [sx * 0.28, 0.11, 0], r: [0, 0, (-sx * Math.PI) / 2] });
      break;
    case 'egg':
      mb.add(box(0.44, 0.09, 0.3), 0xc9a27a, { p: [0, 0.045, 0] });
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 2; j++)
          mb.add(sph(0.065, 8, 6), j === 0 && i === 1 ? 0xfff2dc : 0xfffaf0, { p: [-0.13 + i * 0.13, 0.12, -0.07 + j * 0.14], s: [1, 1.25, 1] });
      break;
    case 'cheese':
      mb.add(cyl(0.21, 0.21, 0.15, 14), 0xffcf40, { p: [0, 0.075, 0] });
      mb.add(cyl(0.18, 0.18, 0.152, 14, ), 0xffd95e, { p: [0, 0.075, 0] });
      for (let i = 0; i < 4; i++) {
        const a = i * 1.7;
        mb.add(sph(0.025, 6, 4), 0xe6ad1c, { p: [Math.cos(a) * 0.205, 0.05 + (i % 2) * 0.05, Math.sin(a) * 0.205] });
      }
      break;
    case 'carrot':
      for (let i = 0; i < 3; i++) {
        const z = -0.1 + i * 0.1;
        mb.add(cone(0.06, 0.36, 8), 0xff8c2e, { p: [0.03, 0.07 + (i % 2) * 0.05, z], r: [0, 0, Math.PI / 2] });
        mb.add(cone(0.05, 0.14, 5), 0x5fb83c, { p: [-0.21, 0.07 + (i % 2) * 0.05, z], r: [0, 0, -Math.PI / 2] });
      }
      break;
    case 'apple':
      mb.add(box(0.44, 0.14, 0.32), C.woodL, { p: [0, 0.07, 0] });
      mb.add(box(0.46, 0.03, 0.34), C.woodD, { p: [0, 0.13, 0] });
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 2; j++)
          mb.add(sph(0.075, 8, 6), (i + j) % 2 ? 0xe63946 : 0xd62839, { p: [-0.13 + i * 0.13, 0.19, -0.07 + j * 0.14] });
      mb.add(box(0.015, 0.05, 0.015), 0x6b4226, { p: [0, 0.28, 0.07] });
      break;
    case 'juice':
      mb.add(box(0.22, 0.26, 0.22), 0xff9f1c, { p: [0, 0.13, 0] });
      mb.add(prism(0.22, 0.06, 0.22), 0xffffff, { p: [0, 0.26, 0], r: [0, Math.PI / 2, 0] });
      mb.add(box(0.225, 0.1, 0.225), 0xffffff, { p: [0, 0.13, 0] });
      mb.add(sph(0.045, 8, 6), 0x7bc043, { p: [0, 0.14, 0.11] });
      break;
    case 'wool':
      mb.add(ico(0.15, 1), 0xf5f0e6, { p: [0, 0.14, 0], flat: true });
      mb.add(ico(0.1, 1), 0xffffff, { p: [0.11, 0.12, 0.04], flat: true });
      mb.add(ico(0.1, 1), 0xece4d6, { p: [-0.1, 0.13, -0.04], flat: true });
      break;
    case 'sweater':
      mb.add(box(0.46, 0.13, 0.34), 0xd64550, { p: [0, 0.065, 0] });
      mb.add(box(0.47, 0.03, 0.35), 0xffffff, { p: [0, 0.06, 0] });
      mb.add(box(0.12, 0.135, 0.12), 0xffffff, { p: [0, 0.07, 0.12] });
      break;
    case 'flour':
      mb.add(sph(0.18, 10, 8), 0xf1e3c6, { p: [0, 0.13, 0], s: [1.1, 0.75, 0.9] });
      mb.add(cyl(0.05, 0.1, 0.1, 8), 0xf1e3c6, { p: [0, 0.24, 0] });
      mb.add(cyl(0.055, 0.055, 0.03, 8), 0xb07a4a, { p: [0, 0.24, 0] });
      mb.add(box(0.12, 0.08, 0.01), 0x7fb3d5, { p: [0, 0.13, 0.16] });
      break;
    case 'bread':
      mb.add(sph(0.2, 12, 8), 0xd08a3e, { p: [0, 0.08, 0], s: [1.25, 0.55, 0.75] });
      for (let i = -1; i <= 1; i++) mb.add(box(0.03, 0.03, 0.18), 0xf2c27e, { p: [i * 0.1, 0.18, 0], r: [0, 0.4, 0] });
      break;
    case 'honey':
      mb.add(cyl(0.12, 0.12, 0.2, 10), 0xffb627, { p: [0, 0.1, 0] });
      mb.add(cyl(0.13, 0.13, 0.05, 10), 0xc8102e, { p: [0, 0.225, 0] });
      mb.add(cyl(0.14, 0.12, 0.03, 10), 0xffffff, { p: [0, 0.255, 0] });
      mb.add(box(0.12, 0.08, 0.02), 0xfff3d1, { p: [0, 0.1, 0.115] });
      break;
    case 'coin':
      mb.add(cyl(0.17, 0.17, 0.06, 12), C.gold, { p: [0, 0.03, 0] });
      mb.add(cyl(0.12, 0.12, 0.065, 12), C.goldD, { p: [0, 0.03, 0] });
      break;
  }
  const g = mb.build();
  itemCache.set(id, g);
  return g;
}

// ---------------------------------------------------------------- humans
export interface HumanOpts {
  shirt: number;
  pants: number;
  skin?: number;
  hair: number;
  hairStyle: 'braids' | 'short' | 'bun' | 'bald';
  hat?: 'straw' | 'cap' | 'flowers' | 'hood' | 'kokoshnik' | 'none';
  hatColor?: number;
  ribbon?: number;
  dress?: boolean;
  basket?: boolean;
  beard?: number;
  glasses?: boolean;
  scale?: number;
}

export interface Human {
  root: THREE.Group;
  body: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  stackAnchor: THREE.Object3D;
  phase: number;
}

export function buildHuman(o: HumanOpts): Human {
  const skin = o.skin ?? C.skin;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const legs: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.11, 0.6, 0);
    const mb = new MB();
    mb.add(cyl(0.085, 0.08, 0.5, 8), o.dress ? skin : o.pants, { p: [0, -0.27, 0] });
    mb.add(box(0.17, 0.1, 0.26), 0x6b4a2f, { p: [0, -0.56, 0.04] });
    const m = mb.mesh();
    pivot.add(m);
    body.add(pivot);
    legs.push(pivot);
  }

  const torso = new MB();
  if (o.dress) {
    torso.add(cyl(0.17, 0.36, 0.55, 12), o.pants, { p: [0, 0.68, 0] });
    torso.add(cyl(0.17, 0.2, 0.3, 12), o.shirt, { p: [0, 1.0, 0] });
    torso.add(cyl(0.37, 0.37, 0.05, 12), o.ribbon ?? 0xffffff, { p: [0, 0.43, 0] });
  } else {
    torso.add(cyl(0.18, 0.21, 0.46, 12), o.shirt, { p: [0, 0.92, 0] });
    torso.add(cyl(0.2, 0.2, 0.26, 12), o.pants, { p: [0, 0.68, 0] });
    torso.add(box(0.3, 0.24, 0.05), o.pants, { p: [0, 0.88, 0.17] });
    torso.add(box(0.05, 0.3, 0.05), o.pants, { p: [-0.12, 1.02, 0.15], r: [0.15, 0, 0] });
    torso.add(box(0.05, 0.3, 0.05), o.pants, { p: [0.12, 1.02, 0.15], r: [0.15, 0, 0] });
    torso.add(sph(0.025, 6, 4), C.gold, { p: [-0.12, 0.97, 0.2] });
    torso.add(sph(0.025, 6, 4), C.gold, { p: [0.12, 0.97, 0.2] });
  }
  // Head
  torso.add(cyl(0.07, 0.08, 0.1, 8), skin, { p: [0, 1.17, 0] });
  torso.add(sph(0.27, 16, 12), skin, { p: [0, 1.4, 0] });
  for (const sx of [-1, 1]) {
    torso.add(sph(0.038, 8, 6), C.eye, { p: [sx * 0.095, 1.41, 0.235] , s: [1, 1.25, 0.6]});
    torso.add(sph(0.013, 6, 4), 0xffffff, { p: [sx * 0.095 + 0.012, 1.43, 0.258] });
    torso.add(sph(0.045, 8, 6), C.blush, { p: [sx * 0.16, 1.33, 0.2], s: [1, 0.6, 0.4] });
    torso.add(sph(0.05, 8, 6), skin, { p: [sx * 0.27, 1.39, 0] });
  }
  torso.add(sph(0.03, 8, 6), 0xffb894, { p: [0, 1.36, 0.27] });
  torso.add(box(0.08, 0.018, 0.02), 0xc0504d, { p: [0, 1.29, 0.25] });

  if (o.hairStyle !== 'bald') {
    torso.add(sph(0.29, 16, 12, ), o.hair, { p: [0, 1.45, -0.04], s: [1, 0.95, 1] });
    torso.add(sph(0.2, 12, 8), o.hair, { p: [0, 1.58, 0.16], s: [1.25, 0.42, 0.7], r: [0.3, 0, 0] });
  }
  if (o.hairStyle === 'braids') {
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        torso.add(sph(0.075 - i * 0.008, 8, 6), o.hair, { p: [sx * (0.25 + i * 0.015), 1.32 - i * 0.12, -0.08] });
      }
      torso.add(sph(0.05, 8, 6), o.ribbon ?? 0xe8505b, { p: [sx * 0.31, 0.88, -0.08], s: [1.4, 0.8, 1] });
    }
  } else if (o.hairStyle === 'bun') {
    torso.add(sph(0.14, 10, 8), o.hair, { p: [0, 1.66, -0.15] });
  }
  if (o.beard !== undefined) {
    torso.add(sph(0.2, 10, 8), o.beard, { p: [0, 1.25, 0.12], s: [1.1, 1, 0.8] });
    torso.add(box(0.2, 0.05, 0.05), o.beard, { p: [0, 1.32, 0.27] });
  }
  if (o.glasses) {
    for (const sx of [-1, 1]) torso.add(torus(0.06, 0.012, 4, 12), 0x333333, { p: [sx * 0.095, 1.41, 0.26] });
  }

  const hat = o.hat ?? 'none';
  const hc = o.hatColor ?? 0xf3d27a;
  if (hat === 'straw') {
    torso.add(cyl(0.48, 0.5, 0.035, 18), hc, { p: [0, 1.62, 0], r: [0.08, 0, 0] });
    torso.add(cyl(0.22, 0.25, 0.2, 14), hc, { p: [0, 1.73, -0.01] });
    torso.add(cyl(0.255, 0.255, 0.06, 14), o.ribbon ?? 0xe8505b, { p: [0, 1.66, -0.01] });
  } else if (hat === 'cap') {
    torso.add(sph(0.29, 14, 8, ), hc, { p: [0, 1.53, -0.02], s: [1, 0.75, 1] });
    torso.add(box(0.36, 0.04, 0.24), hc, { p: [0, 1.56, 0.27] });
    torso.add(sph(0.04, 6, 4), 0xffffff, { p: [0, 1.75, -0.02] });
  } else if (hat === 'flowers') {
    torso.add(torus(0.25, 0.04, 6, 16), hc, { p: [0, 1.62, -0.02], r: [Math.PI / 2 - 0.1, 0, 0] });
    const cols = [0xff6b9a, 0xffd166, 0xffffff, 0x9b5de5, 0xff8c42];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      torso.add(sph(0.06, 8, 6), cols[i % cols.length], { p: [Math.cos(a) * 0.25, 1.64, Math.sin(a) * 0.25 - 0.02] });
    }
  } else if (hat === 'hood') {
    torso.add(sph(0.33, 14, 10, ), hc, { p: [0, 1.46, -0.07], s: [1, 1, 1] });
    torso.add(torus(0.27, 0.05, 6, 16), hc, { p: [0, 1.42, 0.13] });
  } else if (hat === 'kokoshnik') {
    const s = new THREE.Shape();
    s.absarc(0, 0, 0.36, 0, Math.PI, false);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false });
    torso.add(g, hc, { p: [0, 1.5, 0.02] });
    for (let i = 0; i < 5; i++) {
      const a = 0.35 + i * 0.6;
      torso.add(sph(0.035, 6, 4), o.ribbon ?? C.gold, { p: [Math.cos(a) * 0.28, 1.5 + Math.sin(a) * 0.28, 0.09] });
    }
  }

  if (o.basket) {
    torso.add(cyl(0.24, 0.2, 0.32, 10), 0xc98d4a, { p: [0, 0.92, -0.33] });
    torso.add(torus(0.24, 0.025, 4, 14), 0x9a6330, { p: [0, 1.08, -0.33], r: [Math.PI / 2, 0, 0] });
  }

  const torsoMesh = torso.mesh();
  body.add(torsoMesh);

  const arms: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * (o.dress ? 0.22 : 0.24), 1.08, 0);
    const mb = new MB();
    mb.add(cyl(0.065, 0.06, 0.38, 8), o.shirt, { p: [0, -0.19, 0] });
    mb.add(sph(0.07, 8, 6), skin, { p: [0, -0.41, 0] });
    pivot.add(mb.mesh());
    pivot.rotation.z = sx * 0.12;
    body.add(pivot);
    arms.push(pivot);
  }

  const stackAnchor = new THREE.Object3D();
  stackAnchor.position.set(0, 1.0, -0.36);
  body.add(stackAnchor);

  if (o.scale) root.scale.setScalar(o.scale);
  return { root, body, armL: arms[0], armR: arms[1], legL: legs[0], legR: legs[1], stackAnchor, phase: Math.random() * 10 };
}

export function animateHuman(h: Human, dt: number, moving: number, carrying = false) {
  h.phase += dt * (moving > 0.05 ? 10 * Math.min(1.4, 0.6 + moving) : 2);
  const sw = moving > 0.05 ? Math.sin(h.phase) * 0.7 : 0;
  h.legL.rotation.x = sw;
  h.legR.rotation.x = -sw;
  if (carrying) {
    h.armL.rotation.x = -0.5 + sw * 0.15;
    h.armR.rotation.x = -0.5 - sw * 0.15;
  } else {
    h.armL.rotation.x = -sw * 0.8;
    h.armR.rotation.x = sw * 0.8;
  }
  h.body.position.y = moving > 0.05 ? Math.abs(Math.sin(h.phase)) * 0.06 : Math.sin(h.phase) * 0.008;
}

export function skinHumanOpts(s: SkinDef): HumanOpts {
  return {
    shirt: s.shirt,
    pants: s.pants,
    hair: s.hair,
    hairStyle: 'braids',
    hat: s.hat,
    hatColor: s.hatColor,
    ribbon: s.ribbon,
    dress: s.dress,
    basket: true,
  };
}

// ---------------------------------------------------------------- animals
export interface Animal {
  root: THREE.Group;
  body: THREE.Object3D;
  legs: THREE.Object3D[];
  head?: THREE.Object3D;
  phase: number;
}

function legsFor(root: THREE.Group, positions: [number, number][], top: number, len: number, r: number, color: number, hoof?: number) {
  const legs: THREE.Object3D[] = [];
  for (const [x, z] of positions) {
    const pivot = new THREE.Group();
    pivot.position.set(x, top, z);
    const mb = new MB();
    mb.add(cyl(r, r * 0.9, len, 6), color, { p: [0, -len / 2, 0] });
    if (hoof !== undefined) mb.add(cyl(r * 1.05, r * 1.05, 0.07, 6), hoof, { p: [0, -len + 0.035, 0] });
    pivot.add(mb.mesh());
    root.add(pivot);
    legs.push(pivot);
  }
  return legs;
}

export function buildCow(): Animal {
  const root = new THREE.Group();
  const mb = new MB();
  mb.add(box(0.72, 0.58, 1.12), 0xffffff, { p: [0, 0.78, 0] });
  mb.add(box(0.74, 0.3, 0.36), 0x2b2b2b, { p: [0, 0.86, 0.15] });
  mb.add(box(0.74, 0.25, 0.3), 0x2b2b2b, { p: [0.02, 0.72, -0.33] });
  mb.add(box(0.3, 0.6, 0.3), 0x2b2b2b, { p: [-0.22, 0.785, -0.05], s: [1, 0.98, 1] });
  mb.add(sph(0.15, 8, 6), 0xffb3c1, { p: [0, 0.48, -0.2], s: [1, 0.7, 1] });
  mb.add(cyl(0.025, 0.02, 0.5, 5), 0xffffff, { p: [0, 0.7, -0.6], r: [0.3, 0, 0] });
  mb.add(sph(0.06, 6, 4), 0x2b2b2b, { p: [0, 0.46, -0.68] });
  const body = mb.mesh();
  root.add(body);
  const head = new THREE.Group();
  head.position.set(0, 1.0, 0.6);
  const hb = new MB();
  hb.add(box(0.44, 0.42, 0.42), 0xffffff, { p: [0, 0, 0.08] });
  hb.add(box(0.46, 0.22, 0.2), 0xffb3c1, { p: [0, -0.1, 0.3] });
  hb.add(sph(0.025, 6, 4), 0x8a4b5c, { p: [-0.08, -0.08, 0.41] });
  hb.add(sph(0.025, 6, 4), 0x8a4b5c, { p: [0.08, -0.08, 0.41] });
  for (const sx of [-1, 1]) {
    hb.add(sph(0.045, 8, 6), C.eye, { p: [sx * 0.13, 0.07, 0.28] });
    hb.add(sph(0.014, 6, 4), 0xffffff, { p: [sx * 0.13 + 0.01, 0.09, 0.32] });
    hb.add(cone(0.045, 0.16, 6), 0xfff1c9, { p: [sx * 0.16, 0.27, 0.05], r: [0, 0, -sx * 0.4] });
    hb.add(box(0.18, 0.08, 0.1), 0xffffff, { p: [sx * 0.29, 0.12, 0.02], r: [0, 0, sx * 0.3] });
  }
  hb.add(box(0.2, 0.12, 0.08), 0x2b2b2b, { p: [0.1, 0.18, 0.27] });
  head.add(hb.mesh());
  root.add(head);
  const legs = legsFor(root, [[-0.24, 0.38], [0.24, 0.38], [-0.24, -0.38], [0.24, -0.38]], 0.55, 0.52, 0.085, 0xffffff, 0x4a3a30);
  return { root, body, legs, head, phase: Math.random() * 10 };
}

export function buildChicken(): Animal {
  const root = new THREE.Group();
  const mb = new MB();
  mb.add(sph(0.22, 10, 8), 0xffffff, { p: [0, 0.34, 0], s: [0.95, 0.9, 1.15] });
  mb.add(cone(0.12, 0.24, 6), 0xf4f1ea, { p: [0, 0.48, -0.22], r: [-0.9, 0, 0] });
  for (const sx of [-1, 1]) mb.add(sph(0.1, 8, 6), 0xf0ebe0, { p: [sx * 0.19, 0.35, -0.02], s: [0.4, 0.8, 1.2] });
  const body = mb.mesh();
  root.add(body);
  const head = new THREE.Group();
  head.position.set(0, 0.55, 0.18);
  const hb = new MB();
  hb.add(sph(0.12, 10, 8), 0xffffff, { p: [0, 0.03, 0] });
  hb.add(cone(0.04, 0.1, 6), 0xffa62b, { p: [0, 0.01, 0.15], r: [Math.PI / 2, 0, 0] });
  hb.add(box(0.03, 0.08, 0.12), 0xe63946, { p: [0, 0.16, 0.0] });
  hb.add(sph(0.03, 6, 4), 0xe63946, { p: [0, -0.06, 0.1] });
  for (const sx of [-1, 1]) hb.add(sph(0.022, 6, 4), C.eye, { p: [sx * 0.08, 0.05, 0.08] });
  head.add(hb.mesh());
  root.add(head);
  const legs = legsFor(root, [[-0.07, 0], [0.07, 0]], 0.18, 0.18, 0.022, 0xffa62b);
  return { root, body, legs, head, phase: Math.random() * 10 };
}

export function buildSheep(): Animal {
  const root = new THREE.Group();
  const mb = new MB();
  const pts: [number, number, number, number][] = [
    [0, 0.72, 0, 0.36],
    [0.18, 0.75, 0.22, 0.26],
    [-0.18, 0.75, 0.22, 0.26],
    [0.18, 0.75, -0.22, 0.26],
    [-0.18, 0.75, -0.22, 0.26],
    [0, 0.92, 0.05, 0.25],
    [0, 0.68, -0.34, 0.24],
  ];
  pts.forEach(([x, y, z, r], i) => mb.add(ico(r, 1), i % 2 ? 0xfdfaf2 : 0xf3ede0, { p: [x, y, z], flat: true }));
  const body = mb.mesh();
  root.add(body);
  const head = new THREE.Group();
  head.position.set(0, 0.85, 0.42);
  const hb = new MB();
  hb.add(sph(0.17, 10, 8), 0x4a4a4a, { p: [0, 0, 0.08], s: [0.9, 1, 1.1] });
  hb.add(ico(0.12, 1), 0xffffff, { p: [0, 0.14, 0.02], flat: true });
  for (const sx of [-1, 1]) {
    hb.add(box(0.16, 0.06, 0.08), 0x3a3a3a, { p: [sx * 0.18, 0.04, 0.02], r: [0, 0, sx * 0.4] });
    hb.add(sph(0.03, 6, 4), 0xffffff, { p: [sx * 0.07, 0.05, 0.2] });
    hb.add(sph(0.018, 6, 4), C.eye, { p: [sx * 0.07, 0.05, 0.225] });
  }
  head.add(hb.mesh());
  root.add(head);
  const legs = legsFor(root, [[-0.18, 0.2], [0.18, 0.2], [-0.18, -0.2], [0.18, -0.2]], 0.45, 0.45, 0.06, 0x3a3a3a);
  return { root, body, legs, head, phase: Math.random() * 10 };
}

export function buildCat(): Animal {
  const root = new THREE.Group();
  const mb = new MB();
  const orange = 0xf39c4a;
  mb.add(capsule(0.14, 0.32), orange, { p: [0, 0.3, 0], r: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 3; i++) mb.add(box(0.3, 0.04, 0.05), 0xd9782a, { p: [0, 0.43, -0.12 + i * 0.12] });
  mb.add(sph(0.11, 8, 6), 0xfff3e6, { p: [0, 0.26, 0.17], s: [1, 1, 0.8] });
  for (let i = 0; i < 4; i++) mb.add(sph(0.05, 6, 4), orange, { p: [0, 0.35 + i * 0.07, -0.28 - Math.sin(i * 0.6) * 0.08] });
  const body = mb.mesh();
  root.add(body);
  const head = new THREE.Group();
  head.position.set(0, 0.5, 0.24);
  const hb = new MB();
  hb.add(sph(0.16, 12, 10), orange, {});
  for (const sx of [-1, 1]) {
    hb.add(cone(0.06, 0.12, 4), orange, { p: [sx * 0.09, 0.15, -0.02], r: [0, 0, -sx * 0.3] });
    hb.add(sph(0.03, 6, 4), 0x2c3e1f, { p: [sx * 0.06, 0.03, 0.135], s: [1, 1.3, 0.6] });
  }
  hb.add(sph(0.06, 8, 6), 0xfff3e6, { p: [0, -0.04, 0.12], s: [1.3, 0.8, 0.7] });
  hb.add(sph(0.02, 6, 4), 0xff7f9f, { p: [0, -0.01, 0.16] });
  head.add(hb.mesh());
  root.add(head);
  const legs = legsFor(root, [[-0.08, 0.13], [0.08, 0.13], [-0.08, -0.13], [0.08, -0.13]], 0.2, 0.2, 0.04, orange);
  return { root, body, legs, head, phase: Math.random() * 10 };
}

export function animateAnimal(a: Animal, dt: number, moving: number, eating = false) {
  a.phase += dt * (moving > 0.05 ? 9 : 1.5);
  const sw = moving > 0.05 ? Math.sin(a.phase) * 0.5 : 0;
  a.legs.forEach((l, i) => (l.rotation.x = (i % 2 === (i < 2 ? 0 : 1) ? 1 : -1) * sw));
  if (a.head) {
    a.head.rotation.x = eating ? 0.5 + Math.sin(a.phase * 3) * 0.1 : Math.sin(a.phase * 0.7) * 0.06;
  }
  a.body.position.y = moving > 0.05 ? Math.abs(Math.sin(a.phase)) * 0.03 : 0;
}

export function buildBee(): THREE.Mesh {
  const mb = new MB();
  mb.add(sph(0.07, 8, 6), 0xffc531, { s: [1, 0.9, 1.3] });
  mb.add(box(0.145, 0.03, 0.03), 0x222222, { p: [0, 0, 0.02] });
  mb.add(box(0.145, 0.03, 0.03), 0x222222, { p: [0, 0, -0.04] });
  mb.add(box(0.12, 0.01, 0.06), 0xeaf6ff, { p: [0.06, 0.06, 0], r: [0, 0, 0.4] });
  mb.add(box(0.12, 0.01, 0.06), 0xeaf6ff, { p: [-0.06, 0.06, 0], r: [0, 0, -0.4] });
  return mb.mesh(false);
}

// ---------------------------------------------------------------- buildings
export interface BuildingModel {
  mesh: THREE.Object3D;
  spin?: THREE.Object3D;
  smoke?: THREE.Vector3;
}

export function buildBuilding(kind: BuildingKind, w: number, d: number): BuildingModel {
  const mb = new MB();
  const g = new THREE.Group();
  let spin: THREE.Object3D | undefined;
  let smoke: THREE.Vector3 | undefined;
  switch (kind) {
    case 'barn': {
      const bw = 3.4;
      const bd = 2.2;
      mb.add(box(bw, 2.0, bd), 0xc8463d, { p: [0, 1.0, 0] });
      mb.add(box(bw + 0.08, 0.12, bd + 0.08), C.white, { p: [0, 2.0, 0] });
      gableRoofX(mb, bw, bd, 2.0, 1.1, 0x7a4b3a, 0xc8463d, 0.25);
      mb.add(box(1.3, 1.5, 0.08), 0x9e322b, { p: [0, 0.75, bd / 2 + 0.02] });
      mb.add(box(1.4, 0.1, 0.1), C.white, { p: [0, 1.5, bd / 2 + 0.05] });
      mb.add(box(0.1, 1.5, 0.1), C.white, { p: [-0.65, 0.75, bd / 2 + 0.05] });
      mb.add(box(0.1, 1.5, 0.1), C.white, { p: [0.65, 0.75, bd / 2 + 0.05] });
      mb.add(box(1.85, 0.08, 0.1), C.white, { p: [0, 0.75, bd / 2 + 0.06], r: [0, 0, 0.86] });
      mb.add(box(1.85, 0.08, 0.1), C.white, { p: [0, 0.75, bd / 2 + 0.06], r: [0, 0, -0.86] });
      mb.add(box(0.6, 0.5, 0.08), 0xfff3d0, { p: [0, 2.45, bd / 2 + 0.02] });
      mb.add(box(0.5, 0.4, 0.09), 0xf2cf63, { p: [0, 2.42, bd / 2 + 0.03] });
      for (const sx of [-1, 1]) {
        mb.add(cyl(0.45, 0.45, 0.6, 10), C.hay, { p: [sx * 2.1, 0.3, 0.5], r: [Math.PI / 2, 0, 0] });
      }
      break;
    }
    case 'coop': {
      mb.add(box(2.0, 1.2, 1.4), 0xf2c57c, { p: [0, 1.0, 0] });
      for (let i = 0; i < 4; i++) mb.add(box(0.12, 0.4, 0.12), C.woodD, { p: [i < 2 ? -0.85 : 0.85, 0.2, i % 2 ? -0.55 : 0.55] });
      gableRoofX(mb, 2.0, 1.4, 1.6, 0.7, 0xd9534f, 0xf2c57c, 0.2);
      mb.add(box(0.5, 0.6, 0.06), 0x8a5a33, { p: [0.4, 0.9, 0.72] });
      mb.add(box(0.5, 0.06, 1.0), C.woodL, { p: [0.4, 0.3, 1.1], r: [0.5, 0, 0] });
      windowPane(mb, -0.45, 1.05, 0.71, 0.4, 0.35);
      break;
    }
    case 'shed': {
      mb.add(box(2.6, 1.6, 1.6), 0xc49a6c, { p: [0, 0.8, 0] });
      for (let i = 0; i < 6; i++) mb.add(box(0.04, 1.6, 1.62), 0xa77d50, { p: [-1.1 + i * 0.44, 0.8, 0] });
      gableRoofX(mb, 2.6, 1.6, 1.6, 0.8, 0x4f7cac, 0xc49a6c, 0.22);
      mb.add(box(0.9, 1.2, 0.06), 0x7a5230, { p: [0, 0.6, 0.82] });
      break;
    }
    case 'creamery': {
      mb.add(box(w - 0.6, 2.0, d - 1.2), 0xfdf6e8, { p: [0, 1.0, -0.4] });
      mb.add(box(w - 0.5, 0.25, d - 1.1), 0xd7c4a3, { p: [0, 0.12, -0.4] });
      gableRoofX(mb, w - 0.6, d - 1.2, 2.0, 1.0, 0x4f86c6, 0xfdf6e8, 0.3);
      mb.add(box(0.8, 1.3, 0.06), 0x6a8caf, { p: [0, 0.65, d / 2 - 0.98] });
      windowPane(mb, -1.25, 1.2, d / 2 - 0.98, 0.55, 0.55);
      windowPane(mb, 1.25, 1.2, d / 2 - 0.98, 0.55, 0.55);
      mb.add(cyl(0.5, 0.5, 0.25, 16), 0xffcf40, { p: [0, 2.55, d / 2 - 0.9], r: [Math.PI / 2, 0, 0] });
      mb.add(box(0.5, 0.8, 0.5), 0xd7c4a3, { p: [1.3, 3.0, -0.8] });
      smoke = new THREE.Vector3(1.3, 3.5, -0.8);
      mb.add(cyl(0.3, 0.3, 0.7, 12), 0xdfe6ed, { p: [-w / 2 + 0.5, 0.35, d / 2 - 0.6] });
      mb.add(cyl(0.32, 0.32, 0.08, 12), 0x9fb3c8, { p: [-w / 2 + 0.5, 0.72, d / 2 - 0.6] });
      break;
    }
    case 'loom': {
      mb.add(box(w - 0.6, 2.0, d - 1.2), 0xe9dcf5, { p: [0, 1.0, -0.4] });
      gableRoofX(mb, w - 0.6, d - 1.2, 2.0, 1.0, 0x8a5fc7, 0xe9dcf5, 0.3);
      mb.add(box(0.8, 1.3, 0.06), 0x7a5230, { p: [0, 0.65, d / 2 - 0.98] });
      windowPane(mb, -1.25, 1.2, d / 2 - 0.98, 0.6, 0.6);
      windowPane(mb, 1.25, 1.2, d / 2 - 0.98, 0.6, 0.6);
      const cols = [0xff6b9a, 0x4aa8e8, 0xffd166];
      cols.forEach((c, i) => {
        mb.add(cyl(0.22, 0.22, 0.32, 12), c, { p: [-0.6 + i * 0.6, 2.55, d / 2 - 0.92], r: [Math.PI / 2, 0, 0] });
      });
      break;
    }
    case 'press': {
      mb.add(box(w - 1.0, 1.8, d - 1.4), 0xc68b59, { p: [0, 0.9, -0.5] });
      for (let i = 0; i < 6; i++) mb.add(box(0.05, 1.8, d - 1.38), 0xa87043, { p: [-1.5 + i * 0.6, 0.9, -0.5] });
      gableRoofX(mb, w - 1.0, d - 1.4, 1.8, 0.9, 0x6d8a3d, 0xc68b59, 0.3);
      for (let i = 0; i < 6; i++) {
        mb.add(box((w - 0.8) / 6, 0.08, 0.9), i % 2 ? 0xffffff : 0xff9f43, { p: [-(w - 0.8) / 2 + (w - 0.8) / 12 + (i * (w - 0.8)) / 6, 1.7, d / 2 - 1.1], r: [0.35, 0, 0] });
      }
      mb.add(cyl(0.35, 0.38, 0.8, 12), 0x9b6a3c, { p: [-w / 2 + 0.6, 0.4, d / 2 - 0.7] });
      mb.add(torus(0.37, 0.03, 4, 14), 0x555555, { p: [-w / 2 + 0.6, 0.6, d / 2 - 0.7], r: [Math.PI / 2, 0, 0] });
      mb.add(torus(0.37, 0.03, 4, 14), 0x555555, { p: [-w / 2 + 0.6, 0.2, d / 2 - 0.7], r: [Math.PI / 2, 0, 0] });
      mb.add(sph(0.4, 10, 8), 0xff9f1c, { p: [0, 2.85, -0.5 + (d - 1.4) / 2 - 0.2] });
      break;
    }
    case 'mill': {
      mb.add(cyl(1.0, 1.35, 3.2, 10), 0xe9e0cf, { p: [0, 1.6, -0.5] });
      mb.add(cone(1.25, 1.4, 10), 0xb5443b, { p: [0, 3.9, -0.5] });
      mb.add(box(0.8, 1.2, 0.1), 0x7a5230, { p: [0, 0.6, 0.78] });
      windowPane(mb, 0, 2.2, 0.62, 0.4, 0.4);
      mb.add(cyl(0.12, 0.12, 0.6, 8), C.woodD, { p: [0, 3.0, 0.65], r: [Math.PI / 2, 0, 0] });
      const blades = new MB();
      blades.add(cyl(0.18, 0.18, 0.2, 10), C.woodD, { r: [Math.PI / 2, 0, 0] });
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        blades.add(box(0.12, 2.2, 0.06), C.woodD, { p: [Math.sin(a) * 1.1, Math.cos(a) * 1.1, 0], r: [0, 0, -a] });
        blades.add(box(0.5, 1.6, 0.03), 0xfffaf0, { p: [Math.sin(a) * 1.3 + Math.cos(a) * 0.3, Math.cos(a) * 1.3 - Math.sin(a) * 0.3, 0.03], r: [0, 0, -a] });
      }
      spin = blades.mesh();
      spin.position.set(0, 3.0, 0.98);
      g.add(spin);
      for (let i = 0; i < 3; i++) mb.add(sph(0.22, 8, 6), 0xf1e3c6, { p: [1.6, 0.2, 0.2 + i * 0.45], s: [1, 0.8, 0.9] });
      break;
    }
    case 'bakery': {
      mb.add(box(w - 0.6, 2.0, d - 1.2), 0xe8a87c, { p: [0, 1.0, -0.4] });
      for (let i = 0; i < 5; i++) mb.add(box(w - 0.58, 0.04, d - 1.18), 0xd18b62, { p: [0, 0.3 + i * 0.38, -0.4] });
      gableRoofX(mb, w - 0.6, d - 1.2, 2.0, 1.0, 0x8b4a2b, 0xe8a87c, 0.3);
      mb.add(box(0.8, 1.3, 0.06), 0x6b3a1f, { p: [0, 0.65, d / 2 - 0.98] });
      windowPane(mb, -1.25, 1.2, d / 2 - 0.98, 0.6, 0.5);
      windowPane(mb, 1.25, 1.2, d / 2 - 0.98, 0.6, 0.5);
      mb.add(box(0.55, 1.2, 0.55), 0xa0522d, { p: [-1.2, 3.0, -0.9] });
      smoke = new THREE.Vector3(-1.2, 3.7, -0.9);
      mb.add(sph(0.35, 10, 8), 0xd08a3e, { p: [0, 2.6, d / 2 - 0.9], s: [1.4, 0.7, 0.6] });
      break;
    }
    case 'hives': {
      mb.add(box(w - 0.4, 0.15, 1.4), C.woodD, { p: [0, 0.08, -0.6] });
      break;
    }
  }
  const m = mb.mesh(true, true);
  g.add(m);
  return { mesh: g, spin, smoke };
}

export function buildHive(): THREE.Mesh {
  const mb = new MB();
  mb.add(box(0.9, 0.35, 0.8), 0xfff1c9, { p: [0, 0.35, 0] });
  mb.add(box(0.9, 0.35, 0.8), 0xffd166, { p: [0, 0.7, 0] });
  mb.add(box(0.9, 0.3, 0.8), 0xfff1c9, { p: [0, 1.02, 0] });
  mb.add(box(1.05, 0.08, 0.95), 0xb5443b, { p: [0, 1.2, 0] });
  mb.add(box(0.3, 0.06, 0.05), 0x3a2a1a, { p: [0, 0.25, 0.41] });
  for (let i = 0; i < 4; i++) mb.add(box(0.08, 0.2, 0.08), C.woodD, { p: [i < 2 ? -0.35 : 0.35, 0.1, i % 2 ? -0.3 : 0.3] });
  return mb.mesh();
}

export function buildHouse(): THREE.Object3D {
  const mb = new MB();
  mb.add(box(4.2, 0.3, 3.4), 0xb9a58a, { p: [0, 0.15, 0] });
  mb.add(box(4.0, 2.2, 3.2), 0xffe0c2, { p: [0, 1.4, 0] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mb.add(box(0.2, 2.2, 0.2), 0xb07a4a, { p: [sx * 1.95, 1.4, sz * 1.55] });
  gableRoofX(mb, 4.0, 3.2, 2.5, 1.4, 0xd9534f, 0xffe0c2, 0.35);
  mb.add(box(0.9, 1.5, 0.08), 0x8a5a33, { p: [0, 1.05, 1.62] });
  mb.add(sph(0.05, 6, 4), C.gold, { p: [0.3, 1.05, 1.68] });
  for (const sx of [-1, 1]) {
    windowPane(mb, sx * 1.25, 1.6, 1.62, 0.7, 0.6);
    mb.add(box(0.8, 0.18, 0.25), 0x8a5a33, { p: [sx * 1.25, 1.18, 1.75] });
    for (let i = 0; i < 4; i++) mb.add(sph(0.08, 6, 4), [0xff6b9a, 0xffd166, 0xff8c42, 0x9b5de5][i], { p: [sx * 1.25 - 0.27 + i * 0.18, 1.32, 1.78] });
  }
  mb.add(box(0.6, 1.4, 0.6), 0xa0522d, { p: [1.2, 3.6, -0.5] });
  mb.add(box(1.6, 0.12, 1.0), 0xc9a27a, { p: [0, 0.36, 2.2] });
  mb.add(box(1.8, 0.1, 1.2), 0xb5443b, { p: [0, 2.35, 2.25], r: [0.25, 0, 0] });
  for (const sx of [-1, 1]) mb.add(box(0.1, 2.0, 0.1), C.white, { p: [sx * 0.8, 1.35, 2.7] });
  return mb.mesh(true, true);
}

export function buildStall(awning: number): THREE.Object3D {
  const mb = new MB();
  mb.add(box(2.6, 0.9, 1.0), C.woodL, { p: [0, 0.45, 0] });
  mb.add(box(2.7, 0.08, 1.1), C.wood, { p: [0, 0.92, 0] });
  for (let i = 0; i < 5; i++) mb.add(box(0.04, 0.88, 1.02), C.wood, { p: [-1.2 + i * 0.6, 0.45, 0] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mb.add(box(0.1, 2.2, 0.1), C.woodD, { p: [sx * 1.25, 1.1, sz * 0.45] });
  for (let i = 0; i < 6; i++) {
    mb.add(box(0.47, 0.06, 1.5), i % 2 ? 0xffffff : awning, { p: [-1.18 + i * 0.47, 2.25, 0.15], r: [-0.22, 0, 0] });
  }
  for (let i = 0; i < 6; i++) mb.add(cone(0.24, 0.22, 3), i % 2 ? 0xffffff : awning, { p: [-1.18 + i * 0.47, 2.0, 0.88], r: [Math.PI, 0, 0] });
  return mb.mesh(true, true);
}

export function buildTrough(len = 1.6): THREE.Mesh {
  const mb = new MB();
  mb.add(box(len, 0.35, 0.7), C.wood, { p: [0, 0.25, 0] });
  mb.add(box(len - 0.12, 0.05, 0.58), 0x5a3a20, { p: [0, 0.41, 0] });
  for (const sx of [-1, 1]) mb.add(box(0.12, 0.2, 0.75), C.woodD, { p: [sx * (len / 2 - 0.1), 0.1, 0] });
  return mb.mesh(true, true);
}

export function buildPallet(w = 1.5, d = 1.2): THREE.Mesh {
  const mb = new MB();
  for (let i = 0; i < 5; i++) mb.add(box(w, 0.05, d / 6), C.woodL, { p: [0, 0.13, -d / 2 + d / 10 + (i * d) / 5] });
  for (const sx of [-1, 0, 1]) mb.add(box(0.14, 0.1, d), C.woodD, { p: [sx * (w / 2 - 0.08), 0.05, 0] });
  return mb.mesh(false, true);
}

export function buildBin(): THREE.Mesh {
  const mb = new MB();
  mb.add(cyl(0.42, 0.36, 0.85, 12), 0x5aaa4a, { p: [0, 0.43, 0] });
  mb.add(cyl(0.46, 0.46, 0.1, 12), 0x3f8a35, { p: [0, 0.9, 0] });
  mb.add(box(0.3, 0.06, 0.08), 0x3f8a35, { p: [0, 0.98, 0] });
  for (let i = 0; i < 3; i++) mb.add(box(0.05, 0.6, 0.02), 0x8fd27e, { p: [-0.15 + i * 0.15, 0.45, 0.39] });
  return mb.mesh(true, false);
}

export function fenceLine(mb: MB, x1: number, z1: number, x2: number, z2: number, color = 0xf5ead6, gap?: [number, number]) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  const n = Math.max(1, Math.round(len / 1.1));
  const ang = Math.atan2(dx, dz);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x1 + dx * t;
    const z = z1 + dz * t;
    mb.add(box(0.14, 0.75, 0.14), color, { p: [x, 0.375, z] });
    mb.add(cone(0.1, 0.12, 4), color, { p: [x, 0.81, z], r: [0, Math.PI / 4, 0] });
  }
  const segs: [number, number][] = gap ? [[0, gap[0]], [gap[1], 1]] : [[0, 1]];
  for (const [a, b] of segs) {
    if (b - a <= 0.01) continue;
    const l = len * (b - a);
    const cx = x1 + dx * ((a + b) / 2);
    const cz = z1 + dz * ((a + b) / 2);
    for (const y of [0.32, 0.6]) mb.add(box(0.06, 0.1, l), color, { p: [cx, y, cz], r: [0, ang, 0] });
  }
}

// ---------------------------------------------------------------- nature
export function addTree(mb: MB, x: number, z: number, s: number, variant: number, rnd: () => number) {
  if (variant === 0) {
    mb.add(cyl(0.14 * s, 0.2 * s, 1.2 * s, 6), 0x8a5a33, { p: [x, 0.6 * s, z] });
    const leaf = [0x6cc04a, 0x5db040, 0x7fd05a][Math.floor(rnd() * 3)];
    mb.add(ico(0.9 * s, 0), leaf, { p: [x, 1.6 * s, z], flat: true });
    mb.add(ico(0.65 * s, 0), 0x86d863, { p: [x + 0.35 * s, 2.0 * s, z + 0.1 * s], flat: true });
    mb.add(ico(0.55 * s, 0), leaf, { p: [x - 0.4 * s, 1.9 * s, z - 0.15 * s], flat: true });
  } else if (variant === 1) {
    mb.add(cyl(0.12 * s, 0.16 * s, 0.6 * s, 6), 0x7a4b2a, { p: [x, 0.3 * s, z] });
    mb.add(cone(0.85 * s, 1.3 * s, 7), 0x3f9a4f, { p: [x, 1.1 * s, z], flat: true });
    mb.add(cone(0.65 * s, 1.1 * s, 7), 0x4fae5e, { p: [x, 1.7 * s, z], flat: true });
    mb.add(cone(0.42 * s, 0.9 * s, 7), 0x5fbf6d, { p: [x, 2.25 * s, z], flat: true });
  } else {
    mb.add(cyl(0.12 * s, 0.17 * s, 1.0 * s, 6), 0x8a5a33, { p: [x, 0.5 * s, z] });
    mb.add(sph(0.85 * s, 7, 5), 0xf7a8c4, { p: [x, 1.55 * s, z], flat: true });
    mb.add(sph(0.5 * s, 7, 5), 0xffc2d6, { p: [x + 0.4 * s, 1.9 * s, z], flat: true });
  }
}

export function addBush(mb: MB, x: number, z: number, s: number, berries: boolean) {
  mb.add(ico(0.5 * s, 0), 0x5fb546, { p: [x, 0.35 * s, z], flat: true });
  mb.add(ico(0.38 * s, 0), 0x72c757, { p: [x + 0.35 * s, 0.3 * s, z + 0.1], flat: true });
  if (berries) for (let i = 0; i < 4; i++) mb.add(sph(0.06, 6, 4), 0xe63946, { p: [x - 0.2 + i * 0.15, 0.55 * s, z + 0.35 * s] });
}

export function addRock(mb: MB, x: number, z: number, s: number) {
  mb.add(ico(0.45 * s, 0), C.stone, { p: [x, 0.15 * s, z], s: [1.2, 0.7, 1], flat: true });
  mb.add(ico(0.25 * s, 0), C.stoneD, { p: [x + 0.4 * s, 0.08 * s, z + 0.2 * s], flat: true });
}

export function addFlower(mb: MB, x: number, z: number, color: number) {
  mb.add(cyl(0.015, 0.015, 0.3, 4), 0x4f9a3a, { p: [x, 0.15, z] });
  mb.add(sph(0.07, 6, 4), color, { p: [x, 0.32, z], s: [1, 0.6, 1] });
  mb.add(sph(0.03, 6, 4), 0xffe14d, { p: [x, 0.35, z] });
}

export function plotGeo(kind: 'grass' | 'tuft' | 'wheat' | 'carrot' | 'tree' | 'apples'): THREE.BufferGeometry {
  const mb = new MB();
  switch (kind) {
    case 'tuft':
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const r = i === 0 ? 0 : 0.28;
        mb.add(cone(0.13, 0.55 + (i % 3) * 0.12, 4), i % 2 ? 0x6cc24c : 0x5aae3e, {
          p: [Math.cos(a) * r, 0.28, Math.sin(a) * r],
          r: [Math.sin(a) * 0.2, 0, Math.cos(a) * 0.2],
          flat: true,
        });
      }
      break;
    case 'grass':
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2 + i;
        const r = i < 2 ? 0.08 : 0.32;
        const hgt = 0.7 + (i % 4) * 0.12;
        mb.add(cone(0.12, hgt, 4), i % 3 === 0 ? 0xb4ec6a : i % 3 === 1 ? 0x93dd55 : 0x7ccf46, {
          p: [Math.cos(a) * r, hgt / 2, Math.sin(a) * r],
          r: [Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3],
          flat: true,
        });
      }
      mb.add(sph(0.07, 6, 4), 0xffffff, { p: [0.18, 0.62, 0.1] });
      mb.add(sph(0.035, 6, 4), 0xffd23f, { p: [0.18, 0.67, 0.1] });
      mb.add(sph(0.06, 6, 4), 0xffe14d, { p: [-0.2, 0.55, -0.12] });
      break;
    case 'wheat':
      for (let i = 0; i < 6; i++) {
        const x = ((i % 3) - 1) * 0.22;
        const z = (Math.floor(i / 3) - 0.5) * 0.3;
        mb.add(cyl(0.018, 0.018, 0.6, 4), 0xd9b44a, { p: [x, 0.3, z] });
        mb.add(capsule(0.05, 0.16), 0xf2cf63, { p: [x, 0.7, z] });
      }
      break;
    case 'carrot':
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 0.25;
        mb.add(cone(0.07, 0.12, 6), 0xff8c2e, { p: [x, 0.06, 0], r: [Math.PI, 0, 0] });
        for (let j = 0; j < 3; j++) mb.add(cone(0.05, 0.3, 4), 0x5fb83c, { p: [x + (j - 1) * 0.04, 0.27, (j - 1) * 0.04], r: [(j - 1) * 0.3, 0, (j - 1) * 0.3] });
      }
      break;
    case 'tree':
      mb.add(cyl(0.16, 0.22, 1.3, 6), 0x8a5a33, { p: [0, 0.65, 0] });
      mb.add(ico(1.0, 1), 0x5fb546, { p: [0, 1.9, 0], flat: true });
      mb.add(ico(0.6, 0), 0x72c757, { p: [0.4, 2.4, 0.2], flat: true });
      break;
    case 'apples':
      for (let i = 0; i < 7; i++) {
        const a = i * 0.9;
        const y = 1.6 + (i % 3) * 0.35;
        const r = 0.95 - Math.abs(y - 1.9) * 0.4;
        mb.add(sph(0.13, 8, 6), 0xe63946, { p: [Math.cos(a) * r, y, Math.sin(a) * r] });
      }
      break;
  }
  return mb.build();
}

export function buildFair(): { mesh: THREE.Group; spins: { o: THREE.Object3D; axis: 'y' | 'z'; speed: number }[] } {
  const g = new THREE.Group();
  const spins: { o: THREE.Object3D; axis: 'y' | 'z'; speed: number }[] = [];
  const base = new MB();
  // Carousel base and canopy
  const cx = -2;
  base.add(cyl(2.0, 2.1, 0.3, 20), 0xfff1d6, { p: [cx, 0.15, 0] });
  base.add(cyl(2.12, 2.12, 0.12, 20), 0xd62839, { p: [cx, 0.3, 0] });
  base.add(cyl(0.15, 0.15, 3.2, 8), C.gold, { p: [cx, 1.7, 0] });
  g.add(base.mesh(true, true));
  const carousel = new THREE.Group();
  carousel.position.set(cx, 0, 0);
  const cm = new MB();
  const cols = [0xff6b9a, 0x4aa8e8, 0xffd166, 0x8bd36b, 0xc8a2ff, 0xff8c42];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const x = Math.cos(a) * 1.4;
    const z = Math.sin(a) * 1.4;
    cm.add(cyl(0.04, 0.04, 2.5, 6), C.gold, { p: [x, 1.6, z] });
    cm.add(box(0.25, 0.35, 0.7), cols[i], { p: [x, 0.95, z], r: [0, -a, 0] });
    cm.add(box(0.2, 0.3, 0.2), cols[i], { p: [x + Math.cos(a + Math.PI / 2) * 0.35, 1.2, z + Math.sin(a + Math.PI / 2) * 0.35] });
  }
  for (let i = 0; i < 12; i++) {
    const seg = (Math.PI * 2) / 12;
    cm.add(new THREE.ConeGeometry(2.3, 1.3, 2, 1, false, i * seg, seg), i % 2 ? 0xffffff : 0xd62839, { p: [0, 3.55, 0] });
    cm.add(new THREE.CylinderGeometry(2.3, 2.3, 0.35, 2, 1, true, i * seg, seg), i % 2 ? 0xd62839 : 0xffffff, { p: [0, 2.75, 0] });
  }
  cm.add(sph(0.2, 8, 6), C.gold, { p: [0, 4.2, 0] });
  carousel.add(cm.mesh());
  g.add(carousel);
  spins.push({ o: carousel, axis: 'y', speed: 0.7 });

  // Ferris wheel
  const wx = 2.4;
  const wz = -1;
  const sup = new MB();
  for (const sz of [-0.6, 0.6]) {
    sup.add(box(0.15, 4.4, 0.15), 0x9fb3c8, { p: [wx - 1.0, 2.0, wz + sz], r: [0, 0, -0.25] });
    sup.add(box(0.15, 4.4, 0.15), 0x9fb3c8, { p: [wx + 1.0, 2.0, wz + sz], r: [0, 0, 0.25] });
  }
  g.add(sup.mesh(true, true));
  const wheel = new THREE.Group();
  wheel.position.set(wx, 4.0, wz);
  const wm = new MB();
  for (const sz of [-0.5, 0.5]) wm.add(torus(2.2, 0.06, 6, 28), 0xffffff, { p: [0, 0, sz] });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    wm.add(box(0.05, 4.4, 0.05), 0xffffff, { r: [0, 0, a], p: [0, 0, -0.5] });
    wm.add(box(0.05, 4.4, 0.05), 0xffffff, { r: [0, 0, a], p: [0, 0, 0.5] });
    wm.add(box(0.5, 0.45, 0.8), cols[i % cols.length], { p: [Math.cos(a) * 2.2, Math.sin(a) * 2.2 - 0.3, 0] });
  }
  wm.add(cyl(0.2, 0.2, 1.4, 10), C.gold, { r: [Math.PI / 2, 0, 0] });
  wheel.add(wm.mesh());
  g.add(wheel);
  spins.push({ o: wheel, axis: 'z', speed: 0.35 });

  // Tents and bunting
  const deco = new MB();
  for (const [tx, tz, c] of [[-2.8, 2.6, 0x4aa8e8], [2.8, 2.6, 0xff8c42]] as [number, number, number][]) {
    deco.add(cyl(0.9, 0.9, 1.2, 10), 0xffffff, { p: [tx, 0.6, tz] });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      deco.add(box(0.56, 1.21, 0.05), i % 2 ? 0xffffff : c, { p: [tx + Math.cos(a) * 0.88, 0.6, tz + Math.sin(a) * 0.88], r: [0, -a + Math.PI / 2, 0] });
    }
    deco.add(cone(1.1, 1.0, 10), c, { p: [tx, 1.7, tz] });
    deco.add(sph(0.12, 6, 4), C.gold, { p: [tx, 2.25, tz] });
  }
  for (let i = 0; i < 14; i++) {
    const x = -3.8 + i * 0.58;
    const y = 2.9 - Math.sin((i / 13) * Math.PI) * 0.5;
    deco.add(cone(0.15, 0.3, 3), cols[i % cols.length], { p: [x, y, 3.6], r: [Math.PI, 0, 0] });
  }
  for (const sx of [-4, 4]) deco.add(cyl(0.06, 0.06, 3.2, 6), C.woodD, { p: [sx, 1.6, 3.6] });
  g.add(deco.mesh(true, true));
  return { mesh: g, spins };
}

export function buildArrow(): THREE.Mesh {
  const mb = new MB();
  mb.add(cone(0.42, 0.7, 4), 0xffc531, { p: [0, 0.35, 0], r: [Math.PI, 0, 0] });
  mb.add(box(0.3, 0.6, 0.3), 0xffc531, { p: [0, 1.0, 0] });
  const m = new THREE.Mesh(mb.build(), new THREE.MeshBasicMaterial({ vertexColors: true }));
  return m;
}

export { MAT };
