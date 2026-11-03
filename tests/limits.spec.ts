import { test, expect } from './fixtures';
import { flashesPerSecond, BOOT_FLICKER, GLITCH_BURSTS } from '../src/animation/keyframes';

test.describe('flashesPerSecond', () => {
  test('counts 0, 1 and 2 reversals', () => {
    expect(flashesPerSecond([0, 1, 1], 1000)).toBe(0);
    expect(flashesPerSecond([0, 1, 0], 1000)).toBe(1);
    expect(flashesPerSecond([0, 1, 0, 1], 1000)).toBe(2);
  });

  test('ignores changes under 0.1', () => {
    expect(flashesPerSecond([0, 0.05, 0, 0.05, 0], 1000)).toBe(0);
    expect(flashesPerSecond([0, 1, 0.95, 1, 0], 1000)).toBe(1);
  });

  test('uses a sliding 1000ms window without scaling short durations', () => {
    expect(flashesPerSecond([0, 1, 0], 200)).toBe(1);
    expect(flashesPerSecond([0, 1, 0, 1, 0, 1, 0, 1], 1000)).toBe(6);
    expect(flashesPerSecond([0, 1, 0, 1, 0, 1, 0, 1], 500)).toBe(6);
    expect(flashesPerSecond([0, 1, 0, 1, 0, 1, 0, 1], 2000)).toBeLessThan(6);
  });

  test('does not average a burst over the whole sequence', () => {
    const burst = [0, 1, 0, 1, 0, 1, 0, 1, ...new Array(35).fill(1)];
    expect(flashesPerSecond(burst, 3000)).toBe(6);
  });

  test('handles degenerate input', () => {
    expect(flashesPerSecond([], 1000)).toBe(0);
    expect(flashesPerSecond([1], 1000)).toBe(0);
    expect(flashesPerSecond([0, 1], 1000)).toBe(0);
  });

  test('boot flicker stays within 3 flashes per second', () => {
    expect(flashesPerSecond(BOOT_FLICKER.opacity, BOOT_FLICKER.duration)).toBeLessThanOrEqual(3);
  });
});

test.describe('glitch bursts', () => {
  test('there are bursts to choose from', () => {
    expect(GLITCH_BURSTS.length).toBeGreaterThan(0);
  });

  for (const [index, burst] of GLITCH_BURSTS.entries()) {
    test(`burst ${index} is 150-250ms with at most one reversal`, () => {
      expect(burst.duration).toBeGreaterThanOrEqual(150);
      expect(burst.duration).toBeLessThanOrEqual(250);
      // 3 starts per second, one reversal each, so no second can hold more than 3 flashes
      expect(flashesPerSecond(burst.opacity, 1000)).toBeLessThanOrEqual(1);
      expect(flashesPerSecond(burst.opacity, burst.duration)).toBeLessThanOrEqual(1);
    });
  }
});
