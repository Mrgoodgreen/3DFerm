import { t, fmt } from '../i18n';
import { audio } from '../audio';

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export interface ModalButton {
  text: string;
  cls?: string;
  onClick: () => void | boolean | Promise<void | boolean>;
}

export interface ModalOpts {
  title: string;
  color?: '' | 'green' | 'blue' | 'purple';
  body: HTMLElement | string;
  buttons?: ModalButton[];
  closable?: boolean;
  onClose?: () => void;
  center?: boolean;
}

export interface DialogLine {
  name: string;
  text: string;
  portrait: string;
  right?: boolean;
}

interface QueuedModal {
  open: () => void;
}

export class UI {
  root: HTMLElement;
  private coinsEl!: HTMLElement;
  private coinPill!: HTMLElement;
  private lvlEl!: HTMLElement;
  private xpFill!: HTMLElement;
  private questEl!: HTMLElement;
  private questChapter!: HTMLElement;
  private questText!: HTMLElement;
  private questFill!: HTMLElement;
  private questCount!: HTMLElement;
  private questReward!: HTMLElement;
  private toasts!: HTMLElement;
  private hintEl: HTMLElement | null = null;
  rightCol!: HTMLElement;
  topRight!: HTMLElement;
  upgradesBtn!: HTMLButtonElement;
  wardrobeBtn!: HTMLButtonElement;
  settingsBtn!: HTMLButtonElement;
  shopBtn!: HTMLButtonElement;
  private overlayStack: HTMLElement[] = [];
  private queue: QueuedModal[] = [];
  onModalChange: (open: boolean) => void = () => undefined;

  constructor(root: HTMLElement) {
    this.root = root;
    this.buildHUD();
  }

  private buildHUD() {
    const tl = el('div', 'hud-tl');
    const row = el('div', 'hud-row');
    this.coinPill = el('div', 'pill');
    this.coinPill.innerHTML = '<span class="ico">🪙</span>';
    this.coinsEl = el('span', '', '0');
    this.coinPill.appendChild(this.coinsEl);
    const lvl = el('div', 'pill lvl-pill');
    this.lvlEl = el('div', 'lvl-badge', '1');
    const xp = el('div', 'xp-bar');
    this.xpFill = el('div', 'xp-fill');
    xp.appendChild(this.xpFill);
    lvl.append(this.lvlEl, xp);
    row.append(this.coinPill, lvl);
    tl.appendChild(row);

    this.questEl = el('div', 'quest');
    this.questChapter = el('div', 'quest-chapter');
    this.questText = el('div', 'quest-text');
    const bar = el('div', 'quest-bar');
    this.questFill = el('div', 'quest-fill');
    bar.appendChild(this.questFill);
    const meta = el('div', 'quest-meta');
    this.questCount = el('span');
    this.questReward = el('span');
    meta.append(this.questCount, this.questReward);
    this.questEl.append(this.questChapter, this.questText, bar, meta);
    tl.appendChild(this.questEl);
    this.root.appendChild(tl);

    this.topRight = el('div', 'hud-tr');
    this.settingsBtn = this.roundBtn('⚙️');
    this.wardrobeBtn = this.roundBtn('👗');
    this.shopBtn = this.roundBtn('🛍️');
    this.shopBtn.style.display = 'none';
    this.topRight.append(this.settingsBtn, this.wardrobeBtn, this.shopBtn);
    this.root.appendChild(this.topRight);

    this.rightCol = el('div', 'hud-r');
    this.upgradesBtn = this.roundBtn('⬆️', 'big-btn');
    this.upgradesBtn.appendChild(el('span', 'btn-caption', t('upgrades')));
    this.rightCol.appendChild(this.upgradesBtn);
    this.root.appendChild(this.rightCol);

    this.toasts = el('div', 'toasts');
    this.root.appendChild(this.toasts);
  }

  roundBtn(icon: string, extra = ''): HTMLButtonElement {
    const b = el('button', 'round-btn interactive ' + extra, icon);
    b.appendChild(el('span', 'dot'));
    return b;
  }

  setCoins(n: number, bump = false) {
    this.coinsEl.textContent = fmt(n);
    if (bump) {
      this.coinPill.classList.remove('bump');
      void this.coinPill.offsetWidth;
      this.coinPill.classList.add('bump');
    }
  }

  coinTarget(): { x: number; y: number } {
    const r = this.coinPill.getBoundingClientRect();
    return { x: r.left + 18, y: r.top + r.height / 2 };
  }

  flyCoins(x: number, y: number, n: number) {
    const target = this.coinTarget();
    for (let i = 0; i < Math.min(n, 8); i++) {
      const c = el('div', '', '🪙');
      c.style.cssText = `position:absolute;left:0;top:0;font-size:1.4em;pointer-events:none;z-index:50;transform:translate(${x + (Math.random() - 0.5) * 40}px,${y + (Math.random() - 0.5) * 40}px);transition:transform 0.6s cubic-bezier(.5,-0.3,.7,1) ${i * 0.04}s, opacity 0.6s ${i * 0.04}s`;
      this.root.appendChild(c);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          c.style.transform = `translate(${target.x - 10}px,${target.y - 14}px) scale(0.7)`;
          c.style.opacity = '0.6';
        });
      });
      setTimeout(() => c.remove(), 750 + i * 40);
    }
  }

  setLevel(level: number, frac: number) {
    this.lvlEl.textContent = String(level);
    this.xpFill.style.width = `${Math.min(100, Math.max(0, frac * 100))}%`;
  }

  setQuest(chapter: string, text: string, cur: number, n: number, reward: number) {
    this.questChapter.textContent = chapter;
    this.questText.textContent = text;
    this.questFill.style.width = `${Math.min(100, (cur / n) * 100)}%`;
    this.questCount.textContent = n > 1 ? `${fmt(Math.min(cur, n))}/${fmt(n)}` : '';
    this.questReward.textContent = reward > 0 ? `${t('reward')}: 🪙${fmt(reward)}` : '';
  }

  questFlash() {
    this.questEl.classList.remove('done');
    void this.questEl.offsetWidth;
    this.questEl.classList.add('done');
  }

  toast(text: string, cls = '') {
    const e = el('div', 'toast ' + cls, text);
    this.toasts.appendChild(e);
    setTimeout(() => e.remove(), 2300);
    while (this.toasts.children.length > 3) this.toasts.firstChild?.remove();
  }

  showHint(text: string) {
    if (!this.hintEl) {
      this.hintEl = el('div', 'hint', text);
      this.root.appendChild(this.hintEl);
    } else this.hintEl.textContent = text;
  }

  hideHint() {
    if (!this.hintEl) return;
    const h = this.hintEl;
    this.hintEl = null;
    h.style.opacity = '0';
    setTimeout(() => h.remove(), 500);
  }

  get modalOpen() {
    return this.overlayStack.length > 0;
  }

  /** Queue a modal so popups never overlap; runs immediately when nothing is open. */
  enqueue(open: () => void) {
    if (!this.modalOpen) open();
    else this.queue.push({ open });
  }

  private pushOverlay(o: HTMLElement) {
    this.overlayStack.push(o);
    this.root.appendChild(o);
    if (this.overlayStack.length === 1) this.onModalChange(true);
  }

  private popOverlay(o: HTMLElement) {
    o.remove();
    this.overlayStack = this.overlayStack.filter((x) => x !== o);
    if (this.overlayStack.length === 0) {
      const next = this.queue.shift();
      if (next) {
        next.open();
        if (this.overlayStack.length === 0) this.onModalChange(false);
      } else this.onModalChange(false);
    }
  }

  modal(o: ModalOpts): { close: () => void; body: HTMLElement } {
    const overlay = el('div', 'overlay');
    const m = el('div', 'modal');
    const head = el('div', 'modal-head ' + (o.color || ''), o.title);
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      this.popOverlay(overlay);
      o.onClose?.();
    };
    if (o.closable !== false) {
      const x = el('button', 'modal-close', '✕');
      x.onclick = () => {
        audio.play('click');
        close();
      };
      head.appendChild(x);
    }
    const body = el('div', 'modal-body' + (o.center ? ' center' : ''));
    if (typeof o.body === 'string') body.innerHTML = o.body;
    else body.appendChild(o.body);
    if (o.buttons?.length) {
      const col = el('div', 'btn-col');
      for (const b of o.buttons) {
        const btn = el('button', 'btn big ' + (b.cls || ''), b.text);
        btn.onclick = async () => {
          audio.play('click');
          btn.disabled = true;
          const keep = await b.onClick();
          btn.disabled = false;
          if (keep !== true) close();
        };
        col.appendChild(btn);
      }
      body.appendChild(col);
    }
    m.append(head, body);
    overlay.appendChild(m);
    overlay.addEventListener('pointerdown', (e) => {
      if (e.target === overlay && o.closable !== false) close();
    });
    this.pushOverlay(overlay);
    return { close, body };
  }

  dialog(lines: DialogLine[], done: () => void) {
    const wrap = el('div', 'dialog-wrap');
    let i = 0;
    const render = () => {
      const l = lines[i];
      wrap.innerHTML = '';
      const d = el('div', 'dialog' + (l.right ? ' right' : ''));
      const p = el('div', 'portrait');
      if (l.portrait.startsWith('data:')) p.appendChild(Object.assign(new Image(), { src: l.portrait }));
      else p.textContent = l.portrait;
      const box = el('div', 'dialog-box');
      box.append(el('div', 'dialog-name', l.name), el('div', 'dialog-text', l.text), el('div', 'dialog-next', t('next')));
      d.append(p, box);
      wrap.appendChild(d);
    };
    wrap.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      audio.unlock();
      audio.play('click');
      i++;
      if (i >= lines.length) {
        this.popOverlay(wrap);
        done();
      } else render();
    });
    render();
    this.pushOverlay(wrap);
  }

  adCountdown(n: number): Promise<void> {
    return new Promise((resolve) => {
      const e = el('div', 'ad-countdown', t('ad_soon', { n }));
      this.root.appendChild(e);
      let k = n;
      const id = setInterval(() => {
        k--;
        if (k <= 0) {
          clearInterval(id);
          e.remove();
          resolve();
        } else e.textContent = t('ad_soon', { n: k });
      }, 1000);
    });
  }
}
