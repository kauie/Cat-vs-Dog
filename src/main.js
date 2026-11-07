import '@fontsource-variable/anybody/wdth.css';
import '@fontsource-variable/spline-sans/index.css';
import '@fontsource-variable/spline-sans-mono/index.css';
import './styles.css';

import { COPY, MODEL, SAMPLES } from './config.js';
import { backendName, classify, preload } from './inference.js';
import { createRain } from './rain.js';
import { createFight } from './fight.js';

const $ = (selector) => document.querySelector(selector);

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let calm = motionQuery.matches;
let motionChosen = false;

const ui = {
  arena: $('#arena'),
  stage: $('#stage'),
  idle: $('#idlePanel'),
  photo: $('#photoPanel'),
  preview: $('#preview'),
  fileName: $('#fileName'),
  replace: $('#replace'),
  drop: $('#drop'),
  file: $('#file'),
  samples: Array.from(document.querySelectorAll('[data-sample]')),
  analyze: $('#analyze'),
  hint: $('#actionHint'),
  phaseText: $('#phaseText'),
  catScore: $('#catScore'),
  dogScore: $('#dogScore'),
  fight: $('#fight'),
  fighterCat: $('#fighterCat'),
  fighterDog: $('#fighterDog'),
  impact: $('#impact'),
  caption: $('#fightCaption'),
  ko: $('#ko'),
  badgeCat: $('#badgeCat'),
  badgeDog: $('#badgeDog'),
  result: $('#resultPanel'),
  resultStamp: $('#resultStamp'),
  resultLine: $('#resultLine'),
  error: $('#errorPanel'),
  errorTitle: $('.error-title'),
  errorLine: $('#errorLine'),
  errorReset: $('#errorReset'),
  verdict: $('#verdict'),
  vKicker: $('#verdictKicker'),
  vTitle: $('#verdictTitle'),
  vText: $('#verdictText'),
  vCat: $('#verdictCat'),
  vDog: $('#verdictDog'),
  vConf: $('#verdictConf'),
  vScore: $('.verdict-score'),
  vConfidence: $('.confidence'),
  gateNote: $('#gateNote'),
  exhibit: $('#verdictImg'),
  runBack: $('#runBack'),
  verdictStay: $('#verdictStay'),
  verdictClose: $('#verdictClose'),
  splitCat: $('#splitCat'),
  splitDog: $('#splitDog'),
  motion: $('#motion'),
  motionLabel: $('#motionLabel'),
};

const state = {
  phase: 'idle',
  photo: null,
  result: null,
  modelsReady: false,
  modelError: false,
};

let runId = 0;

const rain = createRain($('#rain'), { reduced: calm });
const fight = createFight({
  fightEl: ui.fight,
  stageEl: ui.stage,
  catEl: ui.fighterCat,
  dogEl: ui.fighterDog,
  impactEl: ui.impact,
  captionEl: ui.caption,
  koEl: ui.ko,
  badgeCat: ui.badgeCat,
  badgeDog: ui.badgeDog,
  reduced: calm,
});

/* ------------------------------------------------------------------ */
/* chrome                                                              */
/* ------------------------------------------------------------------ */

function paintStatus() {
  let dot = 'ready';
  let text = 'Ready for a bout';

  if (state.phase === 'fighting') {
    dot = 'fighting';
    text = 'Round one';
  } else if (state.phase === 'result') {
    dot = 'result';
    text = 'Scorecards in';
  } else if (state.phase === 'error') {
    dot = 'error';
    text = 'Photo problem';
  } else if (state.modelError) {
    dot = 'warmup';
    text = 'Model unavailable';
  } else if (!state.modelsReady) {
    dot = 'warmup';
    text = state.phase === 'photo' ? 'Loading the judges' : 'Warming up';
  } else if (state.phase === 'photo') {
    text = 'Weigh-in complete';
  }

  ui.arena.dataset.phase = dot;
  ui.phaseText.textContent = text;
}

function paintActions() {
  const labels = {
    idle: 'Analyze the photo',
    photo: 'Analyze the photo',
    fighting: 'Fighting\u2026',
    result: 'Run it back',
    error: 'Try another photo',
  };
  const hints = {
    idle: 'One photo. One verdict.',
    photo: state.modelsReady ? 'Ready when you are.' : 'The judges are still arriving.',
    fighting: 'The judges are watching closely.',
    result: 'Verdict in. The house does not accept appeals.',
    error: 'Something in that file upset the arena.',
  };

  ui.analyze.textContent = labels[state.phase] || labels.idle;
  ui.analyze.disabled = state.phase === 'idle' || state.phase === 'fighting';
  ui.hint.textContent = hints[state.phase] || hints.idle;
}

function flush() {
  paintStatus();
  paintActions();
}

function setPhase(next) {
  state.phase = next;
  flush();
}

function setView(view) {
  const showIdle = view === 'idle';
  const showPhoto = view === 'photo' || view === 'fight' || view === 'result';
  ui.idle.hidden = !showIdle;
  ui.photo.hidden = !showPhoto;
  ui.fight.hidden = view !== 'fight';
  ui.result.hidden = view !== 'result';
  ui.error.hidden = view !== 'error';
}

/* ------------------------------------------------------------------ */
/* photo intake                                                        */
/* ------------------------------------------------------------------ */

function looksLikeImage(file) {
  if (file.type && file.type.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif|bmp|avif|jfif|heic|heif)$/i.test(file.name || '');
}

async function decode(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (err) {
      try {
        return await createImageBitmap(file);
      } catch (inner) {
        /* fall through to the img element */
      }
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode failed'));
    };
    img.src = url;
  });
}

async function preparePhoto(file) {
  const source = await decode(file);
  const max = 1600;
  const w0 = source.width || source.naturalWidth;
  const h0 = source.height || source.naturalHeight;
  const scale = Math.min(1, max / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, w, h);

  return {
    bitmap: source,
    src: canvas.toDataURL('image/jpeg', 0.9),
    name: file.name || 'contender.jpg',
  };
}

async function handleFile(file) {
  if (!file) return;

  if (!looksLikeImage(file)) {
    showError('That file is not an image.', 'Try a JPG, PNG, WebP or GIF.');
    return;
  }
  if (file.size > 12 * 1024 * 1024) {
    showError('That photo is over 12 MB.', 'Try a smaller version of the same picture.');
    return;
  }

  let next;
  try {
    next = await preparePhoto(file);
  } catch (err) {
    console.warn('[catdog] could not read photo', err);
    showError("That one didn't load.", 'Try a JPG, PNG or WebP.');
    return;
  }

  adoptPhoto(next);
}

function adoptPhoto(next) {
  releasePhoto();
  state.photo = next;
  state.result = null;

  ui.preview.src = next.src;
  ui.fileName.textContent = next.name;
  ui.fight.style.setProperty('--fight-photo', `url("${next.src}")`);
  ui.file.value = '';
  ui.catScore.textContent = '--';
  ui.dogScore.textContent = '--';

  setView('photo');
  setPhase('photo');
  ui.analyze.focus({ preventScroll: true });
}

function releasePhoto() {
  const photo = state.photo;
  if (photo && photo.bitmap && typeof photo.bitmap.close === 'function') {
    try {
      photo.bitmap.close();
    } catch (err) {
      /* noop */
    }
  }
}

async function useSample(id) {
  const sample = SAMPLES.find((entry) => entry.id === id);
  if (!sample) return;
  ui.samples.forEach((button) => {
    button.disabled = true;
  });
  try {
    const res = await fetch(sample.url);
    if (!res.ok) throw new Error(`sample returned ${res.status}`);
    const blob = await res.blob();
    const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const file = new File([blob], `${id}.${ext}`, { type: blob.type || 'image/jpeg' });
    await handleFile(file);
  } catch (err) {
    console.warn('[catdog] sample failed', err);
    showError('That sample refused to enter.', 'Pick a photo from your device instead.');
  } finally {
    ui.samples.forEach((button) => {
      button.disabled = false;
    });
  }
}

/* ------------------------------------------------------------------ */
/* the bout                                                            */
/* ------------------------------------------------------------------ */

async function run() {
  if (state.phase !== 'photo' || !state.photo) return;

  const id = ++runId;
  setView('fight');
  setPhase('fighting');
  ui.catScore.textContent = '--';
  ui.dogScore.textContent = '--';
  rain.setMode('mix');
  fight.start();

  let result = null;
  let failure = null;
  try {
    result = await classify(state.photo.bitmap);
  } catch (err) {
    failure = err;
    console.error('[catdog] inference failed', err);
  }

  if (id !== runId || state.phase !== 'fighting') return;

  if (failure) {
    fight.stop();
    showError('The model could not read that photo.', describeError(failure));
    return;
  }

  await fight.finish(result.winner);
  if (id !== runId || state.phase !== 'fighting') return;

  showResult(result);
}

function describeError(err) {
  const message = String((err && err.message) || err || '');
  if (/fetch|network|load|404|json|backend|webgl|canvas/i.test(message)) {
    return 'The model files did not load. Check your connection, then try again.';
  }
  return 'Try a different image. Big animated GIFs and broken files upset the judges.';
}

function showResult(result) {
  state.result = result;
  const cat = Math.round(result.pCat * 100);
  const dog = 100 - cat;
  const mode = result.winner === 'cat' ? 'cat' : result.winner === 'dog' ? 'dog' : 'mix';

  fight.stop();
  setView('result');
  setPhase('result');

  ui.result.dataset.winner = result.winner;
  ui.resultStamp.textContent = COPY.titles[result.winner];
  ui.resultLine.textContent = pick(COPY.lines[result.winner]);

  ui.catScore.textContent = `${cat}%`;
  ui.dogScore.textContent = `${dog}%`;

  rain.setMode(mode, { burst: mode !== 'mix' });

  openVerdict(result, cat, dog);
}

function openVerdict(result, cat, dog) {
  const isDisq = result.winner === 'disq';
  const top = result.top[0];

  ui.verdict.dataset.winner = result.winner;
  ui.vKicker.textContent = COPY.kickers[result.winner];
  ui.vTitle.textContent = COPY.titles[result.winner];
  ui.vText.textContent = pick(COPY.lines[result.winner]);
  ui.vCat.textContent = `${cat}%`;
  ui.vDog.textContent = `${dog}%`;
  ui.vConf.textContent = `${Math.round(result.confidence * 100)}%`;

  ui.gateNote.textContent = top
    ? `Closest ImageNet read: ${top.label} \u00b7 ${Math.round(top.p * 100)}%`
    : '';
  ui.gateNote.hidden = !top;

  ui.vScore.hidden = isDisq;
  ui.vConfidence.hidden = isDisq;
  ui.exhibit.src = state.photo ? state.photo.src : '';

  ui.splitCat.style.width = '50%';
  ui.splitDog.style.width = '50%';
  requestAnimationFrame(() => {
    ui.splitCat.style.width = `${cat}%`;
    ui.splitDog.style.width = `${dog}%`;
  });

  countTo(ui.vCat, cat);
  countTo(ui.vDog, dog);
  countTo(ui.vConf, Math.round(result.confidence * 100));

  if (!ui.verdict.open) ui.verdict.showModal();
  ui.vTitle.focus({ preventScroll: true });
}

/* ------------------------------------------------------------------ */
/* reset + errors                                                      */
/* ------------------------------------------------------------------ */

function reset() {
  runId += 1;
  fight.stop();
  releasePhoto();
  state.photo = null;
  state.result = null;

  ui.preview.removeAttribute('src');
  ui.exhibit.removeAttribute('src');
  ui.fileName.textContent = 'photo.jpg';
  ui.file.value = '';
  ui.catScore.textContent = '--';
  ui.dogScore.textContent = '--';

  if (ui.verdict.open) ui.verdict.close();

  setView('idle');
  setPhase('idle');
  rain.setMode('mix');
  ui.drop.focus({ preventScroll: true });
}

function showError(title, message) {
  fight.stop();
  ui.errorTitle.textContent = title;
  ui.errorLine.textContent = message;
  setView('error');
  setPhase('error');
  rain.setMode('mix');
}

/* ------------------------------------------------------------------ */
/* warm-up                                                             */
/* ------------------------------------------------------------------ */

function warmUp() {
  preload()
    .then(() => {
      state.modelsReady = true;
      state.modelError = false;
      document.documentElement.dataset.models = 'ready';
      if (state.phase === 'idle' || state.phase === 'photo') flush();
      console.info(`[catdog] models ready \u00b7 backend: ${backendName()}`);
    })
    .catch((err) => {
      state.modelsReady = false;
      state.modelError = true;
      document.documentElement.dataset.models = 'failed';
      console.warn('[catdog] warm-up failed', err);
      if (state.phase === 'idle' || state.phase === 'photo') flush();
    });
}

/* ------------------------------------------------------------------ */
/* events                                                              */
/* ------------------------------------------------------------------ */

ui.analyze.addEventListener('click', () => {
  if (state.phase === 'result' || state.phase === 'error') {
    reset();
    return;
  }
  run();
});

ui.drop.addEventListener('click', () => ui.file.click());
ui.file.addEventListener('change', (event) => {
  const file = event.target.files && event.target.files[0];
  if (file) handleFile(file);
});

ui.replace.addEventListener('click', (event) => {
  event.stopPropagation();
  ui.file.click();
});

ui.samples.forEach((button) => {
  button.addEventListener('click', () => useSample(button.dataset.sample));
});

ui.errorReset.addEventListener('click', reset);

ui.runBack.addEventListener('click', () => {
  if (ui.verdict.open) ui.verdict.close();
  reset();
});
ui.verdictStay.addEventListener('click', () => ui.verdict.close());
ui.verdictClose.addEventListener('click', () => ui.verdict.close());
ui.verdict.addEventListener('close', () => {
  if (state.phase === 'result') ui.analyze.focus({ preventScroll: true });
});

let dragDepth = 0;
function setDrag(on) {
  ui.arena.dataset.drag = on ? 'true' : 'false';
}
ui.arena.addEventListener('dragenter', (event) => {
  event.preventDefault();
  dragDepth += 1;
  setDrag(true);
});
ui.arena.addEventListener('dragover', (event) => {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
});
ui.arena.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) setDrag(false);
});
ui.arena.addEventListener('drop', (event) => {
  event.preventDefault();
  dragDepth = 0;
  setDrag(false);
  const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
  if (file) handleFile(file);
});
window.addEventListener('dragover', (event) => event.preventDefault());
window.addEventListener('drop', (event) => event.preventDefault());

ui.motion.addEventListener('click', () => setMotion(!calm, { chosen: true }));
motionQuery.addEventListener?.('change', (event) => {
  if (!motionChosen) setMotion(event.matches);
});

/* ------------------------------------------------------------------ */
/* motion preference                                                   */
/* ------------------------------------------------------------------ */

function applyMotion() {
  ui.motion.setAttribute('aria-pressed', String(!calm));
  ui.motionLabel.textContent = calm ? 'Motion: off' : 'Motion: on';
  document.documentElement.dataset.motion = calm ? 'calm' : 'full';
}

function setMotion(next, { chosen = false } = {}) {
  calm = Boolean(next);
  if (chosen) motionChosen = true;
  rain.setReduced(calm);
  fight.setReduced(calm);
  applyMotion();
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function countTo(el, target) {
  if (calm) {
    el.textContent = `${target}%`;
    return;
  }
  const started = performance.now();
  const duration = 760;
  const step = (now) => {
    const progress = Math.min(1, (now - started) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = `${Math.round(target * eased)}%`;
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ------------------------------------------------------------------ */
/* boot                                                                */
/* ------------------------------------------------------------------ */

setView('idle');
applyMotion();
flush();
ui.arena.dataset.drag = 'false';

// Models are 11 MB. Let the page paint and the samples settle first.
const whenIdle = window.requestIdleCallback || ((fn) => setTimeout(fn, 900));
whenIdle(warmUp, { timeout: 2500 });

// A tiny console handle, useful when checking the numbers against Colab.
window.__catdog = {
  classify,
  preload,
  state,
  rain,
  fight,
  getModel() {
    return { threshold: MODEL.threshold, size: MODEL.size };
  },
};
