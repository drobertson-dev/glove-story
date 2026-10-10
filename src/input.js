// Unified input: keyboard + mouse, gamepad, and on-screen touch controls.
// Game code reads: move {x, y}, camDelta {x, y}, held[btn], pressed[btn].
const BTNS = ['jump', 'grab', 'slap', 'pause'];

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.move = { x: 0, y: 0 };
    this.camAxis = { x: 0, y: 0 };      // continuous (keys / right stick)
    this.camDelta = { x: 0, y: 0 };     // accumulated drag pixels this frame
    this.held = {}; this.pressed = {}; this.queued = {};
    for (const b of BTNS) { this.held[b] = false; this.pressed[b] = false; this.queued[b] = false; }
    this.keys = new Set();
    this.device = matchMedia('(pointer: coarse)').matches ? 'touch' : 'keyboard';
    this.keyScheme = 'arrows'; // or 'wasd': decides which key names we show
    this.onDeviceChange = null;
    this.stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.camTouch = { id: null, x: 0, y: 0 };
    this.btnTouches = new Map();
    this.gpPrev = {};
    this.enabled = true;

    this.$touch = document.getElementById('touch');
    this.$base = document.getElementById('stick-base');
    this.$knob = document.getElementById('stick-knob');
    this.$hint = document.getElementById('stick-hint');
    this.$btns = {};
    for (const el of document.querySelectorAll('.tbtn')) this.$btns[el.dataset.btn] = el;

    this._bindKeyboard();
    this._bindMouse();
    this._bindTouch();
  }

  setDevice(d) {
    if (this.device === d) return;
    this.device = d;
    document.body.classList.toggle('touch-mode', d === 'touch');
    if (this.onDeviceChange) this.onDeviceChange(d);
  }

  _down(b) { if (!this.held[b]) this.queued[b] = true; this.held[b] = true; }
  _up(b) { this.held[b] = false; }

  _bindKeyboard() {
    const map = {
      Space: 'jump', KeyJ: 'grab', KeyZ: 'grab', KeyK: 'slap', KeyX: 'slap', KeyL: 'slap',
      Escape: 'pause', KeyP: 'pause', Enter: 'pause',
    };
    addEventListener('keydown', (e) => {
      if (e.repeat) { if (map[e.code] || e.code.startsWith('Arrow')) e.preventDefault(); return; }
      this.setDevice('keyboard');
      const scheme = e.code.startsWith('Arrow') ? 'arrows' : ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code) ? 'wasd' : null;
      if (scheme && scheme !== this.keyScheme) {
        this.keyScheme = scheme;
        if (this.onDeviceChange) this.onDeviceChange(this.device);
      }
      this.keys.add(e.code);
      if (map[e.code]) { this._down(map[e.code]); e.preventDefault(); }
      if (e.code.startsWith('Arrow')) e.preventDefault();
    });
    addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (map[e.code]) this._up(map[e.code]);
    });
    addEventListener('blur', () => {
      this.keys.clear();
      for (const b of BTNS) this.held[b] = false;
    });
  }

  _bindMouse() {
    let drag = false, lx = 0, ly = 0;
    this.canvas.addEventListener('mousedown', (e) => { drag = true; lx = e.clientX; ly = e.clientY; });
    addEventListener('mousemove', (e) => {
      if (!drag) return;
      this.camDelta.x += e.clientX - lx;
      this.camDelta.y += e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
    });
    addEventListener('mouseup', () => { drag = false; });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _bindTouch() {
    const opts = { passive: false };
    const start = (e) => {
      if (!this.enabled) return;
      this.setDevice('touch');
      for (const t of e.changedTouches) {
        const el = document.elementFromPoint(t.clientX, t.clientY);
        const btnEl = el && el.closest ? el.closest('.tbtn') : null;
        if (btnEl) {
          const b = btnEl.dataset.btn;
          this.btnTouches.set(t.identifier, b);
          this._down(b);
          btnEl.classList.add('down');
          e.preventDefault();
          continue;
        }
        // let real UI buttons (pause, menus) receive their clicks
        if (el && el.closest && el.closest('button')) continue;
        e.preventDefault();
        if (t.clientX < innerWidth * 0.45 && this.stick.id === null) {
          this.stick.id = t.identifier;
          this.stick.ox = t.clientX; this.stick.oy = t.clientY;
          this.stick.x = 0; this.stick.y = 0;
          this.$base.style.left = t.clientX + 'px';
          this.$base.style.top = t.clientY + 'px';
          this.$base.classList.remove('hidden');
          this.$knob.style.transform = 'translate(0px, 0px)';
          this.$hint.classList.add('used');
        } else if (this.camTouch.id === null) {
          this.camTouch.id = t.identifier;
          this.camTouch.x = t.clientX; this.camTouch.y = t.clientY;
        }
      }
    };
    const move = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stick.id) {
          const R = 56;
          let dx = t.clientX - this.stick.ox, dy = t.clientY - this.stick.oy;
          const d = Math.hypot(dx, dy);
          if (d > R) {
            // drag the base along so the stick never "runs out"
            const k = (d - R) / d;
            this.stick.ox += dx * k; this.stick.oy += dy * k;
            dx = t.clientX - this.stick.ox; dy = t.clientY - this.stick.oy;
            this.$base.style.left = this.stick.ox + 'px';
            this.$base.style.top = this.stick.oy + 'px';
          }
          this.stick.x = dx / R; this.stick.y = dy / R;
          this.$knob.style.transform = `translate(${dx}px, ${dy}px)`;
          e.preventDefault();
        } else if (t.identifier === this.camTouch.id) {
          this.camDelta.x += t.clientX - this.camTouch.x;
          this.camDelta.y += t.clientY - this.camTouch.y;
          this.camTouch.x = t.clientX; this.camTouch.y = t.clientY;
          e.preventDefault();
        } else if (this.btnTouches.has(t.identifier)) {
          e.preventDefault();
        }
      }
    };
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stick.id) {
          this.stick.id = null; this.stick.x = 0; this.stick.y = 0;
          this.$base.classList.add('hidden');
        } else if (t.identifier === this.camTouch.id) {
          this.camTouch.id = null;
        } else if (this.btnTouches.has(t.identifier)) {
          const b = this.btnTouches.get(t.identifier);
          this.btnTouches.delete(t.identifier);
          let still = false;
          for (const v of this.btnTouches.values()) if (v === b) still = true;
          if (!still) { this._up(b); this.$btns[b]?.classList.remove('down'); }
        }
      }
    };
    addEventListener('touchstart', start, opts);
    addEventListener('touchmove', move, opts);
    addEventListener('touchend', end, opts);
    addEventListener('touchcancel', end, opts);
    // iOS pinch-zoom guard
    addEventListener('gesturestart', (e) => e.preventDefault());
  }

  releaseAll() {
    for (const b of BTNS) { this.held[b] = false; this.queued[b] = false; this.pressed[b] = false; }
    for (const el of Object.values(this.$btns)) el.classList.remove('down');
    this.btnTouches.clear();
    this.stick.id = null; this.stick.x = this.stick.y = 0;
    this.$base.classList.add('hidden');
    this.camTouch.id = null;
  }

  // Call once per frame before game logic.
  update() {
    let mx = 0, my = 0;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) my += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) my -= 1;
    let cx = 0, cy = 0;
    if (k.has('KeyQ')) cx -= 1;
    if (k.has('KeyE')) cx += 1;

    // gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
      const ax = dz(gp.axes[0] || 0), ay = dz(gp.axes[1] || 0);
      const rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
      const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
      const state = { jump: b(0), slap: b(1) || b(5), grab: b(2) || b(3) || b(4), pause: b(9) };
      const dpad = { x: (b(15) ? 1 : 0) - (b(14) ? 1 : 0), y: (b(12) ? 1 : 0) - (b(13) ? 1 : 0) };
      const active = ax || ay || rx || ry || dpad.x || dpad.y || Object.values(state).some(Boolean);
      if (active) this.setDevice('gamepad');
      if (ax || ay) { mx = ax; my = -ay; }
      if (dpad.x || dpad.y) { mx = dpad.x; my = dpad.y; }
      if (rx || ry) { cx = rx; cy = ry; }
      if (b(6)) cx -= 1;
      if (b(7)) cx += 1;
      for (const name of Object.keys(state)) {
        const prev = this.gpPrev[name] || false;
        if (state[name] && !prev) this._down(name);
        if (!state[name] && prev) this._up(name);
        this.gpPrev[name] = state[name];
      }
      break;
    }

    if (this.stick.id !== null) {
      let sx = this.stick.x, sy = -this.stick.y;
      const m = Math.hypot(sx, sy);
      if (m < 0.15) { sx = 0; sy = 0; }
      else if (m > 1) { sx /= m; sy /= m; }
      mx = sx; my = sy;
    }

    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    this.move.x = mx;
    this.move.y = my;
    this.camAxis.x = cx;
    this.camAxis.y = cy;
    for (const b of BTNS) { this.pressed[b] = this.queued[b]; this.queued[b] = false; }
  }

  takeCamDelta() {
    const d = { x: this.camDelta.x, y: this.camDelta.y };
    this.camDelta.x = 0; this.camDelta.y = 0;
    return d;
  }

  // which set of button names to show in prompts and signs
  labelMode() {
    if (this.device === 'keyboard') return this.keyScheme === 'wasd' ? 'keyboard' : 'arrows';
    return this.device;
  }

  setGrabHint(on) {
    const el = this.$btns.grab;
    if (el) el.classList.toggle('hint', on);
  }

  setGrabLabel(text) {
    const el = this.$btns.grab;
    if (el && el.textContent !== text) el.textContent = text;
  }
}
