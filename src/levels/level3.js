// World 3: Carnival Chaos. Floating fairground at sunset.
// New: conveyor belts, pinball bumpers, a ferris wheel, a strongman bell (heavy switch)
// and crumbling platforms.
const WHEEL = { x: 0, y: 5.5, z: -50.8, r: 5.5, period: 20 };
const gondola = (phase) => ({
  x: WHEEL.x, y: WHEEL.y, z: WHEEL.z, w: 3, d: 2.4, h: 0.35, mat: 'checker',
  circle: { r: WHEEL.r, period: WHEEL.period, plane: 'xy', phase },
});

export const LEVEL3 = {
  id: 'carnival', number: 3, theme: 'carnival', icon: '🎪', color: '#e8394f',
  name: 'Carnival Chaos',
  start: { pos: [0, 0, 5], yaw: Math.PI },
  ball: [0, 0.5, 1.5],
  killY: -22,
  span: 110,

  islands: [
    { x: 0, y: 0, z: 0, r: 7, mat: 'checker' },         // A  entrance stage
    { x: 0, y: 0, z: -19.5, r: 2.6, mat: 'checker' },   //    stop between the belts
    { x: 0, y: 0, z: -41, r: 8, mat: 'checker' },       // C  bumper plaza
    { x: 0, y: 10.5, z: -88, r: 7, mat: 'checker' },    // G  big top
  ],

  boxes: [
    // H  high platform beyond the wheel (gate at the far end)
    { x: 0, y: 10.5, z: -59.5, w: 8, d: 13, h: 1.5, mat: 'checker' },
  ],

  conveyors: [
    { x: 0, y: 0, z: -12, w: 2.6, d: 10.4, h: 0.5, belt: [0, -2.2] },   // carries you forward
    { x: 0, y: 0, z: -27.6, w: 2.6, d: 11.4, h: 0.5, belt: [0, 2.4] },  // runs against you
  ],

  fenceRings: [
    { x: 0, z: 0, r: 7, y: 0, segs: 18, gaps: [Math.PI], gapWidth: 0.3 },
    { x: 0, z: -41, r: 8, y: 0, segs: 20, gaps: [0, Math.PI], gapWidth: 0.25 },
  ],
  fences: [
    // rails on the high platform's sides
    { from: [-3.9, -53.2], to: [-3.9, -65.8], y: 10.5 },
    { from: [3.9, -53.2], to: [3.9, -65.8], y: 10.5 },
  ],

  bumpers: [
    { x: -3, y: 0, z: -37.5 }, { x: 3, y: 0, z: -37.5 }, { x: 0, y: 0, z: -41 },
    { x: -3.5, y: 0, z: -44.8 }, { x: 3.5, y: 0, z: -44.8 },
  ],

  movers: [gondola(0), gondola(Math.PI / 2), gondola(Math.PI), gondola(Math.PI * 1.5)],
  wheels: [WHEEL],

  switches: [
    { id: 'bell', heavy: true, x: -2.2, y: 10.5, z: -58.5, msg: 'DING DING DING!', sub: 'The gate is open' },
  ],
  gates: [
    { trigger: 'bell', x: 0, y: 15, z: -63, w: 7.8, d: 0.6, h: 4.5, mat: 'stripes', move: [0, -5.1, 0], time: 1.6 },
  ],

  crumbles: [
    { x: 0.7, y: 10.5, z: -68.2, w: 2.4, d: 2.4, h: 0.6, mat: 'checker', delay: 0.6 },
    { x: -0.7, y: 10.5, z: -71.6, w: 2.4, d: 2.4, h: 0.6, mat: 'checker', delay: 0.6 },
    { x: 0.7, y: 10.5, z: -75, w: 2.4, d: 2.4, h: 0.6, mat: 'checker', delay: 0.6 },
    { x: -0.7, y: 10.5, z: -78.4, w: 2.4, d: 2.4, h: 0.6, mat: 'checker', delay: 0.6 },
  ],

  trees: [
    [-5, 0, -3.5, 1.0], [5.2, 0, -2.5, 0.9], [-5.8, 0, -40, 0.9], [5.8, 0, -44, 1.0],
    [-5.4, 10.5, -84.5, 1.0], [5, 10.5, -85.5, 0.9],
  ],

  props: [
    { type: 'tent', x: -4.6, y: 0, z: 2.6, s: 0.6 },
    { type: 'balloons', x: 4.6, y: 0, z: 2.2 },
    { type: 'balloons', x: -6.6, y: 0, z: -34, c: 1 },
    { type: 'balloons', x: 2.8, y: 10.5, z: -54, c: 2 },
    { type: 'tent', x: -5, y: 10.5, z: -92, s: 0.75 },
    { type: 'tent', x: 5.2, y: 10.5, z: -91, s: 0.7 },
    { type: 'tent', x: -12, y: 2, z: -60, s: 1.4, noCollide: true },
    { type: 'tent', x: 13, y: -2, z: -25, s: 1.6, noCollide: true },
    { type: 'balloons', x: -4, y: 10.5, z: -84, c: 3 },
  ],

  garibs: [
    // A
    [-3.5, 0.9, -1], [3.5, 0.9, -1], [0, 0.9, -4.5], [-2.5, 0.9, 3], [2.5, 0.9, 3],
    // belts
    [0, 0.9, -9], [0, 0.9, -12], [0, 0.9, -15], [0, 0.9, -19.5], [0, 0.9, -24], [0, 0.9, -27], [0, 0.9, -30],
    // bumper plaza
    [-1.5, 0.9, -36], [1.5, 0.9, -36], [-5, 0.9, -41], [5, 0.9, -41], [-1.6, 0.9, -43.2], [1.6, 0.9, -43.2], [0, 0.9, -47], [-5.5, 0.9, -46],
    // along the wheel (ride a gondola through them)
    [3.9, 2.5, -50.8], [5.5, 6.4, -50.8], [3.9, 10.3, -50.8],
    // high platform
    [-2.5, 11.4, -54.5], [2.5, 11.4, -60], [0, 11.4, -56],
    // crumbling path
    [0.7, 11.5, -68.2], [-0.7, 11.5, -71.6], [0.7, 11.5, -75],
    // big top
    [-4, 11.4, -86], [4, 11.4, -90], [0, 11.4, -83], [-3, 11.4, -91.5], [3, 11.4, -84.5],
  ],

  potions: [
    { x: 2.6, y: 10.5, z: -56.5, form: 'bowling' },
    { x: 2.6, y: 10.5, z: -65, form: 'crystal' },
  ],

  checkpoints: [
    { x: 5.5, y: 0, z: -38.5 },
    { x: -2.8, y: 10.5, z: -54.6 },
    { x: 3, y: 10.5, z: -83.5 },
  ],

  enemies: [
    { skin: 'mouse', a: [-5.5, 0, -35.4], b: [5.5, 0, -35.4], speed: 1.8 },
    { skin: 'mouse', a: [-5.5, 0, -47.2], b: [5.5, 0, -47.2], speed: 1.8 },
    { skin: 'mouse', a: [-3, 10.5, -61], b: [1.5, 10.5, -61], speed: 1.4 },
    { skin: 'mouse', a: [-4, 10.5, -88.5], b: [4, 10.5, -88.5], speed: 1.8 },
  ],

  signs: [
    { x: -2.4, y: 0, z: -4.6, text: 'Welcome to the Carnival! Hop on the <b>conveyor belt</b>. The second one runs backwards, so keep walking!' },
    { x: -2, y: 0, z: -33.8, text: '<b>Bumpers</b> bounce you and your ball around. Don\'t worry, the fence keeps the ball in.' },
    { x: -2.4, y: 0, z: -47.6, text: 'Ride the <b>ferris wheel</b> to the top, then jump off onto the high platform!' },
    { x: 2.4, y: 10.5, z: -59.8, text: 'The <b>strongman bell</b>! Only a <b>bowling ball</b> is heavy enough to ring it and open the gate.' },
    { x: -2.6, y: 10.5, z: -65.2, text: 'These platforms <b>crumble</b>! Turn the ball back to crystal and keep moving.' },
  ],

  goal: { x: 0, y: 10.5, z: -91.2 },

  scenery: [
    { x: -40, y: -2, z: -30, r: 7 }, { x: 44, y: 4, z: -70, r: 8 }, { x: -46, y: 8, z: -100, r: 7 },
    { x: 30, y: -6, z: 8, r: 6 },
  ],
};
