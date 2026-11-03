import { createTimer } from 'animejs/timer';
import { fxTier, motionAllowed, onFxTierChange, type PageContext } from './core';

export type DecodeOptions = { duration: number; charDelay: number; onDone?: () => void };
export type Decode = { cancel(): void };

const FRAME_RATE = 20;
const AUTO_DURATION_MS = 400;
const AUTO_CHAR_DELAY_MS = 25;
const AUTO_MAX_TOTAL_MS = 900;
// The timer can stall (hidden tab, throttled frames), so every decode also has a wall-clock backstop.
const BACKSTOP_MS = 250;
const LOADER_WAIT_MS = 7000;
const MOBILE_QUERY = '(max-width: 767px)';
const SCRAMBLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
// Only plain ASCII letters and digits are scrambled. Everything else (spaces, punctuation, emoji and
// other multi-unit graphemes) stays put, so a scrambled string is never malformed or a different width class.
const SCRAMBLED = /^[A-Za-z0-9]$/;

type Job = { tick(now: number): void; finish(): void };
const jobs = new Set<Job>();
// A decode already in flight on an element. A second request joins it rather than capturing scrambled text.
const inFlight = new Map<HTMLElement, { handle: Decode; waiters: Array<() => void> }>();

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined) : null;
const graphemes = (text: string): string[] =>
  segmenter ? Array.from(segmenter.segment(text), (part) => part.segment) : Array.from(text);

const randomChar = () => SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)];

// One timer for every character of every heading. Created at module load, outside any page scope,
// so a page swap cannot revert it; it only runs while a decode is active.
const timer = createTimer({
  frameRate: FRAME_RATE,
  loop: true,
  autoplay: false,
  onUpdate: () => {
    const now = performance.now();
    for (const job of jobs) job.tick(now);
  },
});

function settleAll() {
  for (const job of Array.from(jobs)) job.finish();
}

// Anime.js stops in hidden documents. Settling on hide guarantees real text whatever the timer does.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) settleAll();
});

/** Scrambles `el` and resolves it to its exact original text, one character at a time. */
export function decodeElement(el: HTMLElement, opts: DecodeOptions): Decode {
  const running = inFlight.get(el);
  if (running) {
    if (opts.onDone) running.waiters.push(opts.onDone);
    return running.handle;
  }
  const original = el.textContent ?? '';
  const parts = graphemes(original);
  if (document.hidden || !parts.some((part) => SCRAMBLED.test(part))) {
    opts.onDone?.();
    return { cancel() {} };
  }

  const priorLabel = el.getAttribute('aria-label');
  const priorPosition = el.style.position;
  const box = getComputedStyle(el);
  const view = document.createElement('span');
  view.setAttribute('aria-hidden', 'true');
  view.textContent = original;
  // The real text stays in flow as an invisible `::before` sizer (see tailwind.css), so the box, wrapping
  // and neighbours cannot change. The scrambled view floats over the content box and is clipped to it.
  if (box.position === 'static') el.style.position = 'relative';
  view.style.cssText = `position:absolute;overflow:hidden;top:${box.paddingTop};right:${box.paddingRight};bottom:${box.paddingBottom};left:${box.paddingLeft}`;
  el.setAttribute('aria-label', original);
  el.setAttribute('data-decode-text', original);
  el.replaceChildren(view);

  const start = performance.now();
  const total = opts.duration + Math.max(parts.length - 1, 0) * opts.charDelay;
  let done = false;
  let last = original;
  const backstop = setTimeout(() => job.finish(), total + BACKSTOP_MS);

  const release = () => {
    done = true;
    clearTimeout(backstop);
    jobs.delete(job);
    if (jobs.size === 0) timer.pause();
    if (priorLabel === null) el.removeAttribute('aria-label');
    else el.setAttribute('aria-label', priorLabel);
    el.removeAttribute('data-decode-text');
    el.style.position = priorPosition;
    el.textContent = original;
    inFlight.delete(el);
  };

  const job: Job = {
    tick(now) {
      if (done) return;
      const elapsed = now - start;
      if (elapsed >= total) return job.finish();
      let text = '';
      parts.forEach((part, index) => {
        const resolved = elapsed >= opts.duration + index * opts.charDelay;
        text += resolved || !SCRAMBLED.test(part) ? part : randomChar();
      });
      if (text !== last) view.textContent = last = text;
    },
    finish() {
      if (done) return;
      const waiters = inFlight.get(el)?.waiters ?? [];
      release();
      waiters.forEach((waiter) => waiter());
    },
  };

  const handle: Decode = {
    cancel() {
      if (!done) release();
    },
  };
  inFlight.set(el, { handle, waiters: opts.onDone ? [opts.onDone] : [] });
  jobs.add(job);
  timer.play();
  return handle;
}

const number = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

/** Resolves when the loader is gone, or once it can no longer be waited for. Never waits forever. */
function loaderGone(signal: AbortSignal): Promise<void> {
  const screen = document.getElementById('loading-screen');
  if (!screen || getComputedStyle(screen).display === 'none') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timeout);
      document.removeEventListener('loading-screen-end', done);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timeout = setTimeout(done, LOADER_WAIT_MS);
    document.addEventListener('loading-screen-end', done);
    signal.addEventListener('abort', done);
  });
}

/** Hover, click, in-view and loader-end `DecoderText` elements. */
function startTriggers(ctx: PageContext, track: (decode: Decode) => Decode) {
  const mobile = window.matchMedia(MOBILE_QUERY);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  document.querySelectorAll<HTMLElement>('.decoder-text').forEach((el) => {
    const trigger = el.dataset.trigger;
    const repeatable = trigger === 'hover' || trigger === 'click';
    const opts = { duration: number(el.dataset.duration, 500), charDelay: number(el.dataset.charDelay, 150) };
    const disabled = () => !motionAllowed() || (mobile.matches && el.dataset.mobileDisable === 'true');
    let current: Decode | null = null;
    let pending: ReturnType<typeof setTimeout> | null = null;
    let completed = false;

    const restore = () => {
      if (pending !== null) clearTimeout(pending);
      pending = null;
      current?.cancel();
      current = null;
      el.style.opacity = '1';
    };
    const start = () => {
      if (disabled()) return restore();
      if (current || pending !== null || (completed && !repeatable)) return;
      pending = setTimeout(
        () => {
          pending = null;
          el.style.opacity = '1';
          current = track(
            decodeElement(el, {
              ...opts,
              onDone: () => {
                current = null;
                completed = true;
              },
            })
          );
        },
        number(el.dataset.delay, 0)
      );
    };

    ctx.cleanup(restore);
    const skip = () => disabled() && restore();
    reduced.addEventListener('change', skip, { signal: ctx.signal });
    mobile.addEventListener('change', skip, { signal: ctx.signal });
    if (disabled()) return;

    // Interactive text stays readable while it waits for the user.
    if (!repeatable) el.style.opacity = '0';
    if (repeatable) {
      el.addEventListener(trigger === 'hover' ? 'mouseenter' : 'click', start, { signal: ctx.signal });
    } else if (trigger === 'loadingScreenEnd') {
      void loaderGone(ctx.signal).then(() => !ctx.signal.aborted && start());
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer.disconnect();
          start();
        },
        { rootMargin: '0px 0px -5% 0px' }
      );
      observer.observe(el);
      ctx.cleanup(() => observer.disconnect());
    }
  });
}

/** Plain `main h1, main h2` headings, decoded once each as they approach the viewport. */
function startHeadings(ctx: PageContext, track: (decode: Decode) => Decode) {
  if (!motionAllowed() || fxTier() >= 3) return;
  const targets = Array.from(document.querySelectorAll<HTMLElement>('main h1, main h2')).filter(
    (el) =>
      el.childElementCount === 0 &&
      !el.classList.contains('decoder-text') &&
      !el.hasAttribute('data-no-decode') &&
      !!el.textContent?.trim()
  );
  if (targets.length === 0) return;

  void (async () => {
    await document.fonts.ready;
    await loaderGone(ctx.signal);
    if (ctx.signal.aborted || !motionAllowed() || fxTier() >= 3) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          observer.unobserve(el);
          const length = graphemes(el.textContent ?? '').length;
          const spread = Math.max(length - 1, 1);
          const charDelay = Math.min(AUTO_CHAR_DELAY_MS, (AUTO_MAX_TOTAL_MS - AUTO_DURATION_MS) / spread);
          track(decodeElement(el, { duration: AUTO_DURATION_MS, charDelay }));
        }
      },
      { rootMargin: '0px 0px 120px 0px' }
    );
    ctx.cleanup(() => observer.disconnect());
    targets.forEach((el) => observer.observe(el));
  })();
}

export function startDecode(ctx: PageContext): void {
  const active = new Set<Decode>();
  const track = (decode: Decode) => {
    active.add(decode);
    return decode;
  };
  ctx.cleanup(() => {
    active.forEach((decode) => decode.cancel());
    active.clear();
  });
  startTriggers(ctx, track);
  startHeadings(ctx, track);
  // Heavy effects end mid-flight when the device drops to tier 3.
  onFxTierChange((tier) => {
    if (tier >= 3) active.forEach((decode) => decode.cancel());
  }, ctx.signal);
}
