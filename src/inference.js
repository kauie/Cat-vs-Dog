import { MODEL } from './config.js';

/**
 * Browser-side inference that mirrors the Colab pipeline:
 *   1. stretch the photo to 160x160 (no crop, no letterbox)
 *   2. scale pixels to [-1, 1]   (mobilenet_v2.preprocess_input)
 *   3. run the photo and its horizontal mirror, average the two passes
 *   4. cat/dog sigmoid -> p_dog; ImageNet softmax -> pet gate
 *
 * Nothing leaves the tab.
 */

let runtimePromise = null;
let labelsPromise = null;
let loaded = null;

export function preload() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const tf = await import('@tensorflow/tfjs');
      await tf.ready();
      const [catdog, imagenet, labels] = await Promise.all([
        tf.loadGraphModel(MODEL.catdogUrl),
        tf.loadGraphModel(MODEL.imagenetUrl),
        loadLabels(),
      ]);
      loaded = { tf, catdog, imagenet, labels, backend: tf.getBackend() };
      return loaded;
    })().catch((err) => {
      runtimePromise = null;
      loaded = null;
      throw err;
    });
  }
  return runtimePromise;
}

export function isReady() {
  return loaded !== null;
}

export function backendName() {
  return loaded ? loaded.backend : null;
}

async function loadLabels() {
  if (!labelsPromise) {
    labelsPromise = fetch(MODEL.labelsUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Label list returned ${res.status}`);
        return res.json();
      })
      .then((list) => {
        if (!Array.isArray(list) || list.length < 1000) {
          throw new Error('Label list is not the 1000-class list');
        }
        return list;
      })
      .catch((err) => {
        labelsPromise = null;
        throw err;
      });
  }
  return labelsPromise;
}

/**
 * @param {ImageBitmap|HTMLImageElement|HTMLCanvasElement} source
 * @returns {Promise<{
 *   pDog: number, pCat: number, confidence: number,
 *   winner: 'cat'|'dog'|'draw'|'disq',
 *   isPet: boolean, gateMass: number, top: {label: string, p: number, index: number}[],
 *   backend: string|null, ms: number
 * }>}
 */
export async function classify(source) {
  const started = performance.now();
  const { tf, catdog, imagenet, labels } = await preload();

  const batch = tf.tidy(() => buildBatch(tf, source));

  let dogOut = null;
  let gateOut = null;
  try {
    dogOut = execute(tf, catdog, MODEL.catdogInput, batch);
    gateOut = execute(tf, imagenet, MODEL.imagenetInput, batch);
    const dogScores = await dogOut.data();
    const gateScores = await gateOut.data();

    // dogScores is [2] (one sigmoid per mirrored pass); gateScores is [2, 1000].
    const pDogRaw = (dogScores[0] + dogScores[1]) / 2;
    const pDog = clamp01(pDogRaw);
    const pCat = 1 - pDog;

    const classes = labels.length;
    const averaged = new Float32Array(classes);
    for (let i = 0; i < classes; i += 1) {
      averaged[i] = (gateScores[i] + gateScores[classes + i]) / 2;
    }

    let gateMass = 0;
    for (let i = MODEL.gateStart; i < MODEL.gateEnd; i += 1) gateMass += averaged[i];

    const top = topK(averaged, labels, 5);
    const topHasPet = top.some((entry) => entry.index >= MODEL.gateStart && entry.index < MODEL.gateEnd);
    const isPet = topHasPet || gateMass >= MODEL.gateMass;

    const confidence = Math.max(pCat, pDog);
    const winner = !isPet ? 'disq' : confidence < MODEL.threshold ? 'draw' : pCat >= pDog ? 'cat' : 'dog';

    return {
      pDog,
      pCat,
      confidence,
      winner,
      isPet,
      gateMass,
      top,
      backend: tf.getBackend(),
      ms: Math.round(performance.now() - started),
    };
  } finally {
    batch.dispose();
    if (dogOut) dogOut.dispose();
    if (gateOut) gateOut.dispose();
  }
}

function execute(tf, model, inputName, batch) {
  let out;
  try {
    out = model.execute({ [inputName]: batch });
  } catch (err) {
    // Older converters can hide the input names; a single-input graph
    // accepts the tensor directly.
    out = model.execute(batch);
  }
  return Array.isArray(out) ? out[0] : out;
}

function buildBatch(tf, source) {
  const size = MODEL.size;
  const pixels = rasterize(source, size);
  const stride = size * size;
  const originalPixels = new Float32Array(stride * 3);
  const mirroredPixels = new Float32Array(stride * 3);

  for (let y = 0; y < size; y += 1) {
    const row = y * size;
    for (let x = 0; x < size; x += 1) {
      const src = (row + x) * 4;
      const dst = (row + x) * 3;
      const mirrorDst = (row + (size - 1 - x)) * 3;
      const r = pixels[src];
      const g = pixels[src + 1];
      const b = pixels[src + 2];
      originalPixels[dst] = r / 127.5 - 1;
      originalPixels[dst + 1] = g / 127.5 - 1;
      originalPixels[dst + 2] = b / 127.5 - 1;
      mirroredPixels[mirrorDst] = r / 127.5 - 1;
      mirroredPixels[mirrorDst + 1] = g / 127.5 - 1;
      mirroredPixels[mirrorDst + 2] = b / 127.5 - 1;
    }
  }

  const original = tf.tensor4d(originalPixels, [1, size, size, 3]);
  const mirrored = tf.tensor4d(mirroredPixels, [1, size, size, 3]);
  return tf.concat([original, mirrored], 0);
}

function rasterize(source, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('This browser cannot read image pixels.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size).data;
}

function topK(scores, labels, k) {
  const best = [];
  for (let i = 0; i < scores.length; i += 1) {
    const p = scores[i];
    if (best.length < k) {
      best.push({ index: i, p });
      if (best.length === k) best.sort((a, b) => b.p - a.p);
    } else if (p > best[k - 1].p) {
      best[k - 1] = { index: i, p };
      best.sort((a, b) => b.p - a.p);
    }
  }
  return best.map((entry) => ({
    index: entry.index,
    p: entry.p,
    label: labels[entry.index] || `class ${entry.index}`,
  }));
}

function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}
