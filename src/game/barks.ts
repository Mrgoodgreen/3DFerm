import * as THREE from 'three';
import { t } from '../i18n';
import type { Labels, Label } from './labels';

export interface BarkOpts {
  /** Shown at most once per save (tutorial steps, first products). */
  once?: boolean;
  /** Cooldown group: lines in the same group don't repeat too often. */
  group?: string;
  cd?: number;
  /** Tutorial lines skip the global quiet gap. */
  urgent?: boolean;
  params?: Record<string, string | number>;
  /** Key used for `once` bookkeeping when it differs from the text key. */
  id?: string;
}

const GLOBAL_GAP = 40;

/** Arina's speech bubble: short remarks that teach the game and react to the farm. */
export class Barks {
  private label: Label;
  private showT = 0;
  private lastAt = -999;
  private groupAt = new Map<string, number>();
  private groupCount = new Map<string, number>();
  private queue: { text: string; urgent: boolean }[] = [];
  private variant = new Map<string, number>();

  constructor(
    labels: Labels,
    private said: string[],
  ) {
    this.label = labels.add('', new THREE.Vector3(), 'speech');
    this.label.visible = false;
  }

  has(key: string) {
    return this.said.includes(key);
  }

  /** `key` may be a base like "b_idle" with a count of numbered variants. */
  say(time: number, key: string, o: BarkOpts = {}, variants = 0) {
    const id = o.id ?? key;
    if (o.once && this.said.includes(id)) return false;
    if (o.group) {
      const at = this.groupAt.get(o.group) ?? -999;
      // Repeated nags back off so ignoring a hint never turns into spam.
      const n = this.groupCount.get(o.group) ?? 0;
      if (time - at < (o.cd ?? 60) * Math.min(6, Math.pow(1.6, n))) return false;
    }
    if (!o.urgent && (time - this.lastAt < GLOBAL_GAP || this.showT > 0 || this.queue.length)) return false;
    let textKey = key;
    if (variants > 0) {
      const v = ((this.variant.get(key) ?? Math.floor(Math.random() * variants)) + 1) % variants;
      this.variant.set(key, v);
      textKey = `${key}_${v}`;
    }
    if (o.once) this.said.push(id);
    if (o.group) {
      this.groupAt.set(o.group, time);
      this.groupCount.set(o.group, (this.groupCount.get(o.group) ?? 0) + 1);
    }
    this.lastAt = time;
    this.queue.push({ text: t(textKey, o.params), urgent: !!o.urgent });
    return true;
  }

  update(dt: number, head: THREE.Vector3) {
    this.label.pos.copy(head);
    if (this.showT > 0) {
      this.showT -= dt;
      if (this.showT <= 0) {
        this.label.visible = false;
        this.showT = this.queue.length ? -0.35 : 0;
      }
      return;
    }
    if (this.showT < 0) {
      this.showT = Math.min(0, this.showT + dt);
      if (this.showT < 0) return;
    }
    const next = this.queue.shift();
    if (!next) return;
    this.label.setHTML(next.text);
    this.label.setClass('speech');
    this.label.visible = true;
    void this.label.el.offsetWidth;
    this.label.setClass('speech show');
    this.showT = Math.min(7, 2.6 + next.text.length * 0.045);
  }

  hide() {
    this.label.visible = false;
    this.showT = 0;
  }
}
