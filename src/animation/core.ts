import { createScope } from 'animejs/scope';

export type PageContext = {
  signal: AbortSignal;
  cleanup(fn: () => void): void;
};

export type FxTier = 0 | 1 | 2 | 3;

export function motionAllowed(): boolean {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function fxTier(): FxTier {
  const tier = Number(document.documentElement.dataset.fxTier);
  return tier === 1 || tier === 2 || tier === 3 ? tier : 0;
}

export function onFxTierChange(fn: (tier: number) => void, signal?: AbortSignal): void {
  document.addEventListener('fx-tier-change', () => fn(fxTier()), { signal });
}

/**
 * Runs `init` on every `astro:page-load`, inside an Anime.js scope. Cleanups, the scope
 * and the abort signal are released on `astro:before-swap`.
 *
 * `scope.revert()` also reverts `waapi` animations, but only those created synchronously
 * inside `init`. Animations created later (events, timers, promises) are not registered
 * and must be handed to `ctx.cleanup`.
 */
export function onPage(init: (ctx: PageContext) => void): void {
  let end: (() => void) | null = null;

  const teardown = () => {
    const run = end;
    end = null;
    run?.();
  };

  document.addEventListener('astro:page-load', () => {
    teardown();
    const controller = new AbortController();
    const cleanups: Array<() => void> = [];
    const scope = createScope();
    end = () => {
      controller.abort();
      for (const fn of cleanups.reverse()) {
        try {
          fn();
        } catch (error) {
          console.error(error);
        }
      }
      scope.revert();
    };
    scope.add(() => {
      init({ signal: controller.signal, cleanup: (fn) => void cleanups.push(fn) });
    });
  });
  document.addEventListener('astro:before-swap', teardown);
}
