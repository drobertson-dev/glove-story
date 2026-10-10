// Little procedural canvas textures, drawn at low resolution with nearest
// filtering for that crunchy late-90s console look.
import * as THREE from 'three';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeTex(size, draw, { nearest = true } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  if (nearest) {
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestMipmapLinearFilter;
  }
  t.anisotropy = 4;
  return t;
}

function speckle(g, size, colors, count, seed, sz = 2) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    g.fillStyle = colors[Math.floor(r() * colors.length)];
    g.fillRect(Math.floor(r() * size), Math.floor(r() * size), sz, sz);
  }
}

export function createTextures() {
  const T = {};

  T.grass = makeTex(32, (g, s) => {
    g.fillStyle = '#62c73e';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#56b934';
    g.fillRect(0, 0, s / 2, s / 2);
    g.fillRect(s / 2, s / 2, s / 2, s / 2);
    speckle(g, s, ['#7fdc55', '#4aa82c', '#8ce860'], 40, 1, 1);
  });

  T.grassSide = makeTex(32, (g, s) => {
    g.fillStyle = '#9a6633';
    g.fillRect(0, 0, s, s);
    speckle(g, s, ['#865628', '#ad7740', '#7a4b22'], 50, 2, 2);
    g.fillStyle = '#56b934';
    g.fillRect(0, 0, s, 10);
    const r = rng(3);
    for (let x = 0; x < s; x += 2) {
      const h = 10 + Math.floor(r() * 6);
      g.fillRect(x, 0, 2, h);
    }
    g.fillStyle = '#7fdc55';
    g.fillRect(0, 0, s, 3);
  });

  T.rock = makeTex(32, (g, s) => {
    g.fillStyle = '#8a6e55';
    g.fillRect(0, 0, s, s);
    const r = rng(4);
    for (let i = 0; i < 14; i++) {
      g.fillStyle = ['#7a5f48', '#9c8064', '#6e5440'][i % 3];
      g.fillRect(Math.floor(r() * s), Math.floor(r() * s), 4 + Math.floor(r() * 8), 3 + Math.floor(r() * 5));
    }
    speckle(g, s, ['#5d4635', '#a88d70'], 30, 5, 1);
  });

  T.stone = makeTex(32, (g, s) => {
    g.fillStyle = '#6f6a80';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#a9a3bd';
    const bh = 8;
    for (let row = 0; row < s / bh; row++) {
      const off = row % 2 ? 8 : 0;
      for (let x = -8; x < s; x += 16) {
        g.fillStyle = row % 2 ? '#a19bb6' : '#aea8c2';
        g.fillRect(x + off + 1, row * bh + 1, 14, bh - 2);
      }
    }
    speckle(g, s, ['#8f89a6', '#c2bdd4'], 30, 6, 1);
  });

  T.wood = makeTex(32, (g, s) => {
    g.fillStyle = '#b97a3f';
    g.fillRect(0, 0, s, s);
    // planks run across the texture (rows), so bridges along Z get crosswise planks
    for (let i = 0; i < 4; i++) {
      g.fillStyle = i % 2 ? '#c88a4c' : '#b0733a';
      g.fillRect(0, i * 8, s, 7);
      g.fillStyle = '#6b3f1c';
      g.fillRect(0, i * 8 + 7, s, 1);
    }
    speckle(g, s, ['#a3672f', '#d39a5b'], 30, 7, 1);
    g.fillStyle = '#5a3414';
    for (let i = 0; i < 4; i++) { g.fillRect(3, i * 8 + 3, 1, 1); g.fillRect(s - 4, i * 8 + 3, 1, 1); }
  });

  T.crate = makeTex(32, (g, s) => {
    g.fillStyle = '#c98b45';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#8e5420';
    g.fillRect(0, 0, s, 4); g.fillRect(0, s - 4, s, 4);
    g.fillRect(0, 0, 4, s); g.fillRect(s - 4, 0, 4, s);
    g.strokeStyle = '#8e5420';
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(3, 3); g.lineTo(s - 3, s - 3); g.stroke();
    g.fillStyle = '#ffd98f';
    g.fillRect(1, 1, 2, 2); g.fillRect(s - 3, 1, 2, 2); g.fillRect(1, s - 3, 2, 2); g.fillRect(s - 3, s - 3, 2, 2);
  });

  T.thistle = makeTex(32, (g, s) => {
    g.fillStyle = '#5b3d6e';
    g.fillRect(0, 0, s, s);
    speckle(g, s, ['#7a4f8f', '#3f2a4f', '#8f5fa8', '#4d6b3a'], 80, 8, 2);
  });

  T.metal = makeTex(32, (g, s) => {
    g.fillStyle = '#3c4fa8';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#ffcf33';
    for (let i = -s; i < s * 2; i += 12) {
      g.beginPath();
      g.moveTo(i, 0); g.lineTo(i + 6, 0); g.lineTo(i + 6 - s, s); g.lineTo(i - s, s);
      g.closePath(); g.fill();
    }
  });

  T.pad = makeTex(64, (g, s) => {
    g.fillStyle = '#e8394f';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#fff4e6';
    const spots = [[32, 32, 9], [14, 20, 6], [48, 16, 5], [50, 46, 7], [18, 48, 6]];
    for (const [x, y, r] of spots) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  });

  T.shadow = makeTex(64, (g, s) => {
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(30,15,50,0.85)');
    grd.addColorStop(0.55, 'rgba(30,15,50,0.55)');
    grd.addColorStop(1, 'rgba(30,15,50,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  }, { nearest: false });

  T.portal = makeTex(64, (g, s) => {
    const grd = g.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.3, '#ffe8ff');
    grd.addColorStop(0.65, '#c27bff');
    grd.addColorStop(1, '#5b2fd6');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(s / 2, s / 2, 10 + i * 8, i, i + 3.5);
      g.stroke();
    }
  }, { nearest: false });

  T.sign = makeTex(32, (g, s) => {
    g.fillStyle = '#e8c38a';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#8e5420';
    g.fillRect(0, 0, s, 2); g.fillRect(0, s - 2, s, 2); g.fillRect(0, 0, 2, s); g.fillRect(s - 2, 0, 2, s);
    g.fillStyle = '#2a1846';
    g.font = 'bold 26px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('!', s / 2, s / 2 + 2);
  });

  return T;
}

// Scale the UVs of a BoxGeometry so textures tile at a fixed world size.
export function tileBoxUVs(geo, w, h, d, tile = 2) {
  const uv = geo.attributes.uv;
  // face order: px, nx, py, ny, pz, nz ; 4 verts each (1 segment)
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [su, sv] = dims[f];
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * su) / tile, (uv.getY(k) * sv) / tile);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

export function scaleUVs(geo, su, sv) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
  return geo;
}

export { rng };
