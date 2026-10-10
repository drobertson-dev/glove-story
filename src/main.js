import * as THREE from 'three';
import { Game } from './game.js';
import { Input } from './input.js';
import { Hud, controlsHelp } from './hud.js';
import { Sound } from './audio.js';
import { LEVELS } from './levels/index.js';
import { THEMES } from './themes.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
let scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 900);

const $ = (id) => document.getElementById(id);
const settings = loadSettings();
let retro = settings.retro ?? false;
let dprCap = 2; // lowered automatically if the device can't keep up

function loadSettings() {
  try { return JSON.parse(localStorage.getItem('glove-story') || '{}'); } catch { return {}; }
}
function saveSettings() {
  try { localStorage.setItem('glove-story', JSON.stringify({ music: sound.musicOn, retro })); } catch { /* private mode */ }
}

// ---------------------------------------------------------------- progress
let progress = {};
try { progress = JSON.parse(localStorage.getItem('glove-story-progress') || '{}'); } catch { progress = {}; }
function saveProgress() {
  try { localStorage.setItem('glove-story-progress', JSON.stringify(progress)); } catch { /* private mode */ }
}
const unlocked = (i) => i === 0 || !!progress[LEVELS[i - 1].id]?.done || new URLSearchParams(location.search).has('unlock');

function resize() {
  const w = innerWidth, h = innerHeight;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  renderer.setPixelRatio(retro ? Math.max(0.25, 300 / h) : Math.min(dpr, dprCap));
  renderer.setSize(w, h, false);
  canvas.classList.toggle('retro', retro);
  camera.aspect = w / h;
  camera.fov = h > w ? 72 : 60;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

const input = new Input(canvas);
const hud = new Hud();
const sound = new Sound();
sound.musicOn = settings.music ?? true;

const ui = {
  fade(on) { $('fade').classList.toggle('on', on); },
  showComplete(st) {
    const prev = progress[st.id] || {};
    progress[st.id] = {
      done: true,
      garibs: Math.max(prev.garibs || 0, st.garibs),
      total: st.total,
      crystal: !!(prev.crystal || st.crystal),
      best: prev.best ? Math.min(prev.best, st.seconds) : st.seconds,
    };
    saveProgress();
    const last = levelIndex === LEVELS.length - 1;
    $('complete-title').textContent = last ? 'You did it!' : 'Level Complete!';
    $('complete-stats').innerHTML = `
      <div class="row"><span>Garibs</span><span>${st.garibs} / ${st.total}</span></div>
      <div class="row"><span>Time</span><span>${st.time}</span></div>
      <div class="row"><span>Lives left</span><span>${st.lives}</span></div>
      <div class="row"><span>Crystal bonus</span><span>${st.crystal ? '★ Yes!' : '—'}</span></div>`;
    $('complete-note').textContent = last ? 'Every world cleared. The wizard is very proud of you!' : '';
    $('next-btn').classList.toggle('hidden', last);
    show('complete');
    hud.show(false);
    setTouch(false);
  },
  showGameOver() { show('gameover'); hud.show(false); setTouch(false); },
};

// ---------------------------------------------------------------- levels
let game = null;
let levelIndex = 0;

function disposeScene(sc) {
  sc.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) {
      for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose();
      m.dispose();
    }
  });
}

function loadLevel(i) {
  if (game) disposeScene(scene);
  scene = new THREE.Scene();
  levelIndex = i;
  const L = LEVELS[i];
  const theme = THEMES[L.theme];
  game = new Game({ scene, camera, input, hud, sound, level: L, ui, theme });
  sound.setSong(theme.music);
  window.__game = game;
  if (onLevelLoaded) onLevelLoaded(game);
}
let onLevelLoaded = null;
loadLevel(0);

// ---------------------------------------------------------------- screens
const screens = ['title', 'select', 'pause', 'complete', 'gameover'];
function show(name) {
  for (const s of screens) $(s).classList.toggle('hidden', s !== name);
}
function setTouch(on) {
  $('touch').classList.toggle('hidden', !(on && input.device === 'touch'));
}
function refreshHelp() {
  $('controls-help').innerHTML = controlsHelp(input.device);
  $('pause-controls').innerHTML = controlsHelp(input.device);
}
input.onDeviceChange = () => {
  refreshHelp();
  setTouch(game.state === 'playing' || game.state === 'dying' || game.state === 'rescue');
};
document.body.classList.toggle('touch-mode', input.device === 'touch');
refreshHelp();

function updateMenuLabels() {
  $('music-btn').textContent = 'Music: ' + (sound.musicOn ? 'on' : 'off');
  $('retro-btn').textContent = 'Retro pixels: ' + (retro ? 'on' : 'off');
  const fsOk = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
  $('fullscreen-btn').classList.toggle('hidden', !fsOk);
}
updateMenuLabels();

function tryFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req || document.fullscreenElement) return;
  try {
    const p = req.call(el, { navigationUI: 'hide' });
    if (p && p.then) p.then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
  } catch { /* not allowed */ }
}

// world map: one card per level
function renderSelect() {
  const wrap = $('level-cards');
  wrap.innerHTML = '';
  LEVELS.forEach((L, i) => {
    const open = unlocked(i);
    const p = progress[L.id];
    const btn = document.createElement('button');
    btn.className = 'level-card' + (open ? '' : ' locked') + (p?.done ? ' done' : '');
    btn.style.setProperty('--card', L.color);
    btn.disabled = !open;
    const status = !open ? 'Locked' : p?.done
      ? `◆ ${p.garibs}/${p.total}${p.crystal ? ' · ★' : ''}`
      : 'New!';
    btn.innerHTML = `
      <span class="card-icon">${open ? L.icon : '🔒'}</span>
      <span class="card-num">World ${L.number}</span>
      <span class="card-name">${L.name}</span>
      <span class="card-status">${status}</span>`;
    if (open) btn.addEventListener('click', (e) => { e.preventDefault(); playLevel(i); });
    wrap.appendChild(btn);
  });
}

function openSelect() {
  sound.unlock();
  sound.setMusic(sound.musicOn);
  sound.play('ui');
  if (game.state !== 'title') {
    game.state = 'title';
    game.ui.fade(false);
  }
  input.releaseAll();
  hud.show(false);
  setTouch(false);
  renderSelect();
  show('select');
}

function playLevel(i) {
  sound.unlock();
  sound.play('ui');
  if (input.device === 'touch') tryFullscreen();
  if (i !== levelIndex || game.state !== 'title') loadLevel(i);
  else game.reset(true);
  show(null);
  input.releaseAll();
  input.enabled = true;
  game.start();
  setTouch(true);
}

function pause() {
  if (game.state !== 'playing') return;
  game.state = 'paused';
  input.releaseAll();
  show('pause');
  setTouch(false);
  sound.play('ui');
}
function resume() {
  if (game.state !== 'paused') return;
  game.state = 'playing';
  show(null);
  setTouch(true);
  sound.play('ui');
}
function restart() {
  game.reset(true);
  game.state = 'playing';
  show(null);
  hud.show(true);
  setTouch(true);
  sound.play('ui');
}

const tap = (id, fn) => $(id).addEventListener('click', (e) => { e.preventDefault(); fn(); });
tap('start-btn', openSelect);
tap('select-back', () => { show('title'); sound.play('ui'); });
tap('pause-btn', pause);
tap('resume-btn', resume);
tap('restart-btn', restart);
tap('map-btn', openSelect);
tap('checkpoint-btn', () => {
  // escape hatch if the ball ever gets stuck somewhere silly
  game.respawn();
  game.state = 'playing';
  show(null);
  setTouch(true);
  sound.play('ui');
});
tap('again-btn', restart);
tap('next-btn', () => playLevel(Math.min(LEVELS.length - 1, levelIndex + 1)));
tap('complete-map-btn', openSelect);
tap('retry-btn', restart);
tap('gameover-map-btn', openSelect);
tap('music-btn', () => { sound.setMusic(!sound.musicOn); updateMenuLabels(); saveSettings(); });
tap('retro-btn', () => { retro = !retro; resize(); updateMenuLabels(); saveSettings(); });
tap('fullscreen-btn', () => {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else tryFullscreen();
});

// keyboard/gamepad shortcuts for menus
function menuKeys() {
  if (!input.pressed.pause && !input.pressed.jump) return;
  const titleOpen = !$('title').classList.contains('hidden');
  const selectOpen = !$('select').classList.contains('hidden');
  if (titleOpen && input.pressed.jump && input.device !== 'touch') openSelect();
  else if (selectOpen && input.pressed.jump && input.device !== 'touch') {
    // jump on the world map plays the newest unlocked world
    let i = 0;
    while (i + 1 < LEVELS.length && unlocked(i + 1)) i++;
    playLevel(i);
  } else if (game.state === 'playing' && input.pressed.pause) pause();
  else if (game.state === 'paused' && (input.pressed.pause || input.pressed.jump)) resume();
  else if (game.state === 'complete' && input.pressed.jump) {
    if (levelIndex < LEVELS.length - 1) playLevel(levelIndex + 1); else openSelect();
  } else if (game.state === 'gameover' && input.pressed.jump) restart();
}

// pause automatically when the app is backgrounded
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ---------------------------------------------------------------- loop
let last = performance.now();
let perfT = 0, perfFrames = 0;
function adaptQuality(dt) {
  if (game.state !== 'playing' || retro) return;
  perfT += dt; perfFrames++;
  if (perfT < 3) return;
  const fps = perfFrames / perfT;
  perfT = 0; perfFrames = 0;
  if (fps < 45 && dprCap > 1) {
    dprCap = Math.max(1, dprCap - 0.5);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, dprCap));
    renderer.setSize(innerWidth, innerHeight, false);
  }
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  adaptQuality(dt);
  input.enabled = game.state === 'playing' || game.state === 'dying' || game.state === 'rescue';
  input.update();
  menuKeys();
  if (game.state !== 'paused') game.update(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// handy for debugging from the console
if (new URLSearchParams(location.search).has('debug')) {
  import('./debug.js').then((m) => {
    m.installDebug(() => game, () => renderer.render(scene, camera), () => renderer, (i) => { loadLevel(i); return game; });
  });
}
