import { waapi } from 'animejs/waapi';
import { motionAllowed, fxTier, onFxTierChange } from './core';
import { NOISE_FRAMES, noiseKeyframes } from './keyframes';

export type OverlayEffect = 'noise' | 'scanline' | 'overlay';

const SWEEP_MS = 2625;
const HOLD_MS = 4875;
// Keyframes are evenly spaced and the sweep is 35% of the cycle, so 7 of 20 segments sweep and the rest hold.
const SEGMENTS = 20;
const SWEEP_SEGMENTS = (SWEEP_MS / (SWEEP_MS + HOLD_MS)) * SEGMENTS;
const SCANLINE_KEYFRAMES = Array.from({ length: SEGMENTS + 1 }, (_, step) => {
  const progress = Math.min(step, SWEEP_SEGMENTS) / SWEEP_SEGMENTS;
  return `translateY(${-100 + 200 * progress}%)`;
});

type WaapiAnimation = ReturnType<typeof waapi.animate>;

function noiseFps(): number {
  return fxTier() >= 2 ? 8 : 15;
}

function isVisible(element: HTMLElement): boolean {
  return !element.classList.contains('hidden');
}

let current: { root: HTMLElement; sync: () => void; stop: () => void } | null = null;

/** Starts the scanline sweep and the static jitter. Idempotent per overlay element, so a persisted overlay keeps running. */
export function startOverlay(): void {
  const root = document.querySelector<HTMLElement>('.terminal-overlay');
  if (!root) return;
  const scanline = root.querySelector<HTMLElement>('.scanline');
  const noise = root.querySelector<HTMLElement>('.noise');

  // Re-entry with the same element (persisted across a swap): keep running, but restart what a DOM move cancelled.
  if (current?.root === root) {
    current.sync();
    return;
  }
  current?.stop();
  const controller = new AbortController();

  let sweep: WaapiAnimation | null = null;
  let jitter: WaapiAnimation | null = null;
  let jitterFps = 0;

  const syncScanline = () => {
    const wanted = !!scanline && motionAllowedFor(scanline) && isVisible(scanline);
    if (!scanline) return;
    if (!wanted) {
      sweep?.pause();
      return;
    }
    const cancelled = sweep?.animations.some((animation) => animation.playState === 'idle');
    if (sweep && !cancelled) {
      sweep.play();
      return;
    }
    sweep?.cancel();
    sweep = waapi.animate(scanline, {
      transform: SCANLINE_KEYFRAMES,
      duration: SWEEP_MS + HOLD_MS,
      ease: 'linear',
      loop: true,
    });
  };

  const syncNoise = () => {
    if (!noise) return;
    const wanted = motionAllowedFor(noise) && isVisible(noise);
    if (!wanted) {
      jitter?.pause();
      return;
    }
    // Random translate keyframes held in steps, so the compositor jitters the layer with no script or style work per frame.
    const fps = noiseFps();
    const cancelled = jitter?.animations.some((animation) => animation.playState === 'idle');
    if (jitter && !cancelled && fps === jitterFps) {
      jitter.play();
      return;
    }
    jitter?.cancel();
    jitterFps = fps;
    jitter = waapi.animate(noise, {
      transform: noiseKeyframes(),
      duration: (NOISE_FRAMES / fps) * 1000,
      ease: `steps(${NOISE_FRAMES}, jump-none)`,
      loop: true,
    });
  };

  const sync = () => {
    syncScanline();
    syncNoise();
  };

  document.addEventListener('terminal-effect-change', sync, { signal: controller.signal });
  onFxTierChange(syncNoise, controller.signal);
  current = {
    root,
    sync,
    stop: () => {
      controller.abort();
      sweep?.cancel();
      jitter?.cancel();
    },
  };
  sync();
}

// An explicit opt-in (data-effect-enabled) still animates under reduced motion; the default does not.
function motionAllowedFor(element: HTMLElement): boolean {
  return motionAllowed() || element.dataset.effectEnabled === 'true';
}
