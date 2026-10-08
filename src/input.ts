export class Input {
  x = 0;
  z = 0;
  private keys = new Set<string>();
  private pointerId: number | null = null;
  private ox = 0;
  private oy = 0;
  private jx = 0;
  private jy = 0;
  private joy: HTMLDivElement;
  private knob: HTMLDivElement;
  private radius = 55;
  enabled = true;
  onFirstInput: (() => void) | null = null;
  touched = false;

  constructor(target: HTMLElement, uiRoot: HTMLElement) {
    this.joy = document.createElement('div');
    this.joy.className = 'joy';
    this.knob = document.createElement('div');
    this.knob.className = 'joy-knob';
    this.joy.appendChild(this.knob);
    uiRoot.appendChild(this.joy);

    target.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.move(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e));
    window.addEventListener('keydown', (e) => {
      const k = e.code;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
      this.keys.add(k);
      this.first();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.release();
    });
  }

  private first() {
    if (!this.touched) {
      this.touched = true;
    }
    this.onFirstInput?.();
  }

  private down(e: PointerEvent) {
    if (!this.enabled || this.pointerId !== null) return;
    this.first();
    this.pointerId = e.pointerId;
    this.ox = e.clientX;
    this.oy = e.clientY;
    this.jx = 0;
    this.jy = 0;
    this.joy.style.left = this.ox + 'px';
    this.joy.style.top = this.oy + 'px';
    this.joy.style.display = 'block';
    this.knob.style.transform = 'translate(0px,0px)';
  }

  private move(e: PointerEvent) {
    if (e.pointerId !== this.pointerId) return;
    let dx = e.clientX - this.ox;
    let dy = e.clientY - this.oy;
    const len = Math.hypot(dx, dy);
    if (len > this.radius) {
      // Drag the joystick base along so direction changes stay responsive.
      const over = len - this.radius;
      this.ox += (dx / len) * over;
      this.oy += (dy / len) * over;
      this.joy.style.left = this.ox + 'px';
      this.joy.style.top = this.oy + 'px';
      dx = e.clientX - this.ox;
      dy = e.clientY - this.oy;
    }
    this.jx = dx / this.radius;
    this.jy = dy / this.radius;
    this.knob.style.transform = `translate(${dx}px,${dy}px)`;
  }

  private up(e: PointerEvent) {
    if (e.pointerId !== this.pointerId) return;
    this.release();
  }

  release() {
    this.pointerId = null;
    this.jx = 0;
    this.jy = 0;
    this.joy.style.display = 'none';
  }

  update() {
    let x = 0;
    let z = 0;
    if (this.enabled) {
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z -= 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z += 1;
      const kl = Math.hypot(x, z);
      if (kl > 0) {
        x /= kl;
        z /= kl;
      } else {
        x = this.jx;
        z = this.jy;
        const l = Math.hypot(x, z);
        if (l < 0.12) {
          x = 0;
          z = 0;
        } else if (l > 1) {
          x /= l;
          z /= l;
        }
      }
    }
    this.x = x;
    this.z = z;
  }
}
