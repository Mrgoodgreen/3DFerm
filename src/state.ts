import type { ItemId } from './data';

export interface OrderState {
  item: ItemId;
  n: number;
  reward: number;
}

export interface SaveData {
  v: number;
  savedAt: number;
  coins: number;
  xp: number;
  level: number;
  unlocked: string[];
  pads: Record<string, number>;
  up: Record<string, number>;
  ch: number;
  q: number;
  qp: number;
  qBase: number;
  orders: number;
  order: OrderState | null;
  st: Record<string, [number, number]>;
  sh: Record<string, [number, number]>;
  stack: ItemId[];
  skin: string;
  skins: string[];
  skinAds: Record<string, number>;
  sound: boolean;
  music: boolean;
  noAds: boolean;
  daily: string;
  boosts: { income: number; speed: number };
  stats: { sold: number; earned: number; upgrades: number; play: number };
  introSeen: number;
  pos: [number, number];
  reviewAsked: boolean;
  shortcutAsked: boolean;
}

export function defaultSave(): SaveData {
  return {
    v: 1,
    savedAt: 0,
    coins: 0,
    xp: 0,
    level: 1,
    unlocked: [],
    pads: {},
    up: {},
    ch: 0,
    q: 0,
    qp: 0,
    qBase: 0,
    orders: 0,
    order: null,
    st: {},
    sh: {},
    stack: [],
    skin: 'classic',
    skins: ['classic'],
    skinAds: {},
    sound: true,
    music: true,
    noAds: false,
    daily: '',
    boosts: { income: 0, speed: 0 },
    stats: { sold: 0, earned: 0, upgrades: 0, play: 0 },
    introSeen: -1,
    pos: [2, 3],
    reviewAsked: false,
    shortcutAsked: false,
  };
}

export function mergeSave(raw: unknown): SaveData {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<SaveData>;
  const out: SaveData = { ...d, ...r } as SaveData;
  out.boosts = { ...d.boosts, ...(r.boosts || {}) };
  out.stats = { ...d.stats, ...(r.stats || {}) };
  out.up = { ...(r.up || {}) };
  out.pads = { ...(r.pads || {}) };
  out.st = { ...(r.st || {}) };
  out.sh = { ...(r.sh || {}) };
  out.skins = Array.isArray(r.skins) && r.skins.length ? r.skins : ['classic'];
  out.unlocked = Array.isArray(r.unlocked) ? r.unlocked : [];
  out.stack = Array.isArray(r.stack) ? r.stack : [];
  if (!isFinite(out.coins) || out.coins < 0) out.coins = 0;
  out.coins = Math.floor(out.coins);
  for (const k of Object.keys(out.pads)) out.pads[k] = Math.floor(out.pads[k] || 0);
  return out;
}
