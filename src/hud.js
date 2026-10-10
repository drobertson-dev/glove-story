// DOM heads-up display, signs, toasts and the "where's my ball?" arrow.
const LABELS = {
  touch: { JUMP: 'JUMP', GRAB: 'GRAB', SLAP: 'SLAP', THROW: 'GRAB' },
  keyboard: { JUMP: 'Space', GRAB: 'J', SLAP: 'K', THROW: 'J' },
  arrows: { JUMP: 'Space', GRAB: 'Z', SLAP: 'X', THROW: 'Z' },
  gamepad: { JUMP: 'A', GRAB: 'X', SLAP: 'B', THROW: 'X' },
};

export function formatControls(text, device) {
  const L = LABELS[device] || LABELS.keyboard;
  return text.replace(/\{(JUMP|GRAB|SLAP|THROW)\}/g, (_, k) => {
    const cls = k === 'THROW' ? 'grab' : k.toLowerCase();
    return `<span class="key ${cls}">${L[k]}</span>`;
  });
}

export function controlsHelp(device) {
  if (device === 'touch') {
    return 'Left thumb: move &nbsp;·&nbsp; Drag right side: look around<br>' +
      '<span class="key jump">JUMP</span> (tap twice for a double jump) &nbsp; <span class="key grab">GRAB</span> grab / throw &nbsp; <span class="key slap">SLAP</span> slap the ball';
  }
  if (device === 'gamepad') {
    return 'Left stick: move &nbsp;·&nbsp; Right stick: camera<br>' +
      '<span class="key jump">A</span> jump (×2 double) &nbsp; <span class="key grab">X</span> grab / throw &nbsp; <span class="key slap">B</span> slap &nbsp; <span class="key">Start</span> pause';
  }
  return 'Arrow keys or WASD: move &nbsp;·&nbsp; Q/E or drag mouse: camera<br>' +
    '<span class="key jump">Space</span> jump (×2 double) &nbsp; <span class="key grab">Z</span> or <span class="key grab">J</span> grab / throw &nbsp; ' +
    '<span class="key slap">X</span> or <span class="key slap">K</span> slap &nbsp; <span class="key">Esc</span> pause';
}

export class Hud {
  constructor() {
    this.$ = (id) => document.getElementById(id);
    this.root = this.$('hud');
    this.lives = this.$('lives-n');
    this.hearts = this.$('hearts');
    this.garibs = this.$('garibs-n');
    this.garibsBox = this.$('garibs');
    this.form = this.$('ball-form');
    this.sign = this.$('sign');
    this.toastEl = this.$('toast');
    this.arrow = this.$('ball-arrow');
    this.prompt = this.$('prompt');
    this.promptHtml = null;
    this.toastT = 0;
    this.signHtml = null;
    this.cache = {};
  }
  show(on) { this.root.classList.toggle('hidden', !on); }
  setLives(n) { if (this.cache.lives !== n) { this.cache.lives = n; this.lives.textContent = '×' + n; } }
  setHearts(n, max) {
    const key = n + '/' + max;
    if (this.cache.hearts === key) return;
    this.cache.hearts = key;
    this.hearts.innerHTML = '';
    let html = '';
    for (let i = 0; i < max; i++) {
      html += `<svg class="heart${i < n ? '' : ' empty'}" viewBox="0 0 24 24"><path d="M12 21.6 10.6 20.3C5.4 15.6 2 12.5 2 8.6 2 5.5 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.5 22 8.6c0 3.9-3.4 7-8.6 11.7L12 21.6z"/></svg>`;
    }
    this.hearts.innerHTML = html;
  }
  setGaribs(c, total) {
    const key = c + '/' + total;
    if (this.cache.garibs === key) return;
    const bump = this.cache.garibs !== undefined;
    this.cache.garibs = key;
    this.garibs.textContent = key;
    if (bump) {
      this.garibsBox.classList.remove('bump');
      void this.garibsBox.offsetWidth;
      this.garibsBox.classList.add('bump');
    }
  }
  setForm(label, color) {
    if (this.cache.form === label) return;
    this.cache.form = label;
    this.form.textContent = label;
    this.form.style.color = color;
  }
  showSign(html) {
    if (html === this.signHtml) return;
    this.signHtml = html;
    if (html) { this.sign.innerHTML = html; this.sign.classList.remove('hidden'); }
    else this.sign.classList.add('hidden');
  }
  toast(text, sub = '', time = 1.6) {
    this.toastEl.innerHTML = text + (sub ? `<span class="sub">${sub}</span>` : '');
    this.toastEl.classList.add('show');
    this.toastT = time;
  }
  update(dt) {
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.toastEl.classList.remove('show');
    }
  }
  // floating bubble at screen position x,y (CSS px); html = null hides it
  setPrompt(html, x, y) {
    if (!html) {
      if (this.promptHtml !== null) { this.prompt.classList.add('hidden'); this.promptHtml = null; }
      return;
    }
    if (html !== this.promptHtml) {
      this.prompt.innerHTML = html;
      this.prompt.classList.remove('hidden');
      this.promptHtml = html;
    }
    this.prompt.style.left = x + 'px';
    this.prompt.style.top = y + 'px';
  }
  // x,y in CSS px; angle in radians (0 = pointing up)
  setArrow(x, y, angle) {
    if (x === null) { this.arrow.classList.add('hidden'); return; }
    this.arrow.classList.remove('hidden');
    this.arrow.style.left = (x - 14) + 'px';
    this.arrow.style.top = (y - 13) + 'px';
    this.arrow.style.transform = `rotate(${angle}rad)`;
  }
}
