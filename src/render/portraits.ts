import * as THREE from 'three';
import { buildHuman, type HumanOpts } from './models';

export const NPC: Record<'granny' | 'fedor' | 'petya', HumanOpts> = {
  granny: {
    shirt: 0xb48ad6,
    pants: 0x8a5fc7,
    hair: 0xe3e3e3,
    hairStyle: 'bun',
    dress: true,
    glasses: true,
    ribbon: 0xffffff,
    hat: 'none',
  },
  fedor: {
    shirt: 0xc0504d,
    pants: 0x3d5a80,
    hair: 0xbdbdbd,
    hairStyle: 'short',
    beard: 0xe6e6e6,
    hat: 'cap',
    hatColor: 0x6b8e23,
  },
  petya: {
    shirt: 0x4f86c6,
    pants: 0x2f4f6f,
    hair: 0x8b4513,
    hairStyle: 'short',
    hat: 'cap',
    hatColor: 0x2f5f9f,
  },
};

/**
 * Renders a character snapshot to a data URL. The main renderer is reused and
 * read back in the same task, so no preserveDrawingBuffer is needed.
 */
export function renderPortraits(
  renderer: THREE.WebGLRenderer,
  jobs: { opts: HumanOpts; full?: boolean }[],
): string[] {
  const size = 256;
  const prevSize = new THREE.Vector2();
  renderer.getSize(prevSize);
  const prevRatio = renderer.getPixelRatio();
  const prevShadow = renderer.shadowMap.enabled;
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  scene.background = null;
  scene.add(new THREE.HemisphereLight(0xfff6e0, 0xb0a080, 2.0));
  const dl = new THREE.DirectionalLight(0xffffff, 1.8);
  dl.position.set(1.5, 3, 4);
  scene.add(dl);
  const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  const out: string[] = [];
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const g = cv.getContext('2d')!;
  renderer.setClearColor(0xfff0d6, 1);
  for (const job of jobs) {
    const h = buildHuman(job.opts);
    h.root.rotation.y = -0.35;
    h.armL.rotation.x = 0.1;
    h.armR.rotation.x = -0.1;
    scene.add(h.root);
    if (job.full) {
      cam.position.set(0, 1.0, 4.4);
      cam.lookAt(0, 0.9, 0);
    } else {
      cam.position.set(0, 1.45, 3.0);
      cam.lookAt(0, 1.3, 0);
    }
    renderer.render(scene, cam);
    g.clearRect(0, 0, size, size);
    g.drawImage(renderer.domElement, 0, 0, size, size);
    try {
      out.push(cv.toDataURL('image/png'));
    } catch {
      out.push('');
    }
    scene.remove(h.root);
  }
  renderer.setClearColor(0x000000, 1);
  renderer.shadowMap.enabled = prevShadow;
  renderer.setPixelRatio(prevRatio);
  renderer.setSize(prevSize.x, prevSize.y, false);
  return out;
}
