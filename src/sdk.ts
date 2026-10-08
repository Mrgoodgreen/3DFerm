/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YaGames?: { init: () => Promise<any> };
  }
}

export interface CatalogItem {
  id: string;
  title: string;
  price: string;
  priceValue: string;
  imageURI?: string;
}

const LS_KEY = 'arina_farm_save_v1';

class YandexSDK {
  ysdk: any = null;
  player: any = null;
  payments: any = null;
  catalog: CatalogItem[] = [];
  available = false;
  private gameplayActive = false;
  private loadingReady = false;
  onPause: (() => void) | null = null;
  onResume: (() => void) | null = null;

  async init(): Promise<void> {
    const start = Date.now();
    while (!window.YaGames && Date.now() - start < 1500) {
      await new Promise((r) => setTimeout(r, 50));
    }
    if (!window.YaGames) return;
    try {
      this.ysdk = await withTimeout(window.YaGames.init(), 8000);
      this.available = true;
    } catch (e) {
      console.warn('[sdk] init failed', e);
      return;
    }
    try {
      this.ysdk.on?.('game_api_pause', () => this.onPause?.());
      this.ysdk.on?.('game_api_resume', () => this.onResume?.());
    } catch (e) {
      console.warn('[sdk] events unavailable', e);
    }
    try {
      this.player = await withTimeout(this.ysdk.getPlayer({ scopes: false }), 5000);
    } catch (e) {
      console.warn('[sdk] player unavailable', e);
    }
    this.initPayments();
  }

  private async initPayments() {
    try {
      this.payments = await withTimeout(this.ysdk.getPayments({ signed: false }), 5000);
      const cat: any = await withTimeout<any>(this.payments.getCatalog(), 5000);
      this.catalog = (cat || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        price: p.price,
        priceValue: p.priceValue,
        imageURI: p.imageURI,
      }));
    } catch (e) {
      this.payments = null;
      this.catalog = [];
    }
  }

  lang(): string {
    try {
      const l = this.ysdk?.environment?.i18n?.lang;
      if (l) return l;
    } catch {
      /* ignore */
    }
    return (navigator.language || 'ru').slice(0, 2);
  }

  isMobile(): boolean {
    try {
      if (this.ysdk?.deviceInfo) return this.ysdk.deviceInfo.isMobile() || this.ysdk.deviceInfo.isTablet();
    } catch {
      /* ignore */
    }
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
  }

  ready() {
    if (this.loadingReady) return;
    this.loadingReady = true;
    try {
      this.ysdk?.features?.LoadingAPI?.ready();
    } catch (e) {
      console.warn('[sdk] LoadingAPI.ready failed', e);
    }
  }

  gameplayStart() {
    if (this.gameplayActive || !this.loadingReady) return;
    this.gameplayActive = true;
    try {
      this.ysdk?.features?.GameplayAPI?.start();
    } catch {
      /* ignore */
    }
  }

  gameplayStop() {
    if (!this.gameplayActive) return;
    this.gameplayActive = false;
    try {
      this.ysdk?.features?.GameplayAPI?.stop();
    } catch {
      /* ignore */
    }
  }

  showInterstitial(hooks: { open: () => void; close: () => void }): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.ysdk?.adv) {
        resolve(false);
        return;
      }
      let opened = false;
      let done = false;
      const finish = (shown: boolean) => {
        if (done) return;
        done = true;
        if (opened) hooks.close();
        resolve(shown);
      };
      try {
        this.ysdk.adv.showFullscreenAdv({
          callbacks: {
            onOpen: () => {
              opened = true;
              hooks.open();
            },
            onClose: (wasShown: boolean) => finish(!!wasShown),
            onError: () => finish(false),
            onOffline: () => finish(false),
          },
        });
      } catch {
        finish(false);
      }
    });
  }

  showRewarded(hooks: { open: () => void; close: () => void }): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.ysdk?.adv) {
        // Local development without SDK: grant the reward so the flow can be tested.
        if (import.meta.env.DEV) {
          hooks.open();
          setTimeout(() => {
            hooks.close();
            resolve(true);
          }, 600);
        } else resolve(false);
        return;
      }
      let rewarded = false;
      let opened = false;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        if (opened) hooks.close();
        resolve(rewarded);
      };
      try {
        this.ysdk.adv.showRewardedVideo({
          callbacks: {
            onOpen: () => {
              opened = true;
              hooks.open();
            },
            onRewarded: () => {
              rewarded = true;
            },
            onClose: () => finish(),
            onError: () => finish(),
          },
        });
      } catch {
        finish();
      }
    });
  }

  async load(): Promise<any | null> {
    let cloud: any = null;
    let local: any = null;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) local = JSON.parse(raw);
    } catch {
      /* ignore */
    }
    if (this.player) {
      try {
        const data: any = await withTimeout<any>(this.player.getData(["save"]), 5000);
        if (data && data.save) cloud = typeof data.save === 'string' ? JSON.parse(data.save) : data.save;
      } catch (e) {
        console.warn('[sdk] getData failed', e);
      }
    }
    if (cloud && local) return (cloud.savedAt || 0) >= (local.savedAt || 0) ? cloud : local;
    return cloud || local;
  }

  private lastCloudSave = 0;
  private pendingCloud: any = null;
  private cloudTimer: number | null = null;

  save(data: any, force = false) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
    if (!this.player) return;
    this.pendingCloud = data;
    const now = Date.now();
    const wait = Math.max(0, 12000 - (now - this.lastCloudSave));
    if (force || wait === 0) {
      this.flushCloud(force);
    } else if (this.cloudTimer === null) {
      this.cloudTimer = window.setTimeout(() => this.flushCloud(false), wait);
    }
  }

  private flushCloud(flush: boolean) {
    if (this.cloudTimer !== null) {
      clearTimeout(this.cloudTimer);
      this.cloudTimer = null;
    }
    if (!this.pendingCloud || !this.player) return;
    const data = this.pendingCloud;
    this.pendingCloud = null;
    this.lastCloudSave = Date.now();
    try {
      this.player.setData({ save: data }, flush).catch(() => undefined);
    } catch {
      /* ignore */
    }
  }

  async purchase(id: string): Promise<{ ok: boolean; token?: string }> {
    if (!this.payments) return { ok: false };
    try {
      const p = await this.payments.purchase({ id });
      return { ok: true, token: p?.purchaseToken };
    } catch {
      return { ok: false };
    }
  }

  async consume(token: string) {
    try {
      await this.payments?.consumePurchase(token);
    } catch {
      /* ignore */
    }
  }

  async unprocessedPurchases(): Promise<{ id: string; token: string }[]> {
    if (!this.payments) return [];
    try {
      const list = await this.payments.getPurchases();
      return (list || []).map((p: any) => ({ id: p.productID, token: p.purchaseToken }));
    } catch {
      return [];
    }
  }

  async requestReview(): Promise<boolean> {
    try {
      const r = await this.ysdk?.feedback?.canReview();
      if (!r?.value) return false;
      const res = await this.ysdk.feedback.requestReview();
      return !!res?.feedbackSent;
    } catch {
      return false;
    }
  }

  async shortcutPrompt(): Promise<boolean> {
    try {
      const r = await this.ysdk?.shortcut?.canShowPrompt();
      if (!r?.canShow) return false;
      const res = await this.ysdk.shortcut.showPrompt();
      return res?.outcome === 'accepted';
    } catch {
      return false;
    }
  }

  serverTime(): number {
    try {
      const t = this.ysdk?.serverTime?.();
      if (typeof t === 'number' && t > 0) return t;
    } catch {
      /* ignore */
    }
    return Date.now();
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}

export const sdk = new YandexSDK();
