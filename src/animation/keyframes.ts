// Pure keyframe data and math. Must stay free of DOM and animejs imports.

const FLASH_THRESHOLD = 0.1;

/**
 * Flash rate of an opacity sequence spread evenly over `durationMs`.
 * A flash is a pair of opposing opacity changes (rise then fall, or fall then rise),
 * each at least 0.1 in size, matching the WCAG 2.3.1 general flash definition.
 */
export function flashesPerSecond(opacities: number[], durationMs: number): number {
  if (durationMs <= 0) return 0;
  let pairs = 0;
  let lastDirection = 0;
  for (let i = 1; i < opacities.length; i++) {
    const delta = opacities[i] - opacities[i - 1];
    if (Math.abs(delta) < FLASH_THRESHOLD) continue;
    const direction = Math.sign(delta);
    if (lastDirection !== 0 && direction !== lastDirection) pairs++;
    lastDirection = direction;
  }
  return pairs / (durationMs / 1000);
}
