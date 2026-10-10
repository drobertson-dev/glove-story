// All sound is synthesised with Web Audio, so there are no files to load.

const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// half a second of silence as a WAV, for the old-iPhone mute-switch workaround
function silentWavUrl() {
  const rate = 8000, n = rate / 2;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

export class Sound {
  constructor() {
    this.ctx = null;
    this.musicOn = true;
    this.garibStreak = 0;
    this.garibT = 0;
  }

  // Must be called from a tap/click/keypress: browsers only allow sound to start then.
  unlock() {
    this.preferPlayback();
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = 0.9;
      this.sfx.connect(this.master);
      this.music = this.ctx.createGain();
      this.music.gain.value = this.musicOn ? 0.32 : 0;
      this.music.connect(this.master);
      this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.startMusic();
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.ctx.suspend();
          if (this.silentEl) this.silentEl.pause();
        } else this.ctx.resume().catch(() => {});
      });
    }
    this.wake();
    // iOS only fully unlocks once a sound is actually started inside the gesture
    const src = this.ctx.createBufferSource();
    src.buffer = this.ctx.createBuffer(1, 1, 22050);
    src.connect(this.ctx.destination);
    src.start(0);
  }

  // After switching apps, a phone call or a lock screen, iOS leaves the audio
  // suspended/"interrupted" until the next tap. Call this on every tap.
  wake() {
    if (!this.ctx) return;
    this.preferPlayback();
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  // iPhones mute web audio when the ring/silent switch is on silent. Ask for the
  // same audio mode a video uses so the game is heard anyway.
  preferPlayback() {
    try {
      if (navigator.audioSession) {
        if (navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback';
        return;
      }
    } catch { /* not supported */ }
    // older iOS: a looping silent <audio> element switches the phone to playback mode
    if (IS_IOS && !this.silentEl) {
      const el = document.createElement('audio');
      el.src = silentWavUrl();
      el.loop = true;
      el.setAttribute('playsinline', '');
      el.setAttribute('x-webkit-airplay', 'deny');
      this.silentEl = el;
    }
    if (this.silentEl && this.silentEl.paused) this.silentEl.play().catch(() => {});
  }

  setMusic(on) {
    this.musicOn = on;
    if (this.music) this.music.gain.setTargetAtTime(on ? 0.32 : 0, this.ctx.currentTime, 0.1);
  }

  tone({ type = 'square', f = 440, f2 = null, dur = 0.15, vol = 0.2, at = 0, attack = 0.005, out = null }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + at;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out || this.sfx);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise({ dur = 0.15, vol = 0.2, freq = 1200, q = 1, type = 'bandpass', at = 0, f2 = null, out = null }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + at;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const fl = this.ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(freq, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    fl.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(out || this.sfx);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  play(name, arg) {
    if (!this.ctx) return;
    switch (name) {
      case 'jump': this.tone({ type: 'square', f: 300, f2: 620, dur: 0.14, vol: 0.09 }); break;
      case 'jump2': this.tone({ type: 'square', f: 460, f2: 980, dur: 0.16, vol: 0.09 }); this.noise({ dur: 0.2, vol: 0.05, freq: 3000, f2: 6000 }); break;
      case 'land': this.noise({ dur: 0.08, vol: 0.12, freq: 400, type: 'lowpass' }); break;
      case 'step': this.noise({ dur: 0.04, vol: 0.04, freq: 900, q: 2 }); break;
      case 'garib': {
        const now = performance.now() / 1000;
        this.garibStreak = now - this.garibT < 1.2 ? Math.min(this.garibStreak + 1, 10) : 0;
        this.garibT = now;
        const base = 880 * Math.pow(2, this.garibStreak / 12 * 2);
        this.tone({ type: 'triangle', f: base, dur: 0.18, vol: 0.16 });
        this.tone({ type: 'sine', f: base * 1.5, dur: 0.3, vol: 0.1, at: 0.06 });
        break;
      }
      case 'grab': this.tone({ type: 'sine', f: 520, f2: 760, dur: 0.08, vol: 0.18 }); break;
      case 'throw': this.noise({ dur: 0.22, vol: 0.12, freq: 800, f2: 2600, q: 0.8 }); break;
      case 'slap': this.noise({ dur: 0.07, vol: 0.32, freq: 2500, q: 0.7 }); this.tone({ type: 'square', f: 180, f2: 90, dur: 0.07, vol: 0.08 }); break;
      case 'whiff': this.noise({ dur: 0.15, vol: 0.08, freq: 1500, f2: 600, q: 1 }); break;
      case 'bounce': {
        const v = Math.min(1, (arg || 5) / 12);
        this.tone({ type: 'sine', f: 240 + v * 120, f2: 120, dur: 0.18, vol: 0.12 + v * 0.12 });
        break;
      }
      case 'clink': {
        const v = Math.min(1, (arg || 5) / 12);
        this.tone({ type: 'sine', f: 2200 + Math.random() * 600, dur: 0.12, vol: 0.05 + v * 0.1 });
        this.tone({ type: 'sine', f: 3300 + Math.random() * 400, dur: 0.08, vol: 0.03 + v * 0.05 });
        break;
      }
      case 'thud': {
        const v = Math.min(1, (arg || 5) / 12);
        this.tone({ type: 'sine', f: 110, f2: 50, dur: 0.2, vol: 0.15 + v * 0.2 });
        this.noise({ dur: 0.1, vol: 0.1 + v * 0.1, freq: 300, type: 'lowpass' });
        break;
      }
      case 'shatter':
        this.noise({ dur: 0.6, vol: 0.35, freq: 5000, q: 0.6 });
        for (let i = 0; i < 9; i++) this.tone({ type: 'sine', f: 1800 + Math.random() * 3000, dur: 0.15 + Math.random() * 0.25, vol: 0.06, at: i * 0.03 });
        break;
      case 'potion':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone({ type: 'triangle', f, dur: 0.22, vol: 0.12, at: i * 0.06 }));
        this.noise({ dur: 0.5, vol: 0.06, freq: 6000, f2: 2000 });
        break;
      case 'pad':
        this.tone({ type: 'sine', f: 150, f2: 900, dur: 0.35, vol: 0.22 });
        this.tone({ type: 'square', f: 300, f2: 1200, dur: 0.25, vol: 0.05 });
        break;
      case 'superbounce':
        this.tone({ type: 'sine', f: 200, f2: 1400, dur: 0.4, vol: 0.22 });
        this.tone({ type: 'triangle', f: 400, f2: 1600, dur: 0.4, vol: 0.08, at: 0.05 });
        break;
      case 'hurt':
        this.tone({ type: 'sawtooth', f: 400, f2: 120, dur: 0.3, vol: 0.12 });
        this.noise({ dur: 0.15, vol: 0.12, freq: 900 });
        break;
      case 'stomp':
        this.tone({ type: 'square', f: 200, f2: 700, dur: 0.12, vol: 0.12 });
        this.noise({ dur: 0.12, vol: 0.15, freq: 1200 });
        break;
      case 'pop':
        this.tone({ type: 'sine', f: 900, f2: 200, dur: 0.15, vol: 0.2 });
        [1047, 1568].forEach((f, i) => this.tone({ type: 'triangle', f, dur: 0.15, vol: 0.08, at: 0.08 + i * 0.06 }));
        break;
      case 'crate':
        this.noise({ dur: 0.35, vol: 0.4, freq: 500, q: 0.5 });
        this.tone({ type: 'square', f: 140, f2: 60, dur: 0.25, vol: 0.12 });
        break;
      case 'checkpoint':
        [784, 988, 1175, 1568].forEach((f, i) => this.tone({ type: 'square', f, dur: 0.14, vol: 0.07, at: i * 0.08 }));
        break;
      case 'nope': this.tone({ type: 'square', f: 220, f2: 180, dur: 0.18, vol: 0.08 }); break;
      case 'die':
        [523, 466, 415, 349, 262].forEach((f, i) => this.tone({ type: 'square', f, dur: 0.16, vol: 0.08, at: i * 0.11 }));
        break;
      case 'portal':
        this.tone({ type: 'sine', f: 200, f2: 1600, dur: 0.8, vol: 0.2 });
        this.noise({ dur: 0.9, vol: 0.12, freq: 600, f2: 6000 });
        break;
      case 'fanfare': {
        const seq = [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36], [784, 0.54], [1047, 0.66]];
        seq.forEach(([f, at]) => { this.tone({ type: 'square', f, dur: 0.2, vol: 0.09, at }); this.tone({ type: 'triangle', f: f / 2, dur: 0.22, vol: 0.12, at }); });
        this.tone({ type: 'square', f: 1319, dur: 0.6, vol: 0.09, at: 0.84 });
        this.tone({ type: 'triangle', f: 659, dur: 0.6, vol: 0.12, at: 0.84 });
        break;
      }
      case 'ui': this.tone({ type: 'triangle', f: 660, f2: 880, dur: 0.08, vol: 0.12 }); break;
      case 'splash':
        this.noise({ dur: 0.45, vol: 0.3, freq: 1400, f2: 400, q: 0.6 });
        this.tone({ type: 'sine', f: 600, f2: 180, dur: 0.2, vol: 0.12 });
        break;
      case 'boing':
        this.tone({ type: 'sine', f: 380, f2: 900, dur: 0.12, vol: 0.2 });
        this.tone({ type: 'square', f: 760, f2: 300, dur: 0.18, vol: 0.05, at: 0.05 });
        break;
      case 'switch':
        this.tone({ type: 'square', f: 300, dur: 0.06, vol: 0.12 });
        [523, 784, 1047].forEach((f, i) => this.tone({ type: 'triangle', f, dur: 0.18, vol: 0.12, at: 0.08 + i * 0.07 }));
        break;
      case 'bell':
        this.noise({ dur: 0.08, vol: 0.3, freq: 2000 });
        [880, 1320, 1760, 2637].forEach((f, i) => this.tone({ type: 'sine', f, dur: 1.4 - i * 0.2, vol: 0.12 - i * 0.02, at: 0.05 }));
        break;
      case 'rumble':
        this.noise({ dur: 1.2, vol: 0.3, freq: 160, type: 'lowpass' });
        this.tone({ type: 'sawtooth', f: 55, f2: 45, dur: 1.1, vol: 0.06 });
        break;
      case 'crumble':
        this.noise({ dur: 0.5, vol: 0.22, freq: 700, q: 0.6 });
        for (let i = 0; i < 4; i++) this.noise({ dur: 0.05, vol: 0.15, freq: 2500, at: 0.1 + i * 0.09 });
        break;
      case 'ghost':
        this.tone({ type: 'sine', f: 420, f2: 300, dur: 0.6, vol: 0.06 });
        break;
    }
  }

  // --- little tunes, sequenced in eighth notes ---
  // melody: midi notes, -1 = hold previous, 0 = rest. chords: [root, fifth, triad] per bar.
  // bass: per-eighth pattern ('r' root, 'f' fifth, 'o' octave, 0 rest)
  setSong(name) {
    this.song = SONGS[name] || SONGS.meadow;
    this.songStep = 0;
  }

  startMusic() {
    if (!this.song) this.setSong('meadow');
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
    let next = this.ctx.currentTime + 0.1;
    const out = this.music;
    const sched = () => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const S = this.song;
      const step = 60 / S.bpm / 2;
      if (next < this.ctx.currentTime - 0.1) next = this.ctx.currentTime + 0.05; // skip, don't burst
      while (next < this.ctx.currentTime + 0.2) {
        const n = S.melody.length;
        const idx = this.songStep % n;
        const bar = Math.floor(idx / 8), beat = idx % 8;
        const at = next - this.ctx.currentTime;
        const m = S.melody[idx];
        if (m > 0) {
          let len = 1;
          while (S.melody[(idx + len) % n] === -1) len++;
          const dur = S.pluck ? step * Math.min(len, 2) * 0.7 : step * len * 0.9;
          this.tone({ type: S.lead, f: mtof(m), dur, vol: S.leadVol, at, out });
          this.tone({ type: 'triangle', f: mtof(m + 12), dur: dur * 0.6, vol: S.leadVol * 0.5, at, out });
        }
        const [root, fifth, triad] = S.chords[bar % S.chords.length];
        const bp = S.bass[beat];
        if (bp) {
          const note = bp === 'r' ? root : bp === 'f' ? fifth : root + 12;
          this.tone({ type: 'triangle', f: mtof(note), dur: step * 1.5, vol: 0.2, at, out });
        }
        if (S.stabs.includes(beat)) for (const t of triad) this.tone({ type: S.stabWave || 'square', f: mtof(t), dur: step * 0.6, vol: 0.018, at, out });
        if (S.hats && beat % 2 === 1) this.noise({ dur: 0.04, vol: 0.035, freq: 8000, type: 'highpass', at, out });
        if (S.kick.includes(beat)) this.tone({ type: 'sine', f: 120, f2: 45, dur: 0.12, vol: 0.18, at, out });
        if (S.shaker && beat % 2 === 0) this.noise({ dur: 0.05, vol: 0.025, freq: 5000, type: 'bandpass', at, out });
        next += step;
        this.songStep++;
      }
    };
    this.musicTimer = setInterval(sched, 40);
  }
}

const SONGS = {
  meadow: {
    bpm: 132, lead: 'square', leadVol: 0.05,
    melody: [
      72, 0, 69, 72, 77, 0, 76, 74,
      72, 0, 67, 0, 64, 67, 72, 0,
      74, 0, 69, 74, 77, 0, 76, 74,
      72, -1, 70, -1, 69, 67, 65, 0,
      72, 0, 69, 72, 77, 0, 79, 81,
      79, -1, 76, 0, 72, 74, 76, 0,
      77, 0, 74, 0, 70, 74, 77, 79,
      76, -1, -1, 0, 72, 0, 67, 0,
    ],
    chords: [
      [41, 48, [53, 57, 60]], [36, 43, [52, 55, 60]], [38, 45, [53, 57, 62]], [34, 41, [53, 58, 62]],
      [41, 48, [53, 57, 60]], [36, 43, [52, 55, 60]], [34, 41, [53, 58, 62]], [36, 43, [52, 55, 58]],
    ],
    bass: ['r', 0, 'f', 0, 'r', 0, 'f', 0], stabs: [2, 6], kick: [0, 4], hats: true,
  },
  lagoon: {
    // breezy calypso, marimba-ish plucks
    bpm: 116, lead: 'triangle', leadVol: 0.09, pluck: true,
    melody: [
      72, 0, 76, 0, 79, 77, 76, 0,
      77, 0, 76, 77, 81, 0, 79, 0,
      79, 77, 76, 74, 71, 0, 74, 0,
      72, -1, 0, 76, 74, 72, 0, 0,
      76, 0, 72, 0, 69, 72, 76, 0,
      77, -1, 76, 74, 72, 0, 69, 0,
      71, 72, 74, 76, 77, 74, 71, 67,
      72, -1, -1, 0, 0, 0, 67, 0,
    ],
    chords: [
      [36, 43, [55, 60, 64]], [41, 48, [57, 60, 65]], [43, 50, [55, 59, 62]], [36, 43, [55, 60, 64]],
      [45, 52, [57, 60, 64]], [41, 48, [57, 60, 65]], [43, 50, [55, 59, 62]], [36, 43, [55, 60, 64]],
    ],
    bass: ['r', 0, 0, 'r', 0, 0, 'f', 0], stabs: [1, 3, 5, 7], stabWave: 'triangle', kick: [0, 3, 6], shaker: true,
  },
  carnival: {
    // fast circus oom-pah
    bpm: 160, lead: 'square', leadVol: 0.045,
    melody: [
      79, 78, 79, 0, 74, 0, 79, 0,
      78, 77, 78, 0, 74, 0, 78, 0,
      79, 81, 83, 79, 81, 78, 79, 76,
      76, -1, 72, 0, 76, 0, 79, 0,
      79, 78, 79, 0, 74, 0, 79, 0,
      81, 80, 81, 0, 78, 0, 74, 0,
      79, 83, 86, 83, 79, 78, 76, 74,
      79, -1, 0, 0, 67, 0, 0, 0,
    ],
    chords: [
      [43, 50, [59, 62, 67]], [38, 45, [57, 62, 66]], [43, 50, [59, 62, 67]], [36, 43, [55, 60, 64]],
      [43, 50, [59, 62, 67]], [38, 45, [57, 62, 66]], [43, 50, [59, 62, 67]], [43, 50, [59, 62, 67]],
    ],
    bass: ['r', 0, 'f', 0, 'r', 0, 'f', 0], stabs: [2, 6], kick: [0, 4], hats: true,
  },
  spooky: {
    // creepy-cute minor waltz-ish
    bpm: 100, lead: 'sine', leadVol: 0.1,
    melody: [
      69, 0, 72, 0, 76, 0, 75, 76,
      77, -1, 76, 0, 72, 0, 69, 0,
      65, 0, 69, 0, 72, 0, 71, 72,
      71, -1, -1, 0, 68, 0, 64, 0,
      69, 0, 72, 0, 76, 0, 79, 0,
      77, -1, 74, 0, 77, 0, 81, 0,
      80, -1, 76, 0, 74, 0, 71, 0,
      69, -1, -1, 0, 0, 0, 0, 0,
    ],
    chords: [
      [45, 52, [57, 60, 64]], [45, 52, [57, 60, 64]], [41, 48, [57, 60, 65]], [40, 47, [56, 59, 64]],
      [45, 52, [57, 60, 64]], [38, 45, [57, 62, 65]], [40, 47, [56, 59, 64]], [45, 52, [57, 60, 64]],
    ],
    bass: ['r', 0, 0, 0, 'f', 0, 'o', 0], stabs: [2, 6], stabWave: 'triangle', kick: [0], hats: false,
  },
};
