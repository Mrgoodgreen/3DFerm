import type * as THREE from 'three';
import type { Effects } from './effects';
import type { Labels } from './labels';

export interface GameCtx {
  scene: THREE.Scene;
  fx: Effects;
  labels: Labels;
  playerPos: THREE.Vector3;
  sound(name: 'moo' | 'cluck' | 'baa' | 'pick' | 'drop' | 'coin' | 'pay', at?: THREE.Vector3, param?: number): void;
}
