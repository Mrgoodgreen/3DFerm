import * as THREE from 'three';
import {
  ITEMS,
  FIELDS,
  STATIONS,
  SHELVES,
  HELPERS,
  UNLOCKS,
  UPGRADES,
  SKINS,
  CHAPTERS,
  CONFIG,
  FAIR,
  DECO_BONUS,
  SELLABLE,
  xpForLevel,
  levelReward,
  upgradeCost,
  type ItemId,
  type UnlockDef,
  type QuestType,
  type Speaker,
  type SkinDef,
  type UpgradeDef,
} from '../data';
import { t, fmt, getLang } from '../i18n';
import { sdk } from '../sdk';
import { audio } from '../audio';
import { Stage } from '../render/stage';
import { buildWorld, type World, type Collider } from '../render/world';
import { buildArrow, buildBin, buildFair, buildDeco, skinHumanOpts } from '../render/models';
import { renderPortraits, NPC } from '../render/portraits';
import { Labels, type Label } from './labels';
import { Effects } from './effects';
import { Field } from './field';
import { Station } from './station';
import { Shelf } from './shelf';
import { Pad } from './pad';
import { Player, Pet } from './player';
import { Helper, type HelperEnv } from './helper';
import { CustomerManager, type CustomerEnv } from './customers';
import type { GameCtx } from './ctx';
import { Input } from '../input';
import { UI, el } from '../ui/ui';
import { type SaveData } from '../state';

type PauseReason = 'hidden' | 'ad' | 'modal' | 'sdk' | 'loading';

interface QuestView {
  type: QuestType;
  target?: string;
  n: number;
  reward: number;
  chapter: string;
  text: string;
}

const IAP_COINS: Record<string, number> = { coins_small: 5000, coins_medium: 30000, coins_big: 150000 };

const _v = new THREE.Vector3();
const dist2 = (a: THREE.Vector3, b: THREE.Vector3) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;

export class Game {
  stage: Stage;
  world: World;
  labels: Labels;
  fx: Effects;
  input: Input;
  ui: UI;
  player: Player;
  pet: Pet;
  fields = new Map<string, Field>();
  stations = new Map<string, Station>();
  shelves = new Map<ItemId, Shelf>();
  pads = new Map<string, Pad>();
  helpers: Helper[] = [];
  customers: CustomerManager;
  unlocked = new Set<string>();
  colliders: Collider[] = [];
  pause = new Set<PauseReason>(['loading']);
  portraits: Record<string, string> = {};
  skinPortraits: Record<string, string> = {};
  ctx: GameCtx;

  private time = 0;
  private lastAd = 0;
  private giftReadyAt = 45;
  private harvestT = 0;
  private transferT = 0;
  private payCoinT = 0;
  private autoCashT = 0;
  private uiT = 0;
  private saveT = 0;
  private questCheckT = 0;
  private fullToastT = 0;
  private padToastFor: Pad | null = null;
  private arrow: THREE.Mesh;
  private groundArrow: THREE.Mesh;
  private arrowTarget: THREE.Vector3 | null = null;
  private maxLabel: Label;
  private binPos = new THREE.Vector3(CONFIG.bin.x, 0, CONFIG.bin.z);
  private fairSpins: { o: THREE.Object3D; axis: 'y' | 'z'; speed: number }[] = [];
  private decoAnims: ((t: number) => void)[] = [];
  private decoColliders: Collider[] = [];
  private hintActive = false;
  private moveAcc = 0;
  private boostBtns!: { income: HTMLButtonElement; speed: HTMLButtonElement; gift: HTMLButtonElement };
  private shownCoins = -1;
  private completingQuest = false;
  private sessionStart = performance.now();
  private lastFrame = performance.now();

  constructor(
    public s: SaveData,
    public mobile: boolean,
  ) {
    const container = document.getElementById('game')!;
    const uiRoot = document.getElementById('ui')!;
    this.stage = new Stage(container, mobile);
    this.labels = new Labels(uiRoot);
    this.ui = new UI(uiRoot);
    this.fx = new Effects(this.stage.scene, this.labels);
    this.input = new Input(this.stage.renderer.domElement, uiRoot);
    this.input.onFirstInput = () => audio.unlock();
    this.world = buildWorld(this.stage, mobile);

    this.ctx = {
      scene: this.stage.scene,
      fx: this.fx,
      labels: this.labels,
      playerPos: new THREE.Vector3(),
      sound: (name, at, param) => {
        if (at && at.distanceTo(this.player.pos) > 14) return;
        audio.play(name, param);
      },
    };

    const skin = this.skin();
    this.player = new Player(this.stage.scene, skin);
    this.player.pos.set(s.pos[0], 0, s.pos[1]);
    this.player.h.root.position.copy(this.player.pos);
    this.ctx.playerPos = this.player.pos;
    this.pet = new Pet(this.stage.scene, this.player.pos);
    this.pet.a.root.position.copy(this.pet.pos);

    for (const f of FIELDS) {
      const field = new Field(f);
      this.fields.set(f.id, field);
      this.stage.scene.add(field.group);
    }
    for (const sd of STATIONS) this.stations.set(sd.id, new Station(sd, this.ctx));
    for (const sh of SHELVES) this.shelves.set(sh.item, new Shelf(sh, this.ctx));
    for (const u of UNLOCKS) this.pads.set(u.id, new Pad(u, this.unlockName(u), this.ctx));
    this.customers = new CustomerManager(this.stage.scene, this.labels, this.fx);

    const bin = buildBin();
    bin.position.copy(this.binPos);
    this.stage.scene.add(bin);
    this.labels.add('🗑️', new THREE.Vector3(this.binPos.x, 1.7, this.binPos.z), 'icon-label');

    this.arrow = buildArrow();
    this.arrow.visible = false;
    this.stage.scene.add(this.arrow);
    const ga = new THREE.Shape();
    ga.moveTo(0, 0.55);
    ga.lineTo(0.4, -0.2);
    ga.lineTo(0, -0.02);
    ga.lineTo(-0.4, -0.2);
    ga.closePath();
    const gaGeo = new THREE.ShapeGeometry(ga);
    gaGeo.rotateX(-Math.PI / 2);
    this.groundArrow = new THREE.Mesh(gaGeo, new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, depthWrite: false }));
    this.groundArrow.visible = false;
    this.stage.scene.add(this.groundArrow);
    this.maxLabel = this.labels.add(t('max'), new THREE.Vector3(), 'max-label');
    this.maxLabel.visible = false;

    this.restore();
    this.buildPortraits();
    this.buildButtons();
    this.ui.onModalChange = (open) => (open ? this.pauseAdd('modal') : this.pauseDel('modal'));
    sdk.onPause = () => this.pauseAdd('sdk');
    sdk.onResume = () => this.pauseDel('sdk');
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseAdd('hidden');
        this.save(true);
      } else this.pauseDel('hidden');
    });
    window.addEventListener('pagehide', () => this.save(true));
    window.addEventListener('resize', () => this.stage.resize());
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    audio.setSound(s.sound);
    audio.setMusic(s.music);
    this.stage.follow(this.player.pos, 0, true);
  }

  // ------------------------------------------------------------------ setup

  private skin(): SkinDef {
    return SKINS.find((k) => k.id === this.s.skin) || SKINS[0];
  }

  private buildPortraits() {
    const jobs = [
      { opts: skinHumanOpts(this.skin()) },
      { opts: NPC.granny },
      { opts: NPC.fedor },
      { opts: NPC.petya },
      ...SKINS.map((k) => ({ opts: { ...skinHumanOpts(k), basket: false }, full: true })),
    ];
    const res = renderPortraits(this.stage.renderer, jobs);
    this.portraits = { arina: res[0], granny: res[1], fedor: res[2], petya: res[3] };
    SKINS.forEach((k, i) => (this.skinPortraits[k.id] = res[4 + i]));
  }

  private restore() {
    const s = this.s;
    for (const f of FIELDS) if (!f.unlock) this.fields.get(f.id)!.activate(true);
    for (const sd of STATIONS) {
      if (!sd.unlock) {
        const st = this.stations.get(sd.id)!;
        st.activate();
        for (let i = 0; i < (sd.startAnimals || 0); i++) st.addAnimal();
      }
    }
    for (const sh of SHELVES) if (!sh.unlock) this.shelves.get(sh.item)!.activate();
    for (const u of UNLOCKS) if (s.unlocked.includes(u.id)) this.applyUnlock(u, true);
    for (const [id, v] of Object.entries(s.st)) {
      const st = this.stations.get(id);
      if (!st || !st.active) continue;
      st.inCount = Math.min(v[0] | 0, st.def.inCap);
      st.outCount = Math.min(v[1] | 0, st.def.outCap);
      st.inPile?.set(st.inCount, false);
      st.outPile.set(st.outCount, false);
      st.refreshLabels();
    }
    for (const [item, v] of Object.entries(s.sh)) {
      const sh = this.shelves.get(item as ItemId);
      if (!sh || !sh.active) continue;
      sh.count = Math.min(v[0] | 0, 30);
      sh.pile.set(sh.count, false);
      sh.refresh();
      sh.coins = Math.max(0, v[1] || 0);
      sh.refreshCoins();
    }
    this.player.restore(s.stack.slice(0, this.capacity()));
    this.refreshPads(true);
    this.rebuildColliders();
    this.refreshHUD();
  }

  private rebuildColliders() {
    const c: Collider[] = [...this.world.colliders];
    for (const st of this.stations.values()) if (st.active) c.push(st.collider);
    for (const sh of this.shelves.values()) if (sh.active) c.push(sh.collider);
    c.push({ x1: this.binPos.x - 0.45, z1: this.binPos.z - 0.45, x2: this.binPos.x + 0.45, z2: this.binPos.z + 0.45 });
    if (this.unlocked.has('fair')) c.push({ x1: FAIR.x - 4.4, z1: FAIR.z - 3.4, x2: FAIR.x + 4.6, z2: FAIR.z + 3.2 });
    c.push(...this.decoColliders);
    this.colliders = c;
  }

  unlockName(u: UnlockDef): string {
    switch (u.kind) {
      case 'field':
        return t('f_' + u.target);
      case 'station':
        return t('st_' + u.target);
      case 'animal': {
        const st = STATIONS.find((s) => s.id === u.target)!;
        return t('pad_animal', { name: t('an_' + st.animal) });
      }
      case 'shelf':
        return `${t('pad_shelf')} ${ITEMS[u.target as ItemId].icon}`;
      case 'helper': {
        const h = HELPERS.find((x) => x.id === u.target)!;
        return `${t('pad_helper')} ${ITEMS[h.item].icon}`;
      }
      case 'fair':
        return t('fair');
      case 'deco':
        return t('deco_' + u.target);
    }
  }

  private applyUnlock(u: UnlockDef, instant: boolean) {
    this.unlocked.add(u.id);
    for (const f of FIELDS) if (f.unlock === u.id) this.fields.get(f.id)!.activate(instant);
    for (const sd of STATIONS) {
      if (sd.unlock === u.id) {
        const st = this.stations.get(sd.id)!;
        st.activate();
        for (let i = 0; i < (sd.startAnimals || 0); i++) st.addAnimal();
      }
    }
    for (const sh of SHELVES) if (sh.unlock === u.id) this.shelves.get(sh.item)!.activate();
    if (u.kind === 'animal') this.stations.get(u.target)!.addAnimal();
    if (u.kind === 'helper') {
      const def = HELPERS.find((h) => h.id === u.target)!;
      const start = instant ? this.helperStart(def) : new THREE.Vector3(u.x, 0, u.z);
      this.helpers.push(new Helper(def, this.stage.scene, start));
    }
    if (u.kind === 'fair') {
      const fair = buildFair();
      fair.mesh.position.set(FAIR.x, 0, FAIR.z);
      this.stage.scene.add(fair.mesh);
      this.fairSpins = fair.spins;
    }
    if (u.kind === 'deco') {
      const d = buildDeco(u.target);
      d.mesh.position.set(u.x, 0, u.z);
      this.stage.scene.add(d.mesh);
      if (d.animate) this.decoAnims.push(d.animate);
      this.decoColliders.push({ x1: u.x - d.radius, z1: u.z - d.radius, x2: u.x + d.radius, z2: u.z + d.radius });
      if (!instant) this.ui.toast(`⭐ +${Math.round(DECO_BONUS * 100)}% 🪙`, 'big');
    }
    this.pads.get(u.id)?.hide();
    if (!instant) {
      const p = new THREE.Vector3(u.x, 0.5, u.z);
      this.fx.burst(p, 0xffd23f, 18, 5, 1.2);
      this.fx.burst(p, 0xffffff, 10, 4, 1);
      this.stage.shakeT = 0.25;
      audio.play('unlock');
      this.ui.toast(`${u.icon} ${this.unlockName(u)}!`, 'good');
      this.rebuildColliders();
    }
  }

  private helperStart(def: (typeof HELPERS)[number]): THREE.Vector3 {
    if ('field' in def.from) {
      const f = this.fields.get(def.from.field)!.def;
      return new THREE.Vector3(f.x, 0, f.z + 2);
    }
    return this.stations.get(def.from.station)!.outZone.clone();
  }

  private refreshPads(instant = false) {
    for (const u of UNLOCKS) {
      const pad = this.pads.get(u.id)!;
      if (this.unlocked.has(u.id)) {
        if (pad.visible) pad.hide();
        continue;
      }
      const ok = u.req.every((r) => this.unlocked.has(r));
      if (ok && !pad.visible) {
        pad.show(this.s.pads[u.id] || 0);
        if (!instant) this.fx.burst(new THREE.Vector3(u.x, 0.3, u.z), 0xffffff, 8, 3, 0.8);
      }
    }
  }

  private buildButtons() {
    const ui = this.ui;
    ui.upgradesBtn.onclick = () => {
      audio.unlock();
      audio.play('click');
      this.openUpgrades();
    };
    ui.settingsBtn.onclick = () => {
      audio.unlock();
      audio.play('click');
      this.openSettings();
    };
    ui.wardrobeBtn.onclick = () => {
      audio.unlock();
      audio.play('click');
      this.openWardrobe();
    };
    ui.shopBtn.onclick = () => {
      audio.unlock();
      audio.play('click');
      this.openShop();
    };
    if (sdk.catalog.some((p) => p.id in IAP_COINS || p.id === 'no_ads')) ui.shopBtn.style.display = '';

    const mk = (cls: string) => {
      const b = el('button', 'ad-btn interactive ' + cls);
      ui.rightCol.appendChild(b);
      return b;
    };
    this.boostBtns = { income: mk(''), speed: mk(''), gift: mk('gift') };
    this.boostBtns.income.onclick = () => this.boost('income');
    this.boostBtns.speed.onclick = () => this.boost('speed');
    this.boostBtns.gift.onclick = () => this.claimGift();
    this.refreshBoostButtons();
  }

  // ------------------------------------------------------------------ economy

  capacity() {
    return CONFIG.baseCap + CONFIG.capPerLvl * (this.s.up.cap || 0);
  }
  speed() {
    return CONFIG.baseSpeed * (1 + CONFIG.speedPerLvl * (this.s.up.speed || 0)) * (this.s.boosts.speed > 0 ? 1.5 : 1);
  }
  basePriceMult() {
    const decos = UNLOCKS.filter((u) => u.kind === 'deco' && this.unlocked.has(u.id)).length;
    return (1 + CONFIG.pricePerLvl * (this.s.up.price || 0)) * (this.unlocked.has('fair') ? 1 + FAIR.priceBonus : 1) * (1 + DECO_BONUS * decos);
  }
  priceMult() {
    return this.basePriceMult() * (this.s.boosts.income > 0 ? 2 : 1);
  }
  prodMult() {
    return 1 + CONFIG.prodPerLvl * (this.s.up.prod || 0);
  }
  helperCap() {
    return CONFIG.helperBaseCap + (this.s.up.helper || 0);
  }
  helperSpeed() {
    return CONFIG.helperSpeed * (1 + 0.06 * (this.s.up.helper || 0));
  }
  private giftAmount() {
    return Math.round(40 * Math.pow(this.s.level, 1.7) + 20);
  }

  addCoins(n: number, fromScreen?: { x: number; y: number }) {
    this.s.coins += n;
    this.s.stats.earned += n;
    this.questEvent('earn', undefined, n);
    if (fromScreen) this.ui.flyCoins(fromScreen.x, fromScreen.y, Math.ceil(Math.min(8, n / 5 + 1)));
    this.ui.setCoins(Math.floor(this.s.coins), true);
    this.shownCoins = Math.floor(this.s.coins);
  }

  private toScreen(p: THREE.Vector3) {
    _v.copy(p).project(this.stage.camera);
    return { x: (_v.x * 0.5 + 0.5) * window.innerWidth, y: (-_v.y * 0.5 + 0.5) * window.innerHeight };
  }

  addXP(n: number) {
    this.s.xp += n;
    let need = xpForLevel(this.s.level);
    while (this.s.xp >= need) {
      this.s.xp -= need;
      this.s.level++;
      need = xpForLevel(this.s.level);
      this.onLevelUp(this.s.level);
    }
    this.refreshHUD();
  }

  private onLevelUp(level: number) {
    audio.play('levelup');
    this.fx.burst(this.player.pos.clone().setY(1.5), 0x8ad5ff, 20, 5, 1.1);
    const reward = levelReward(level);
    this.ui.enqueue(() => {
      const body = el('div', '', `<div class="reward-ico">🏆</div><div class="modal-text">${t('level_up_text')}</div><div class="reward-big">🪙 ${fmt(reward)}</div>`);
      let watched = false;
      this.ui.modal({
        title: `${t('level')} ${level}!`,
        color: 'blue',
        body,
        center: true,
        closable: false,
        buttons: [
          {
            text: `📺 ${t('take_x3')}`,
            cls: 'purple',
            onClick: async () => {
              const ok = await this.rewarded();
              if (ok) {
                watched = true;
                this.addCoins(reward * 3, { x: innerWidth / 2, y: innerHeight / 2 });
                return false;
              }
              return true;
            },
          },
          {
            text: t('take'),
            onClick: () => {
              this.addCoins(reward, { x: innerWidth / 2, y: innerHeight / 2 });
            },
          },
        ],
        onClose: () => {
          if (!watched) this.maybeInterstitial();
        },
      });
    });
  }

  // ------------------------------------------------------------------ pause / ads

  pauseAdd(r: PauseReason) {
    this.pause.add(r);
    this.applyPause();
  }
  pauseDel(r: PauseReason) {
    this.pause.delete(r);
    this.applyPause();
  }
  private applyPause() {
    const muted = this.pause.has('hidden') || this.pause.has('ad') || this.pause.has('sdk');
    audio.setMuted(muted);
    if (this.pause.size > 0) {
      sdk.gameplayStop();
      this.input.release();
    } else sdk.gameplayStart();
  }

  async rewarded(): Promise<boolean> {
    let opened = false;
    const ok = await sdk.showRewarded({
      open: () => {
        opened = true;
        this.pauseAdd('ad');
      },
      close: () => this.pauseDel('ad'),
    });
    this.pauseDel('ad');
    this.lastAd = performance.now();
    if (!opened && !ok) this.ui.toast(t('ad_unavailable'));
    return ok;
  }

  async maybeInterstitial() {
    if (this.s.noAds) return;
    const now = performance.now();
    if (now - this.lastAd < CONFIG.interstitialCooldown * 1000) return;
    if (now - this.sessionStart < 60000) return;
    this.lastAd = now;
    this.pauseAdd('ad');
    await this.ui.adCountdown(2);
    await sdk.showInterstitial({ open: () => undefined, close: () => undefined });
    this.pauseDel('ad');
    this.lastAd = performance.now();
  }

  private async boost(kind: 'income' | 'speed') {
    audio.unlock();
    audio.play('click');
    const ok = await this.rewarded();
    if (!ok) return;
    this.s.boosts[kind] = Math.min(CONFIG.boostDuration * 3, Math.max(0, this.s.boosts[kind]) + CONFIG.boostDuration);
    this.ui.toast(kind === 'income' ? `💰 ${t('boost_income')}!` : `👟 ${t('boost_speed')}!`, 'big');
    audio.play('levelup');
    this.refreshBoostButtons();
    this.save();
  }

  private async claimGift() {
    audio.unlock();
    audio.play('click');
    const ok = await this.rewarded();
    if (!ok) return;
    const n = this.giftAmount();
    const r = this.boostBtns.gift.getBoundingClientRect();
    this.addCoins(n, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    this.giftReadyAt = this.time + CONFIG.giftCooldown;
    audio.play('coin');
    this.refreshBoostButtons();
    this.save();
  }

  private refreshBoostButtons() {
    const show = this.s.ch >= 1 || this.s.level >= 2;
    const b = this.boostBtns;
    const fmtT = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
    const set = (btn: HTMLButtonElement, icon: string, title: string, sub: string, active: boolean) => {
      const html = `<span class="ad-ico">${icon}</span><span>${title}<br><span class="tv">${sub}</span></span>`;
      if (btn.innerHTML !== html) btn.innerHTML = html;
      btn.classList.toggle('active', active);
    };
    b.income.style.display = show ? '' : 'none';
    b.speed.style.display = show ? '' : 'none';
    const inc = this.s.boosts.income;
    const spd = this.s.boosts.speed;
    set(b.income, '💰', t('boost_income'), inc > 0 ? t('boost_active', { t: fmtT(inc) }) : `📺 ${t('boost_income_desc')}`, inc > 0);
    set(b.speed, '👟', t('boost_speed'), spd > 0 ? t('boost_active', { t: fmtT(spd) }) : `📺 ${t('boost_speed_desc')}`, spd > 0);
    const giftReady = show && this.time >= this.giftReadyAt;
    b.gift.style.display = giftReady ? '' : 'none';
    set(b.gift, '🎁', t('boost_gift'), `📺 +${fmt(this.giftAmount())} 🪙`, false);
  }

  // ------------------------------------------------------------------ quests

  private currentQuest(): QuestView {
    const s = this.s;
    if (s.ch < CHAPTERS.length) {
      const ch = CHAPTERS[s.ch];
      const q = ch.quests[Math.min(s.q, ch.quests.length - 1)];
      return { ...q, chapter: `${t('chapter', { n: s.ch + 1 })} · ${t(ch.id)}`, text: this.questText(q.type, q.target, q.n) };
    }
    if (!s.order) s.order = this.makeOrder();
    const o = s.order;
    return { type: 'sell', target: o.item, n: o.n, reward: o.reward, chapter: `${t('orders')} #${s.orders + 1}`, text: t('order_q', { item: t('item_' + o.item), n: o.n }) };
  }

  private makeOrder() {
    const avail = SELLABLE.filter((i) => this.shelves.get(i)?.active);
    const item = avail[Math.floor(Math.random() * avail.length)] || 'milk';
    const price = ITEMS[item].price;
    const n = Math.max(5, Math.round((14 + this.s.orders * 1.5) * Math.sqrt(10 / Math.max(5, price))));
    const reward = Math.round(price * n * 2.2 * this.basePriceMult());
    return { item, n, reward };
  }

  private questText(type: QuestType, target: string | undefined, n: number) {
    switch (type) {
      case 'harvest':
        return t('q_harvest', { item: t('item_' + target), n });
      case 'feed':
        return t('q_feed', { name: t('st_' + target), n });
      case 'collect':
        return t('q_collect', { item: t('item_' + target), n });
      case 'sell':
        return t('q_sell', { item: t('item_' + target), n });
      case 'unlock': {
        const u = UNLOCKS.find((x) => x.id === target)!;
        return t('q_unlock', { name: `${u.icon} ${this.unlockName(u)}` });
      }
      case 'earn':
        return t('q_earn', { n: fmt(n) });
      case 'upgrade':
        return t('q_upgrade', { n });
      case 'helpers':
        return t('q_helpers', { n });
    }
  }

  questEvent(type: QuestType, target: string | undefined, amount = 1) {
    const q = this.currentQuest();
    if (q.type !== type) return;
    if (q.target !== undefined && q.target !== target) return;
    this.s.qp += amount;
    this.refreshQuest();
    if (this.s.qp >= q.n) this.completeQuest();
  }

  private checkQuestAuto() {
    const q = this.currentQuest();
    if (q.type === 'unlock' && q.target && this.unlocked.has(q.target)) {
      this.s.qp = 1;
      this.completeQuest();
    } else if (q.type === 'helpers') {
      this.s.qp = this.helpers.length;
      this.refreshQuest();
      if (this.s.qp >= q.n) this.completeQuest();
    }
  }

  private completeQuest() {
    if (this.completingQuest) return;
    this.completingQuest = true;
    const q = this.currentQuest();
    const s = this.s;
    audio.play('quest');
    this.ui.questFlash();
    s.qp = 0;
    if (s.ch < CHAPTERS.length) {
      s.q++;
      if (s.q >= CHAPTERS[s.ch].quests.length) {
        const ch = CHAPTERS[s.ch];
        s.ch++;
        s.q = 0;
        this.chapterComplete(ch.id, ch.reward);
      }
    } else {
      s.orders++;
      s.order = this.makeOrder();
    }
    if (q.reward > 0) {
      this.addCoins(q.reward, { x: 120, y: 120 });
      this.ui.toast(`✅ +${fmt(q.reward)} 🪙`, 'good');
    }
    this.addXP(Math.max(2, Math.round(q.reward / 3)));
    this.completingQuest = false;
    this.refreshQuest();
    this.refreshBoostButtons();
    if (s.qp >= this.currentQuest().n) this.completeQuest();
    this.save();
  }

  private chapterComplete(id: string, reward: number) {
    this.ui.enqueue(() => {
      let watched = false;
      const body = el(
        'div',
        '',
        `<div class="reward-ico">📖</div><div class="modal-text">${t('chapter_done_text', { name: t(id) })}</div><div class="reward-big">🪙 ${fmt(reward)}</div>`,
      );
      this.ui.modal({
        title: t('chapter_done'),
        color: 'green',
        body,
        center: true,
        closable: false,
        buttons: [
          {
            text: `📺 ${t('take_x2')}`,
            cls: 'purple',
            onClick: async () => {
              const ok = await this.rewarded();
              if (ok) {
                watched = true;
                this.addCoins(reward * 2, { x: innerWidth / 2, y: innerHeight / 2 });
                return false;
              }
              return true;
            },
          },
          { text: t('take'), onClick: () => this.addCoins(reward, { x: innerWidth / 2, y: innerHeight / 2 }) },
        ],
        onClose: () => {
          if (!watched) this.maybeInterstitial();
        },
      });
    });
    this.ui.enqueue(() => this.showChapterIntro());
  }

  showChapterIntro() {
    const s = this.s;
    if (s.introSeen >= s.ch) return;
    s.introSeen = s.ch;
    const lines: { sp: Speaker; key: string }[] = [];
    if (s.ch < CHAPTERS.length) {
      CHAPTERS[s.ch].lines.forEach((sp, i) => lines.push({ sp, key: `${CHAPTERS[s.ch].id}_${i}` }));
    } else lines.push({ sp: 'petya', key: 'endless_0' });
    this.ui.dialog(
      lines.map((l) => ({ name: t('sp_' + l.sp), text: t(l.key), portrait: this.portraits[l.sp] || '🙂', right: l.sp === 'arina' })),
      () => this.save(),
    );
  }

  private questTarget(): THREE.Vector3 | null {
    const q = this.currentQuest();
    switch (q.type) {
      case 'harvest': {
        const f = [...this.fields.values()].find((x) => x.active && x.def.item === q.target);
        return f ? new THREE.Vector3(f.def.x, 0, f.def.z) : null;
      }
      case 'feed': {
        const st = this.stations.get(q.target!);
        if (!st || !st.active || !st.def.input) return null;
        if (this.player.has(st.def.input)) return st.inZone;
        return this.guide(st.def.input);
      }
      case 'collect':
        return this.guide(q.target as ItemId);
      case 'sell': {
        const sh = this.shelves.get(q.target as ItemId);
        if (!sh || !sh.active) return null;
        if (this.player.has(q.target as ItemId) || sh.count >= 30) return sh.zone;
        if (sh.coins >= 1 && sh.count > 0) return sh.zone;
        return this.guide(q.target as ItemId) || sh.zone;
      }
      case 'unlock': {
        const pad = this.pads.get(this.firstMissing(q.target!));
        if (pad && pad.visible) {
          const left = pad.def.cost - pad.paid;
          if (this.s.coins >= Math.min(left, 1)) return new THREE.Vector3(pad.def.x, 0, pad.def.z);
          return this.richestShelf() || new THREE.Vector3(pad.def.x, 0, pad.def.z);
        }
        return null;
      }
      default:
        return null;
    }
  }

  /** First not-yet-unlocked step on the requirement chain leading to `id`. */
  private firstMissing(id: string, depth = 0): string {
    const u = UNLOCKS.find((x) => x.id === id);
    if (!u || depth > 10) return id;
    for (const r of u.req) if (!this.unlocked.has(r)) return this.firstMissing(r, depth + 1);
    return id;
  }

  private richestShelf(): THREE.Vector3 | null {
    let best: Shelf | null = null;
    for (const sh of this.shelves.values()) if (sh.active && sh.coins >= 1 && (!best || sh.coins > best.coins)) best = sh;
    return best ? best.zone : null;
  }

  /** Where the player should go next to obtain the given item. */
  private guide(item: ItemId, depth = 0): THREE.Vector3 | null {
    if (depth > 4) return null;
    for (const st of this.stations.values()) {
      if (!st.active || st.def.output !== item) continue;
      if (st.outCount > 0) return st.outZone;
      const inp = st.def.input;
      if (!inp) return st.outZone;
      if (st.inCount > 0) return st.outZone;
      if (this.player.has(inp)) return st.inZone;
      return this.guide(inp, depth + 1) || st.inZone;
    }
    for (const f of this.fields.values()) if (f.active && f.def.item === item) return new THREE.Vector3(f.def.x, 0, f.def.z);
    return null;
  }

  private refreshQuest() {
    const q = this.currentQuest();
    this.ui.setQuest(q.chapter, q.text, this.s.qp, q.n, q.reward);
  }

  private refreshHUD() {
    this.ui.setCoins(Math.floor(this.s.coins));
    this.ui.setLevel(this.s.level, this.s.xp / xpForLevel(this.s.level));
    this.refreshQuest();
  }

  // ------------------------------------------------------------------ main update

  start() {
    this.pauseDel('loading');
    this.refreshHUD();
    const firstRun = this.s.introSeen < 0;
    if (firstRun) {
      this.hintActive = true;
      this.ui.showHint(this.mobile ? t('hint_touch') : t('hint_desktop'));
    }
    this.showWelcomeBack();
    this.ui.enqueue(() => this.showChapterIntro());
    this.processPurchases();
    requestAnimationFrame(this.loop);
  }

  private loop = (now: number) => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    if (this.pause.has('hidden') || this.pause.has('ad')) return;
    const simPaused = this.pause.size > 0;
    if (!simPaused) this.update(dt);
    this.world.update(dt, now / 1000);
    this.stage.follow(this.player.pos, dt);
    this.labels.update(this.stage.camera);
    this.stage.render();
  };

  private update(dt: number) {
    this.time += dt;
    this.s.stats.play += dt;
    const s = this.s;
    this.input.update();
    this.player.update(dt, this.input.x, this.input.z, this.speed(), this.colliders);
    this.pet.update(dt, this.player.pos, this.player.rot, this.colliders);
    if (this.hintActive) {
      this.moveAcc += Math.hypot(this.input.x, this.input.z) * dt;
      if (this.moveAcc > 1.2) {
        this.hintActive = false;
        this.ui.hideHint();
      }
    }

    const prod = this.prodMult();
    for (const f of this.fields.values()) f.update(dt, prod);
    for (const st of this.stations.values()) st.update(dt, prod);
    for (const sh of this.shelves.values()) sh.update(dt);

    this.interact(dt);
    this.updatePads(dt);

    const henv: HelperEnv = {
      fields: this.fields,
      stations: this.stations,
      shelves: this.shelves,
      fx: this.fx,
      cap: this.helperCap(),
      speed: this.helperSpeed(),
      onDeliver: (to) => {
        if ('station' in to) this.questEvent('feed', to.station);
      },
    };
    for (const h of this.helpers) h.update(dt, henv);

    const activeShelves = [...this.shelves.values()].filter((x) => x.active);
    const cenv: CustomerEnv = {
      shelves: activeShelves,
      interval: CONFIG.customerInterval / (1 + CONFIG.customerPerLvl * (s.up.customers || 0)) / (1 + 0.22 * (activeShelves.length - 1)),
      maxCustomers: 3 + activeShelves.length * 2,
      priceFor: (item) => ITEMS[item].price * this.priceMult(),
      onSale: (shelf, item, coins) => {
        shelf.addCoins(coins);
        s.stats.sold++;
        this.ctx.sound('coin', shelf.zone);
        this.addXP(ITEMS[item].xp);
        this.questEvent('sell', item);
      },
    };
    this.customers.update(dt, cenv);

    if (s.up.autocash) {
      this.autoCashT -= dt;
      if (this.autoCashT <= 0) {
        this.autoCashT = 1;
        for (const sh of this.shelves.values()) if (sh.active && sh.coins >= 1) this.collectShelf(sh, true);
      }
    }

    for (const a of this.decoAnims) a(this.time);
    for (const sp of this.fairSpins) {
      if (sp.axis === 'y') sp.o.rotation.y += dt * sp.speed;
      else sp.o.rotation.z += dt * sp.speed;
    }

    if (s.boosts.income > 0) s.boosts.income = Math.max(0, s.boosts.income - dt);
    if (s.boosts.speed > 0) s.boosts.speed = Math.max(0, s.boosts.speed - dt);

    this.fx.update(dt);
    this.updateArrow(dt);

    const full = this.player.count >= this.capacity();
    this.maxLabel.visible = full;
    if (full) {
      this.player.topWorld(this.maxLabel.pos);
      this.maxLabel.pos.y += 0.5;
    }

    const coinsNow = Math.floor(s.coins);
    if (coinsNow !== this.shownCoins) {
      this.shownCoins = coinsNow;
      this.ui.setCoins(coinsNow);
    }

    this.uiT -= dt;
    if (this.uiT <= 0) {
      this.uiT = 0.5;
      this.refreshBoostButtons();
      this.refreshNotifications();
      for (const pad of this.pads.values()) if (pad.visible) pad.refresh(s.coins);
    }
    this.questCheckT -= dt;
    if (this.questCheckT <= 0) {
      this.questCheckT = 1;
      this.checkQuestAuto();
    }
    this.saveT -= dt;
    if (this.saveT <= 0) {
      this.saveT = 6;
      this.save();
    }
  }

  private showFull() {
    if (this.fullToastT > this.time) return;
    this.fullToastT = this.time + 3;
    this.ui.toast(`🧺 ${t('stack_full')}`);
    audio.play('error');
  }

  private interact(dt: number) {
    const p = this.player.pos;
    const cap = this.capacity();
    const pl = this.player;

    this.harvestT -= dt;
    if (this.harvestT <= 0) {
      for (const f of this.fields.values()) {
        if (!f.active || !f.contains(p.x, p.z, 1.0)) continue;
        const idx = f.ripeNear(p.x, p.z, 1.2);
        if (idx < 0) continue;
        if (pl.count >= cap) {
          this.showFull();
          break;
        }
        const from = f.harvest(idx);
        pl.push(f.def.item, 0.26);
        this.fx.fly(f.def.item, from, () => pl.topWorld(_v.clone()), 0.26, undefined, 0.9);
        this.fx.burst(from, f.def.kind === 'tree' ? 0x5fb546 : f.def.kind === 'wheat' ? 0xf2cf63 : 0x7fd35b, 5, 2, 0.6);
        audio.play('harvest');
        this.questEvent('harvest', f.def.item);
        this.harvestT = 0.07;
        break;
      }
    }

    this.transferT -= dt;
    if (this.transferT > 0) return;
    const R = 1.35 * 1.35;
    for (const st of this.stations.values()) {
      if (!st.active) continue;
      const inp = st.def.input;
      if (inp && dist2(p, st.inZone) < R && pl.has(inp) && st.canAccept()) {
        const r = pl.remove(inp)!;
        const dest = new THREE.Vector3();
        st.inSlotWorld(dest);
        st.accept();
        this.fx.fly(inp, r.pos, dest, 0.25, undefined, 0.8);
        audio.play('drop');
        this.questEvent('feed', st.def.id);
        this.transferT = 0.07;
        return;
      }
      if (dist2(p, st.outZone) < R && st.outCount > 0) {
        if (pl.count >= cap) {
          this.showFull();
          continue;
        }
        const from = new THREE.Vector3();
        st.outSlotWorld(from);
        st.take();
        pl.push(st.def.output, 0.24);
        this.fx.fly(st.def.output, from, () => pl.topWorld(_v.clone()), 0.24, undefined, 0.8);
        audio.play('pick', pl.count);
        this.questEvent('collect', st.def.output);
        this.transferT = 0.07;
        return;
      }
    }
    const RS = 1.45 * 1.45;
    for (const sh of this.shelves.values()) {
      if (!sh.active || dist2(p, sh.zone) >= RS) continue;
      if (sh.coins >= 1) this.collectShelf(sh, false);
      if (pl.has(sh.def.item) && sh.canAccept()) {
        const r = pl.remove(sh.def.item)!;
        const dest = new THREE.Vector3();
        sh.slotWorld(dest);
        sh.add();
        this.fx.fly(sh.def.item, r.pos, dest, 0.25, undefined, 0.8);
        audio.play('drop');
        this.transferT = 0.06;
        return;
      }
    }
    if (pl.count > 0 && dist2(p, this.binPos) < 1.5 * 1.5) {
      const r = pl.remove()!;
      this.fx.fly(r.item, r.pos, this.binPos.clone().setY(0.9), 0.25, () => this.fx.burst(this.binPos.clone().setY(1), 0xcccccc, 3, 1.5, 0.5), 0.8);
      audio.play('drop');
      this.transferT = 0.05;
    }
  }

  private collectShelf(sh: Shelf, auto: boolean) {
    const amount = Math.floor(sh.coins);
    if (amount < 1) return;
    sh.coins -= amount;
    sh.refreshCoins();
    const from = sh.coinPile.mesh.getWorldPosition(new THREE.Vector3()).setY(0.4);
    const n = Math.min(6, 1 + Math.floor(amount / 10));
    for (let i = 0; i < n; i++) {
      setTimeout(() => this.fx.fly('coin', from, () => this.player.pos.clone().setY(1.2), 0.3, undefined, 1.2), i * 40);
    }
    this.addCoins(amount, this.toScreen(this.player.pos.clone().setY(1.5)));
    if (!auto || sh.zone.distanceTo(this.player.pos) < 12) this.fx.floatText(`+${fmt(amount)}`, sh.zone.clone().setY(1.6));
    audio.play('coin');
  }

  private updatePads(dt: number) {
    const p = this.player.pos;
    let standingOn: Pad | null = null;
    for (const pad of this.pads.values()) {
      if (!pad.visible) continue;
      const standing = pad.contains(p.x, p.z);
      pad.update(dt, standing);
      if (standing) standingOn = pad;
    }
    if (!standingOn) {
      this.padToastFor = null;
      return;
    }
    const pad = standingOn;
    const left = pad.def.cost - pad.paid;
    if (this.s.coins < 1) {
      if (this.padToastFor !== pad) {
        this.padToastFor = pad;
        this.ui.toast(`🪙 ${t('need_coins')}`);
        audio.play('error');
      }
      return;
    }
    const rate = Math.max(pad.def.cost / 2.2, 8);
    const amt = Math.min(rate * dt, this.s.coins, left);
    pad.paid += amt;
    this.s.coins -= amt;
    this.s.pads[pad.def.id] = pad.paid;
    this.payCoinT -= dt;
    if (this.payCoinT <= 0) {
      this.payCoinT = 0.07;
      this.fx.fly('coin', this.player.pos.clone().setY(1.3), new THREE.Vector3(pad.def.x, 0.1, pad.def.z), 0.25, undefined, 1.0);
      audio.play('pay', pad.paid / pad.def.cost);
    }
    pad.refresh(this.s.coins);
    if (pad.paid >= pad.def.cost - 1e-6) {
      delete this.s.pads[pad.def.id];
      this.applyUnlock(pad.def, false);
      this.addXP(Math.max(2, Math.round(pad.def.cost / 8)));
      this.questEvent('unlock', pad.def.id);
      this.refreshPads();
      this.save();
    }
  }

  private updateArrow(dt: number) {
    this.arrowTarget = this.questTarget();
    const tg = this.arrowTarget;
    const pp = this.player.pos;
    if (!tg) {
      this.arrow.visible = false;
      this.groundArrow.visible = false;
      return;
    }
    const d = Math.hypot(tg.x - pp.x, tg.z - pp.z);
    this.arrow.visible = d > 1.2;
    this.arrow.position.set(tg.x, 2.4 + Math.sin(this.time * 5) * 0.25, tg.z);
    this.arrow.rotation.y += dt * 2.5;
    this.groundArrow.visible = d > 3;
    if (this.groundArrow.visible) {
      const ang = Math.atan2(tg.x - pp.x, tg.z - pp.z);
      this.groundArrow.position.set(pp.x + Math.sin(ang) * 1.5, 0.06, pp.z + Math.cos(ang) * 1.5);
      this.groundArrow.rotation.y = ang + Math.PI;
      const s = 1 + Math.sin(this.time * 6) * 0.08;
      this.groundArrow.scale.setScalar(s);
    }
  }

  private refreshNotifications() {
    const canUp = UPGRADES.some((u) => this.canBuyUpgrade(u));
    this.ui.upgradesBtn.classList.toggle('notify', canUp);
    const canSkin = SKINS.some((k) => !this.s.skins.includes(k.id) && k.cost > 0 && this.s.coins >= k.cost);
    this.ui.wardrobeBtn.classList.toggle('notify', canSkin);
  }

  // ------------------------------------------------------------------ panels

  private canBuyUpgrade(u: UpgradeDef) {
    const lvl = this.s.up[u.id] || 0;
    return lvl < u.max && this.s.level >= u.minLevel && this.s.coins >= upgradeCost(u, lvl);
  }

  private upgradeDesc(u: UpgradeDef, lvl: number) {
    switch (u.id) {
      case 'cap':
        return t('up_cap_d', { v: CONFIG.baseCap + CONFIG.capPerLvl * lvl });
      case 'speed':
        return t('up_speed_d', { v: Math.round(CONFIG.speedPerLvl * lvl * 100) });
      case 'prod':
        return t('up_prod_d', { v: Math.round(CONFIG.prodPerLvl * lvl * 100) });
      case 'price':
        return t('up_price_d', { v: Math.round(CONFIG.pricePerLvl * lvl * 100) });
      case 'customers':
        return t('up_customers_d', { v: Math.round(CONFIG.customerPerLvl * lvl * 100) });
      case 'helper':
        return t('up_helper_d', { v: CONFIG.helperBaseCap + lvl });
      case 'autocash':
        return t('up_autocash_d');
    }
  }

  openUpgrades() {
    const list = el('div', 'list');
    const render = () => {
      list.innerHTML = '';
      for (const u of UPGRADES) {
        const lvl = this.s.up[u.id] || 0;
        const row = el('div', 'row');
        const ico = el('div', 'row-ico', u.icon);
        const main = el('div', 'row-main');
        main.appendChild(el('div', 'row-title', t('up_' + u.id)));
        main.appendChild(el('div', 'row-sub', this.upgradeDesc(u, lvl)));
        if (u.max > 1) {
          const dots = el('div', 'lvl-dots');
          for (let i = 0; i < u.max; i++) dots.appendChild(el('i', i < lvl ? 'on' : ''));
          main.appendChild(dots);
        }
        let btn: HTMLButtonElement;
        if (lvl >= u.max) {
          btn = el('button', 'btn disabled', t('max'));
          btn.disabled = true;
        } else if (this.s.level < u.minLevel) {
          btn = el('button', 'btn disabled', `🔒 ${t('up_locked', { n: u.minLevel })}`);
          btn.disabled = true;
        } else {
          const cost = upgradeCost(u, lvl);
          btn = el('button', 'btn' + (this.s.coins >= cost ? '' : ' disabled'), `🪙 ${fmt(cost)}`);
          btn.onclick = () => {
            if (this.s.coins < cost) {
              audio.play('error');
              this.ui.toast(`🪙 ${t('need_coins')}`);
              return;
            }
            this.s.coins -= cost;
            this.s.up[u.id] = lvl + 1;
            this.s.stats.upgrades++;
            audio.play('unlock');
            this.fx.burst(this.player.pos.clone().setY(1.2), 0x8bd36b, 14, 4, 1);
            this.questEvent('upgrade', undefined, 1);
            this.ui.setCoins(Math.floor(this.s.coins), true);
            this.save();
            render();
          };
        }
        row.append(ico, main, btn);
        list.appendChild(row);
      }
    };
    render();
    this.ui.modal({ title: `⬆️ ${t('upgrades')}`, body: list });
  }

  openSettings() {
    const list = el('div', 'list');
    const toggle = (label: string, on: boolean, cb: (v: boolean) => void) => {
      const row = el('div', 'row toggle-row');
      row.appendChild(el('div', 'row-title', label));
      const sw = el('button', 'switch' + (on ? ' on' : ''));
      sw.onclick = () => {
        on = !on;
        sw.classList.toggle('on', on);
        cb(on);
        audio.play('click');
      };
      row.appendChild(sw);
      list.appendChild(row);
    };
    toggle(`🔊 ${t('sound')}`, this.s.sound, (v) => {
      this.s.sound = v;
      audio.setSound(v);
      this.save();
    });
    toggle(`🎵 ${t('music')}`, this.s.music, (v) => {
      this.s.music = v;
      audio.setMusic(v);
      this.save();
    });
    const info = el('div', 'row');
    info.appendChild(el('div', 'row-sub', `🌐 ${t('lang')}: ${getLang().toUpperCase()} · ${t('reset_hint')} · v1.0`));
    list.appendChild(info);
    this.ui.modal({ title: `⚙️ ${t('settings')}`, body: list });
  }

  openWardrobe() {
    const grid = el('div', 'skin-grid');
    const render = () => {
      grid.innerHTML = '';
      for (const k of SKINS) {
        const owned = this.s.skins.includes(k.id);
        const card = el('div', 'skin-card' + (this.s.skin === k.id ? ' on' : ''));
        const img = new Image();
        img.src = this.skinPortraits[k.id];
        card.appendChild(img);
        card.appendChild(el('div', 'row-title', t('skin_' + k.id)));
        let btn: HTMLButtonElement;
        if (this.s.skin === k.id) {
          btn = el('button', 'btn disabled', t('equipped'));
          btn.disabled = true;
        } else if (owned) {
          btn = el('button', 'btn blue', t('equip'));
          btn.onclick = () => {
            this.equipSkin(k);
            render();
          };
        } else if (k.ads > 0) {
          const seen = this.s.skinAds[k.id] || 0;
          btn = el('button', 'btn purple', `📺 ${seen}/${k.ads}`);
          btn.onclick = async () => {
            const ok = await this.rewarded();
            if (!ok) return;
            this.s.skinAds[k.id] = seen + 1;
            if (seen + 1 >= k.ads) {
              this.s.skins.push(k.id);
              this.equipSkin(k);
            }
            this.save();
            render();
          };
        } else {
          btn = el('button', 'btn' + (this.s.coins >= k.cost ? ' orange' : ' disabled'), `🪙 ${fmt(k.cost)}`);
          btn.onclick = () => {
            if (this.s.coins < k.cost) {
              audio.play('error');
              this.ui.toast(`🪙 ${t('need_coins')}`);
              return;
            }
            this.s.coins -= k.cost;
            this.s.skins.push(k.id);
            this.equipSkin(k);
            this.save();
            render();
          };
        }
        card.appendChild(btn);
        grid.appendChild(card);
      }
    };
    render();
    this.ui.modal({ title: `👗 ${t('wardrobe')}`, body: grid, color: 'purple' });
  }

  private equipSkin(k: SkinDef) {
    this.s.skin = k.id;
    const items = this.player.stack.map((x) => x.item);
    while (this.player.remove()) {
      /* clear */
    }
    this.player.setSkin(k);
    this.player.restore(items);
    this.portraits.arina = renderPortraits(this.stage.renderer, [{ opts: skinHumanOpts(k) }])[0];
    this.stage.resize();
    audio.play('unlock');
    this.fx.burst(this.player.pos.clone().setY(1), 0xff9ec7, 16, 4, 1);
    this.save();
  }

  openShop() {
    const list = el('div', 'list');
    for (const p of sdk.catalog) {
      const coins = IAP_COINS[p.id];
      if (coins === undefined && p.id !== 'no_ads') continue;
      if (p.id === 'no_ads' && this.s.noAds) continue;
      const row = el('div', 'row');
      const ico = el('div', 'row-ico');
      if (p.imageURI) ico.appendChild(Object.assign(new Image(), { src: p.imageURI }));
      else ico.textContent = coins ? '💰' : '🚫';
      const main = el('div', 'row-main');
      main.appendChild(el('div', 'row-title', p.title || (coins ? t('shop_coins') : t('no_ads'))));
      main.appendChild(el('div', 'row-sub', coins ? `+${fmt(coins)} 🪙` : t('no_ads_desc')));
      const btn = el('button', 'btn orange', p.price);
      btn.onclick = async () => {
        const res = await sdk.purchase(p.id);
        if (!res.ok) return;
        this.grantPurchase(p.id);
        if (coins && res.token) await sdk.consume(res.token);
        this.save(true);
      };
      row.append(ico, main, btn);
      list.appendChild(row);
    }
    this.ui.modal({ title: `🛍️ ${t('shop')}`, body: list, color: 'purple' });
  }

  private grantPurchase(id: string) {
    const coins = IAP_COINS[id];
    if (coins) this.addCoins(coins, { x: innerWidth / 2, y: innerHeight / 2 });
    if (id === 'no_ads') this.s.noAds = true;
    this.ui.toast(`✨ ${t('purchased')}`, 'big');
    audio.play('levelup');
  }

  private async processPurchases() {
    const list = await sdk.unprocessedPurchases();
    for (const p of list) {
      if (p.id === 'no_ads') {
        this.s.noAds = true;
        continue;
      }
      if (IAP_COINS[p.id]) {
        this.grantPurchase(p.id);
        await sdk.consume(p.token);
      }
    }
    if (list.length) this.save(true);
  }

  private showWelcomeBack() {
    const s = this.s;
    const now = sdk.serverTime();
    const away = s.savedAt ? Math.min(CONFIG.offlineCapSec, Math.max(0, (now - s.savedAt) / 1000)) : 0;
    if (away > 60 && this.helpers.length > 0) {
      const avg = SELLABLE.filter((i) => this.shelves.get(i)?.active).reduce((a, i, _, arr) => a + ITEMS[i].price / arr.length, 0) || 5;
      const amount = Math.round(away * this.helpers.length * avg * 0.05 * this.basePriceMult());
      if (amount >= 20) {
        this.ui.enqueue(() => {
          const body = el('div', '', `<div class="reward-ico">🌙</div><div class="modal-text">${t('offline_text')}</div><div class="reward-big">🪙 ${fmt(amount)}</div>`);
          this.ui.modal({
            title: t('offline_title'),
            color: 'blue',
            body,
            center: true,
            closable: false,
            buttons: [
              {
                text: `📺 ${t('take_x2')}`,
                cls: 'purple',
                onClick: async () => {
                  const ok = await this.rewarded();
                  if (ok) {
                    this.addCoins(amount * 2, { x: innerWidth / 2, y: innerHeight / 2 });
                    return false;
                  }
                  return true;
                },
              },
              { text: t('take'), onClick: () => this.addCoins(amount, { x: innerWidth / 2, y: innerHeight / 2 }) },
            ],
          });
        });
      }
    }
    const today = new Date(now).toISOString().slice(0, 10);
    if (s.daily !== today && s.introSeen >= 0) {
      s.daily = today;
      const amount = 50 + s.level * 40;
      this.ui.enqueue(() => {
        const body = el('div', '', `<div class="reward-ico">🎁</div><div class="modal-text">${t('daily_text')}</div><div class="reward-big">🪙 ${fmt(amount)}</div>`);
        this.ui.modal({
          title: t('daily_title'),
          color: 'green',
          body,
          center: true,
          closable: false,
          buttons: [
            {
              text: `📺 ${t('take_x3')}`,
              cls: 'purple',
              onClick: async () => {
                const ok = await this.rewarded();
                if (ok) {
                  this.addCoins(amount * 3, { x: innerWidth / 2, y: innerHeight / 2 });
                  return false;
                }
                return true;
              },
            },
            { text: t('take'), onClick: () => this.addCoins(amount, { x: innerWidth / 2, y: innerHeight / 2 }) },
          ],
        });
      });
    } else if (s.introSeen < 0) s.daily = today;
  }

  // ------------------------------------------------------------------ save

  save(force = false) {
    const s = this.s;
    s.savedAt = sdk.serverTime();
    s.unlocked = [...this.unlocked];
    s.st = {};
    for (const [id, st] of this.stations) if (st.active) s.st[id] = [st.inCount, st.outCount];
    s.sh = {};
    for (const [item, sh] of this.shelves) if (sh.active) s.sh[item] = [sh.count, Math.round(sh.coins * 100) / 100];
    s.stack = this.player.stack.map((x) => x.item);
    s.pos = [Math.round(this.player.pos.x * 10) / 10, Math.round(this.player.pos.z * 10) / 10];
    s.coins = Math.round(s.coins * 100) / 100;
    sdk.save(s, force);
  }
}
