import { EMOJI } from './config.js';

/**
 * Slow, rotating emoji rain on a fixed canvas.
 * Modes: 'mix' (both), 'cat', 'dog'. Changing mode fades the wrong
 * species out and rains the winner back in.
 */

const TAU = Math.PI * 2;

export function createRain(canvas, { reduced = false } = {}) {
  const ctx = canvas.getContext('2d', { alpha: true });
  const sprites = { cat: [], dog: [] };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  let isReduced = reduced;
  let drops = [];
  let mode = 'mix';
  let ready = false;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let raf = 0;
  let last = 0;
  let destroyed = false;
  let nextRefill = 0;
  const MIN_DROPS = 6;

  loadSprites();

  function loadSprites() {
    const jobs = [];
    for (const kind of ['cat', 'dog']) {
      for (const url of EMOJI[kind]) {
        jobs.push(
          new Promise((resolve) => {
            const img = new Image();
            img.decoding = 'async';
            img.onload = () => {
              sprites[kind].push(img);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = url;
          }),
        );
      }
    }
    Promise.all(jobs).then(() => {
      if (destroyed) return;
      ready = sprites.cat.length + sprites.dog.length > 0;
      if (!ready) return;
      resize();
      if (!isReduced) start();
      else renderStill();
    });
  }

  function viewport() {
    return {
      w: Math.max(1, canvas.clientWidth || window.innerWidth),
      h: Math.max(1, canvas.clientHeight || window.innerHeight),
    };
  }

  function resize() {
    if (!ready) return;
    const v = viewport();
    width = v.w;
    height = v.h;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const wanted = Math.round(clamp((width * height) / 52000, 12, 30));
    while (drops.length < wanted) drops.push(spawn(true));
    while (drops.length > wanted) drops.pop();

    if (isReduced) renderStill();
  }

  function pickType() {
    if (mode === 'cat' || mode === 'dog') return mode;
    return Math.random() < 0.5 ? 'cat' : 'dog';
  }

  function pickSprite(kind) {
    const pool = sprites[kind];
    return pool[Math.floor(Math.random() * pool.length)] || null;
  }

  function spawn(initial) {
    const d = {
      type: 'cat',
      img: null,
      x: 0,
      y: 0,
      size: 30,
      rot: 0,
      spin: 0,
      vy: 30,
      swayAmp: 10,
      swayPhase: Math.random() * TAU,
      swaySpeed: 0.5,
      alpha: 0.25,
      fade: 0,
      popping: 0,
      deleted: false,
      gone: false,
    };
    place(d, initial);
    return d;
  }

  function place(d, initial) {
    d.type = pickType();
    d.img = pickSprite(d.type);
    d.x = Math.random() * width;
    d.y = initial ? Math.random() * height - height * 0.05 : -d.size - Math.random() * height * 0.45;
    d.size = 18 + Math.random() * 26;
    d.rot = Math.random() * 360;
    d.spin = (Math.random() * 2 - 1) * 16;
    d.vy = 14 + Math.random() * 22;
    d.swayAmp = 6 + Math.random() * 16;
    d.swayPhase = Math.random() * TAU;
    d.swaySpeed = 0.35 + Math.random() * 0.5;
    d.alpha = 0.09 + Math.random() * 0.14;
    d.fade = initial ? 1 : 0;
    d.popping = 0;
    d.deleted = false;
    d.gone = false;
  }

  function popDrop(d) {
    if (d.popping > 0 || d.deleted) return;
    d.popping = 0.001;
    d.deleted = true;
    d.vy = 0;
    d.spin = 0;
    d.swayAmp = 0;
    if (isReduced) renderStill();
  }

  function nearestDrop(x, y) {
    const ox = pointer.x * 14;
    const oy = pointer.y * 10;
    let best = null;
    let bestDist = 0;
    for (let i = drops.length - 1; i >= 0; i -= 1) {
      const d = drops[i];
      if (d.popping > 0) continue;
      const dx = d.x + Math.sin(d.swayPhase) * d.swayAmp + ox - x;
      const dy = d.y + oy - y;
      const r = d.size * 0.62;
      const dist = dx * dx + dy * dy;
      if (dist <= r * r && (best === null || dist < bestDist)) {
        best = d;
        bestDist = dist;
      }
    }
    return best;
  }

  function onPointerDown(event) {
    if (event.button !== 0) return;
    if (event.defaultPrevented) return;
    const target = event.target;
    if (target && target.closest && target.closest('button, a, input, select, textarea, label, [role="button"]')) {
      return;
    }
    const hit = nearestDrop(event.clientX, event.clientY);
    if (hit) {
      popDrop(hit);
      event.preventDefault();
    }
  }

  function onPointerMove(event) {
    const hit = nearestDrop(event.clientX, event.clientY);
    document.body.style.cursor = hit ? 'pointer' : '';
  }
  function step(d, dt) {
    if (d.deleted) {
      if (d.popping < 1) {
        d.popping += dt * 2.4;
        d.rot += dt * 420;
        if (d.popping >= 1) d.gone = true;
      }
      return;
    }

    if (d.popping > 0) {
      d.popping += dt * 2.4;
      if (d.popping >= 1) d.gone = true;
      return;
    }

    if (mode !== 'mix' && d.type !== mode) {
      d.fade -= dt * 2.2;
      if (d.fade <= 0) place(d, false);
    } else if (d.fade < 1) {
      d.fade = Math.min(1, d.fade + dt * 2.4);
    }

    d.y += d.vy * dt;
    d.rot += d.spin * dt;
    d.swayPhase += d.swaySpeed * dt;

    if (d.y > height + d.size * 1.6) place(d, false);
  }

  function draw(d, offsetX, offsetY) {
    if (d.gone) return;
    if (!d.img) return;
    const fade = clamp(d.fade, 0, 1);
    const pop = d.popping;

    if (d.deleted) {
      if (pop >= 1) return;
      const scale = 1 + pop * 1.9;
      const size = d.size * scale;
      ctx.save();
      ctx.globalAlpha = d.alpha * (1 - pop);
      ctx.translate(d.x + Math.sin(d.swayPhase) * d.swayAmp + offsetX, d.y + offsetY);
      ctx.rotate((d.rot * Math.PI) / 180);
      ctx.drawImage(d.img, -size / 2, -size / 2, size, size);
      ctx.restore();
      return;
    }

    if (fade <= 0.01 && pop <= 0) return;

    const scale = 1 + pop * 1.9;
    const size = d.size * scale;
    ctx.save();
    ctx.globalAlpha = d.alpha * fade * (pop > 0 ? 1 - pop : 1);
    ctx.translate(d.x + Math.sin(d.swayPhase) * d.swayAmp + offsetX, d.y + offsetY);
    ctx.rotate((d.rot * Math.PI) / 180);
    ctx.drawImage(d.img, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  function frame(now) {
    if (destroyed) return;
    if (!last) last = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    // Remove fully popped drops; slowly refill so the sky never empties.
    drops = drops.filter((d) => !d.gone);
    if (drops.length < MIN_DROPS && now > nextRefill) {
      drops.push(spawn(false));
      nextRefill = now + 1800 + Math.random() * 1400;
    }

    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    const ox = pointer.x * 14;
    const oy = pointer.y * 10;

    ctx.clearRect(0, 0, width, height);
    for (const d of drops) {
      step(d, dt);
      draw(d, ox, oy);
    }
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (raf || destroyed) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  function pause() {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  }

  function renderStill() {
    const v = viewport();
    width = v.w;
    height = v.h;
    for (const d of drops) {
      d.x = Math.random() * width;
      d.y = Math.random() * height;
    }
    ctx.clearRect(0, 0, width, height);
    for (const d of drops) draw(d, 0, 0);
  }

  function setMode(next, { burst = false } = {}) {
    mode = next === 'cat' || next === 'dog' ? next : 'mix';

    if (isReduced) {
      for (const d of drops) {
        d.type = pickType();
        d.img = pickSprite(d.type);
      }
      renderStill();
      return;
    }

    if (burst) {
      for (const d of drops) {
        if (Math.random() < 0.5) {
          d.y = -Math.random() * height * 0.4 - d.size;
          d.x = Math.random() * width;
          d.vy = 110 + Math.random() * 150;
          d.size = 22 + Math.random() * 28;
          d.fade = 0;
        }
      }
    }
  }

  function onResize() {
    resize();
  }

  function onPointer(event) {
    pointer.tx = (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
    pointer.ty = (event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
  }

  function onVisibility() {
    if (document.hidden) pause();
    else start();
  }

  window.addEventListener('resize', onResize);
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('visibilitychange', onVisibility);

  return {
    setMode,
    debugPositions() {
      return drops.map((d) => ({ x: d.x, y: d.y, size: d.size, popping: d.popping }));
    },
    setReduced(next) {
      isReduced = Boolean(next);
      if (!ready) return;
      if (isReduced) {
        pause();
        renderStill();
      } else {
        resize();
        start();
      }
    },
    get mode() {
      return mode;
    },
    destroy() {
      destroyed = true;
      pause();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('visibilitychange', onVisibility);
      drops = [];
    },
  };
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}
