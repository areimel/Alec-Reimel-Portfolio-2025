import { waapi } from 'animejs/waapi';
import { fxTier, motionAllowed, onFxTierChange } from './core';
import { GLITCH_BURSTS } from './keyframes';

const MAX_RUNNING = 3;
const MAX_STARTS_PER_SECOND = 3;
const COOLDOWN_MS = 1000;
const AMBIENT_MIN_MS = 15000;
const AMBIENT_MAX_MS = 30000;
const SCROLL_QUIET_MS = 500;
const INLINE_PROPS = ['opacity', 'translate', 'clip-path'];
const ATTR = 'data-fx-glitch';
const AMBIENT_TARGETS = 'main h1, main h2, #sidebar-nav a';
const HEADINGS = 'main h1, main h2';

type Running = {
  animation: ReturnType<typeof waapi.animate>;
  restore: () => void;
  backstop: ReturnType<typeof setTimeout>;
};
const running = new Map<Element, Running>();
const lastStart = new WeakMap<Element, number>();
let recentStarts: number[] = [];
let lastScroll = -Infinity;

/** Ends a burst: removes the marker and anything the animation could leave behind. Safe to repeat. */
function finish(el: Element) {
  const burst = running.get(el);
  if (!burst) return;
  running.delete(el);
  clearTimeout(burst.backstop);
  const native = burst.animation.animations.slice();
  // revert() cancels, then restores the inline styles `cancel()` would have committed. It misses
  // `clip-path` (it lowercases `clipPath`), and Anime's cancel handler commits styles again when the
  // cancel event fires, so restore once now and once after every cancel event.
  burst.animation.revert();
  burst.restore();
  native.forEach((animation) => animation.addEventListener('cancel', burst.restore, { once: true }));
  el.removeAttribute(ATTR);
}

function cancelAll() {
  for (const el of Array.from(running.keys())) finish(el);
}

/**
 * Plays one short burst on `el`. Returns false when rate limited, or when motion is off.
 *
 * Only the individual `translate` property moves the element, so an existing `transform` (such as modal
 * centering) is untouched. Bursts end with `revert()`, and a timeout ends them even when the document is
 * hidden and animations stall.
 */
export function glitch(target: Element): boolean {
  const el = target as HTMLElement;
  if (!motionAllowed() || running.has(target) || running.size >= MAX_RUNNING) return false;
  const now = performance.now();
  if (now - (lastStart.get(target) ?? -Infinity) < COOLDOWN_MS) return false;
  recentStarts = recentStarts.filter((time) => now - time < 1000);
  if (recentStarts.length >= MAX_STARTS_PER_SECOND) return false;

  const { duration, opacity, translate, clipPath } = GLITCH_BURSTS[Math.floor(Math.random() * GLITCH_BURSTS.length)];
  // transform and translate do not apply to inline boxes, and display must never change.
  const inline = getComputedStyle(el).display === 'inline';
  const keyframes: Record<string, string[] | number[]> = { opacity };
  if (translate && !inline) keyframes.translate = translate;
  if (clipPath) keyframes.clipPath = clipPath;

  const original = INLINE_PROPS.map((name) => [name, el.style.getPropertyValue(name)] as const);
  const restore = () => {
    for (const [name, value] of original) {
      if (value) el.style.setProperty(name, value);
      else el.style.removeProperty(name);
    }
    if (el.getAttribute('style') === '') el.removeAttribute('style');
  };

  recentStarts.push(now);
  lastStart.set(target, now);
  el.setAttribute(ATTR, '');
  const animation = waapi.animate(el, { ...keyframes, duration, ease: 'linear', onComplete: () => finish(target) });
  running.set(target, { animation, restore, backstop: setTimeout(() => finish(target), duration + 100) });
  return true;
}

const reactiveAllowed = () => fxTier() < 2;
const ambientAllowed = () => fxTier() < 1;

function scheduleAmbient() {
  const delay = AMBIENT_MIN_MS + Math.random() * (AMBIENT_MAX_MS - AMBIENT_MIN_MS);
  setTimeout(() => {
    scheduleAmbient();
    if (document.hidden || !ambientAllowed() || performance.now() - lastScroll < SCROLL_QUIET_MS) return;
    const visible = Array.from(document.querySelectorAll(AMBIENT_TARGETS)).filter((el) => {
      const rect = el.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.top < innerHeight &&
        rect.right > 0 &&
        rect.left < innerWidth
      );
    });
    if (visible.length > 0) glitch(visible[Math.floor(Math.random() * visible.length)]);
  }, delay);
}

/** Wires every glitch trigger. Call once: listeners live on `document` and need no per-page setup. */
export function startGlitches(): void {
  document.addEventListener('pointerover', (event) => {
    if (event.pointerType === 'touch' || !reactiveAllowed() || !window.matchMedia('(pointer: fine)').matches) return;
    const target = (event.target as Element | null)?.closest?.('a, button');
    if (!target || target.contains(event.relatedTarget as Node | null)) return;
    glitch(target);
  });
  document.addEventListener('modal-opened', (event) => {
    if (reactiveAllowed() && (event as CustomEvent).detail instanceof Element) glitch((event as CustomEvent).detail);
  });
  document.addEventListener('astro:before-preparation', () => {
    const heading = document.querySelector(HEADINGS);
    if (reactiveAllowed() && heading) glitch(heading);
  });
  // A swap discards the page, and a half-run burst must not outlive it.
  document.addEventListener('astro:before-swap', cancelAll);
  document.addEventListener('scroll', () => (lastScroll = performance.now()), { passive: true, capture: true });
  onFxTierChange((tier) => {
    if (tier >= 2) cancelAll();
  });
  scheduleAmbient();
}
