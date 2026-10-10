import * as THREE from 'three';
import { Game } from './game.js';
import { Input } from './input.js';
import { Hud, controlsHelp } from './hud.js';
import { Sound } from './audio.js';
import { LEVEL1 } from './level1.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const scene = new THREE.Scene();
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
    $('complete-stats').innerHTML = `
      <div class="row"><span>Garibs</span><span>${st.garibs} / ${st.total}</span></div>
      <div class="row"><span>Time</span><span>${st.time}</span></div>
      <div class="row"><span>Lives left</span><span>${st.lives}</span></div>
      <div class="row"><span>Crystal bonus</span><span>${st.crystal ? '★ Yes!' : '—'}</span></div>`;
    show('complete');
    hud.show(false);
    setTouch(false);
  },
  showGameOver() { show('gameover'); hud.show(false); setTouch(false); },
};

const game = new Game({ scene, camera, input, hud, sound, level: LEVEL1, ui });

// ---------------------------------------------------------------- screens
const screens = ['title', 'pause', 'complete', 'gameover'];
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
  setTouch(game.state === 'playing' || game.state === 'dying');
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

function startGame() {
  sound.unlock();
  sound.setMusic(sound.musicOn);
  sound.play('ui');
  if (input.device === 'touch') tryFullscreen();
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
tap('start-btn', startGame);
tap('pause-btn', pause);
tap('resume-btn', resume);
tap('restart-btn', restart);
tap('checkpoint-btn', () => {
  // escape hatch if the ball ever gets stuck somewhere silly
  game.respawn();
  game.state = 'playing';
  show(null);
  setTouch(true);
  sound.play('ui');
});
tap('again-btn', restart);
tap('retry-btn', restart);
tap('music-btn', () => { sound.setMusic(!sound.musicOn); updateMenuLabels(); saveSettings(); });
tap('retro-btn', () => { retro = !retro; resize(); updateMenuLabels(); saveSettings(); });
tap('fullscreen-btn', () => {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else tryFullscreen();
});

// keyboard/gamepad shortcuts for menus
function menuKeys() {
  if (!input.pressed.pause && !input.pressed.jump) return;
  if (game.state === 'title' && input.pressed.jump && input.device !== 'touch') startGame();
  else if (game.state === 'playing' && input.pressed.pause) pause();
  else if (game.state === 'paused' && (input.pressed.pause || input.pressed.jump)) resume();
  else if ((game.state === 'complete' || game.state === 'gameover') && input.pressed.jump) restart();
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
  input.enabled = game.state === 'playing' || game.state === 'dying';
  input.update();
  menuKeys();
  if (game.state !== 'paused') game.update(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// handy for debugging from the console
window.__game = game;
if (new URLSearchParams(location.search).has('debug')) {
  import('./debug.js').then((m) => m.installDebug(game, () => renderer.render(scene, camera), renderer));
}
