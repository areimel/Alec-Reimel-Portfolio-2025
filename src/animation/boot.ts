import { waapi } from 'animejs/waapi';
import { motionAllowed } from './core';
import { BOOT_FLICKER } from './keyframes';

const BOOTED_KEY = 'fx-booted';
const FALLBACK_MS = 5000;
const POST_LOAD_MS = 200;
const BEAM_COLLAPSE_MS = 250;
const BEAM_CLOSE_MS = 150;
const FADE_MS = 300;
const SHORT_FADE_MS = 300;
// Hard stop for a hidden or throttled tab: the sequence never gets to outlive its own length by much.
const SEQUENCE_GUARD_MS = BEAM_COLLAPSE_MS + BEAM_CLOSE_MS + FADE_MS + 150;

const STATUS = [
  'Loading terminal fonts...',
  'Initializing interface...',
  'Loading terminal graphics...',
  'Connecting to systems...',
  'Finalizing setup...',
  'Ready!',
];

let started = false;

function readBooted(): boolean {
  try {
    return sessionStorage.getItem(BOOTED_KEY) !== null;
  } catch {
    return false;
  }
}

function markBooted(): void {
  try {
    sessionStorage.setItem(BOOTED_KEY, '1');
  } catch {
    // Storage may be blocked; every load then plays the full boot.
  }
}

function setProgress(percent: number): void {
  const bar = document.getElementById('loading-progress-bar');
  if (bar) bar.style.transform = `scaleX(${percent / 100})`;
  const label = document.getElementById('loading-percentage');
  if (label) label.textContent = `${Math.round(percent)}%`;
  const status = document.getElementById('loading-status');
  if (status) status.textContent = STATUS[Math.min(Math.floor(percent / 20), STATUS.length - 1)];
}

/** Runs the loader: font progress, optional CRT power-on flicker, and the exit. Starts once per document. */
export function startBoot(): void {
  if (started) return;
  started = true;
  const screen = document.getElementById('loading-screen');
  if (!screen || getComputedStyle(screen).display === 'none') return;

  const container = screen.querySelector<HTMLElement>('.loading-container');
  const full = motionAllowed() && !readBooted();
  markBooted();

  let ended = false;
  let exiting = false;
  let flicker: ReturnType<typeof waapi.animate> | null = null;
  let guard: ReturnType<typeof setTimeout> | undefined;

  // Idempotent: the sequence end, the guard timer and a navigation can all land here.
  const end = () => {
    if (ended) return;
    ended = true;
    clearTimeout(fallback);
    clearTimeout(guard);
    flicker?.cancel();
    screen.style.display = 'none';
    document.dispatchEvent(new CustomEvent('loading-screen-end'));
  };

  // `persist` animations never finish (so never call onComplete). Writing the end value inline first keeps
  // the final state after the animation, which overrides it while running.
  const step = (
    target: HTMLElement,
    property: 'opacity' | 'transform',
    from: string,
    to: string,
    duration: number,
    ease: string,
    onComplete: () => void
  ) => {
    target.style[property] = to;
    waapi.animate(target, { [property]: [from, to], duration, ease, onComplete });
  };

  const fade = (ms: number) => step(screen, 'opacity', '1', '0', ms, 'ease-out', end);

  const exit = () => {
    if (exiting || ended) return;
    exiting = true;
    clearTimeout(fallback);
    setProgress(100);
    flicker?.cancel();
    // A hidden tab may never produce frames; the reduced-motion path needs no animation at all.
    if (!motionAllowed() || document.hidden || !container) return end();
    guard = setTimeout(end, SEQUENCE_GUARD_MS);
    if (!full) return fade(SHORT_FADE_MS);
    step(container, 'transform', 'scale(1, 1)', 'scale(1, 0.005)', BEAM_COLLAPSE_MS, 'ease-in', () =>
      step(container, 'transform', 'scale(1, 0.005)', 'scale(0, 0.005)', BEAM_CLOSE_MS, 'ease-in', () => fade(FADE_MS))
    );
  };

  // The decorative boot badge may start after first paint; page content stays usable.
  if (full && container) {
    flicker = waapi.animate(container, { ...BOOT_FLICKER, ease: 'linear' });
  }

  setProgress(0);
  // Observe fonts already requested by CSS rather than forcing alternate-theme fonts to download.
  // Progress is decorative and never gates page visibility or the completion event.
  void document.fonts.ready.then(() => {
    if (!ended && !exiting) setProgress(85);
  });

  const fallback = setTimeout(() => {
    console.warn('Loading screen fallback timer triggered');
    exit();
  }, FALLBACK_MS);

  if (document.readyState === 'complete') setTimeout(exit, POST_LOAD_MS);
  else window.addEventListener('load', () => setTimeout(exit, POST_LOAD_MS), { once: true });

  // ClientRouter swaps in a fresh, visible loader; it must never show again.
  document.addEventListener('astro:after-swap', () => {
    const next = document.getElementById('loading-screen');
    if (next) next.style.display = 'none';
    if (!ended) end();
  });
}
