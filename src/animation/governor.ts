import { fxTier, type FxTier } from './core';

const START_DELAY_MS = 2000;
const WINDOW_MS = 3000;
const LONG_FRAME_MS = 50;
const LONG_SHARE = 0.25;
// A young window or a slow device must not decide on a few frames: it needs both a time span and a few frames.
const MIN_SPAN_MS = 2000;
const MIN_FRAMES = 5;
// Ring capacity: 3s at well over 240Hz, so the window never overflows.
const CAPACITY = 1024;
const STEP_COOLDOWN_MS = 5000;
const MAX_TIER: FxTier = 3;
const TIER_KEY = 'fx-tier';
const LOCK_KEY = 'fx-tier-lock';

let started = false;

function readLock(): FxTier | null {
  try {
    const value = localStorage.getItem(LOCK_KEY);
    return value === '0' || value === '1' || value === '2' || value === '3' ? (Number(value) as FxTier) : null;
  } catch {
    return null;
  }
}

/** Publishes a tier: on `<html>`, in session storage for the next load, and as a `fx-tier-change` event. */
function publish(tier: FxTier): void {
  document.documentElement.dataset.fxTier = String(tier);
  try {
    sessionStorage.setItem(TIER_KEY, String(tier));
  } catch {
    // Storage may be blocked; the in-memory copy in `startGovernor` still survives swaps.
  }
  document.dispatchEvent(new CustomEvent('fx-tier-change', { detail: { tier } }));
}

/** Resolves once the loader is gone. `loading-screen-end` fires once per document, so a loader that is already gone counts. */
function afterLoader(run: () => void): void {
  const screen = document.getElementById('loading-screen');
  if (!screen || getComputedStyle(screen).display === 'none') {
    run();
    return;
  }
  document.addEventListener('loading-screen-end', run, { once: true });
}

/**
 * Watches frame gaps and steps the effect tier down (never up) when too many frames are long.
 * `localStorage['fx-tier-lock']` pins a tier and disables measuring. It is read once, at load.
 * Runs once per document: navigations neither restart nor reset the measurement.
 */
export function startGovernor(): void {
  if (started) return;
  started = true;

  let tier: FxTier = fxTier();
  // ClientRouter replaces <html> attributes on every swap and the bootstrap can only restore what
  // storage still holds, so the governor reapplies its own value too.
  const reapply = () => {
    if (tier > 0 || document.documentElement.dataset.fxTier !== undefined) {
      document.documentElement.dataset.fxTier = String(tier);
    }
  };
  document.addEventListener('astro:after-swap', reapply);

  const lock = readLock();
  if (lock !== null) {
    tier = lock;
    publish(tier);
    return;
  }

  afterLoader(() => {
    setTimeout(measure, START_DELAY_MS);
  });

  function measure(): void {
    if (tier >= MAX_TIER) return;
    // Ring buffer of frame times and long flags, so per-frame work is O(1) with no allocation.
    const times = new Float64Array(CAPACITY);
    const longs = new Uint8Array(CAPACITY);
    let head = 0;
    let count = 0;
    let longCount = 0;
    let last: number | null = null;
    let skipNext = false;
    let lastStep = -Infinity;

    const clear = () => {
      head = 0;
      count = 0;
      longCount = 0;
    };
    const reset = () => {
      clear();
      last = null;
      skipNext = true;
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') reset();
    });

    const frame = (now: number) => {
      if (document.visibilityState === 'hidden') {
        reset();
      } else if (skipNext) {
        // The gap that spans the time away is not a real frame.
        skipNext = false;
        last = now;
      } else {
        if (last !== null) {
          const long = now - last > LONG_FRAME_MS ? 1 : 0;
          if (count === CAPACITY) {
            longCount -= longs[head];
            head = (head + 1) % CAPACITY;
            count--;
          }
          const slot = (head + count) % CAPACITY;
          times[slot] = now;
          longs[slot] = long;
          longCount += long;
          count++;
        }
        last = now;
        while (count > 0 && now - times[head] > WINDOW_MS) {
          longCount -= longs[head];
          head = (head + 1) % CAPACITY;
          count--;
        }
        const span = count > 0 ? now - times[head] : 0;
        if (
          span >= MIN_SPAN_MS &&
          count >= MIN_FRAMES &&
          longCount / count > LONG_SHARE &&
          now - lastStep >= STEP_COOLDOWN_MS
        ) {
          tier = (tier + 1) as FxTier;
          lastStep = now;
          clear();
          publish(tier);
          if (tier >= MAX_TIER) return;
        }
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}
