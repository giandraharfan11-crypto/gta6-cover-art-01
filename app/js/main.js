// ViceFrame Studio — editor wiring, photo handling, export, shot modes.

import { GRADES, LAYOUTS, panelPolygons, renderCover } from './render.js';

const SAMPLES = [
  { id: 'neon', label: 'Neon Boulevard', src: 'samples/neon.jpg' },
  { id: 'drive', label: 'Coastal Drive', src: 'samples/drive.jpg' },
  { id: 'boulevard', label: 'The Boulevard', src: 'samples/boulevard.jpg' },
  { id: 'pier', label: 'The Pier', src: 'samples/pier.jpg' },
];

const params = new URLSearchParams(location.search);
const shotMode = params.get('shot'); // 'cover' | 'editor' | null

const state = {
  layout: 'hero',
  grade: 'sunset',
  title: 'VICEFRAME',
  caption: 'NEON HEAT ON THE BOULEVARD',
  shared: true,
  selected: 0,
  // Slightly different default crops per panel, so one shared photo still
  // reads as three distinct poster panels instead of three identical copies.
  panels: [
    { img: null, zoom: 1, ox: 0, oy: 0 },
    { img: null, zoom: 1, ox: 0.4, oy: -0.15 },
    { img: null, zoom: 1, ox: -0.4, oy: 0.1 },
  ],
};

if (LAYOUTS[params.get('layout')]) state.layout = params.get('layout');
if (GRADES[params.get('grade')]) state.grade = params.get('grade');
if (params.get('title')) state.title = params.get('title');
if (params.get('caption') != null) state.caption = params.get('caption');

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const imageCache = new Map();

function loadImage(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
  imageCache.set(src, p);
  return p;
}

function assignPhoto(img) {
  if (state.shared) {
    for (const panel of state.panels) panel.img = img;
  } else {
    state.panels[state.selected].img = img;
  }
  draw();
}

function draw() {
  const editing = shotMode !== 'cover';
  renderCover(ctx, canvas.width, canvas.height, state, {
    highlight: editing ? state.selected : null,
  });
}

function markShotReady() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.__shotReady = true;
    });
  });
}

/* ---------------- editor controls ---------------- */

function buildControls() {
  const thumbs = document.getElementById('thumbs');
  for (const sample of SAMPLES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.title = sample.label;
    b.dataset.sample = sample.id;
    const img = document.createElement('img');
    img.src = sample.src;
    img.alt = sample.label;
    b.appendChild(img);
    b.addEventListener('click', async () => {
      assignPhoto(await loadImage(sample.src));
      markActiveThumb(sample.id);
    });
    thumbs.appendChild(b);
  }

  const chips = document.getElementById('panelChips');
  state.panels.forEach((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = String(i + 1);
    if (i === state.selected) b.classList.add('active');
    b.addEventListener('click', () => selectPanel(i));
    chips.appendChild(b);
  });

  const layoutBtns = document.getElementById('layoutBtns');
  for (const [key, label] of Object.entries(LAYOUTS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.dataset.layout = key;
    if (key === state.layout) b.classList.add('active');
    b.addEventListener('click', () => {
      state.layout = key;
      layoutBtns.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x.dataset.layout === key));
      draw();
    });
    layoutBtns.appendChild(b);
  }

  const gradeBtns = document.getElementById('gradeBtns');
  for (const [key, grade] of Object.entries(GRADES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = grade.label;
    b.dataset.grade = key;
    if (key === state.grade) b.classList.add('active');
    b.addEventListener('click', () => {
      state.grade = key;
      gradeBtns.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x.dataset.grade === key));
      draw();
    });
    gradeBtns.appendChild(b);
  }

  document.getElementById('titleInput').addEventListener('input', (e) => {
    state.title = e.target.value;
    draw();
  });
  document.getElementById('captionInput').addEventListener('input', (e) => {
    state.caption = e.target.value;
    draw();
  });
  document.getElementById('sharedToggle').addEventListener('change', (e) => {
    state.shared = e.target.checked;
    if (state.shared) {
      const current = state.panels[state.selected].img;
      if (current) for (const panel of state.panels) panel.img = current;
    }
    draw();
  });
  document.getElementById('zoomSlider').addEventListener('input', (e) => {
    state.panels[state.selected].zoom = Number(e.target.value);
    draw();
  });

  const fileInput = document.getElementById('fileInput');
  document.getElementById('uploadBtn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    if (fileInput.files?.[0]) await takeFile(fileInput.files[0]);
    fileInput.value = '';
  });

  const sizeSelect = document.getElementById('sizeSelect');
  sizeSelect.addEventListener('change', () => {
    const [w, h] = sizeSelect.value.split('x').map(Number);
    canvas.width = w;
    canvas.height = h;
    draw();
  });

  document.getElementById('downloadBtn').addEventListener('click', exportPng);
}

function markActiveThumb(id) {
  document.querySelectorAll('#thumbs button').forEach((b) => {
    b.classList.toggle('active', b.dataset.sample === id);
  });
}

function selectPanel(i) {
  state.selected = i;
  document.querySelectorAll('#panelChips button').forEach((b, j) => b.classList.toggle('active', j === i));
  document.getElementById('zoomSlider').value = String(state.panels[i].zoom);
  draw();
}

async function takeFile(file) {
  const url = URL.createObjectURL(file);
  try {
    assignPhoto(await loadImage(url));
    markActiveThumb(null);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}

/* ---------------- canvas interaction ---------------- */

function canvasPoint(evt) {
  const r = canvas.getBoundingClientRect();
  return [
    ((evt.clientX - r.left) / r.width) * canvas.width,
    ((evt.clientY - r.top) / r.height) * canvas.height,
  ];
}

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function wireCanvas() {
  let drag = null;

  canvas.addEventListener('pointerdown', (evt) => {
    const [x, y] = canvasPoint(evt);
    const polys = panelPolygons(state.layout, canvas.width, canvas.height);
    const hit = polys.findIndex((poly) => pointInPoly(x, y, poly));
    if (hit >= 0 && hit !== state.selected) selectPanel(hit);
    drag = { x, y };
    canvas.setPointerCapture(evt.pointerId);
    canvas.classList.add('dragging');
  });

  canvas.addEventListener('pointermove', (evt) => {
    if (!drag) return;
    const [x, y] = canvasPoint(evt);
    const panel = state.panels[state.selected];
    const fit = panel._fit;
    if (fit) {
      const rangeX = Math.max(1, (fit.dw - fit.bw) / 2);
      const rangeY = Math.max(1, (fit.dh - fit.bh) / 2);
      panel.ox = clamp(panel.ox + (x - drag.x) / rangeX, -1, 1);
      panel.oy = clamp(panel.oy + (y - drag.y) / rangeY, -1, 1);
      draw();
    }
    drag = { x, y };
  });

  const endDrag = () => {
    drag = null;
    canvas.classList.remove('dragging');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener('wheel', (evt) => {
    evt.preventDefault();
    const panel = state.panels[state.selected];
    panel.zoom = clamp(panel.zoom * (evt.deltaY < 0 ? 1.06 : 1 / 1.06), 1, 3);
    document.getElementById('zoomSlider').value = String(panel.zoom);
    draw();
  }, { passive: false });

  const box = document.getElementById('stageBox');
  box.addEventListener('dragover', (evt) => {
    evt.preventDefault();
    box.classList.add('over');
  });
  box.addEventListener('dragleave', () => box.classList.remove('over'));
  box.addEventListener('drop', async (evt) => {
    evt.preventDefault();
    box.classList.remove('over');
    const file = evt.dataTransfer?.files?.[0];
    if (file) await takeFile(file);
  });
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/* ---------------- export ---------------- */

function exportPng() {
  const [w, h] = document.getElementById('sizeSelect').value.split('x').map(Number);
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  renderCover(off.getContext('2d'), w, h, state, { highlight: null });
  off.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `viceframe-cover-${w}x${h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, 'image/png');
}

/* ---------------- boot ---------------- */

async function boot() {
  const wanted = SAMPLES.find((s) => s.id === params.get('photo')) ?? SAMPLES[0];

  if (shotMode === 'cover') {
    document.body.classList.add('shot-cover');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  } else {
    buildControls();
    wireCanvas();
    document.getElementById('titleInput').value = state.title;
    document.getElementById('captionInput').value = state.caption;
    markActiveThumb(wanted.id);
  }

  const img = await loadImage(wanted.src);
  for (const panel of state.panels) panel.img = img;
  draw();
  markShotReady();
}

boot();
