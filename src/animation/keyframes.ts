// Pure keyframe data and math. Must stay free of DOM and animejs imports.

const FLASH_THRESHOLD = 0.1;

/**
 * Worst-case flash count in any 1000ms window of an opacity sequence whose keyframes are
 * evenly spaced over `durationMs`.
 *
 * Every direction reversal of a change of at least 0.1 counts as one flash. This is
 * deliberately stricter than WCAG 2.3.1, which counts opposing pairs. Durations under
 * 1000ms are not scaled up: one reversal in a 200ms burst returns 1.
 *
 * Loop boundaries are not counted. Looping callers must check the wrap-around themselves.
 */
export function flashesPerSecond(opacities: number[], durationMs: number): number {
  if (durationMs <= 0 || opacities.length < 2) return 0;
  const step = durationMs / (opacities.length - 1);
  const reversalTimes: number[] = [];
  let lastDirection = 0;
  for (let i = 1; i < opacities.length; i++) {
    const delta = opacities[i] - opacities[i - 1];
    if (Math.abs(delta) < FLASH_THRESHOLD) continue;
    const direction = Math.sign(delta);
    if (lastDirection !== 0 && direction !== lastDirection) reversalTimes.push(i * step);
    lastDirection = direction;
  }
  let max = 0;
  let start = 0;
  for (let end = 0; end < reversalTimes.length; end++) {
    while (reversalTimes[end] - reversalTimes[start] > 1000) start++;
    max = Math.max(max, end - start + 1);
  }
  return max;
}

/** CRT power-on flicker for the loader. At most 2 reversals in any 1000ms window (limit: 3). */
export const BOOT_FLICKER = { opacity: [0, 0.6, 0.2, 0.9, 1], duration: 1200 };

export type GlitchBurst = { opacity: number[]; translate?: string[]; clipPath?: string[]; duration: number };

/**
 * Short glitches for hover, modals, page changes and ambient. Each opacity sequence has at most one
 * reversal, and glitch.ts allows 3 starts per second, so no second holds more than 3 flashes.
 */
export const GLITCH_BURSTS: GlitchBurst[] = [
  {
    opacity: [1, 0.5, 1],
    translate: ['0px 0px', '-3px 0px', '2px 0px'],
    clipPath: ['inset(0% 0% 0% 0%)', 'inset(20% 0% 55% 0%)', 'inset(0% 0% 0% 0%)'],
    duration: 180,
  },
  {
    opacity: [1, 1, 0.6, 1],
    translate: ['0px 0px', '3px 0px', '-2px 0px', '0px 0px'],
    duration: 220,
  },
  {
    opacity: [1, 0.7, 1],
    clipPath: ['inset(0% 0% 0% 0%)', 'inset(45% 0% 25% 0%)', 'inset(0% 0% 0% 0%)'],
    duration: 160,
  },
];

/** Frames in one noise loop. The pattern repeats every `NOISE_FRAMES / fps` seconds, which is not noticeable on random static. */
export const NOISE_FRAMES = 60;
/** The noise layer is inset by this much on every side, so jitter within +-this never exposes an edge. */
export const NOISE_REACH = 128;

/** Random whole-pixel `translate` keyframes for the static jitter, one per held frame. */
export function noiseKeyframes(frames: number = NOISE_FRAMES, reach: number = NOISE_REACH): string[] {
  const span = reach * 2;
  return Array.from({ length: frames }, () => {
    const x = Math.floor(Math.random() * span) - reach;
    const y = Math.floor(Math.random() * span) - reach;
    return `translate(${x}px, ${y}px)`;
  });
}
