// World 2: Splash Lagoon. Islands rise out of the sea (water at y=0).
// New: swimming, a floating rubber ball you can ride, a ball switch that raises a bridge.
const W = 0, FLOOR = -7;
const isl = (x, y, z, r, extra = {}) => ({ x, y, z, r, column: true, depth: y - FLOOR - 0.5, taper: 0.95, ...extra });

export const LEVEL2 = {
  id: 'lagoon', number: 2, theme: 'lagoon', icon: '🏝️', color: '#2fb8d8',
  name: 'Splash Lagoon',
  start: { pos: [0, 0.6, 5], yaw: Math.PI },
  ball: [0, 1.1, 1.5],
  killY: -30,
  span: 120,
  water: { y: W, floor: FLOOR },

  islands: [
    isl(0, 0.6, 0, 7.5),                 // A  start beach
    isl(0.8, 0.9, -10, 1.4),             // B  stepping stones
    isl(-0.8, 0.9, -13.6, 1.4),
    isl(0.6, 0.9, -17.2, 1.4),
    isl(0, 0.6, -25, 6),                 // C  crab cove
    isl(-5, 0.4, -37, 1.3, { noDecor: true }), //    sandbar in the channel
    isl(0, 0.6, -49, 6),                 // E  switch island
    isl(0, 3, -71.5, 5.5),               // F  cliff island
    isl(0, 0.8, -101, 6.5),              // G  lighthouse point
    isl(12, 0.5, -15, 1.6),              //    secret rocks (swim out)
    isl(-11, 0.6, -60, 1.7),
  ],

  boxes: [
    { x: 0, y: 3, z: -56.3, w: 3, d: 2.6, h: 10, mat: 'flags' },     // pier at the top of the ramp
    { x: 0, y: 0.8, z: -81.6, w: 3.2, d: 2.4, h: 7.8, mat: 'flags' }, // dock below the cliff
  ],

  ramps: [
    { from: [0, 0.6, -50], to: [0, 3, -55.1], w: 3, mat: 'flags' },
    { from: [0, 3, -76.4], to: [0, 0.8, -80.5], w: 3, mat: 'flags' },
  ],

  switches: [
    { id: 'bridge', x: -3.3, y: 0.6, z: -51, msg: 'A bridge rises!', sub: 'Up the ramp and across' },
  ],
  gates: [
    // rises out of the sea when the switch is pressed
    { trigger: 'bridge', x: 0, y: -1.3, z: -61.8, w: 2.6, d: 9.2, h: 0.5, mat: 'wood', move: [0, 4.3, 0], time: 2.2 },
  ],

  movers: [
    // a raft shuttling from the dock to the lighthouse
    { x: 0, y: 0.75, z: -88.25, w: 3, d: 3, h: 0.4, axis: [0, 0, 1], amp: 4.5, period: 7, mat: 'wood' },
  ],

  trees: [
    [-5.5, 0.6, 2.5, 1.0], [5.5, 0.6, -2, 0.9], [-5, 0.6, -4, 1.1],
    [4.5, 0.6, -22, 1.0], [-4.5, 0.6, -28.5, 0.9],
    [4, 0.6, -46.5, 1.0],
    [3.5, 3, -69, 0.9],
    [5, 0.8, -98, 1.0], [-5, 0.8, -103.5, 1.1],
  ],

  props: [
    { type: 'umbrella', x: -3.8, y: 0.6, z: 3.2 },
    { type: 'umbrella', x: 4.2, y: 0.6, z: -27.5, rot: 1 },
    { type: 'rock', x: 5.2, y: 0.6, z: 1.8, s: 0.8 },
    { type: 'rock', x: -4.6, y: 0.6, z: -52.5, s: 0.6 },
    { type: 'lighthouse', x: 4.3, y: 0.8, z: -104.5 },
    { type: 'coral', x: -6, y: FLOOR, z: -32, color: 0xff6f9a },
    { type: 'coral', x: 5, y: FLOOR, z: -38, color: 0xffb03a },
    { type: 'coral', x: -3, y: FLOOR, z: -64, color: 0xb77cff },
    { type: 'coral', x: 6, y: FLOOR, z: -90, color: 0xff6f9a },
    { type: 'rock', x: 3, y: FLOOR, z: -35, s: 1.4 },
  ],

  garibs: [
    // A
    [-4, 1.5, 0], [4, 1.5, 0], [-3, 1.5, -4], [3, 1.5, -4], [0, 1.5, -6], [5.5, 1.5, 3.5],
    // stepping stones
    [0.8, 1.9, -10], [-0.8, 1.9, -13.6], [0.6, 1.9, -17.2],
    // C
    [-4, 1.5, -22.5], [4, 1.5, -27], [0, 1.5, -29.5],
    // over the channel (grab them riding the ball)
    [0, 1.4, -33], [0, 1.4, -35.5], [0, 1.4, -38], [0, 1.4, -40.5], [-5, 1.3, -37],
    // E and the pier
    [-3.5, 1.5, -46], [3.5, 1.5, -50], [0, 3.9, -56.3],
    // bridge
    [0, 3.9, -59], [0, 3.9, -61.8], [0, 3.9, -64.5],
    // F
    [-3, 3.9, -70], [3, 3.9, -73.5], [0, 3.9, -68],
    // raft
    [0, 1.7, -86], [0, 1.7, -91],
    // G
    [-4, 1.7, -102], [4, 1.7, -100], [0, 1.7, -97.5], [-2.5, 1.7, -106],
    // secret rocks
    [12, 1.4, -14.6], [12, 1.4, -15.6], [-11, 1.5, -59.5], [-11, 1.5, -60.5],
  ],

  potions: [
    { x: -3.5, y: 0.6, z: -21.8, form: 'rubber' },
    { x: -3.6, y: 0.8, z: -98.5, form: 'crystal' },
  ],

  checkpoints: [
    { x: 2.8, y: 0.6, z: -21.3 },
    { x: 2.8, y: 0.6, z: -45 },
    { x: 2.6, y: 3, z: -68.2 },
  ],

  enemies: [
    { skin: 'crab', a: [-3.5, 0.6, -25.3], b: [3.5, 0.6, -25.3] },
    { skin: 'crab', a: [-3, 0.6, -47.5], b: [3, 0.6, -47.5] },
    { skin: 'crab', a: [-3, 3, -72], b: [3, 3, -72] },
    { skin: 'crab', a: [-3.5, 0.8, -101.5], b: [3.5, 0.8, -101.5] },
  ],

  signs: [
    { x: -2.6, y: 0.6, z: 3.4, text: 'Splash Lagoon! You can swim, but you have to let go of the ball in the water. Rubber floats; everything else sinks!' },
    { x: -2.2, y: 0.6, z: -6.2, text: 'Hop across the stones with your ball. You can double jump while carrying it!' },
    { x: 2.6, y: 0.6, z: -27.6, text: 'Too far to jump! Make the ball <b>rubber</b>, throw it in the water, then swim to it and climb on. Paddle across!' },
    { x: -2.8, y: 0.6, z: -45.5, text: 'A <b>ball switch</b>! Put your ball down on it to raise the bridge.' },
    { x: -2.6, y: 3, z: -74.5, text: 'Ride the raft over to the lighthouse.' },
    { x: 3.4, y: 0.8, z: -97.8, text: 'Bring a <b>Crystal Ball</b> through the portal for a bonus!' },
  ],

  goal: { x: 0, y: 0.8, z: -104.8 },

  scenery: [
    { x: -48, y: 0.6, z: -40, r: 8 }, { x: 52, y: 0.6, z: -75, r: 10 }, { x: -40, y: 0.6, z: -120, r: 7 },
    { x: 35, y: 0.6, z: 5, r: 6 }, { x: 10, y: 0.6, z: -150, r: 9 },
  ],
};
