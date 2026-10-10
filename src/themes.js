// Look and feel for each world: sky, light, fog, ground colours, scenery style and music.
export const THEMES = {
  meadow: {
    sky: [0x3d8be6, 0xbfe6ff, 0xfff1d6],
    fog: [0xc4e6ff, 50, 175],
    hemi: [0xe4f2ff, 0x7a6248, 1.9],
    sun: [0xfff0d0, 2.2, [0.6, 1, 0.35]],
    palette: {
      grass: { base: '#62c73e', alt: '#56b934', specks: ['#7fdc55', '#4aa82c', '#8ce860'] },
      side: { dirt: '#9a6633', specks: ['#865628', '#ad7740', '#7a4b22'], fringe: '#56b934', light: '#7fdc55' },
      rock: { base: '#8a6e55', blocks: ['#7a5f48', '#9c8064', '#6e5440'], specks: ['#5d4635', '#a88d70'] },
      stone: { mortar: '#6f6a80', a: '#aea8c2', b: '#a19bb6', specks: ['#8f89a6', '#c2bdd4'] },
    },
    clouds: { color: 0xffffff, emissive: 0x506080, below: 34, above: 10 },
    trees: 'round', decor: 'flowers', music: 'meadow', fence: 'wood',
  },

  lagoon: {
    sky: [0x2f8fe0, 0xa8e8ff, 0x8fe0ee],
    fog: [0xa6e2f0, 45, 165],
    hemi: [0xeaf8ff, 0x8a7a5a, 1.9],
    sun: [0xfff2cc, 2.3, [0.4, 1, 0.5]],
    palette: {
      grass: { base: '#f2dca0', alt: '#ead095', specks: ['#f8e8b8', '#d9bd80', '#fff3cf'] },
      side: { dirt: '#d8b27a', specks: ['#c49a5e', '#e4c48e', '#b88a50'], fringe: '#ead095', light: '#f8e8b8' },
      rock: { base: '#b98d5f', blocks: ['#a87c50', '#c9a070', '#9a6e45'], specks: ['#8a6040', '#d8b080'] },
      stone: { mortar: '#6a9a92', a: '#cfe8e0', b: '#bfe0d6', specks: ['#a8d0c6', '#e4f4ef'] },
    },
    clouds: { color: 0xffffff, emissive: 0x507090, below: 0, above: 14 },
    trees: 'palm', decor: 'shells', music: 'lagoon', fence: 'rope',
    water: 0x2fb8d8,
  },

  carnival: {
    sky: [0x3b2a7a, 0xff9e7a, 0xffd27a],
    fog: [0xf0a890, 45, 165],
    hemi: [0xffe0d0, 0x553366, 1.7],
    sun: [0xffc49a, 2.2, [-0.5, 0.7, 0.4]],
    palette: {
      grass: { base: '#fff4e0', alt: '#e8394f', specks: [], checker: true },
      side: { stripes: ['#e8394f', '#fff4e0'], band: '#ffd23f' },
      rock: { base: '#6b4f8a', blocks: ['#5d4379', '#7a5c9c', '#523a6c'], specks: ['#46305e', '#8a6cae'] },
      stone: { mortar: '#3d5aa8', a: '#8fc4ff', b: '#7ab4f4', specks: ['#a8d4ff', '#6aa0e8'] },
    },
    clouds: { color: 0xffd6e8, emissive: 0x704060, below: 30, above: 12 },
    trees: 'candy', decor: 'confetti', music: 'carnival', fence: 'candy',
  },

  spooky: {
    sky: [0x0b0a24, 0x2a1f5a, 0x4a2f6e],
    fog: [0x2a2350, 30, 120],
    hemi: [0x9a90ff, 0x2a2040, 1.5],
    sun: [0xb8c4ff, 1.8, [-0.3, 1, 0.5]],
    palette: {
      grass: { base: '#3f5e3a', alt: '#36532f', specks: ['#4f7048', '#2c4527', '#5a7a4f'] },
      side: { dirt: '#4a3a33', specks: ['#3a2c26', '#5a473e', '#33261f'], fringe: '#36532f', light: '#4f7048' },
      rock: { base: '#4a4058', blocks: ['#3d3449', '#57506a', '#332b3d'], specks: ['#2a2333', '#655c78'] },
      stone: { mortar: '#2e2a3a', a: '#6a6680', b: '#5d5973', specks: ['#77738e', '#4e4a62'] },
    },
    clouds: { color: 0x7a6aa8, emissive: 0x201840, below: 26, above: 8 },
    trees: 'dead', decor: 'pumpkins', music: 'spooky', fence: 'iron',
    night: true,
  },
};
