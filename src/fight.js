/**
 * The 3.5 second broadcast fight.
 *
 * start()  — entrance plus three exchanges; resolves when the ring is clear
 * finish() — waits for the exchanges, then knocks the loser out
 * stop()   — cancels everything and restores the starting positions
 */

export function createFight({ fightEl, stageEl, catEl, dogEl, impactEl, captionEl, koEl, badgeCat, badgeDog, reduced = false }) {
  const live = new Set();
  const timers = new Set();
  let calm = reduced;
  let cancelled = true;
  let ready = Promise.resolve();
  let started = false;

  function anim(el, frames, options) {
    if (!el || !el.animate) return Promise.resolve();

    let keyframes = frames;
    let settings = options;

    if (calm) {
      // Reduced motion keeps the storytelling but drops movement:
      // fades and type changes only, with shorter durations.
      keyframes = frames.map((frame) => {
        const next = {};
        if (frame.opacity !== undefined) next.opacity = frame.opacity;
        if (frame.offset !== undefined) next.offset = frame.offset;
        return next;
      });
      settings = { ...options, duration: Math.min(options?.duration || 300, 420) };
    }

    const animation = el.animate(keyframes, settings);
    live.add(animation);
    return animation.finished
      .catch(() => {})
      .then(() => {
        live.delete(animation);
        if (!settings || !settings.keep) {
          try {
            animation.cancel();
          } catch (err) {
            /* already gone */
          }
        }
      });
  }

  function sleep(ms) {
    return new Promise((resolve) => {
      const entry = { resolve };
      entry.id = setTimeout(() => {
        timers.delete(entry);
        resolve();
      }, ms);
      timers.add(entry);
    });
  }

  function impact(word) {
    impactEl.textContent = word;
    anim(
      impactEl,
      [
        { opacity: 0, transform: 'translate(-50%, -50%) rotate(-12deg) scale(0.4)' },
        { opacity: 1, transform: 'translate(-50%, -50%) rotate(-6deg) scale(1.12)', offset: 0.24 },
        { opacity: 1, transform: 'translate(-50%, -50%) rotate(-4deg) scale(1)', offset: 0.62 },
        { opacity: 0, transform: 'translate(-50%, -50%) rotate(0deg) scale(1.34)' },
      ],
      { duration: 540, easing: 'cubic-bezier(.18,.75,.3,1)' },
    );
    anim(
      fightEl,
      [
        { transform: 'translate(0, 0)' },
        { transform: 'translate(-5px, 3px)' },
        { transform: 'translate(4px, -3px)' },
        { transform: 'translate(-2px, 2px)' },
        { transform: 'translate(0, 0)' },
      ],
      { duration: 260, easing: 'linear' },
    );
  }

  async function enter(el, dir) {
    await anim(
      el,
      [
        { transform: `translateX(${dir * 130}%) rotate(${dir * 24}deg)`, opacity: 0 },
        { transform: 'translateX(-4%) rotate(2deg)', opacity: 1, offset: 0.72 },
        { transform: `translateX(0) rotate(${dir * 3}deg)`, opacity: 1 },
      ],
      { duration: 600, easing: 'cubic-bezier(.16,.9,.3,1.14)' },
    );
  }

  async function exchange(attacker, defender, dir, word, caption) {
    if (cancelled) return;
    captionEl.textContent = caption;
    anim(
      captionEl,
      [
        { opacity: 0, transform: 'translate(-50%, 7px)' },
        { opacity: 1, transform: 'translate(-50%, 0)' },
      ],
      { duration: 240, easing: 'ease-out' },
    );

    await anim(
      attacker,
      [
        { transform: 'translateX(0) rotate(0deg)' },
        { transform: `translateX(${-dir * 7}%) rotate(${-dir * 7}deg)` },
      ],
      { duration: 180, easing: 'ease-in' },
    );

    if (cancelled) return;

    const land = 130;
    const flashEntry = { resolve() {} };
    flashEntry.id = setTimeout(() => {
      timers.delete(flashEntry);
      if (!cancelled) impact(word);
    }, land);
    timers.add(flashEntry);

    anim(
      defender,
      [
        { transform: 'translateX(0) rotate(0deg)' },
        { transform: `translateX(${dir * 10}%) rotate(${dir * 10}deg)` },
        { transform: 'translateX(0) rotate(0deg)' },
      ],
      { duration: 360, delay: land, easing: 'ease-out' },
    );

    await anim(
      attacker,
      [
        { transform: `translateX(${-dir * 7}%) rotate(${-dir * 7}deg)` },
        { transform: `translateX(${dir * 25}%) rotate(${dir * 14}deg)`, offset: 0.38 },
        { transform: 'translateX(0) rotate(0deg)' },
      ],
      { duration: 520, easing: 'cubic-bezier(.28,.72,.28,1)' },
    );

    await sleep(200);
  }

  async function sequence() {
    captionEl.textContent = 'Round one. No rules.';
    if (calm) {
      await anim(captionEl, [{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
      await sleep(420);
      await exchange(catEl, dogEl, 1, 'POW', 'The cat opens with a slap.');
      await exchange(dogEl, catEl, -1, 'BONK', 'The dog returns fire.');
      await exchange(catEl, dogEl, 1, 'WHAM', 'Somebody is getting rained on.');
      await exchange(dogEl, catEl, -1, 'KABOOM', 'The final exchange. No mercy.');
      captionEl.textContent = 'The judges check the tape.';
      await sleep(320);
      return;
    }
    await Promise.all([enter(catEl, -1), enter(dogEl, 1)]);
    if (cancelled) return;
    await sleep(150);
    await exchange(catEl, dogEl, 1, 'POW', 'The cat opens with a slap.');
    await exchange(dogEl, catEl, -1, 'BONK', 'The dog returns fire.');
    await exchange(catEl, dogEl, 1, 'WHAM', 'Somebody is getting rained on.');
    await exchange(dogEl, catEl, -1, 'KABOOM', 'The final exchange. No mercy.');
    await sleep(250);
    captionEl.textContent = 'The judges check the tape.';
  }

  function start() {
    stop();
    started = true;
    cancelled = false;
    ready = sequence().catch(() => {});
    return ready;
  }

  function showKo(word) {
    koEl.textContent = word;
    return anim(
      koEl,
      [
        { opacity: 0, transform: 'translate(-50%, -50%) rotate(-12deg) scale(0.5)' },
        { opacity: 1, transform: 'translate(-50%, -50%) rotate(-8deg) scale(1.05)', offset: 0.3 },
        { opacity: 1, transform: 'translate(-50%, -50%) rotate(-8deg) scale(1)', offset: 0.8 },
        { opacity: 0, transform: 'translate(-50%, -50%) rotate(-6deg) scale(1.1)' },
      ],
      { duration: 900, easing: 'cubic-bezier(.18,.8,.3,1)' },
    );
  }

  async function finish(winner) {
    if (!started) return;
    await ready;
    if (cancelled) return;

    if (badgeCat) badgeCat.textContent = winner === 'cat' ? '\ud83d\udc51\ud83d\udcaa' : '\ud83d\ude35';
    if (badgeDog) badgeDog.textContent = winner === 'dog' ? '\ud83d\udc51\ud83d\udcaa' : '\ud83d\ude35';
    requestAnimationFrame(() => {
      badgeCat?.classList.add('show');
      badgeDog?.classList.add('show');
    });

    if (calm) {
      await showKo(winner === 'draw' ? 'DRAW' : winner === 'disq' ? 'NOPE' : 'K.O.');
      return;
    }

    if (winner === 'cat' || winner === 'dog') {
      const dir = winner === 'cat' ? 1 : -1;
      const win = winner === 'cat' ? catEl : dogEl;
      const lose = winner === 'cat' ? dogEl : catEl;
      await Promise.all([
        anim(
          win,
          [
            { transform: 'translateX(0) translateY(0) rotate(0deg)' },
            { transform: `translateX(${dir * 7}%) translateY(-44px) rotate(${dir * -10}deg)`, offset: 0.42 },
            { transform: `translateX(${dir * 7}%) translateY(0) rotate(${dir * -4}deg)` },
          ],
          { duration: 820, easing: 'cubic-bezier(.2,.85,.3,1)' },
        ),
        anim(
          lose,
          [
            { transform: 'translateX(0) translateY(0) rotate(0deg)', opacity: 1 },
            { transform: `translateX(${-dir * 34}%) translateY(22px) rotate(${-dir * 76}deg)`, opacity: 0.3, offset: 0.85 },
          ],
          { duration: 760, easing: 'cubic-bezier(.4,0,.72,.44)', keep: true },
        ),
        showKo('K.O.'),
      ]);
      await sleep(120);
      return;
    }

    if (winner === 'draw') {
      await Promise.all([
        anim(
          catEl,
          [
            { transform: 'translateX(0) translateY(0) rotate(0deg)', opacity: 1 },
            { transform: 'translateX(-6%) translateY(18px) rotate(-16deg)', opacity: 0.55 },
          ],
          { duration: 700, easing: 'cubic-bezier(.3,0,.6,.6)', keep: true },
        ),
        anim(
          dogEl,
          [
            { transform: 'translateX(0) translateY(0) rotate(0deg)', opacity: 1 },
            { transform: 'translateX(6%) translateY(18px) rotate(16deg)', opacity: 0.55 },
          ],
          { duration: 700, easing: 'cubic-bezier(.3,0,.6,.6)', keep: true },
        ),
        showKo('DRAW'),
      ]);
      await sleep(120);
      return;
    }

    await Promise.all([
      anim(
        catEl,
        [{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(-60%)', opacity: 0 }],
        { duration: 620, easing: 'ease-in', keep: true },
      ),
      anim(
        dogEl,
        [{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(60%)', opacity: 0 }],
        { duration: 620, easing: 'ease-in', keep: true },
      ),
      showKo('NOPE'),
    ]);
    await sleep(120);
  }

  function resetScene() {
    koEl.textContent = 'K.O.';
    impactEl.textContent = 'POW';
    captionEl.textContent = 'Round one. No rules.';
    for (const el of [catEl, dogEl, impactEl, koEl, captionEl, fightEl, badgeCat, badgeDog]) {
      if (!el) continue;
      try {
        el.getAnimations().forEach((a) => a.cancel());
      } catch (err) {
        /* noop */
      }
      el.style.removeProperty('opacity');
      el.style.removeProperty('transform');
      el.classList.remove('show');
      if (el === badgeCat || el === badgeDog) el.textContent = '';
    }
  }

  function stop() {
    cancelled = true;
    started = false;
    for (const animation of live) {
      try {
        animation.cancel();
      } catch (err) {
        /* noop */
      }
    }
    live.clear();
    for (const timer of timers) {
      clearTimeout(timer.id);
      timer.resolve();
    }
    timers.clear();
    resetScene();
  }

  return {
    start,
    finish,
    stop,
    setReduced(next) {
      calm = Boolean(next);
    },
    get running() { return started; },
  };
}
