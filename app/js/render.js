// ViceFrame Studio — cover renderer.
//
// Everything is drawn with plain Canvas 2D: photo panels with diagonal
// cuts, a neon sunset grade, vector palm + skyline silhouettes, gradient
// masthead lettering, film grain and a vignette. No libraries, no assets
// beyond the photos themselves.

export const GRADES = {
  sunset: {
    label: 'Sunset Vice',
    top: '#ff2e88',
    mid: '#ff8a3c',
    bottom: '#0fb5a8',
    filter: 'saturate(1.28) contrast(1.07) brightness(1.02)',
  },
  neon: {
    label: 'Neon Nights',
    top: '#8a2bff',
    mid: '#ff2e63',
    bottom: '#00c2ff',
    filter: 'saturate(1.45) contrast(1.15) brightness(0.98)',
  },
  golden: {
    label: 'Golden Hour',
    top: '#ffb347',
    mid: '#ff6b4a',
    bottom: '#5b2a86',
    filter: 'saturate(1.18) contrast(1.05) brightness(1.06) sepia(0.16)',
  },
};

export const LAYOUTS = {
  hero: 'Hero Grid',
  slash: 'Diagonal Slash',
  triptych: 'Triptych',
};

const INK = '#150329';
const SILHOUETTE = '#12031f';

// Panel outlines as [fx, fy] fractions of the canvas, per layout.
export function panelPolygons(layout, w, h) {
  const P = (pts) => pts.map(([fx, fy]) => [fx * w, fy * h]);
  switch (layout) {
    case 'slash':
      return [
        P([[0, 0], [0.42, 0], [0.30, 1], [0, 1]]),
        P([[0.42, 0], [0.78, 0], [0.62, 1], [0.30, 1]]),
        P([[0.78, 0], [1, 0], [1, 1], [0.62, 1]]),
      ];
    case 'triptych':
      return [
        P([[0, 0], [0.34, 0], [0.32, 1], [0, 1]]),
        P([[0.34, 0], [0.67, 0], [0.69, 1], [0.32, 1]]),
        P([[0.67, 0], [1, 0], [1, 1], [0.69, 1]]),
      ];
    case 'hero':
    default:
      return [
        P([[0, 0], [0.66, 0], [0.60, 1], [0, 1]]),
        P([[0.66, 0], [1, 0], [1, 0.46], [0.637, 0.5]]),
        P([[0.637, 0.5], [1, 0.46], [1, 1], [0.60, 1]]),
      ];
  }
}

function pathPoly(ctx, poly) {
  ctx.beginPath();
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
  ctx.closePath();
}

function bbox(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1 - x0, y1 - y0];
}

function hexA(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// One panel: clip to its polygon, cover-fit the photo with the panel's
// zoom/offset, then wash the grade colours over it.
function drawPanel(ctx, poly, panel, grade) {
  const [bx, by, bw, bh] = bbox(poly);
  ctx.save();
  pathPoly(ctx, poly);
  ctx.clip();

  if (panel.img) {
    const iw = panel.img.naturalWidth;
    const ih = panel.img.naturalHeight;
    const scale = Math.max(bw / iw, bh / ih) * panel.zoom;
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = bx + (bw - dw) / 2 + panel.ox * Math.max(0, (dw - bw) / 2);
    const dy = by + (bh - dh) / 2 + panel.oy * Math.max(0, (dh - bh) / 2);
    ctx.filter = grade.filter;
    ctx.drawImage(panel.img, dx, dy, dw, dh);
    ctx.filter = 'none';
    panel._fit = { dw, dh, bw, bh };
  } else {
    const g = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
    g.addColorStop(0, grade.top);
    g.addColorStop(0.52, grade.mid);
    g.addColorStop(1, grade.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(bx, by, bw, bh);
    panel._fit = null;
  }

  // Grade washes: hot colour from the top, cool colour rising from below.
  ctx.globalCompositeOperation = 'overlay';
  const topWash = ctx.createLinearGradient(0, by, 0, by + bh * 0.62);
  topWash.addColorStop(0, hexA(grade.top, 0.5));
  topWash.addColorStop(1, hexA(grade.top, 0));
  ctx.fillStyle = topWash;
  ctx.fillRect(bx, by, bw, bh);

  const botWash = ctx.createLinearGradient(0, by + bh * 0.42, 0, by + bh);
  botWash.addColorStop(0, hexA(grade.bottom, 0));
  botWash.addColorStop(1, hexA(grade.bottom, 0.45));
  ctx.fillStyle = botWash;
  ctx.fillRect(bx, by, bw, bh);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

function strokeFrames(ctx, polys, w, grade) {
  for (const poly of polys) {
    pathPoly(ctx, poly);
    ctx.strokeStyle = 'rgba(5, 0, 12, 0.92)';
    ctx.lineWidth = Math.max(5, w * 0.0075);
    ctx.stroke();
    pathPoly(ctx, poly);
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, grade.bottom);
    g.addColorStop(0.5, grade.mid);
    g.addColorStop(1, grade.top);
    ctx.strokeStyle = g;
    ctx.lineWidth = Math.max(1.5, w * 0.0018);
    ctx.stroke();
  }
}

// Deterministic little PRNG so the skyline and grain are stable per render.
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawSkyline(ctx, w, baseY, height, color) {
  const rnd = mulberry(20261);
  ctx.fillStyle = color;
  let x = -w * 0.02;
  while (x < w * 1.02) {
    const bw = w * (0.028 + rnd() * 0.05);
    const bh = height * (0.35 + rnd() * 0.65);
    ctx.fillRect(x, baseY - bh, bw, bh + 2);
    if (rnd() > 0.62) {
      ctx.fillRect(x + bw * 0.42, baseY - bh - height * 0.14, bw * 0.1, height * 0.14);
    }
    x += bw + w * 0.006;
  }
}

// One frond: a tapered sliver that leaves the crown heading up and out,
// arcs over, and lets its tip droop below the crown line.
function frond(ctx, cx, cy, dx, dy, droop, halfWidth) {
  const tipX = cx + dx;
  const tipY = cy + dy + droop;
  const midX = cx + dx * 0.5;
  const midY = cy + dy * 0.5 + droop * 0.1 - 0.11;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * halfWidth;
  const ny = (dx / len) * halfWidth;
  ctx.beginPath();
  ctx.moveTo(cx + nx, cy + ny);
  ctx.quadraticCurveTo(midX + nx * 0.45, midY + ny * 0.45, tipX, tipY);
  ctx.quadraticCurveTo(midX - nx * 0.45, midY - ny * 0.45, cx - nx, cy - ny);
  ctx.closePath();
  ctx.fill();
}

// A palm drawn in a unit box: base at (0,0), crown near (0.34,-1).
// Slim tapered trunk, nine drooping fronds, two coconuts at the crown.
function drawPalm(ctx, x, y, s, flip, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip * s, s);
  ctx.fillStyle = color;

  ctx.beginPath();
  ctx.moveTo(-0.05, 0.02);
  ctx.quadraticCurveTo(0.05, -0.52, 0.27, -1.0);
  ctx.lineTo(0.41, -1.0);
  ctx.quadraticCurveTo(0.21, -0.5, 0.08, 0.02);
  ctx.closePath();
  ctx.fill();

  const cx = 0.34;
  const cy = -1.0;
  const fronds = [
    [-0.92, -0.30, 0.42], [-0.78, -0.58, 0.34], [-0.52, -0.78, 0.26],
    [-0.18, -0.90, 0.20], [0.18, -0.90, 0.20], [0.52, -0.78, 0.26],
    [0.78, -0.58, 0.34], [0.92, -0.30, 0.42],
  ];
  for (const [dx, dy, droop] of fronds) frond(ctx, cx, cy, dx, dy, droop, 0.04);

  ctx.beginPath();
  ctx.arc(cx - 0.045, cy + 0.045, 0.05, 0, Math.PI * 2);
  ctx.arc(cx + 0.055, cy + 0.06, 0.042, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function titleFont(size) {
  return `italic 900 ${size}px "Arial Narrow", "Liberation Sans Narrow", Impact, Haettenschweiler, "Arial Black", "Franklin Gothic Medium", sans-serif`;
}

function drawMasthead(ctx, w, h, state, grade) {
  const cx = w / 2;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Kicker line.
  const kick = Math.max(11, h * 0.02);
  ctx.font = `600 ${kick}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${kick * 0.5}px`;
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = kick * 0.5;
  ctx.shadowOffsetY = kick * 0.14;
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.fillText('VICEFRAME STUDIO PRESENTS', cx, h * 0.052);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

  // Masthead: shrink to fit, gradient fill, heavy dark stroke, soft shadow.
  const title = (state.title || 'VICEFRAME').toUpperCase();
  let size = h * 0.128;
  ctx.font = titleFont(size);
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${size * 0.015}px`;
  while (ctx.measureText(title).width > w * 0.92 && size > 10) {
    size *= 0.94;
    ctx.font = titleFont(size);
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${size * 0.015}px`;
  }
  const ty = h * 0.052 + kick * 0.9 + size * 0.52;
  ctx.save();
  ctx.transform(1, 0, -0.045, 1, 0, 0);
  const gx = cx / (1) + size * 0.1;
  ctx.shadowColor = 'rgba(10,0,24,0.55)';
  ctx.shadowBlur = size * 0.14;
  ctx.shadowOffsetY = size * 0.055;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = size * 0.13;
  ctx.strokeText(title, gx, ty);
  ctx.shadowColor = 'transparent';
  const grad = ctx.createLinearGradient(0, ty - size * 0.55, 0, ty + size * 0.55);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.34, '#ffd7ef');
  grad.addColorStop(0.68, grade.mid);
  grad.addColorStop(1, grade.top);
  ctx.fillStyle = grad;
  ctx.fillText(title, gx, ty);
  ctx.restore();
  ctx.restore();
}

function drawCaptionBand(ctx, w, h, state, grade) {
  const caption = (state.caption || '').trim();
  if (!caption) return;
  const bandH = Math.max(40, h * 0.082);
  const y0 = h - bandH;
  ctx.save();
  ctx.fillStyle = 'rgba(8, 1, 18, 0.78)';
  ctx.fillRect(0, y0, w, bandH);
  const line = ctx.createLinearGradient(0, 0, w, 0);
  line.addColorStop(0, grade.bottom);
  line.addColorStop(0.5, grade.mid);
  line.addColorStop(1, grade.top);
  ctx.fillStyle = line;
  ctx.fillRect(0, y0, w, Math.max(2, h * 0.0038));

  const size = bandH * 0.32;
  ctx.font = `600 ${size}px "Arial Narrow", "Liberation Sans Narrow", "Segoe UI", Arial, sans-serif`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${size * 0.3}px`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = size * 0.3;
  ctx.fillText(caption.toUpperCase(), w / 2, y0 + bandH * 0.56);
  ctx.restore();
}

let grainTile = null;
function getGrain(ctx) {
  if (!grainTile) {
    grainTile = document.createElement('canvas');
    grainTile.width = 160;
    grainTile.height = 160;
    const g = grainTile.getContext('2d');
    const img = g.createImageData(160, 160);
    const rnd = mulberry(977);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(rnd() * 255);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  return ctx.createPattern(grainTile, 'repeat');
}

// Full cover render. opts.highlight: panel index to outline (editor only).
export function renderCover(ctx, w, h, state, opts = {}) {
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const polys = panelPolygons(state.layout, w, h);

  ctx.fillStyle = '#0a0214';
  ctx.fillRect(0, 0, w, h);

  polys.forEach((poly, i) => drawPanel(ctx, poly, state.panels[i], grade));

  // One unifying wash across the whole composition.
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  const wash = ctx.createLinearGradient(0, 0, 0, h);
  wash.addColorStop(0, hexA(grade.top, 0.20));
  wash.addColorStop(0.5, 'rgba(0,0,0,0)');
  wash.addColorStop(1, hexA(grade.bottom, 0.22));
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  strokeFrames(ctx, polys, w, grade);

  // Vector silhouettes: skyline along the floor, palms hugging the edges.
  drawSkyline(ctx, w, h + 2, h * 0.15, SILHOUETTE);
  drawPalm(ctx, -w * 0.03, h * 1.0, h * 0.27, 1, SILHOUETTE);
  drawPalm(ctx, w * 1.03, h * 1.0, h * 0.21, -1, SILHOUETTE);

  // Soft top scrim so the lettering stays legible over bright skies.
  const scrim = ctx.createLinearGradient(0, 0, 0, h * 0.30);
  scrim.addColorStop(0, 'rgba(8, 0, 18, 0.38)');
  scrim.addColorStop(1, 'rgba(8, 0, 18, 0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, w, h * 0.30);

  drawMasthead(ctx, w, h, state, grade);
  drawCaptionBand(ctx, w, h, state, grade);

  // Vignette.
  const vg = ctx.createRadialGradient(w / 2, h * 0.46, Math.min(w, h) * 0.36, w / 2, h * 0.5, Math.max(w, h) * 0.78);
  vg.addColorStop(0, 'rgba(6,0,14,0)');
  vg.addColorStop(1, 'rgba(6,0,14,0.44)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  // Grain.
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = getGrain(ctx);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Editor selection outline (never in exports or shot renders).
  if (opts.highlight != null && polys[opts.highlight]) {
    ctx.save();
    pathPoly(ctx, polys[opts.highlight]);
    ctx.setLineDash([14, 9]);
    ctx.lineWidth = Math.max(2.5, w * 0.003);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.shadowColor = 'rgba(255,46,136,0.9)';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();
  }
}
