// World 4: Spooky Spires. A moonlit castle.
// New: ghosts that drift after you, a lift, pop-up spike traps, crumbling floors
// and a portcullis opened by a ball switch.
const tower = (x, y, z, r, depth) => ({ x, y, z, r, mat: 'flags', column: true, depth, taper: 0.9, noDecor: true });

export const LEVEL4 = {
  id: 'spooky', number: 4, theme: 'spooky', icon: '🏰', color: '#7b4bd6',
  name: 'Spooky Spires',
  start: { pos: [0, 0, 5], yaw: Math.PI },
  ball: [0, 0.5, 1.5],
  killY: -22,
  span: 100,

  islands: [
    { x: 0, y: 0, z: 0, r: 7.5 },                 // A  graveyard
    tower(-6.5, 7, -34.2, 3.5, 9),                // T1
    tower(-6.5, 7, -56.5, 5, 10),                 // T2
    tower(-13.5, 13, -50.5, 1.6, 16),             //    secret spire
    tower(-6.5, 7, -77.5, 6, 10),                 // keep
  ],

  boxes: [
    { x: 0, y: 0, z: -11.5, w: 2.4, d: 8.2, h: 0.4, mat: 'wood' },        // bridge to the castle
    { x: 0, y: 0, z: -21.5, w: 11, d: 12, h: 3, mat: 'flags' },           // courtyard
    { x: 0, y: 7, z: -29.2, w: 15, d: 3.4, h: 10, mat: 'flags' },         // castle wall + walkway
    { x: -6.5, y: 7, z: -66.5, w: 2.6, d: 10.4, h: 0.4, mat: 'wood' },    // bridge to the keep
  ],

  movers: [
    // lift up the castle wall
    { x: 6.9, y: 3.5, z: -25.8, w: 2.6, d: 2.6, h: 0.4, axis: [0, 1, 0], amp: 3.5, period: 7, phase: -Math.PI / 2, mat: 'flags' },
  ],

  spikes: [
    { x: 3, y: 7.02, z: -29.2, w: 2, d: 3.2, period: 2.6, phase: 0 },
    { x: -1.6, y: 7.02, z: -29.2, w: 2, d: 3.2, period: 2.6, phase: 0.5 },
    { x: -6.5, y: 7.02, z: -75.2, w: 4, d: 1.6, period: 2.4, phase: 0.25 },
  ],

  crumbles: [
    { x: -6.5, y: 7, z: -39.4, w: 2.4, d: 2.4, h: 0.6, delay: 0.55 },
    { x: -6.5, y: 7, z: -42.8, w: 2.4, d: 2.4, h: 0.6, delay: 0.55 },
    { x: -6.5, y: 7, z: -46.2, w: 2.4, d: 2.4, h: 0.6, delay: 0.55 },
    { x: -6.5, y: 7, z: -49.6, w: 2.4, d: 2.4, h: 0.6, delay: 0.55 },
  ],

  switches: [
    { id: 'gate', x: -3.6, y: 7, z: -55.2, msg: 'The portcullis rises!', sub: 'On to the keep' },
  ],
  gates: [
    { trigger: 'gate', x: -6.5, y: 11.6, z: -61.9, w: 2.9, d: 0.25, h: 4.6, mat: 'bars', move: [0, 4.8, 0], time: 1.8 },
  ],

  pads: [
    // up to the secret spire
    { x: -9.2, y: 7, z: -54.2, r: 0.9, apex: 7.5, push: [-4.15, 3.6] },
  ],

  fences: [
    { from: [-7.3, -27.65], to: [5.3, -27.65], y: 7 },
    { from: [-3.0, -30.75], to: [7.3, -30.75], y: 7 },
  ],

  trees: [
    [-5.5, 0, 4, 1.0], [5.8, 0, 3.5, 1.1], [-6, 0, -3, 0.9], [-10.8, 7, -76, 0.9],
  ],

  props: [
    { type: 'grave', x: -4, y: 0, z: 2.2 },
    { type: 'grave', x: -5, y: 0, z: -1.2, tilt: 0.1, rot: 0.3 },
    { type: 'grave', x: 4.4, y: 0, z: 1.2, rot: -0.2 },
    { type: 'grave', x: 5, y: 0, z: -2.8, tilt: -0.12 },
    { type: 'lantern', x: -2.4, y: 0, z: -6.4 },
    { type: 'lantern', x: 2.4, y: 0, z: -6.4, rot: Math.PI },
    { type: 'lantern', x: -4.8, y: 0, z: -16.2 },
    { type: 'lantern', x: 4.8, y: 0, z: -16.2, rot: Math.PI },
    { type: 'grave', x: -4.2, y: 0, z: -25.6 },
    { type: 'grave', x: 3.4, y: 0, z: -19.2, rot: 0.4 },
    { type: 'lantern', x: -9.2, y: 7, z: -59, color: 0x9affc8 },
    { type: 'lantern', x: -2.4, y: 7, z: -80, rot: Math.PI, color: 0x9affc8 },
    { type: 'grave', x: -10.5, y: 7, z: -80 },
    { type: 'grave', x: -2.6, y: 7, z: -76, rot: 0.3 },
  ],

  garibs: [
    // graveyard
    [-3, 0.9, 3], [3, 0.9, 3], [-2, 0.9, -3], [2, 0.9, -3], [0, 0.9, -5.5],
    // bridge
    [0, 0.9, -9], [0, 0.9, -11.5], [0, 0.9, -14],
    // courtyard
    [-3.5, 0.9, -20], [2.5, 0.9, -22.5], [0, 0.9, -25.8], [-2, 0.9, -17.5],
    // lift
    [6.9, 2.8, -25.8], [6.9, 5.4, -25.8],
    // walkway
    [4.6, 7.9, -29.2], [0.7, 7.9, -29.2], [-3.6, 7.9, -29.2], [-6, 7.9, -29.4],
    // T1 and the crumbling bridge
    [-6.5, 7.9, -33], [-8.6, 7.9, -35.5], [-6.5, 8.4, -42.8], [-6.5, 8.4, -46.2], [-6.5, 8.4, -49.6],
    // T2
    [-4, 7.9, -57.8], [-8.4, 7.9, -60], [-6.5, 7.9, -53],
    // secret spire
    [-13.5, 13.9, -49.9], [-13.5, 13.9, -51.1], [-12.9, 13.9, -50.5], [-14.1, 13.9, -50.5],
    // bridge to the keep
    [-6.5, 7.9, -65], [-6.5, 7.9, -68.5],
    // keep
    [-10, 7.9, -78], [-3, 7.9, -77.6], [-6.5, 7.9, -73], [-9.4, 7.9, -81.6],
  ],

  potions: [],

  checkpoints: [
    { x: -3.6, y: 0, z: -17.6 },
    { x: -8.6, y: 7, z: -33 },
    { x: -4.2, y: 7, z: -57.6 },
  ],

  enemies: [
    { type: 'ghost', home: [-3.5, 0, -3.5], range: 6 },
    { type: 'ghost', home: [-2.5, 0, -23], range: 6 },
    { type: 'ghost', home: [-9, 7, -58.5], range: 5, speed: 1.8 },
    { type: 'ghost', home: [-2.6, 7, -75.5], range: 5 },
  ],

  signs: [
    { x: -2.6, y: 0, z: 3.4, text: 'Spooky Spires! Ghosts drift toward you. <b>Stomp</b> on them, or bop them with the ball.' },
    { x: 3.2, y: 0, z: -16.9, text: 'Ride the <b>lift</b> up the castle wall.' },
    { x: 5.4, y: 7, z: -30.2, text: 'Watch the <b>spike traps</b>! Wait for them to drop, then dash across.' },
    { x: -4.4, y: 7, z: -35.4, text: 'These old floors <b>crumble</b> under you. Don\'t stop moving!' },
    { x: -3.2, y: 7, z: -53.8, text: 'Put your ball on the switch to raise the <b>portcullis</b>. (Psst: that red pad leads somewhere secret.)' },
  ],

  goal: { x: -6.5, y: 7, z: -81.2 },

  scenery: [
    { type: 'tower', x: -40, y: 0, z: -40, r: 4, h: 40 },
    { type: 'tower', x: 36, y: 0, z: -70, r: 5, h: 50 },
    { type: 'tower', x: -32, y: 0, z: -110, r: 3.5, h: 34 },
    { type: 'tower', x: 26, y: 0, z: -8, r: 3, h: 30 },
    { type: 'tower', x: 14, y: 0, z: -130, r: 6, h: 56 },
  ],
};
