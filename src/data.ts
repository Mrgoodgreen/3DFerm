export type ItemId =
  | 'grass'
  | 'milk'
  | 'wheat'
  | 'egg'
  | 'cheese'
  | 'carrot'
  | 'apple'
  | 'juice'
  | 'wool'
  | 'sweater'
  | 'flour'
  | 'bread'
  | 'honey';

export interface ItemDef {
  id: ItemId;
  icon: string;
  price: number;
  /** Height of one item in a carried stack. */
  h: number;
  xp: number;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  grass: { id: 'grass', icon: '🌿', price: 0, h: 0.24, xp: 0 },
  milk: { id: 'milk', icon: '🥛', price: 5, h: 0.36, xp: 1 },
  wheat: { id: 'wheat', icon: '🌾', price: 0, h: 0.24, xp: 0 },
  egg: { id: 'egg', icon: '🥚', price: 7, h: 0.2, xp: 1 },
  cheese: { id: 'cheese', icon: '🧀', price: 20, h: 0.17, xp: 2 },
  carrot: { id: 'carrot', icon: '🥕', price: 6, h: 0.2, xp: 1 },
  apple: { id: 'apple', icon: '🍎', price: 8, h: 0.27, xp: 1 },
  juice: { id: 'juice', icon: '🧃', price: 24, h: 0.32, xp: 2 },
  wool: { id: 'wool', icon: '🧶', price: 0, h: 0.28, xp: 0 },
  sweater: { id: 'sweater', icon: '🧥', price: 55, h: 0.15, xp: 4 },
  flour: { id: 'flour', icon: '🌾', price: 0, h: 0.28, xp: 0 },
  bread: { id: 'bread', icon: '🍞', price: 42, h: 0.2, xp: 3 },
  honey: { id: 'honey', icon: '🍯', price: 34, h: 0.28, xp: 3 },
};

export type FieldKind = 'grass' | 'wheat' | 'carrot' | 'tree';
export interface FieldDef {
  id: string;
  item: ItemId;
  kind: FieldKind;
  x: number;
  z: number;
  cols: number;
  rows: number;
  spacing: number;
  regrow: number;
  unlock?: string;
}

export const FIELDS: FieldDef[] = [
  { id: 'meadow', item: 'grass', kind: 'grass', x: -8, z: -3, cols: 4, rows: 4, spacing: 1.4, regrow: 5 },
  { id: 'wheat', item: 'wheat', kind: 'wheat', x: -8, z: -14, cols: 4, rows: 4, spacing: 1.4, regrow: 6, unlock: 'wheat' },
  { id: 'carrot', item: 'carrot', kind: 'carrot', x: -19, z: -3, cols: 4, rows: 3, spacing: 1.4, regrow: 7, unlock: 'carrot' },
  { id: 'orchard', item: 'apple', kind: 'tree', x: -19, z: -14, cols: 3, rows: 3, spacing: 2.6, regrow: 8, unlock: 'orchard' },
  { id: 'meadow2', item: 'grass', kind: 'grass', x: 24, z: -15, cols: 4, rows: 4, spacing: 1.4, regrow: 5, unlock: 'sheep' },
];

export type AnimalKind = 'cow' | 'chicken' | 'sheep' | 'bee';
export type BuildingKind = 'barn' | 'coop' | 'shed' | 'creamery' | 'loom' | 'press' | 'mill' | 'bakery' | 'hives';

export interface StationDef {
  id: string;
  kind: 'pen' | 'building';
  building: BuildingKind;
  animal?: AnimalKind;
  input: ItemId | null;
  output: ItemId;
  /** Seconds per output per worker (animal) at base speed. */
  time: number;
  x: number;
  z: number;
  w: number;
  d: number;
  inCap: number;
  outCap: number;
  startAnimals?: number;
  unlock?: string;
}

export const STATIONS: StationDef[] = [
  { id: 'cows', kind: 'pen', building: 'barn', animal: 'cow', input: 'grass', output: 'milk', time: 3.2, x: 2, z: -4, w: 7, d: 5, inCap: 24, outCap: 30, startAnimals: 1 },
  { id: 'chickens', kind: 'pen', building: 'coop', animal: 'chicken', input: 'wheat', output: 'egg', time: 3, x: 3, z: -15, w: 6, d: 4, inCap: 24, outCap: 30, startAnimals: 1, unlock: 'chickens' },
  { id: 'creamery', kind: 'building', building: 'creamery', input: 'milk', output: 'cheese', time: 3.5, x: 13, z: -4, w: 5, d: 4, inCap: 24, outCap: 24, unlock: 'creamery' },
  { id: 'sheep', kind: 'pen', building: 'shed', animal: 'sheep', input: 'grass', output: 'wool', time: 4, x: 14, z: -15, w: 6, d: 4, inCap: 24, outCap: 24, startAnimals: 1, unlock: 'sheep' },
  { id: 'loom', kind: 'building', building: 'loom', input: 'wool', output: 'sweater', time: 4.5, x: 24, z: -4, w: 5, d: 4, inCap: 20, outCap: 20, unlock: 'loom' },
  { id: 'press', kind: 'building', building: 'press', input: 'apple', output: 'juice', time: 3.5, x: -19, z: -25, w: 5, d: 4, inCap: 24, outCap: 24, unlock: 'press' },
  { id: 'mill', kind: 'building', building: 'mill', input: 'wheat', output: 'flour', time: 2.5, x: -8, z: -26, w: 5, d: 4, inCap: 24, outCap: 24, unlock: 'mill' },
  { id: 'bakery', kind: 'building', building: 'bakery', input: 'flour', output: 'bread', time: 4, x: 3, z: -26, w: 5, d: 4, inCap: 24, outCap: 24, unlock: 'bakery' },
  { id: 'bees', kind: 'building', building: 'hives', animal: 'bee', input: null, output: 'honey', time: 6, x: 14, z: -26, w: 6, d: 4, inCap: 0, outCap: 24, startAnimals: 1, unlock: 'bees' },
];

export const SHELF_Z = 8.6;
export interface ShelfDef {
  item: ItemId;
  x: number;
  awning: number;
  unlock?: string;
}
export const SHELVES: ShelfDef[] = [
  { item: 'juice', x: -7, awning: 0xff9f43, unlock: 'shelf_juice' },
  { item: 'carrot', x: -3.6, awning: 0xff7f50, unlock: 'shelf_carrot' },
  { item: 'apple', x: -0.2, awning: 0xe8505b, unlock: 'shelf_apple' },
  { item: 'milk', x: 3.2, awning: 0x5aa9e6 },
  { item: 'egg', x: 6.6, awning: 0xf9c74f, unlock: 'shelf_egg' },
  { item: 'cheese', x: 10, awning: 0xf4a259, unlock: 'shelf_cheese' },
  { item: 'bread', x: 13.4, awning: 0xc08552, unlock: 'shelf_bread' },
  { item: 'honey', x: 16.8, awning: 0xf6bd60, unlock: 'shelf_honey' },
  { item: 'sweater', x: 20.2, awning: 0xb56cdb, unlock: 'shelf_sweater' },
];
export const SHELF_CAP = 30;

export type HelperFrom = { field: string } | { station: string };
export type HelperTo = { station: string } | { shelf: ItemId };
export interface HelperDef {
  id: string;
  item: ItemId;
  from: HelperFrom;
  to: HelperTo;
  shirt: number;
}

export const HELPERS: HelperDef[] = [
  { id: 'h_grass', item: 'grass', from: { field: 'meadow' }, to: { station: 'cows' }, shirt: 0x6ab04c },
  { id: 'h_milkshelf', item: 'milk', from: { station: 'cows' }, to: { shelf: 'milk' }, shirt: 0x4aa8e8 },
  { id: 'h_milk', item: 'milk', from: { station: 'cows' }, to: { station: 'creamery' }, shirt: 0x7ec8e3 },
  { id: 'h_wheat', item: 'wheat', from: { field: 'wheat' }, to: { station: 'chickens' }, shirt: 0xe1b12c },
  { id: 'h_egg', item: 'egg', from: { station: 'chickens' }, to: { shelf: 'egg' }, shirt: 0xf6e58d },
  { id: 'h_cheese', item: 'cheese', from: { station: 'creamery' }, to: { shelf: 'cheese' }, shirt: 0xf0932b },
  { id: 'h_carrot', item: 'carrot', from: { field: 'carrot' }, to: { shelf: 'carrot' }, shirt: 0xff7f50 },
  { id: 'h_apple', item: 'apple', from: { field: 'orchard' }, to: { station: 'press' }, shirt: 0xeb4d4b },
  { id: 'h_juice', item: 'juice', from: { station: 'press' }, to: { shelf: 'juice' }, shirt: 0xffbe76 },
  { id: 'h_grass2', item: 'grass', from: { field: 'meadow2' }, to: { station: 'sheep' }, shirt: 0xbadc58 },
  { id: 'h_wool', item: 'wool', from: { station: 'sheep' }, to: { station: 'loom' }, shirt: 0xdff9fb },
  { id: 'h_sweater', item: 'sweater', from: { station: 'loom' }, to: { shelf: 'sweater' }, shirt: 0xbe2edd },
  { id: 'h_flour', item: 'wheat', from: { field: 'wheat' }, to: { station: 'mill' }, shirt: 0xc7ecee },
  { id: 'h_bake', item: 'flour', from: { station: 'mill' }, to: { station: 'bakery' }, shirt: 0x95afc0 },
  { id: 'h_bread', item: 'bread', from: { station: 'bakery' }, to: { shelf: 'bread' }, shirt: 0xa0522d },
  { id: 'h_honey', item: 'honey', from: { station: 'bees' }, to: { shelf: 'honey' }, shirt: 0xf9ca24 },
];

export type UnlockKind = 'field' | 'station' | 'animal' | 'shelf' | 'helper' | 'fair' | 'deco';
export interface UnlockDef {
  id: string;
  cost: number;
  req: string[];
  kind: UnlockKind;
  target: string;
  icon: string;
  x: number;
  z: number;
}

const station = (id: string) => STATIONS.find((s) => s.id === id)!;
const field = (id: string) => FIELDS.find((f) => f.id === id)!;
const shelf = (item: ItemId) => SHELVES.find((s) => s.item === item)!;
const stPad = (id: string): [number, number] => {
  const s = station(id);
  return [s.x, s.z + s.d / 2 + 1.0];
};
const animalPad = (id: string): [number, number] => {
  const s = station(id);
  return [s.x + s.w / 2 + 1.5, s.z];
};
const fieldPad = (id: string): [number, number] => {
  const f = field(id);
  return [f.x, f.z];
};
const shelfPad = (item: ItemId): [number, number] => [shelf(item).x, SHELF_Z - 2.5];

function u(
  id: string,
  cost: number,
  req: string[],
  kind: UnlockKind,
  target: string,
  icon: string,
  pos: [number, number],
): UnlockDef {
  return { id, cost, req, kind, target, icon, x: pos[0], z: pos[1] };
}

export const UNLOCKS: UnlockDef[] = [
  u('cow2', 15, [], 'animal', 'cows', '🐄', animalPad('cows')),
  u('wheat', 40, ['cow2'], 'field', 'wheat', '🌾', fieldPad('wheat')),
  u('chickens', 70, ['wheat'], 'station', 'chickens', '🐔', stPad('chickens')),
  u('shelf_egg', 30, ['chickens'], 'shelf', 'egg', '🥚', shelfPad('egg')),
  u('cow3', 60, ['shelf_egg'], 'animal', 'cows', '🐄', animalPad('cows')),
  u('chicken2', 60, ['shelf_egg'], 'animal', 'chickens', '🐔', animalPad('chickens')),
  u('h_grass', 150, ['cow3'], 'helper', 'h_grass', '👨‍🌾', [-4.2, -1.6]),
  u('creamery', 250, ['h_grass'], 'station', 'creamery', '🧀', stPad('creamery')),
  u('shelf_cheese', 80, ['creamery'], 'shelf', 'cheese', '🧀', shelfPad('cheese')),
  u('h_milk', 300, ['shelf_cheese'], 'helper', 'h_milk', '👨‍🌾', [8.3, -1.0]),
  u('carrot', 350, ['shelf_cheese'], 'field', 'carrot', '🥕', fieldPad('carrot')),
  u('shelf_carrot', 60, ['carrot'], 'shelf', 'carrot', '🥕', shelfPad('carrot')),
  u('chicken3', 250, ['chicken2', 'h_grass'], 'animal', 'chickens', '🐔', animalPad('chickens')),
  u('cow4', 300, ['cow3', 'h_milk'], 'animal', 'cows', '🐄', animalPad('cows')),
  u('h_milkshelf', 400, ['h_milk'], 'helper', 'h_milkshelf', '👩‍🌾', [5.8, 3.0]),
  u('h_wheat', 500, ['chicken3'], 'helper', 'h_wheat', '👩‍🌾', [-3, -13]),
  u('h_carrot', 600, ['shelf_carrot'], 'helper', 'h_carrot', '👨‍🌾', [-14, 2]),
  u('orchard', 700, ['shelf_carrot'], 'field', 'orchard', '🍎', fieldPad('orchard')),
  u('shelf_apple', 120, ['orchard'], 'shelf', 'apple', '🍎', shelfPad('apple')),
  u('h_egg', 800, ['h_wheat'], 'helper', 'h_egg', '👨‍🌾', [7.6, -9.6]),
  u('press', 1000, ['shelf_apple'], 'station', 'press', '🧃', stPad('press')),
  u('shelf_juice', 250, ['press'], 'shelf', 'juice', '🧃', shelfPad('juice')),
  u('h_cheese', 1200, ['cow4'], 'helper', 'h_cheese', '👩‍🌾', [13, 3]),
  u('chicken4', 900, ['chicken3', 'h_egg'], 'animal', 'chickens', '🐔', animalPad('chickens')),
  u('sheep', 1800, ['shelf_juice'], 'station', 'sheep', '🐑', stPad('sheep')),
  u('sheep2', 1200, ['sheep'], 'animal', 'sheep', '🐑', animalPad('sheep')),
  u('loom', 2600, ['sheep'], 'station', 'loom', '🧥', stPad('loom')),
  u('shelf_sweater', 600, ['loom'], 'shelf', 'sweater', '🧥', shelfPad('sweater')),
  u('h_apple', 2500, ['shelf_juice'], 'helper', 'h_apple', '👨‍🌾', [-24, -19.5]),
  u('h_juice', 3000, ['h_apple'], 'helper', 'h_juice', '👩‍🌾', [-14.5, -19.5]),
  u('h_grass2', 2200, ['shelf_sweater'], 'helper', 'h_grass2', '👨‍🌾', [20.5, -10.5]),
  u('cow5', 2500, ['cow4', 'shelf_sweater'], 'animal', 'cows', '🐄', animalPad('cows')),
  u('mill', 4000, ['shelf_sweater'], 'station', 'mill', '🌾', stPad('mill')),
  u('bakery', 5500, ['mill'], 'station', 'bakery', '🍞', stPad('bakery')),
  u('shelf_bread', 1200, ['bakery'], 'shelf', 'bread', '🍞', shelfPad('bread')),
  u('h_wool', 4000, ['h_grass2'], 'helper', 'h_wool', '👩‍🌾', [19.5, -7]),
  u('sheep3', 4000, ['sheep2', 'h_wool'], 'animal', 'sheep', '🐑', animalPad('sheep')),
  u('h_flour', 4500, ['shelf_bread'], 'helper', 'h_flour', '👨‍🌾', [-11.5, -19.5]),
  u('h_bake', 5000, ['h_flour'], 'helper', 'h_bake', '👩‍🌾', [-2.5, -20]),
  u('h_sweater', 6000, ['h_wool'], 'helper', 'h_sweater', '👨‍🌾', [24, 3]),
  u('chicken5', 3500, ['chicken4', 'shelf_bread'], 'animal', 'chickens', '🐔', animalPad('chickens')),
  u('bees', 8000, ['shelf_bread'], 'station', 'bees', '🍯', stPad('bees')),
  u('shelf_honey', 1800, ['bees'], 'shelf', 'honey', '🍯', shelfPad('honey')),
  u('hive2', 5000, ['shelf_honey'], 'animal', 'bees', '🐝', animalPad('bees')),
  u('h_bread', 8000, ['h_bake'], 'helper', 'h_bread', '👨‍🌾', [7, -20]),
  u('h_honey', 7000, ['shelf_honey'], 'helper', 'h_honey', '👩‍🌾', [10, -20.5]),
  u('cow6', 9000, ['cow5', 'shelf_honey'], 'animal', 'cows', '🐄', animalPad('cows')),
  u('hive3', 12000, ['hive2'], 'animal', 'bees', '🐝', animalPad('bees')),
  u('sheep4', 12000, ['sheep3', 'shelf_honey'], 'animal', 'sheep', '🐑', animalPad('sheep')),
  u('fair', 25000, ['shelf_honey'], 'fair', 'fair', '🎡', [24, -22]),
  u('deco_fountain', 15000, ['fair'], 'deco', 'fountain', '⛲', [-27.5, -3]),
  u('deco_gazebo', 25000, ['deco_fountain'], 'deco', 'gazebo', '🛖', [28.5, -9.4]),
  u('deco_statue', 40000, ['deco_gazebo'], 'deco', 'statue', '🐮', [-14, -31]),
  u('deco_balloon', 60000, ['deco_statue'], 'deco', 'balloon', '🎈', [12, -31]),
  u('deco_arch', 90000, ['deco_balloon'], 'deco', 'arch', '🌸', [28.5, 6.2]),
  u('deco_lighthouse', 140000, ['deco_arch'], 'deco', 'lighthouse', '🗼', [-28.5, -30.5]),
];

export const DECO_BONUS = 0.05;

export const FAIR = { x: 24, z: -27, priceBonus: 0.25 };

export interface UpgradeDef {
  id: 'cap' | 'speed' | 'price' | 'prod' | 'helper' | 'customers' | 'autocash';
  icon: string;
  max: number;
  base: number;
  mult: number;
  minLevel: number;
}
export const UPGRADES: UpgradeDef[] = [
  { id: 'cap', icon: '🧺', max: 15, base: 25, mult: 1.55, minLevel: 1 },
  { id: 'speed', icon: '👢', max: 10, base: 40, mult: 1.6, minLevel: 1 },
  { id: 'prod', icon: '🌱', max: 12, base: 90, mult: 1.62, minLevel: 2 },
  { id: 'price', icon: '⭐', max: 15, base: 120, mult: 1.66, minLevel: 3 },
  { id: 'customers', icon: '📻', max: 10, base: 180, mult: 1.7, minLevel: 4 },
  { id: 'helper', icon: '🛒', max: 10, base: 300, mult: 1.7, minLevel: 5 },
  { id: 'autocash', icon: '🐷', max: 1, base: 4000, mult: 1, minLevel: 8 },
];
export const upgradeCost = (u: UpgradeDef, lvl: number) => Math.round(u.base * Math.pow(u.mult, lvl));

export interface SkinDef {
  id: string;
  cost: number;
  ads: number;
  shirt: number;
  pants: number;
  hat: 'straw' | 'cap' | 'flowers' | 'hood' | 'kokoshnik';
  hatColor: number;
  ribbon: number;
  dress: boolean;
  hair: number;
}
export const SKINS: SkinDef[] = [
  { id: 'classic', cost: 0, ads: 0, shirt: 0xfff1e0, pants: 0x4f86c6, hat: 'straw', hatColor: 0xf3d27a, ribbon: 0xe8505b, dress: false, hair: 0xe0712c },
  { id: 'rose', cost: 600, ads: 0, shirt: 0xffb6c8, pants: 0xff7aa2, hat: 'straw', hatColor: 0xffe0ea, ribbon: 0xff5c8a, dress: true, hair: 0xe0712c },
  { id: 'meadow', cost: 0, ads: 3, shirt: 0xfffbe6, pants: 0x6ab04c, hat: 'flowers', hatColor: 0x8bd36b, ribbon: 0xffd166, dress: true, hair: 0xe0712c },
  { id: 'rain', cost: 3000, ads: 0, shirt: 0xffd23f, pants: 0x3d5a80, hat: 'hood', hatColor: 0xffd23f, ribbon: 0xffd23f, dress: false, hair: 0xe0712c },
  { id: 'mechanic', cost: 8000, ads: 0, shirt: 0xffffff, pants: 0xe76f51, hat: 'cap', hatColor: 0xe76f51, ribbon: 0xffffff, dress: false, hair: 0xe0712c },
  { id: 'fair', cost: 20000, ads: 0, shirt: 0xffffff, pants: 0xd62839, hat: 'kokoshnik', hatColor: 0xd62839, ribbon: 0xffc531, dress: true, hair: 0xe0712c },
];

export type QuestType = 'harvest' | 'feed' | 'collect' | 'sell' | 'unlock' | 'earn' | 'upgrade' | 'helpers';
export interface QuestDef {
  type: QuestType;
  target?: string;
  n: number;
  reward: number;
}
export type Speaker = 'arina' | 'granny' | 'fedor' | 'petya';
export interface ChapterDef {
  id: string;
  lines: Speaker[];
  quests: QuestDef[];
  reward: number;
}

const q = (type: QuestType, target: string | undefined, n: number, reward: number): QuestDef => ({ type, target, n, reward });

export const CHAPTERS: ChapterDef[] = [
  {
    id: 'ch1',
    lines: ['granny', 'arina', 'granny'],
    quests: [
      q('harvest', 'grass', 5, 5),
      q('feed', 'cows', 5, 5),
      q('collect', 'milk', 3, 5),
      q('sell', 'milk', 3, 10),
      q('unlock', 'cow2', 1, 10),
    ],
    reward: 30,
  },
  {
    id: 'ch2',
    lines: ['fedor', 'arina', 'fedor'],
    quests: [
      q('unlock', 'wheat', 1, 15),
      q('harvest', 'wheat', 6, 15),
      q('unlock', 'chickens', 1, 20),
      q('unlock', 'shelf_egg', 1, 20),
      q('sell', 'egg', 5, 30),
    ],
    reward: 80,
  },
  {
    id: 'ch3',
    lines: ['granny', 'arina'],
    quests: [
      q('unlock', 'cow3', 1, 30),
      q('upgrade', undefined, 2, 40),
      q('unlock', 'h_grass', 1, 50),
      q('sell', 'milk', 20, 60),
    ],
    reward: 150,
  },
  {
    id: 'ch4',
    lines: ['petya', 'arina', 'petya'],
    quests: [
      q('unlock', 'creamery', 1, 60),
      q('feed', 'creamery', 5, 60),
      q('unlock', 'shelf_cheese', 1, 80),
      q('sell', 'cheese', 5, 100),
      q('unlock', 'carrot', 1, 100),
      q('sell', 'carrot', 10, 120),
    ],
    reward: 400,
  },
  {
    id: 'ch5',
    lines: ['granny', 'arina', 'granny'],
    quests: [
      q('unlock', 'orchard', 1, 150),
      q('harvest', 'apple', 10, 150),
      q('unlock', 'shelf_apple', 1, 150),
      q('unlock', 'press', 1, 200),
      q('unlock', 'shelf_juice', 1, 200),
      q('sell', 'juice', 8, 300),
    ],
    reward: 900,
  },
  {
    id: 'ch6',
    lines: ['fedor', 'arina', 'fedor'],
    quests: [
      q('unlock', 'sheep', 1, 300),
      q('collect', 'wool', 10, 300),
      q('unlock', 'loom', 1, 400),
      q('unlock', 'shelf_sweater', 1, 400),
      q('sell', 'sweater', 6, 600),
    ],
    reward: 2000,
  },
  {
    id: 'ch7',
    lines: ['granny', 'arina'],
    quests: [
      q('unlock', 'mill', 1, 600),
      q('unlock', 'bakery', 1, 800),
      q('unlock', 'shelf_bread', 1, 800),
      q('sell', 'bread', 10, 1200),
    ],
    reward: 4000,
  },
  {
    id: 'ch8',
    lines: ['petya', 'arina', 'petya'],
    quests: [
      q('unlock', 'bees', 1, 1200),
      q('unlock', 'shelf_honey', 1, 1500),
      q('sell', 'honey', 10, 2000),
      q('helpers', undefined, 8, 2500),
    ],
    reward: 7000,
  },
  {
    id: 'ch9',
    lines: ['fedor', 'arina', 'granny', 'arina'],
    quests: [q('unlock', 'fair', 1, 5000), q('earn', undefined, 30000, 5000)],
    reward: 15000,
  },
];

export const SELLABLE: ItemId[] = ['milk', 'egg', 'cheese', 'carrot', 'apple', 'juice', 'sweater', 'bread', 'honey'];

export const xpForLevel = (lvl: number) => Math.round(25 * Math.pow(lvl, 1.55));
export const levelReward = (lvl: number) => Math.round(20 * Math.pow(lvl, 1.6));

export const CONFIG = {
  baseCap: 6,
  capPerLvl: 2,
  baseSpeed: 4.6,
  speedPerLvl: 0.07,
  pricePerLvl: 0.1,
  prodPerLvl: 0.12,
  helperBaseCap: 4,
  helperSpeed: 3.2,
  customerInterval: 4.2,
  customerPerLvl: 0.12,
  boostDuration: 180,
  giftCooldown: 150,
  interstitialCooldown: 150,
  offlineCapSec: 2 * 3600,
  playerStart: { x: 2, z: 3 },
  bin: { x: -10.6, z: 6.6 },
  bounds: { minX: -29.5, maxX: 31.5, minZ: -31.5, maxZ: 15 },
  road: { z: 12.6 },
};
