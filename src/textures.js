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

export function createTextures(theme) {
  const T = {};
  const P = theme.palette;

  T.grass = makeTex(32, (g, s) => {
    g.fillStyle = P.grass.base;
    g.fillRect(0, 0, s, s);
    g.fillStyle = P.grass.alt;
    g.fillRect(0, 0, s / 2, s / 2);
    g.fillRect(s / 2, s / 2, s / 2, s / 2);
    if (P.grass.specks.length) speckle(g, s, P.grass.specks, 40, 1, 1);
  });

  T.grassSide = makeTex(32, (g, s) => {
    if (P.side.stripes) {
      // candy stripes with a gold band along the top
      for (let x = 0; x < s; x += 8) {
        g.fillStyle = P.side.stripes[(x / 8) % 2];
        g.fillRect(x, 0, 8, s);
      }
      g.fillStyle = P.side.band;
      g.fillRect(0, 0, s, 6);
      g.fillStyle = 'rgba(0,0,0,0.15)';
      g.fillRect(0, 6, s, 1);
      return;
    }
    g.fillStyle = P.side.dirt;
    g.fillRect(0, 0, s, s);
    speckle(g, s, P.side.specks, 50, 2, 2);
    g.fillStyle = P.side.fringe;
    g.fillRect(0, 0, s, 10);
    const r = rng(3);
    for (let x = 0; x < s; x += 2) {
      const h = 10 + Math.floor(r() * 6);
      g.fillRect(x, 0, 2, h);
    }
    g.fillStyle = P.side.light;
    g.fillRect(0, 0, s, 3);
  });

  T.rock = makeTex(32, (g, s) => {
    g.fillStyle = P.rock.base;
    g.fillRect(0, 0, s, s);
    const r = rng(4);
    for (let i = 0; i < 14; i++) {
      g.fillStyle = P.rock.blocks[i % 3];
      g.fillRect(Math.floor(r() * s), Math.floor(r() * s), 4 + Math.floor(r() * 8), 3 + Math.floor(r() * 5));
    }
    speckle(g, s, P.rock.specks, 30, 5, 1);
  });

  T.stone = makeTex(32, (g, s) => {
    g.fillStyle = P.stone.mortar;
    g.fillRect(0, 0, s, s);
    const bh = 8;
    for (let row = 0; row < s / bh; row++) {
      const off = row % 2 ? 8 : 0;
      for (let x = -8; x < s; x += 16) {
        g.fillStyle = row % 2 ? P.stone.b : P.stone.a;
        g.fillRect(x + off + 1, row * bh + 1, 14, bh - 2);
      }
    }
    speckle(g, s, P.stone.specks, 30, 6, 1);
  });

  // big flagstones for castle walkways and plazas
  T.flags = makeTex(32, (g, s) => {
    g.fillStyle = P.stone.mortar;
    g.fillRect(0, 0, s, s);
    const tiles = [[1, 1, 14, 14], [17, 1, 14, 9], [17, 12, 14, 19], [1, 17, 14, 14]];
    tiles.forEach(([x, y, w, h], i) => { g.fillStyle = i % 2 ? P.stone.a : P.stone.b; g.fillRect(x, y, w, h); });
    speckle(g, s, P.stone.specks, 24, 11, 1);
  });

  // bold carnival floor
  T.checker = makeTex(32, (g, s) => {
    g.fillStyle = '#fff4e0';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#2a1846';
    g.fillRect(0, 0, s / 2, s / 2);
    g.fillRect(s / 2, s / 2, s / 2, s / 2);
  });

  T.stripes = makeTex(32, (g, s) => {
    for (let x = 0; x < s; x += 8) {
      g.fillStyle = (x / 8) % 2 ? '#fff4e0' : '#e8394f';
      g.fillRect(x, 0, 8, s);
    }
  });

  // conveyor belt: chevrons pointing toward -v
  T.belt = makeTex(32, (g, s) => {
    g.fillStyle = '#3a3448';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#ffd23f';
    for (let y = 0; y < s; y += 16) {
      g.beginPath();
      g.moveTo(4, y + 12); g.lineTo(16, y + 2); g.lineTo(28, y + 12); g.lineTo(28, y + 16); g.lineTo(16, y + 6); g.lineTo(4, y + 16);
      g.closePath(); g.fill();
    }
    g.fillStyle = '#26212f';
    g.fillRect(0, 0, 2, s); g.fillRect(s - 2, 0, 2, s);
  });

  T.bars = makeTex(32, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.fillStyle = '#2b2735';
    for (let x = 2; x < s; x += 8) g.fillRect(x, 0, 3, s);
    g.fillRect(0, 2, s, 3);
    g.fillRect(0, s - 6, s, 3);
    g.fillStyle = '#d4a23a';
    for (let x = 2; x < s; x += 8) g.fillRect(x - 1, 0, 5, 2);
  });

  T.seabed = makeTex(32, (g, s) => {
    g.fillStyle = '#d9c08a';
    g.fillRect(0, 0, s, s);
    speckle(g, s, ['#c9ae76', '#e8d3a2', '#bfa26a'], 70, 13, 2);
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
