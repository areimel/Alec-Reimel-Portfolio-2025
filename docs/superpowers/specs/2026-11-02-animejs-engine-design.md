# Anime.js animation engine: design and plan

## Context

The portfolio is an animation-heavy 80s CRT terminal. Alec wants real motion moved to Anime.js for better quality and performance, without overloading the browser. Lag has been felt during scrolling and general use, on phones and weaker devices, and with animated shadows or neon glow. The effects should stay, but run more efficiently.

Alec also wants the headroom spent on more glitch, and fewer components and lines of code overall.

**Review findings. These come from reading the code; nothing has been profiled yet.**

- Anime.js isn't installed. Live motion is a mix of CSS keyframes, CSS transitions, per-character `setTimeout` loops, and a template IntersectionObserver.
- Likely biggest costs, all in the always-on overlay (`TerminalOverlay.astro`) and base styles:
  - The static is a 3.4 MB full-screen animated GIF, which the loading screen also downloads as a "critical" resource.
  - The scanline animates `background-position`, repainting the full viewport.
  - All text inherits a blurred `text-shadow` from `body` (`CustomStyles.astro`). It's static, but expensive to rasterize.
- The only live animated shadow found is the loading box's `terminalPulse` (`box-shadow`), plus the progress bar's `width` and `box-shadow` transitions.
- `DecoderText` runs a separate timer per character and is only used by the test fixture page.
- A Playwright suite exists (`tests/`), although `CLAUDE.md` and `AGENTS.md` say there are no tests. `effects.spec.ts` asserts the CSS animation name `scan`, so it must change.

## Goals

- Run all real motion through one shared Anime.js layer.
- Smoother scrolling and idle behavior, especially on phones and weak devices, measured against a baseline taken before any changes.
- Keep every existing effect, including glow, and make each one cheaper.
- Add the new glitch effects listed below.
- Finish with fewer components and fewer lines, with files under 300-400 lines.

## Non-goals

- Whole-screen random tears or dropouts. These were offered and not chosen.
- Moving simple hover and color transitions, or the browser's `::view-transition-*` CSS, to Anime.js.
- Theme, layout, or content redesign, and migrating unused code.
- Merging the near-duplicate contact form scripts (`ContactFormModal`, `ContactFormFull`), beyond their animation code.

## Anti-goals (failure even if it technically works)

- Scrolling or idle is measurably worse than the baseline.
- Text becomes hard to read, or content is invisible without JS or with reduced motion.
- Glitches shift the layout, or decoding breaks screen readers or SEO text.
- Rapid or high-contrast full-screen flashing. Hard limit: no more than 3 flashes per second (WCAG 2.3.1).
- A slow boot sequence that keeps people from the content.

## Decided by Alec

- Scope: all real motion. Simple hover and color transitions and page-transition CSS stay as they are.
- Static: replace the GIF with tiled noise, with Anime.js jumping its position at a capped rate.
- Glitch: push it further with reactive glitches, heading decode, and CRT power-on/off.
- Unprompted glitch rate: occasional, a short burst every 15-30 seconds.
- Weak devices: dial back automatically based on measured performance.
- Unused animated components: delete once confirmed unused.

## Design (Claude's calls, open to correction)

### Two tiers, chosen per effect

Docs confirm WAAPI can run off the main thread for `opacity` and `transform`, while `animate()` runs in JS.

| Tier       | API                                                                | Use for                                                           |
| ---------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Compositor | `waapi.animate` from `animejs/waapi`, with CSS-string easings only | Scanline, cursor blink, reveals, modals, glow pulses, boot motion |
| JS engine  | `createTimer` / `animate` with a low `frameRate`                   | Noise position steps, text decoding, glitch scheduling            |

Docs note that JS easings prevent WAAPI acceleration everywhere, and that `linear()` and power eases like `out(3)` prevent it in Safari. Use `cubic-bezier()` strings or named CSS easings. Use subpath imports to keep the bundle small.

### Shared module: `src/animation/`

Keep each file small and single-purpose. Start from these and merge any that end up trivially thin:

- `core.ts`: motion and effect checks, `onPage(init)` lifecycle helper, effect constants.
- `governor.ts`: performance tiers.
- `overlay.ts`: scanline and noise.
- `boot.ts`: loading screen and CRT sequence.
- `decode.ts`: heading scramble.
- `glitch.ts`: reactive and ambient glitches.
- `ui.ts`: reveals, modal in/out, cursor blink, submit pulse.
- `index.ts`: single entry point, loaded once from `Layout.astro`.

**Lifecycle:** `onPage` runs an init on `astro:page-load` inside a `createScope`, then reverts it on `astro:before-swap`. Every feature uses this instead of its own listeners and cleanup. Interaction uses document-level delegation, so listeners survive page swaps. Try `transition:persist` on the overlay so the scanline and static don't restart on navigation, and fall back to re-init if it misbehaves.

### Effect conversions

- **Scanline:** a gradient layer animated with `translateY` plus idle gap, matching the current 7.5s cycle (sweep for 35%, then idle). Overlay gets `overflow: hidden` and `contain`.
- **Static:** a small seamless noise tile, committed as an optimized image in `public/images/`, on an oversized layer, with a `transform` jump at about 12-15 fps. Start at the current 0.02 opacity and tune it until it matches the GIF's visual presence side by side, since an exact match isn't possible. Delete the GIF and remove it from the loader's resource list.
- **Glow:** render shadows once on a separate layer and animate that layer's `opacity`. Never animate `box-shadow` or `text-shadow`. Applies to `terminalPulse` and the progress bar, whose fill also moves from `width` to `scaleX`.
- **Static text glow:** unchanged at full tier. It's only lightened at the lowest governor tier.
- **Cursor blink:** `waapi` opacity with `steps()`. Confirm Anime.js accepts `steps()`, and otherwise use a stepped keyframe equivalent.
- **Modals:** shared `waapi` in/out helpers replace the CSS transitions and the 10ms/300ms timers in `Modal.astro`. Rapid open and close must stay safe, and existing focus handling must not change.
- **Reveals:** a `.reveal` class plus one observer replaces the `is:inline` Observer in `BasicScripts.astro`, the Tailwind `intersect` variant, `animate-fade`, and its 27 class usages. A small inline head script hides reveal targets only when JS is on and motion is allowed, so content stays visible without JS.
- **Form submit pulse:** one shared helper replaces the duplicated `pulse` keyframes.

### New effects

- **Heading decode:** automatically applies to `main h1, main h2`, including MDX and blog content, once per page view, in view only. Headings containing child elements such as links or emphasis are skipped, and `data-no-decode` opts one out. One shared timer at about 20 fps drives all characters. Try Anime.js `scrambleText` first, and keep per-character handling only if it fails emoji or layout tests. Requirements: real text in the HTML, readable by screen readers, and no layout shift. Merge `AnimationWrapper` into `DecoderText` and update the fixture page and tests. Use the `dry-coding` skill's Rule of Three before keeping any abstraction.
- **Reactive glitches:** 150-250ms bursts using only `transform`, `opacity`, and `clip-path`, in theme colors. Triggers are link and nav hover (fine pointers only), modal open, and page change. At most 3 running at once.
- **Ambient glitch:** every 15-30 seconds, a short burst on **one visible heading or nav element**. This is how the chosen rate fits with whole-screen disturbances not being selected. It pauses during scrolling and when the tab is hidden.
- **CRT boot:** on load, flicker on, run the loader, collapse to a beam, then expand to the page. The flicker overlaps the loader rather than delaying it. The collapse and expand add at most about 1.2s to the time content becomes visible on the first load of a session, with a shortened version for later full reloads in that session. The 5s loader fallback stays. Power-off appears only as this beam collapse, not on every navigation. The flicker counts toward the 3-flashes-per-second limit.

### Governor

`governor.ts` tracks the share of long frames (over 50ms) in a rolling window, ignoring hidden tabs and initial load. Using long frames rather than average fps means a steady 30 fps from Low Power Mode isn't treated as failure. Tuning thresholds is part of the work.

It sets `data-fx-tier` on `<html>`, steps down only, and stores the tier in `sessionStorage`:

1. **Tier 1:** no ambient glitches.
2. **Tier 2:** no reactive glitches, and slower static.
3. **Tier 3:** decode off, and lighter text glow via the existing `--theme-glow-subtle`.

The governor never turns on anything the user has turned off, and storage failures must not break it (see `effects.spec.ts`).

### Accessibility and preferences

- Reduced motion: no boot sequence, decoding, glitches, or reveals. Existing per-effect opt-ins still work.
- `terminal-effect-*` toggles still control the overlay and now also pause its animations.
- Without JS, everything stays readable and the loader stays hidden.

### Unused code to remove

Resolved-import scan from every page and content file confirms these are unused: `TerminalComponents/LoadingScreen`, `NavComponents/SidebarNav`, `Forms/ContactFormSmall`, `MouseToolTip`, `SidebarButton`, `SidebarOptions`, `ExtraMenu`, `widgets/Hero2`, `widgets/Footer`. `SidebarOptions` and `ExtraMenu` were added because they only exist to import other files on this list. `ui/Timeline` stays: `widgets/Steps` uses it.

## Execution

See `docs/superpowers/plans/2026-11-02-animejs-engine.md`.

## Verification

- **Baseline first:** a Playwright/CDP script in `scripts/` records long frames, main-thread time, and paint on `/`, a project page, and `/contact`, while idle and scrolling, at 1x and 4x CPU throttle, in Chromium.
- **After every step:** `pnpm run check` and `pnpm run test:e2e` (Chromium, Firefox, WebKit, mobile).
- **New tests:**
  - Scanline moves by transform, and effect toggles stop it.
  - No `box-shadow` or `text-shadow` animations are running.
  - Decode causes no layout shift and leaves accessible text intact.
  - Reduced-motion and no-JS paths stay readable.
  - Rapid navigation produces no errors or leftover animations.
  - Governor tier changes respect user toggles.
- **Visual check in a browser:** all five themes, side by side with the old static and scanline, on desktop and phone viewports. Also check flash rate by eye against the 3-per-second limit.
- **Flash check:** a test reads the boot and glitch keyframes and fails above 3 flashes per second, alongside the by-eye check.
- **Success bar:** with all effects on and the governor locked at full tier, final numbers beat the baseline for idle and scrolling at 4x throttle, so the governor can't hide a regression. **If an effect and the bar conflict, performance wins:** make the effect cheaper, or cut it and say so. Report actual numbers, including anything that didn't improve. Real-phone feel can't be confirmed from here, so Alec should check on a phone.
