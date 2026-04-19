// AI Field Boundary Detection — analyzes satellite imagery tiles
// Uses Sobel edge detection + region-growing to trace visible field edges

const ZOOM = 17;     // ~0.9m/pixel at mid-latitudes
const GRID = 5;      // 5×5 tiles ≈ 1.2km coverage
const T = 256;       // tile pixels
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile';

// Slippy-map tile math
const lng2tx = (lng, z) => Math.floor((lng + 180) / 360 * (1 << z));
const lat2ty = (lat, z) => {
  const r = lat * Math.PI / 180;
  return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * (1 << z));
};
const tx2lng = (x, z) => x / (1 << z) * 360 - 180;
const ty2lat = (y, z) => {
  const n = Math.PI - 2 * Math.PI * y / (1 << z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};

const loadImg = (z, x, y) => new Promise(resolve => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = `${ESRI}/${z}/${y}/${x}`;
});

// Douglas-Peucker line simplification
const dpSimplify = (pts, tol) => {
  if (pts.length <= 2) return pts;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const lenSq = (bx - ax) ** 2 + (by - ay) ** 2;
  let maxD = 0, maxI = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    const d = lenSq === 0
      ? Math.sqrt((px - ax) ** 2 + (py - ay) ** 2)
      : Math.abs((by - ay) * (ax - px) - (bx - ax) * (ay - py)) / Math.sqrt(lenSq);
    if (d > maxD) { maxD = d; maxI = i; }
  }
  if (maxD > tol) {
    const left = dpSimplify(pts.slice(0, maxI + 1), tol);
    const right = dpSimplify(pts.slice(maxI), tol);
    return [...left.slice(0, -1), ...right];
  }
  return [pts[0], pts[pts.length - 1]];
};

/**
 * Detect field boundary from satellite imagery at the given coordinates.
 * Returns an array of [lon, lat] pairs forming a closed ring, or null.
 */
export const detectFieldFromImagery = async (lat, lng) => {
  const z = ZOOM;
  const cx = lng2tx(lng, z), cy = lat2ty(lat, z);
  const half = Math.floor(GRID / 2);
  const S = GRID * T; // 1280

  // Offscreen canvas
  const cvs = document.createElement('canvas');
  cvs.width = S; cvs.height = S;
  const ctx = cvs.getContext('2d', { willReadFrequently: true });

  // Load 5×5 tile grid in parallel
  const loads = [];
  for (let dy = -half; dy <= half; dy++)
    for (let dx = -half; dx <= half; dx++)
      loads.push(loadImg(z, cx + dx, cy + dy).then(img =>
        img && ctx.drawImage(img, (dx + half) * T, (dy + half) * T)));
  await Promise.all(loads);

  // Geo bounds
  const west = tx2lng(cx - half, z);
  const north = ty2lat(cy - half, z);
  const east = tx2lng(cx + half + 1, z);
  const south = ty2lat(cy + half + 1, z);

  // Click point → full-res pixel
  const fpx = Math.round((lng - west) / (east - west) * S);
  const fpy = Math.round((lat - north) / (south - north) * S);
  if (fpx < 4 || fpy < 4 || fpx >= S - 4 || fpy >= S - 4) return null;

  let imgData;
  try { imgData = ctx.getImageData(0, 0, S, S); } catch { return null; }
  const { data } = imgData;

  // Downsample 2× for processing speed (~1.8m/pixel)
  const W = S >> 1, H = W, N = W * H;
  const rr = new Float32Array(N), gg = new Float32Array(N), bb = new Float32Array(N);
  const gray = new Float32Array(N);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sx = x * 2, sy = y * 2;
      const i0 = (sy * S + sx) * 4, i1 = i0 + 4;
      const i2 = ((sy + 1) * S + sx) * 4, i3 = i2 + 4;
      const di = y * W + x;
      rr[di] = (data[i0] + data[i1] + data[i2] + data[i3]) * 0.25;
      gg[di] = (data[i0 + 1] + data[i1 + 1] + data[i2 + 1] + data[i3 + 1]) * 0.25;
      bb[di] = (data[i0 + 2] + data[i1 + 2] + data[i2 + 2] + data[i3 + 2]) * 0.25;
      gray[di] = 0.299 * rr[di] + 0.587 * gg[di] + 0.114 * bb[di];
    }
  }

  const px = fpx >> 1, py = fpy >> 1;

  // Sobel edge detection
  const edge = new Float32Array(N);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const gx = -gray[i - W - 1] + gray[i - W + 1] - 2 * gray[i - 1] + 2 * gray[i + 1] - gray[i + W - 1] + gray[i + W + 1];
      const gy = -gray[i - W - 1] - 2 * gray[i - W] - gray[i - W + 1] + gray[i + W - 1] + 2 * gray[i + W] + gray[i + W + 1];
      edge[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  // Adaptive edge threshold (70th percentile of non-zero edges)
  const vals = [];
  for (let i = 0; i < N; i++) if (edge[i] > 1) vals.push(edge[i]);
  vals.sort((a, b) => a - b);
  const edgeThr = vals.length > 100 ? vals[Math.floor(vals.length * 0.70)] : 30;
  if (edgeThr < 5) return null;

  // Seed color from 11×11 patch around click
  let sr = 0, sg = 0, sb = 0, sc = 0;
  for (let dy = -5; dy <= 5; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      const sx = px + dx, sy = py + dy;
      if (sx >= 0 && sy >= 0 && sx < W && sy < H) {
        const i = sy * W + sx;
        sr += rr[i]; sg += gg[i]; sb += bb[i]; sc++;
      }
    }
  }
  const mR = sr / sc, mG = sg / sc, mB = sb / sc;

  // Color variance → adaptive threshold
  let variance = 0;
  for (let dy = -5; dy <= 5; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      const sx = px + dx, sy = py + dy;
      if (sx >= 0 && sy >= 0 && sx < W && sy < H) {
        const i = sy * W + sx;
        variance += (rr[i] - mR) ** 2 + (gg[i] - mG) ** 2 + (bb[i] - mB) ** 2;
      }
    }
  }
  // Generous color threshold — primary stopping is edges, color is a safety net
  const colorThrSq = Math.max(40, Math.min(85, 3.0 * Math.sqrt(variance / sc))) ** 2;

  // BFS flood fill: stop at strong edges OR wildly different color
  const mask = new Uint8Array(N);
  const Q = new Int32Array(N);
  let qH = 0, qT = 0;
  const si = py * W + px;
  mask[si] = 1;
  Q[qT++] = si;
  let rsz = 1;
  const maxRegion = N * 0.30;

  while (qH < qT && rsz < maxRegion) {
    const idx = Q[qH++];
    const x0 = idx % W, y0 = (idx - x0) / W;

    // Check 4 neighbors (inlined for performance)
    if (x0 > 0) {
      const ni = idx - 1;
      if (!mask[ni] && edge[ni] <= edgeThr) {
        const dr = rr[ni] - mR, dg = gg[ni] - mG, db = bb[ni] - mB;
        if (dr * dr + dg * dg + db * db <= colorThrSq) { mask[ni] = 1; Q[qT++] = ni; rsz++; }
      }
    }
    if (x0 < W - 1) {
      const ni = idx + 1;
      if (!mask[ni] && edge[ni] <= edgeThr) {
        const dr = rr[ni] - mR, dg = gg[ni] - mG, db = bb[ni] - mB;
        if (dr * dr + dg * dg + db * db <= colorThrSq) { mask[ni] = 1; Q[qT++] = ni; rsz++; }
      }
    }
    if (y0 > 0) {
      const ni = idx - W;
      if (!mask[ni] && edge[ni] <= edgeThr) {
        const dr = rr[ni] - mR, dg = gg[ni] - mG, db = bb[ni] - mB;
        if (dr * dr + dg * dg + db * db <= colorThrSq) { mask[ni] = 1; Q[qT++] = ni; rsz++; }
      }
    }
    if (y0 < H - 1) {
      const ni = idx + W;
      if (!mask[ni] && edge[ni] <= edgeThr) {
        const dr = rr[ni] - mR, dg = gg[ni] - mG, db = bb[ni] - mB;
        if (dr * dr + dg * dg + db * db <= colorThrSq) { mask[ni] = 1; Q[qT++] = ni; rsz++; }
      }
    }
  }

  // Reject if too small (<~0.5 acre) or hit area cap (likely a leak)
  if (rsz < 80 || rsz >= maxRegion) return null;

  // Check if region touches canvas border (usually means a leak)
  for (let x = 0; x < W; x++) if (mask[x] || mask[(H - 1) * W + x]) return null;
  for (let y = 0; y < H; y++) if (mask[y * W] || mask[y * W + W - 1]) return null;

  // Moore neighborhood contour tracing
  let stX = -1, stY = -1;
  findStart: for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (mask[y * W + x]) { stX = x; stY = y; break findStart; }
  if (stX < 0) return null;

  const dx8 = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy8 = [0, 1, 1, 1, 0, -1, -1, -1];
  const contour = [[stX, stY]];
  let curX = stX, curY = stY, dir = 6;

  for (let step = 0; step < 200000; step++) {
    let sDir = (dir + 5) % 8;
    let found = false;
    for (let i = 0; i < 8; i++) {
      const nd = (sDir + i) % 8;
      const nx = curX + dx8[nd], ny = curY + dy8[nd];
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && mask[ny * W + nx]) {
        curX = nx; curY = ny; dir = nd;
        if (curX === stX && curY === stY) { found = true; break; }
        contour.push([curX, curY]);
        found = true;
        break;
      }
    }
    if (!found || (curX === stX && curY === stY)) break;
  }

  if (contour.length < 8) return null;

  // Simplify (3px ≈ 5m tolerance)
  const simplified = dpSimplify(contour, 3.0);
  if (simplified.length < 4) return null;

  // Pixel → geo (×2 for downsample, +0.5 for pixel center)
  const ring = simplified.map(([x, y]) => [
    west + ((x * 2 + 1) / S) * (east - west),
    north + ((y * 2 + 1) / S) * (south - north),
  ]);

  // Close the ring
  if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])
    ring.push([...ring[0]]);

  return ring;
};
