# Animation engine: baseline vs final

**Verification caveat.** The full four-browser Playwright suite has NOT been run on the final code. The last full run was stopped for low memory at test 232 of 292. On the final code only these ran, on chromium with `--workers=1`: `tests/boot.spec.ts` (9/9), `tests/overlay.spec.ts` (5/5), `tests/governor.spec.ts` (11/11), plus `pnpm run check` and `pnpm run build` (clean).

## Setup

Both runs used `scripts/perf-measure.mjs`: 3 runs, median, 30 s idle, 15 s scroll, 1280x720 headless Chromium 156, CPU throttle 1x and 4x, tier locked at 0, all effects on, build `REVIEW_TEST_FIXTURES=1 astro build --outDir .test-dist`. The `meta` blocks are identical except `date` and `gitSha` (baseline `5a8c8fa`, final `82024b8` plus the uncommitted Task 11 edits). Headless Chromium uses software compositing, so only compare before and after.
Durations are cumulative seconds over the window. `transferredBytes` is measured when the loader hides. The baseline includes the 3.4 MB GIF, so the page-weight drop is not all engine.

## Verdict against the success bar (4x, idle and scroll)

Bar: `TaskDuration`, `paintEvents`, `RecalcStyleDuration`, `ScriptDuration` improve; `longFrameShare` does not get worse.

| Route / mode @4x | TaskDuration | paintEvents | RecalcStyle | ScriptDuration             | longFrameShare                         |
| ---------------- | ------------ | ----------- | ----------- | -------------------------- | -------------------------------------- |
| / idle           | -10% ok      | -63% ok     | +22% MISS   | +84% (expected, JS engine) | 0 → 0 ok                               |
| / scroll         | -0% (flat)   | -17% ok     | +6% MISS    | +33%                       | 0 → 0 ok                               |
| /contact idle    | +15% MISS    | -93% ok     | -25% ok     | +52%                       | 0 → 0.004 WORSE                        |
| /contact scroll  | -2% ok       | -82% ok     | -25% ok     | +28%                       | 0 → 0.001 WORSE                        |
| project idle     | -11% ok      | -79% ok     | +7% MISS    | +64%                       | 0 → 0 ok                               |
| project scroll   | +11% MISS    | -19% ok     | -1% ok      | +42%                       | 0.0011 → 0.0011 (+2%, about one frame) |

**The bar is not fully met.** `paintEvents` improves everywhere (-17% to -93%). `TaskDuration` is mixed: better on 3 of 6 rows, flat on 1, worse on 2 (/contact idle +15%, project scroll +11%). `RecalcStyleDuration` is worse on 3 of 6 rows. `ScriptDuration` rises on every row, as expected. `longFrameShare` is worse on the two /contact rows, from 0 to 0.4% and 0.1% of frames (a handful of frames out of about 1800 and 900), and is unchanged on the project scroll row.
No effect was cut or weakened. Needs a controller decision.

## Probable causes (hypotheses, not verified)

- **LayoutDuration** goes from about 0.001 s to 0.04-0.16 s on every row (the largest relative change in the data). Something now forces layout during idle. Likely candidates are timer-driven work in the JS tier (noise stepping, decode, or glitch scheduling) reading or writing layout-affecting state each tick. Task and RecalcStyle rises at 4x likely come from the same source.
- **ScriptDuration** rises because the engine and timers are JS.
- **/contact idle 1x TaskDuration is +87%** while its 4x row is +15%. That looks like a noisy or outlier baseline row, but it has not been re-run.
- **Paint gains** are consistent with moving the scanline, cursor and boot motion onto the compositor and removing paint-heavy shadow/width/background animations.

## Full results (baseline → final, % change)

Columns: TaskDuration, paintEvents, RecalcStyleDuration, ScriptDuration, LayoutDuration, longFrameShare, frameCount, transferredBytes.

| key                      | Task   | paint | Recalc                 | Script            | Layout                   | longFrameShare           | frames                      | bytes                     |
| ------------------------ | ------ | ----- | ---------------------- | ----------------- | ------------------------ | ------------------------ | --------------------------- | ------------------------- |
| []                       |
| /                        | idle   | 1x    | 1.186 → 1.302 (+10%)   | 1267 → 467 (-63%) | 0.1463 → 0.1854 (+27%)   | 0.05778 → 0.1228 (+113%) | 0.000178 → 0.01475 (+8184%) | 0 → 0 (n/a)               | 1801 → 1801 (+0%) | 4.08e+06 → 7.425e+05 (-82%)  |
| /                        | idle   | 4x    | 3.122 → 2.805 (-10%)   | 1267 → 468 (-63%) | 0.407 → 0.4978 (+22%)    | 0.1181 → 0.2172 (+84%)   | 0.000691 → 0.04809 (+6859%) | 0 → 0 (n/a)               | 1801 → 1801 (+0%) | 4.08e+06 → 7.425e+05 (-82%)  |
| /                        | scroll | 1x    | 0.6897 → 0.8205 (+19%) | 662 → 612 (-8%)   | 0.0769 → 0.09984 (+30%)  | 0.0651 → 0.1045 (+61%)   | 0 → 0.04223 (n/a)           | 0 → 0 (n/a)               | 915 → 900 (-2%)   | 4.08e+06 → 7.425e+05 (-82%)  |
| /                        | scroll | 4x    | 1.868 → 1.867 (-0%)    | 664 → 552 (-17%)  | 0.2239 → 0.2384 (+6%)    | 0.182 → 0.2429 (+33%)    | 0 → 0.1328 (n/a)            | 0 → 0 (n/a)               | 916 → 911 (-1%)   | 4.08e+06 → 7.424e+05 (-82%)  |
| /contact                 | idle   | 1x    | 1.109 → 2.073 (+87%)   | 1276 → 89 (-93%)  | 0.2074 → 0.1925 (-7%)    | 0.05959 → 0.1203 (+102%) | 0.000164 → 0.01281 (+7714%) | 0 → 0.003409 (n/a)        | 1801 → 1760 (-2%) | 4.023e+06 → 6.854e+05 (-83%) |
| /contact                 | idle   | 4x    | 2.829 → 3.254 (+15%)   | 1278 → 84 (-93%)  | 0.6369 → 0.4777 (-25%)   | 0.1228 → 0.1871 (+52%)   | 0.000664 → 0.04318 (+6403%) | 0 → 0.003971 (n/a)        | 1802 → 1763 (-2%) | 4.023e+06 → 6.854e+05 (-83%) |
| /contact                 | scroll | 1x    | 0.6036 → 0.7781 (+29%) | 658 → 149 (-77%)  | 0.1085 → 0.09684 (-11%)  | 0.04861 → 0.0862 (+77%)  | 0 → 0.02216 (n/a)           | 0 → 0.001114 (n/a)        | 913 → 898 (-2%)   | 4.023e+06 → 6.854e+05 (-83%) |
| /contact                 | scroll | 4x    | 1.601 → 1.567 (-2%)    | 658 → 117 (-82%)  | 0.3414 → 0.2548 (-25%)   | 0.1319 → 0.1687 (+28%)   | 0 → 0.07043 (n/a)           | 0 → 0.001126 (n/a)        | 913 → 890 (-3%)   | 4.023e+06 → 6.854e+05 (-83%) |
| /projects/arda-analytics | idle   | 1x    | 1.207 → 1.35 (+12%)    | 1279 → 269 (-79%) | 0.1564 → 0.2004 (+28%)   | 0.06198 → 0.1257 (+103%) | 0.00016 → 0.03095 (+19247%) | 0 → 0 (n/a)               | 1802 → 1801 (-0%) | 9.917e+06 → 6.579e+06 (-34%) |
| /projects/arda-analytics | idle   | 4x    | 3.046 → 2.714 (-11%)   | 1276 → 267 (-79%) | 0.4329 → 0.4623 (+7%)    | 0.1177 → 0.1931 (+64%)   | 0.000534 → 0.1145 (+21348%) | 0 → 0 (n/a)               | 1801 → 1801 (+0%) | 9.917e+06 → 6.579e+06 (-34%) |
| /projects/arda-analytics | scroll | 1x    | 0.6591 → 0.8376 (+27%) | 646 → 568 (-12%)  | 0.07573 → 0.09918 (+31%) | 0.06176 → 0.1062 (+72%)  | 0 → 0.04683 (n/a)           | 0.001103 → 0.001115 (+1%) | 907 → 897 (-1%)   | 9.917e+06 → 6.579e+06 (-34%) |
| /projects/arda-analytics | scroll | 4x    | 1.768 → 1.968 (+11%)   | 648 → 525 (-19%)  | 0.2458 → 0.2435 (-1%)    | 0.1667 → 0.2369 (+42%)   | 0 → 0.1573 (n/a)            | 0.001101 → 0.001124 (+2%) | 908 → 890 (-2%)   | 9.917e+06 → 6.579e+06 (-34%) |

## Bundle and size

- Built JS in `dist`: 63,853 bytes total (largest: Layout script 26.5 KB, ClientRouter 15.4 KB, `ui` chunk 9.5 KB, `core` chunk 6.7 KB). A baseline JS total was never recorded, so no bundle comparison is possible.
- Page weight: -82% on `/` (4.08 MB → 0.74 MB), -83% on `/contact`, -34% on the project page, but the baseline carried the 3.4 MB GIF.
- `src/animation/`: 9 files, 1096 lines, largest `decode.ts` at 273 (all under 400). `src` vs `main`: 49 files changed, +1279/-2074 lines; `.astro` files 112 → 103; `src/components` `.astro` files 94 → 85.
- `@keyframes` in live code: `fade-in`, `fade-out` (`Layout.astro`) and `loadingGlow` (`LoadingScreenV1.astro`). The glow stays in CSS because the loader paints before the Anime.js chunk arrives.

## Final browser check

Headless screenshots (boot, home, scrolled, modal) for all five themes on desktop 1280x720 and phone 390x844, 40 files, no page errors, in `/tmp/claude-1000/-home-alec-code-projects-personal-projects-Alec-Reimel-Portfolio-2025/1bc4da2b-0842-4b9b-a4f8-c778efb62c38/scratchpad/final-shots/` (`<desktop|phone>-<theme>-<boot|home|scrolled|modal>.png`). Stills only. Not done, and needing a person by eye: flash rate (3 per second limit), overall animation feel, navigation and hover feel, and real-phone behavior.

## Untouched known issue

`body` has no computed `text-shadow` in the built site because nested rules in `CustomStyles.astro` are flattened. Not changed here; the controller is raising it with the user.
