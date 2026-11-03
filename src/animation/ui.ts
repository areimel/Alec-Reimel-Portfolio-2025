import { waapi } from 'animejs/waapi';
import { motionAllowed, type PageContext } from './core';

type WaapiAnimation = ReturnType<typeof waapi.animate>;

const MODAL_MS = 300;
const CONTENT_OPEN = 'translate(-50%,-50%) scale(1)';
const CONTENT_CLOSED = 'translate(-50%,-48%) scale(0.96)';

type ModalState = { animations: WaapiAnimation[]; closing: ReturnType<typeof setTimeout> | null };
const modals = new WeakMap<HTMLElement, ModalState>();

/** Cancels whatever modal motion is in flight, including a pending `done`, and returns the state. */
function interrupt(container: HTMLElement): ModalState {
  const state = modals.get(container) ?? { animations: [], closing: null };
  if (state.closing !== null) clearTimeout(state.closing);
  state.closing = null;
  state.animations.forEach((animation) => animation.cancel());
  state.animations = [];
  modals.set(container, state);
  return state;
}

function run(state: ModalState, container: HTMLElement, content: HTMLElement, opacity: number[], transform: string[]) {
  const options = { duration: MODAL_MS, ease: 'ease-out' };
  state.animations = [
    waapi.animate(container, { opacity, ...options }),
    waapi.animate(content, { transform, ...options }),
  ];
}

export function modalIn(container: HTMLElement, content: HTMLElement): void {
  const state = interrupt(container);
  if (motionAllowed()) run(state, container, content, [0, 1], [CONTENT_CLOSED, CONTENT_OPEN]);
  document.dispatchEvent(new CustomEvent('modal-opened', { detail: content }));
}

export function modalOut(container: HTMLElement, content: HTMLElement, done: () => void): void {
  const state = interrupt(container);
  if (!motionAllowed()) {
    done();
    return;
  }
  run(state, container, content, [1, 0], [CONTENT_OPEN, CONTENT_CLOSED]);
  // Anime.js pauses in hidden documents, so `done` must not wait on the animation finishing.
  state.closing = setTimeout(() => {
    state.closing = null;
    state.animations.forEach((animation) => animation.cancel());
    state.animations = [];
    done();
  }, MODAL_MS);
}

/** Fades an element between full and half opacity while work is pending. */
export function pulse(el: HTMLElement): { cancel(): void } {
  if (!motionAllowed()) return { cancel() {} };
  const animation = waapi.animate(el, { opacity: [1, 0.5, 1], duration: 1500, ease: 'ease-in-out', loop: true });
  return { cancel: () => animation.cancel() };
}

/**
 * Blinks every terminal cursor that is rendered, one animation each.
 *
 * An animation on an element with no box (for example a cursor inside a hidden modal) can't run on the
 * compositor, so it forces a style recalculation on every frame. A cursor therefore only animates while
 * it is intersecting the viewport, which an element with no box never does.
 */
export function startCursors(ctx: PageContext): void {
  if (!motionAllowed()) return;
  const cursors = new Map<Element, WaapiAnimation>();
  const observer = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      const blink = cursors.get(target);
      if (!isIntersecting) blink?.pause();
      else if (blink) blink.play();
      else {
        cursors.set(
          target,
          waapi.animate(target as HTMLElement, {
            opacity: [1, 0],
            duration: 1000,
            ease: 'steps(2, jump-none)',
            loop: true,
          })
        );
      }
    }
  });
  ctx.cleanup(() => {
    observer.disconnect();
    cursors.forEach((blink) => blink.revert());
    cursors.clear();
  });
  document.querySelectorAll('.flashing').forEach((cursor) => observer.observe(cursor));
}

const REVEAL_MIN_WIDTH = 768;
const REVEAL_MS = 1000;
const REVEAL_STAGGER_MS = 100;

/** Fades `.reveal` elements in as they scroll into view, once each. */
export function startReveals(ctx: PageContext): void {
  const targets = Array.from(document.querySelectorAll<HTMLElement>('.reveal:not(.revealed)'));
  if (targets.length === 0) return;

  const reveal = (el: HTMLElement) => el.classList.add('revealed');
  const animations: WaapiAnimation[] = [];
  // Whatever happens, never leave a target hidden or an animation holding inline styles.
  ctx.cleanup(() => {
    animations.forEach((animation) => animation.revert());
    targets.forEach(reveal);
  });

  if (!motionAllowed() || window.innerWidth < REVEAL_MIN_WIDTH) {
    targets.forEach(reveal);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries
        .filter((entry) => entry.isIntersecting)
        .forEach((entry, index) => {
          const el = entry.target as HTMLElement;
          observer.unobserve(el);
          animations.push(
            waapi.animate(el, {
              opacity: [0, 1],
              transform: ['translateY(2rem)', 'none'],
              duration: REVEAL_MS,
              delay: index * REVEAL_STAGGER_MS,
              ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
              onComplete: (animation) => animation.revert(),
            })
          );
          // Animation fill holds opacity 0 through the delay, so the hiding rule can lift now.
          reveal(el);
        });
    },
    { threshold: 0, rootMargin: '0px 0px -5% 0px' }
  );
  ctx.cleanup(() => observer.disconnect());
  targets.forEach((el) => observer.observe(el));
}
