// World 1: Sunny Isles. Coordinates in metres; the route runs toward -Z.
// y values for islands/boxes are the height of the walkable top surface.

export const LEVEL1 = {
  id: 'isles', number: 1, theme: 'meadow', icon: '🌼', color: '#4cc764',
  name: 'Sunny Isles',
  start: { pos: [0, 0, 5], yaw: Math.PI },
  ball: [0, 0.5, 1.5],
  killY: -22,

  islands: [
    { x: 0, y: 0, z: 0, r: 8 },              // A  start meadow
    { x: 0, y: 0, z: -26, r: 6.5 },          // C  bumbler island
    { x: 9.6, y: 1.2, z: -27, r: 1.8 },      //    little side islet
    { x: 0, y: 3, z: -43.4, r: 5.6 },        // D  plateau
    { x: 0, y: 2, z: -57.2, r: 5.3 },        // F  potion island
    { x: -7.2, y: 8.5, z: -58, r: 1.5, column: true, depth: 14 }, // secret pillar
    { x: 0, y: 8, z: -92.5, r: 5.8 },        // I  bowling island
    { x: 0, y: 8, z: -120.5, r: 6 },         // L  portal island
  ],

  boxes: [
    { x: 0, y: 0, z: -13.75, w: 2.2, d: 12.5, h: 0.4, mat: 'wood' },        // B  bridge
    { x: 0, y: 3, z: -38.5, w: 3.6, d: 2, h: 0.6, mat: 'stone' },           //    ramp landing
    { x: 0, y: 8, z: -69.25, w: 8, d: 13.5, h: 8, mat: 'stone' },           // H  high ledge
    { x: 0, y: 8, z: -81.5, w: 4.8, d: 11, h: 1.2, mat: 'thistle', hurt: true }, // thistle strip
    { x: 0, y: 8, z: -101.4, w: 2.6, d: 6.6, h: 0.4, mat: 'wood' },         // J  bridge to mover
  ],

  ramps: [
    { from: [0, 0, -30.5], to: [0, 3, -37.6], w: 3.6 },
  ],

  pads: [
    // apex: launch height above the pad; push: horizontal velocity [x, z]
    { x: 0, y: 2, z: -60.3, r: 1.0, apex: 8.5, push: [0, -3.6] },
  ],

  crates: (() => {
    const out = [];
    const s = 0.85;
    // six high: too tall to double-jump over, so you need the bowling ball
    for (const x of [-0.85, 0, 0.85])
      for (let k = 0; k < 6; k++) out.push({ x, y: 8 + s / 2 + k * s, z: -99.2, size: s });
    return out;
  })(),

  movers: [
    { x: 0, y: 8, z: -109.6, w: 3.6, d: 3.6, h: 0.5, axis: [0, 0, 1], amp: 2.95, period: 5.5, phase: 0 },
  ],

  trees: [
    [-5.5, 0, 3.5, 1.1], [5.8, 0, 2.5, 1.0], [-6, 0, -3.5, 1.2], [6.2, 0, -4, 0.9],
    [-5, 0, -29, 1.0], [5, 0, -29.5, 1.1],
    [-4, 3, -46.5, 0.9], [4.2, 3, -40.2, 0.8],
    [3.6, 2, -59.5, 0.8],
    [4.2, 8, -94.5, 0.9],
    [-4.2, 8, -123, 1.0], [4.2, 8, -123.5, 1.1],
  ],

  garibs: [
    // A
    [-4, 0.9, 0], [-4.5, 0.9, -2.5], [4, 0.9, 0], [4.5, 0.9, -2.5], [0, 0.9, -5], [0, 0.9, -6.5],
    // B bridge
    [0, 0.9, -10.5], [0, 0.9, -13], [0, 0.9, -15.5], [0, 0.9, -18],
    // C
    [-4.5, 0.9, -28], [4.5, 0.9, -28],
    // side islet
    [9.2, 2.1, -26.6], [10, 2.1, -27.4],
    // ramp
    [0, 1.9, -33], [0, 2.9, -35.5],
    // D
    [-3.5, 3.9, -42], [3.5, 3.9, -42],
    // over the gap
    [0, 4.4, -50.8],
    // secret pillar
    [-7.2, 9.4, -57.4], [-7.2, 9.4, -58.6], [-6.6, 9.4, -58], [-7.8, 9.4, -58],
    // H ledge
    [-2.5, 8.9, -68], [2.5, 8.9, -71],
    // above the thistles (grab them while riding the ball)
    [0, 10.2, -79], [0, 10.2, -82], [0, 10.2, -85],
    // I
    [3.5, 8.9, -96], [-1.2, 8.9, -95.5],
    // just past the crate wall
    [0, 8.9, -102.6],
    // mover
    [0, 9.6, -109.6],
    // L
    [-4, 8.9, -121.5], [4, 8.9, -121.5], [0, 8.9, -116.8],
  ],

  potions: [
    { x: 2.8, y: 2, z: -56, form: 'rubber' },
    { x: 3.2, y: 8, z: -91, form: 'bowling' },
    { x: -3.3, y: 8, z: -117.5, form: 'crystal' },
  ],

  checkpoints: [
    { x: 3.2, y: 0, z: -22 },
    { x: 2.6, y: 8, z: -65.5 },
    { x: -3, y: 8, z: -89.5 },
  ],

  enemies: [
    { a: [-3.5, 0, -26.5], b: [3.5, 0, -26.5] },
    { a: [-2.5, 3, -44.8], b: [2.5, 3, -44.8] },
    { a: [-3, 8, -120.2], b: [3, 8, -120.2] },
  ],

  signs: [
    { x: -2.8, y: 0, z: 3.2, text: 'This is your <b>Crystal Ball</b>! Walk up and press {GRAB} to pick it up. Press it again to put it down.' },
    { x: 2.8, y: 0, z: -4.5, text: 'Get the ball to the <b>magic portal</b> at the end. Careful: crystal shatters if it falls too far!' },
    { x: -3.2, y: 0, z: -22, text: 'A Bumbler! Jump on its head, or {SLAP} the ball into it.' },
    { x: 3.2, y: 3, z: -46.8, text: 'Gap ahead! Jump across with the ball (tap {JUMP} twice to double jump), or <b>throw</b> it over with {GRAB} while running.' },
    { x: -2.6, y: 2, z: -54.2, text: 'Potions change your ball! <b>Rubber</b> bounces, and if you double-jump onto it you get a super bounce!' },
    { x: 2.9, y: 2, z: -60.2, text: 'Bounce pad! Hold the ball and hop on, or roll the ball onto it.' },
    { x: -2.6, y: 8, z: -73.8, text: 'Ouch, thistles! Put the ball down, hop on top of it, and ride it across.' },
    { x: -3.4, y: 8, z: -94.2, text: 'Crates in the way? A <b>bowling ball</b> is heavy enough to smash right through!' },
    { x: 3.4, y: 8, z: -117, text: 'Almost there! Bring a <b>Crystal Ball</b> through the portal for a bonus.' },
  ],

  goal: { x: 0, y: 8, z: -123.8 },

  // purely decorative, far away
  scenery: [
    { x: -38, y: -4, z: -30, r: 7 }, { x: 42, y: 2, z: -70, r: 9 }, { x: -45, y: 6, z: -110, r: 8 },
    { x: 30, y: -8, z: 10, r: 6 }, { x: -20, y: 14, z: -150, r: 10 }, { x: 35, y: 10, z: -140, r: 6 },
  ],
};
