# Anime.js Animation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all real motion on the CRT portfolio to one shared Anime.js layer, make it measurably cheaper than today, and add the new glitch effects.

**Architecture:** `src/animation/` is loaded once from `Layout.astro`. Compositor-safe motion uses `waapi.animate`. Stepped effects (noise, decode, glitch scheduling) use the JS engine at low frame rates. A governor steps effects down when long frames pile up.

**Tech Stack:** Astro 5 with ClientRouter, TypeScript, Tailwind 3, `animejs` 4.x with subpath imports, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-02-animejs-engine-design.md`

## Global Constraints

- Branch: `feat/animation-engine`. One commit per task. End each commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Before each commit: `pnpm run check` and `pnpm run test:e2e` pass (Chromium, Firefox, WebKit, mobile). If a failure predates the task, record it against Task 1's results instead of hiding it.
- Import from subpaths only (`animejs/waapi`, `animejs/timer`, `animejs/scope`, `animejs/text`, and so on).
- WAAPI easings are CSS strings only (`linear`, `ease-out`, `cubic-bezier()`, `steps()`). Never `linear()`, power eases like `out(3)`, or JS easing functions.
- Only `transform`, `translate`, `scale`, `opacity`, and `clip-path` may be animated. Never animate `box-shadow`, `text-shadow`, `filter`, `width`, or `background-position`.
- No more than 3 flashes per second (WCAG 2.3.1), and no full-screen high-contrast flashing.
- Theme-aware colors only (`--terminal-*`). Effects must work under all five themes.
- Files stay under 300-400 lines. Apply the `dry-coding` skill.
- Reduced motion: no boot sequence, decoding, glitches, or reveals. Explicit `terminal-effect-*` opt-ins still work.
- **`ClientRouter` replaces `<html>` attributes and classes on every swap.** Anything stored on `<html>` must be reapplied on `astro:after-swap`.
- Priority rule: if an effect makes idle or scrolling worse than the baseline, make it cheaper or cut it, and report that.

## Review Focus

Each line has a test in the owning task.

1. **Script fails to load** (blocked or failed chunk): the loader still dismisses and no content stays hidden. Task 3.
2. **Navigating away mid-animation** (during decode, reveal, modal, or boot): no errors, nothing stuck invisible or scrambled on return. Tasks 5, 7, 8.
3. **Back/forward cache restore** (`pageshow`): content visible, overlay still animating. Task 4.
4. **Reveal target much taller than the viewport, or reached by a hash link**: it still appears. Today's 25% threshold can never be met by a very tall element. Task 7.
5. **Client-side navigation wiping `<html>` state**: motion flag and governor tier survive. Tasks 3, 10.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/animation/core.ts` | `motionAllowed`, `fxTier`, `onPage`, effect names |
| `src/animation/keyframes.ts` | Pure data only (no DOM, no `animejs`), plus `flashesPerSecond`, so Node tests can import it |
| `src/animation/overlay.ts` | Scanline and noise |
| `src/animation/boot.ts` | Loader progress and CRT sequence |
| `src/animation/ui.ts` | Reveals, modal in/out, cursor, submit pulse |
| `src/animation/decode.ts` | Scramble, heading selection, triggers |
| `src/animation/glitch.ts` | Reactive and ambient glitches |
| `src/animation/governor.ts` | Long-frame tracking and tier steps |
| `src/animation/index.ts` | Entry point; sets `window.__fxReady = true` |
| `src/components/common/FxBootstrap.astro` | Inline `<head>` script: motion flag, tier, failsafe |
| `scripts/perf-measure.mjs` | Repeatable before/after measurement |

---

### Task 1: Baseline measurement (Sonnet)

**Files:**
- Create: `scripts/perf-measure.mjs`, `docs/superpowers/perf/baseline.json`
- Modify: `package.json` (add `"perf": "node scripts/perf-measure.mjs"`)

**Interfaces:**
- Produces: `pnpm run perf --out <path>` writes JSON, consumed by Task 11. Sets `localStorage['fx-tier-lock'] = '0'` through `addInitScript`, which is harmless before Task 10 and locks the full tier after it.

- [ ] **Step 1: Run the existing suite on the untouched branch**

Run: `pnpm run check && pnpm run test:e2e`
Expected: PASS. Write any existing failures to `docs/superpowers/perf/known-failures.md`.

- [ ] **Step 2: Implement the script**

It builds to `.test-dist`, serves on port 4399, and drives headless Chromium over these combinations:

- Routes: `/`, `/contact`, and `/projects/<first slug sorted from src/data/projects>`.
- Modes: idle 30s (long enough to include an ambient glitch), and scroll 15s (scrolling down and up with `mouse.wheel`).
- CPU throttle 1x and 4x via `Emulation.setCPUThrottlingRate`.
- `--runs`, default 3, reporting the median.

Start measuring only after `#loading-screen` is hidden. Record:

- `longFrameShare` and `frameCount` from a page rAF loop (frames over 50ms).
- `TaskDuration`, `ScriptDuration`, `LayoutDuration`, and `RecalcStyleDuration` deltas from `Performance.getMetrics`.
- Paint event count from CDP tracing.
- `transferredBytes` from the first route load.

- [ ] **Step 3: Record the baseline**

Run: `pnpm run perf --out docs/superpowers/perf/baseline.json`
Expected: JSON has all 12 combinations with nonzero `frameCount`. Note in the file's `meta` that headless uses software compositing.

- [ ] **Step 4: Commit** `chore: add perf measurement script and baseline`

---

### Task 2: Delete unused animated components (Haiku)

**Files:**
- Delete from `src/components/`: `TerminalComponents/LoadingScreen.astro`, `NavComponents/SidebarNav.astro`, `Forms/ContactFormSmall.astro`, `MouseToolTip.astro`, `SidebarButton.astro`, `SidebarOptions.astro`, `ExtraMenu.astro`, `widgets/Hero2.astro`, `widgets/Footer.astro`
- Do **not** delete `ui/Timeline.astro`, which `widgets/Steps.astro` uses.

Careful: `Layout.astro` imports `LoadingScreenV1` under the name `LoadingScreen`, and `PageLayout.astro` imports `SidebarNavV2` as `SidebarNav` and `components/Footer.astro` as `Footer`. Match on import paths, not names.

- [ ] **Step 1: Confirm no importers by path**

Run: `grep -rnE "(TerminalComponents/LoadingScreen|NavComponents/SidebarNav|ContactFormSmall|MouseToolTip|SidebarButton|SidebarOptions|ExtraMenu|widgets/Hero2|widgets/Footer|\./Hero2|\./Footer)" src tests`
Expected: matches only inside files on the delete list. Stop and report anything else.

- [ ] **Step 2: Delete the files**

- [ ] **Step 3: Verify**

Run: `pnpm run check && pnpm run test:e2e`
Expected: PASS, and the build reports no missing imports.

- [ ] **Step 4: Commit** `chore: remove unused animated components`

---

### Task 3: Engine core and failsafe (Sonnet)

**Files:**
- Create: `src/animation/core.ts`, `src/animation/keyframes.ts`, `src/animation/index.ts`, `src/components/common/FxBootstrap.astro`
- Modify: `src/layouts/Layout.astro`, `package.json`
- Test: `tests/engine.spec.ts`

**Interfaces:**
- Produces, from `core.ts`:
  - `motionAllowed(): boolean`
  - `fxTier(): 0 | 1 | 2 | 3`, read from `documentElement.dataset.fxTier` (default 0)
  - `onFxTierChange(fn: (tier: number) => void, signal?: AbortSignal): void`, listening for document event `fx-tier-change`
  - `onPage(init: (ctx: PageContext) => void): void`
  - `type PageContext = { signal: AbortSignal; cleanup(fn: () => void): void }`
- `onPage` runs `init` on each `astro:page-load` and calls cleanups and aborts `signal` on `astro:before-swap`. Run `init` inside `createScope().add()` and call `scope.revert()` in cleanup. Check whether `scope.revert()` also reverts `waapi` animations; if it doesn't, features register them through `ctx.cleanup`.
- Produces, from `keyframes.ts`: `flashesPerSecond(opacities: number[], durationMs: number): number`, which counts opposing pairs of opacity changes of at least 0.1.
- Produces, on `<html>`: class `motion-ok` when motion is allowed, plus attribute `data-fx-tier`.

- [ ] **Step 1: Write the failing tests** in `tests/engine.spec.ts`

```ts
test('blocked animation chunk still dismisses the loader and shows content', async ({ page }) => {
  // Abort every same-origin /_astro/*.js request.
  await page.goto('/');
  await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 8000 });
  await expect(page.locator('html')).not.toHaveClass(/motion-ok/);
  await expect(page.locator('main')).toBeVisible();
});

test('motion flag survives client-side navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/motion-ok/);
  await page.locator('#sidebar-nav a[href="/contact"]').click();
  await expect(page).toHaveURL(/contact/);
  await expect(page.locator('html')).toHaveClass(/motion-ok/);
});

test('reduced motion does not set the motion flag', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveClass(/motion-ok/);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm exec playwright test tests/engine.spec.ts --project=chromium`
Expected: FAIL. The first test may time out because the loader is stuck.

- [ ] **Step 3: Install and implement**

Run `pnpm add animejs`, then write the modules above.

`FxBootstrap.astro` is an `is:inline` script, mounted in `<head>` before `<CustomStyles />`:

- Guard with `window.__fxBootstrapped`.
- Add `motion-ok` if motion is allowed.
- Copy `sessionStorage['fx-tier']` to `data-fx-tier`, in try/catch.
- Reapply both on `astro:after-swap`.
- After 6000ms, if `window.__fxReady` is not set, hide `#loading-screen` and remove `motion-ok`.

`Layout.astro` adds `<script>import '~/animation/index';</script>`.

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm exec playwright test tests/engine.spec.ts --project=chromium`
Expected: PASS.

- [ ] **Step 5: Commit** `feat: add animation core, entry point and load failsafe`

---

### Task 4: Overlay (Sonnet)

**Files:**
- Create: `src/animation/overlay.ts`, `public/images/terminal-noise.png`
- Modify: `src/components/TerminalComponents/TerminalOverlay.astro`, `src/components/TerminalEffectsControls.astro`, `src/components/LoadingScreenV1.astro` (remove GIF from resource list), `src/components/common/CommonMeta.astro` (remove GIF preload, line 22), `src/layouts/Layout.astro` (`transition:persist` on the overlay)
- Delete: `public/images/terminal-static-animated.gif`
- Test: `tests/overlay.spec.ts`, `tests/effects.spec.ts`

**Interfaces:**
- Consumes: `motionAllowed`, `fxTier`, `onFxTierChange`.
- Produces: `startOverlay(): void`. It's idempotent and keyed on the element, so a persisted overlay keeps running instead of restarting. Call it from `index.ts` on `astro:page-load`, not through `onPage`, because the overlay outlives page swaps.
- Produces: document event `terminal-effect-change` with `detail: { effect: 'noise' | 'scanline' | 'overlay'; enabled: boolean }`, dispatched by `TerminalEffectsControls`. The `.hidden` class behavior stays, since existing tests assert it.

Values:

- Scanline: `waapi` `translateY(-100%)` to `translateY(100%)`, 2625ms `linear`, then held off-screen for 4875ms, looping (the current 7.5s cycle, sweeping for 35%).
- Noise: 256×256 seamless PNG generated once with `sharp` from random values. The layer is oversized by one tile on each side. `createTimer({ frameRate: 15 })` sets a random whole-pixel `transform` translate; at tier 2 and above use 8 fps. Start at opacity 0.02.
- Hidden effects cancel or pause their animations.
- `.terminal-overlay` gets `overflow: hidden; contain: strict`.
- Remove `@keyframes scan`.

- [ ] **Step 1: Write the failing tests**

In `tests/overlay.spec.ts`:

- `scanline animates transform only`: from `.scanline`, `getAnimations()` is non-empty and its keyframes' property names are only `transform` and bookkeeping keys.
- `toggling scanline off stops its animation`: open settings, click `label[for="scanline-effect"]`, and `getAnimations()` has no running entries.
- `noise layer moves by transform with no GIF requested`: `.noise` inline `transform` changes within 500ms, and no request matches `terminal-static-animated`.
- `overlay animation continues across navigation`: the scanline `currentTime` after a sidebar navigation is greater than before it.
- `overlay still animating after back/forward`: after `goBack`, `getAnimations()` is non-empty and `main` is visible.

In `tests/effects.spec.ts`, replace the `toHaveCSS('animation-name', 'scan')` line with an assertion that `.scanline` `getAnimations()` is non-empty. An explicit opt-in under reduced motion must still animate.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm exec playwright test tests/overlay.spec.ts tests/effects.spec.ts --project=chromium`
Expected: FAIL.

- [ ] **Step 3: Implement** the files above

If `transition:persist` breaks `effects.spec.ts` or restarts the animation, remove it, re-init per page, and drop the "continues across navigation" test, noting why in the commit.

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm exec playwright test tests/overlay.spec.ts tests/effects.spec.ts`
Expected: PASS on all four projects.

- [ ] **Step 5: Compare the look**

Screenshot old (a `main` build) and new at desktop and 390px, in all five themes. Tune noise opacity to match the old presence.

- [ ] **Step 6: Commit** `feat: run scanline and static on the compositor, remove 3.4 MB GIF`

---

### Task 5: Boot sequence and cheap glow (Sonnet)

**Files:**
- Create: `src/animation/boot.ts`
- Modify: `src/components/LoadingScreenV1.astro` (script moves out, leaving markup and styles), `src/animation/keyframes.ts`, `src/animation/index.ts`
- Test: `tests/boot.spec.ts`, `tests/limits.spec.ts`

**Interfaces:**
- Consumes: `motionAllowed`.
- Produces: `startBoot(): void`, and document event `loading-screen-end`. Remove the duplicate `loadingScreenComplete` dispatch, and remove its listener in `DecoderText.astro`.
- Produces, from `keyframes.ts`: `BOOT_FLICKER = { opacity: [0, 0.6, 0.2, 0.9, 0.5, 1], duration: 1200 }`.

Values:

- Glow: add `<div class="loading-glow" aria-hidden="true">` with the stronger `terminalPulse` shadow. Animate only its `opacity`, 0 to 1, 2000ms alternating, `ease-in-out`. Remove `@keyframes terminalPulse`.
- Progress: the bar is `w-full origin-left`, driven by `scaleX` over 300ms. Remove the `width` and `box-shadow` transitions and the JS `boxShadow` write. Shadow is clipped by the track's `overflow-hidden` anyway.
- First load of a session (`sessionStorage['fx-booted']` unset, in try/catch): `BOOT_FLICKER` on `.loading-container`, overlapping load. Then on completion: `scaleY` to 0.005 over 250ms, `scaleX` to 0 over 150ms, screen fades over 300ms. Total 700ms, under the 1.2s cap.
- Later reloads in the session: 300ms fade only.
- Reduced motion: hide immediately on completion, with no flicker or beam.
- Keep the 5000ms fallback. Hide `#loading-screen` on `astro:after-swap` so it doesn't flash on client-side navigation. Drop the GIF-specific status messages only if they no longer apply.

- [ ] **Step 1: Write the failing tests**

In `tests/boot.spec.ts`:

- `boot animates no shadow or width properties`: during load, `document.getAnimations()` keyframes contain none of `boxShadow`, `textShadow`, `width`, or `backgroundPosition`.
- `second reload in a session uses the short exit`: `sessionStorage['fx-booted']` is set after the first load, and `#loading-screen` hides within 800ms after `load` on reload.
- `loader never returns on client-side navigation`: after a sidebar click, `#loading-screen` is hidden and no `pageerror` fired.
- `navigating during boot leaves no stuck state`: click a sidebar link immediately after `load`, then assert `main` is visible, the loader is hidden, and there are no errors.

In `tests/limits.spec.ts` (no browser):

- `expect(flashesPerSecond(BOOT_FLICKER.opacity, BOOT_FLICKER.duration)).toBeLessThanOrEqual(3)`
- `flashesPerSecond` unit cases: `[0,1,0,1,0,1,0,1]` over 1000ms is above 3, and `[0,1]` over 1000ms is 0.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm exec playwright test tests/boot.spec.ts tests/limits.spec.ts --project=chromium`
Expected: FAIL.

- [ ] **Step 3: Implement** the files above

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm exec playwright test tests/boot.spec.ts tests/limits.spec.ts tests/animations.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit** `feat: add CRT boot sequence and opacity-only loader glow`

---

### Task 6: Modals, cursor, submit pulse (Sonnet)

**Files:**
- Create: `src/animation/ui.ts`
- Modify: `src/components/PopUpComponents/Modal.astro`, `src/components/PopUpComponents/ContactFormModal.astro`, `src/components/Forms/ContactFormFull.astro`, `src/components/TerminalComponents/TerminalPrefix.astro`, `src/animation/index.ts`
- Test: `tests/ui.spec.ts`

**Interfaces:**
- Produces, from `ui.ts`:
  - `modalIn(container: HTMLElement, content: HTMLElement): void`
  - `modalOut(container: HTMLElement, content: HTMLElement, done: () => void): void`
  - `pulse(el: Element): { cancel(): void }`
  - `startCursors(ctx: PageContext): void`
- `modalIn` also dispatches document event `modal-opened` with `detail: content`, which Task 9 consumes.

Values:

- Modal: container `opacity` 0 to 1; content `transform` `translate(-50%,-48%) scale(0.96)` to `translate(-50%,-50%) scale(1)`; both 300ms `ease-out`. Starting either direction cancels the other. `done` adds `hidden`. Reduced motion: no animation, and `done` runs immediately.
- Keep `Modal.astro`'s focus and tab handling unchanged. Focus moves right after `hidden` is removed, replacing the 10ms timer.
- Static modal shadow stays.
- Cursor: `.flashing` `opacity` 1 to 0, 1000ms, `steps(1)`, looping. If Anime.js rejects `steps()`, use a stepped keyframe equivalent at 12 keyframes or fewer. Not started under reduced motion. Remove `@keyframes flash`.
- Pulse: `opacity` 1, 0.5, 1 over 1500ms, `ease-in-out`, looping, on the `SENDING` span. Remove both `@keyframes pulse` blocks and their `.animate-pulse` rules, and rename that span class to `fx-pulse`.

- [ ] **Step 1: Write the failing tests** in `tests/ui.spec.ts`

- `modal opens and closes through waapi`: open `/contact`'s modal, content `getAnimations().length > 0` during opening, and `[role=dialog]` is visible afterwards.
- `rapid open and close settles correctly`: call open, close, open, close within one tick through the page's `window.open<id>Modal` functions; after 500ms the container has class `hidden` and no errors fired.
- `cursor blinks with one animation per cursor`: first `.flashing` `getAnimations().length === 1`, and 0 under reduced motion.
- `no CSS keyframes left in ui components`: `document.getAnimations()` on `/contact` includes no entry where `animationName` is `flash` or `pulse`.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm exec playwright test tests/ui.spec.ts --project=chromium`
Expected: FAIL.

- [ ] **Step 3: Implement** the files above

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm exec playwright test tests/ui.spec.ts tests/contact.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit** `feat: move modals, cursor and submit pulse to shared helpers`

---

### Task 7: Reveals (Sonnet for module, Haiku for class edits)

The design said `data-reveal`. This plan uses a `.reveal` **class**, because these strings pass through `class:list`, twMerge, and props where an attribute can't go.

**Files:**
- Modify: `src/animation/ui.ts`, `src/components/CustomStyles.astro` (hiding rule), `src/components/common/BasicScripts.astro` (delete the `Observer` script block only), `tailwind.config.js` (remove the `intersect` variant, the `fade` animation, and `fadeInUp`)
- Modify the class strings in: `blog/GridItem`, `blog/ListItem`, `blog/RelatedPosts`, `blog/SinglePost`, `ui/ItemGrid`, `ui/ItemGrid2`, `ui/Timeline`, `ui/WidgetWrapper`, `widgets/Hero`, `widgets/HeroText`, `widgets/Pricing`, `widgets/Stats`, `widgets/Testimonials`
- Test: `tests/ui.spec.ts`, plus a tall block and hash target added to `src/pages/review-fixtures/[fixture].astro`

**Interfaces:**
- Produces, from `ui.ts`: `startReveals(ctx: PageContext): void`.

Values:

- Class edit: remove `intersect-once`, `intersect-quarter`, `intercept-no-queue`, `motion-safe:md:opacity-0`, and `motion-safe:md:intersect:animate-fade`, and add one `reveal`.
- Hiding rule, only with the flag: `@media (min-width: 768px) { .motion-ok .reveal:not(.revealed) { opacity: 0; } }`
- Animation: `opacity` 0 to 1 and `translateY(2rem)` to `none`, 1000ms, `cubic-bezier(0.22, 1, 0.36, 1)`. Elements entering in the same batch are 100ms apart.
- Observer: threshold 0 with `rootMargin: '0px 0px -5% 0px'`, so tall elements always trigger. Once only.
- Below 768px or under reduced motion: add `.revealed` immediately, with no animation.
- On cleanup, mark all targets `.revealed` so nothing stays hidden.

- [ ] **Step 1: Write the failing tests**

- `reveal targets show after scrolling`: a `.reveal` on `/` reaches opacity 1 after `scrollIntoViewIfNeeded`.
- `reveal taller than 4 viewports appears`: the fixture's tall block reaches opacity 1.
- `hash link target appears`: goto `fixture#reveal-target` and it reaches opacity 1.
- `no-JS and reduced motion keep reveal targets visible`: opacity 1 without scrolling, in both modes.
- `navigating away mid-reveal then back shows content`: no element left at opacity 0 after return, and no errors.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm exec playwright test tests/ui.spec.ts -g reveal --project=chromium`
Expected: FAIL.

- [ ] **Step 3: Implement the module and CSS, then apply the class edits**

- [ ] **Step 4: Confirm nothing old remains**

Run: `grep -rnE 'intersect|intercept-no-queue|animate-fade|fadeInUp' src tailwind.config.js`
Expected: no matches.

- [ ] **Step 5: Run to verify**

Run: `pnpm run check && pnpm run test:e2e`
Expected: PASS.

- [ ] **Step 6: Commit** `feat: replace template intersect observer with shared reveals`

---

### Task 8: Heading decode (Sonnet)

**Files:**
- Create: `src/animation/decode.ts`
- Modify: `src/components/AnimationComponents/DecoderText.astro` (markup and data attributes only, with the script moved out), `src/pages/review-fixtures/[fixture].astro`, `tests/animations.spec.ts`, `src/animation/index.ts`
- Delete: `src/components/AnimationComponents/AnimationWrapper.astro`

**Interfaces:**
- Consumes: `onPage`, `motionAllowed`, `fxTier`, `loading-screen-end`.
- Produces: `startDecode(ctx: PageContext): void`, and `decodeElement(el: HTMLElement, opts: { duration: number; charDelay: number }): { cancel(): void }`, used by both auto headings and `DecoderText` triggers.

Values:

- Auto targets: `main h1, main h2` with no element children and no `data-no-decode`. Skip entirely at tier 3 or above, or under reduced motion.
- Auto timing: `duration` 400ms, with `charDelay` scaled so the total never exceeds 900ms.
- One shared timer at `frameRate: 20` drives all characters.
- Observe with a positive `rootMargin` so scrambling starts just before the heading is visible. Headings already in view wait for `loading-screen-end` when the loader is showing.
- Wait for `document.fonts.ready` before measuring.
- Try `scrambleText` first. If it fails the emoji or layout test, use grapheme-safe per-character spans with locked widths.
- During decode, set `aria-label` to the real text on the heading and `aria-hidden` on the animated content; remove both afterwards.
- `DecoderText` props stay: `text`, `as`, `className`, `delay`, `duration`, `charDelay`, `trigger`, `mobileDisable`. Move hover and click target from `.animation-wrapper` to the `.decoder-text` element itself.

- [ ] **Step 1: Update the tests**

In `tests/animations.spec.ts`:

- Replace `.animation-wrapper` locators with `.decoder-text`.
- Drop the `data-index` assertion if `scrambleText` wins.
- Keep every other assertion, including the emoji text, replay, in-view delay, `mobileDisable`, reduced motion, no-JS, and rapid navigation tests.

Add:

- `decode causes no layout shift`: with a `PerformanceObserver` on `layout-shift`, summed shift is under 0.01 on `/`, and a heading's bounding box is unchanged during decode.
- `headings stay accessible during decode`: `getByRole('heading', { name: <text> })` resolves at all times during decode.
- `html source contains real heading text`: `page.request.get('/')` body contains the heading text unsplit.
- `headings with links are skipped`: a fixture `<h2><a>…</a></h2>` never changes text.
- `each heading decodes once per page view`: text stays stable after scrolling away and back.
- `navigation mid-decode restores on return`: no scrambled text remains after `goBack`.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm exec playwright test tests/animations.spec.ts --project=chromium`
Expected: FAIL.

- [ ] **Step 3: Implement** the files above

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm exec playwright test tests/animations.spec.ts`
Expected: PASS on all four projects, including the WebKit emoji case.

- [ ] **Step 5: Commit** `feat: decode headings on one shared timer, merge AnimationWrapper`

---

### Task 9: Reactive and ambient glitches (Sonnet)

**Files:**
- Create: `src/animation/glitch.ts`
- Modify: `src/animation/keyframes.ts`, `src/animation/index.ts`
- Test: `tests/glitch.spec.ts`, `tests/limits.spec.ts`

**Interfaces:**
- Consumes: `motionAllowed`, `fxTier`, `onFxTierChange`, `onPage`, document event `modal-opened`.
- Produces: `startGlitches(): void`, called once, with delegated listeners on `document`; `glitch(el: Element): boolean`, returning false when rate limited; and `GLITCH_BURSTS` from `keyframes.ts`, each `{ opacity: number[]; translate?: string[]; clipPath?: string[]; duration: number }` with `duration` from 150 to 250.

Values:

- Each element carries a `data-fx-glitch` attribute while its burst runs, removed on finish or cancel. Tests count these.
- Limits: at most 3 running; at most 3 starts per rolling second, site-wide; 1000ms per-element cooldown.
- Inline elements: `transform` and `translate` don't apply to them, so if computed `display` is `inline`, use only `opacity` and `clip-path`. Never change `display`.
- Triggers:
  - `pointerover` on `a, button` when `(pointer: fine)`.
  - `modal-opened`.
  - `astro:before-preparation`, on the current page's first `main h1, main h2`.
- Ambient: a random 15000-30000ms delay, then a burst on one in-viewport element from `main h1, main h2, #sidebar-nav a`. Skip and reschedule if the tab is hidden or a scroll happened in the last 500ms.
- Tiers: ambient off at tier 1 and above; all reactive off at tier 2 and above.
- All off under reduced motion.

- [ ] **Step 1: Write the failing tests**

In `tests/glitch.spec.ts`:

- `hover triggers a short burst`: after hovering a nav link, its `getAnimations()` is non-empty, and all finished within 300ms.
- `hovering many links never exceeds 3 running`: sweep the mouse over all sidebar links, sampling `document.querySelectorAll('[data-fx-glitch]').length` each frame; the maximum is 3 or fewer.
- `glitches leave layout alone`: summed `layout-shift` under 0.01 during the hover sweep.
- `ambient fires within 30s on one visible element`: `page.clock` advanced by 30000ms, at least one `[data-fx-glitch]` element seen, and it is in the viewport. Advance on the clock rather than waiting in real time.
- `no glitches under reduced motion`: none after a hover sweep.
- `no glitches at tier 2`: set `data-fx-tier='2'` and dispatch `fx-tier-change`, and none after a hover sweep.

In `tests/limits.spec.ts`: every `GLITCH_BURSTS` entry has `duration` from 150 to 250, and `flashesPerSecond(entry.opacity, 1000)` of 1 or fewer, so 3 starts a second can't exceed 3 flashes.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm exec playwright test tests/glitch.spec.ts tests/limits.spec.ts --project=chromium`
Expected: FAIL.

- [ ] **Step 3: Implement** the files above

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm exec playwright test tests/glitch.spec.ts tests/limits.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit** `feat: add rate-limited reactive and ambient glitches`

---

### Task 10: Governor (Sonnet)

**Files:**
- Create: `src/animation/governor.ts`
- Modify: `src/components/CustomStyles.astro`, `src/animation/index.ts`
- Test: `tests/governor.spec.ts`

**Interfaces:**
- Consumes: document event `loading-screen-end`.
- Produces: `startGovernor(): void`. It writes `data-fx-tier` and `sessionStorage['fx-tier']`, and dispatches `fx-tier-change` with `detail: { tier }`. `localStorage['fx-tier-lock']` (`'0'` to `'3'`) sets that tier and disables measuring; Task 1's script and tests use this.

Values:

- Start 2000ms after `loading-screen-end`. Rolling 3000ms window of rAF gaps. A frame is long when its gap exceeds 50ms.
- Step down one tier when long frames exceed 25% of the window and the window has at least 20 frames, with 5000ms between steps.
- Reset the window when the tab becomes hidden, and ignore the first frame after it returns.
- Down only. Maximum tier 3.
- Stop the rAF loop at tier 3, or if locked.
- All storage access in try/catch.
- Tier 3 CSS: `html[data-fx-tier='3'] { --theme-glow: var(--theme-glow-subtle); --theme-glow-strong: var(--theme-glow-subtle); }`

Thresholds are starting values. Tune them only if the Step 5 run shows false step-downs.

- [ ] **Step 1: Write the failing tests** in `tests/governor.spec.ts`

- `sustained long frames step the tier down`: block the main thread in a page loop for about 8s, and `data-fx-tier` is at least 1.
- `steady 30fps does not step down`: a page rAF loop busy-waits so each frame takes about 33ms. Tier stays 0 after 8s.
- `hidden tab time does not count`: stub `document.visibilityState` to hidden, dispatch `visibilitychange`, block for 4s, restore it. Tier stays 0.
- `tier survives navigation and reload`: lock to 2, navigate, and `data-fx-tier` is `'2'`. Reload and it is still `'2'`.
- `tier 3 lightens glow`: lock to 3, and `body` computed `text-shadow` differs from tier 0.
- `governor never enables a disabled effect`: turn noise off, lock to 0, then 3. `.noise` still has `hidden`.
- `blocked storage does not break it`: with the `effects.spec.ts` storage stub, no `pageerror`.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm exec playwright test tests/governor.spec.ts --project=chromium`
Expected: FAIL.

- [ ] **Step 3: Implement** the files above

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm exec playwright test tests/governor.spec.ts`
Expected: PASS.

- [ ] **Step 5: Check for false step-downs**

Without the lock, load `/` in headless Chromium at 1x for 60s of idle.
Expected: `data-fx-tier` stays unset or `0`. Raise the threshold if it doesn't, and note the change.

- [ ] **Step 6: Commit** `feat: add long-frame governor with step-down tiers`

---

### Task 11: Cleanup, docs, final comparison (Haiku, with final perf judgment by the coordinator)

**Files:**
- Modify: `CLAUDE.md`, `AGENTS.md`, `src/components/ContentComponents/Skills.astro` (remove the unused `box-shadow` transition and empty hover rule), and any leftovers
- Create: `docs/superpowers/perf/final.json`, `docs/superpowers/perf/comparison.md`
- Test: `tests/boot.spec.ts`

**`CLAUDE.md` and `AGENTS.md` updates:**

- Replace "no test suite" with the Playwright suite and `pnpm run test:e2e`.
- Add a section on `src/animation/`, with the two tiers and the animate-only-these-properties rule.
- Remove references to the deleted live/dead pairs.

- [ ] **Step 1: Write the site-wide test**

`no route runs banned animation properties`: on `/`, `/contact`, and a project page, after load, a hover sweep, and a modal open, no `document.getAnimations()` keyframe contains `boxShadow`, `textShadow`, `filter`, `width`, or `backgroundPosition`. `::view-transition-*` pseudo-element animations are excluded, as they're out of scope.

- [ ] **Step 2: Run it, then fix anything it finds**

Run: `pnpm exec playwright test tests/boot.spec.ts -g banned --project=chromium`
Expected: PASS after fixes.

- [ ] **Step 3: Confirm no leftover keyframes in live code**

Run: `grep -rn '@keyframes' src tailwind.config.js`
Expected: only the `fade-in` and `fade-out` view-transition keyframes in `Layout.astro`.

- [ ] **Step 4: Measure and compare**

Run: `pnpm run perf --out docs/superpowers/perf/final.json`

Write `comparison.md` as a table of baseline against final for every route, mode, and throttle, plus bundle JS and page weight. Check it against the success bar: idle and scroll at 4x, with all effects on and the tier locked at 0, must beat the baseline. For any row that misses, apply the priority rule (make the effect cheaper, or cut it), re-measure, and record what was done.

- [ ] **Step 5: Final browser check**

In all five themes, on desktop and a phone viewport, watch boot, navigation, hover, modal, and scrolling. Check flash rate by eye. Run `wc -l src/animation/*` and confirm files are under 400 lines. Compare line and component counts against `main`.

- [ ] **Step 6: Run the full suite**

Run: `pnpm run check && pnpm run build && pnpm run test:e2e`
Expected: PASS, apart from anything recorded in `known-failures.md`.

- [ ] **Step 7: Commit** `docs: record final perf comparison and animation architecture`
