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
