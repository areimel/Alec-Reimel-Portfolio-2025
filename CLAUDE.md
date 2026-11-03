# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is pnpm. Verification is `pnpm run check`, `pnpm run build`, and the Playwright suite in `tests/` (`pnpm run test:e2e`, which builds with `REVIEW_TEST_FIXTURES=1` into `.test-dist` and serves it on port 4399; projects: chromium, firefox, webkit, mobile). The suite is large, so on a constrained machine run single specs with `pnpm exec playwright test tests/<file>.spec.ts --project=chromium --workers=1`.

```bash
pnpm run dev              # dev server at http://localhost:4321
pnpm run dev-host         # same, exposed on the network
pnpm run build            # static build to dist/
pnpm run preview          # serve the build
pnpm run test:e2e         # build + full Playwright suite (4 browser projects)
pnpm run perf --out <file.json>  # perf measurement, ~15 min; records in docs/superpowers/perf/

pnpm run check            # astro check + eslint + prettier --check
pnpm run check:astro      # or check:eslint / check:prettier individually
pnpm run fix              # eslint --fix + prettier -w

pnpm run optimize:preview # compress public/preview.png for OpenGraph
pnpm run optimize:images  # batch-optimize images
pnpm run optimize:og      # OpenGraph optimization
pnpm run optimize:file ./public/hero.png --og   # a single file
```

## Architecture

An Astro 5 static site with an "80s lo-fi computer terminal" look, built on the AstroWind template. Deployed to Netlify from `dist/` (`netlify.toml`).

### AstroWind leftovers

Much of `src/components/widgets/` and `src/components/ui/`, and pages like `pricing.astro` and `services.astro`, come from the template. Check what is actually imported before editing a component, because several have live and dead versions side by side:

- `PageLayout.astro` uses `SidebarNavV2.astro` for navigation (no header) and `components/Footer.astro`.
- `Layout.astro` uses `LoadingScreenV1.astro`.

### Layouts and page lifecycle

`Layout.astro` is the root: it mounts the theme styles, loading screen, and CRT overlay on every page, and enables View Transitions through `<ClientRouter>`. Because of client-side navigation, a script that touches the DOM must re-initialize on `astro:page-load` or `astro:after-swap`, or it stops working after the first navigation. `Layout.astro` also dispatches a custom `page-transition-complete` event.

### Animation engine (`src/animation/`)

All motion is driven from `src/animation/` (Anime.js, subpath imports only: `animejs/waapi`, `animejs/timer`, `animejs/scope`). `index.ts` is the entry point loaded by `Layout.astro`; it sets `window.__fxReady`, and a bootstrap failsafe fires if the chunk fails to load. `onPage(init)` in `core.ts` re-runs a feature on every `astro:page-load` inside an Anime.js scope and releases it on `astro:before-swap`. `keyframes.ts` is pure data and must not import the DOM or animejs.

- **Two tiers, chosen per effect.** The compositor tier uses `waapi.animate` with CSS-string easings only (`linear`, `ease-out`, `cubic-bezier()`, `steps()`; never `linear()`, `out(3)` or JS easings) for the scanline, cursor blink, reveals, modals, glows and boot motion. The JS tier uses `createTimer` with a low frame rate for noise steps, text decoding and glitch scheduling.
- **Animate only `transform`, `translate`, `scale`, `opacity` and `clip-path`.** Never animate `box-shadow`, `text-shadow`, `filter`, `width` or `background-position`. `tests/boot.spec.ts` enforces this on `/`, `/contact` and a project page.
- **No new CSS `@keyframes`.** The only ones allowed are `fade-in` and `fade-out` (view transitions, `Layout.astro`) and `loadingGlow` (`LoadingScreenV1.astro`). The glow stays in CSS because the loader paints before the Anime.js chunk arrives.
- **Governor (`governor.ts`).** Sets `data-fx-tier` on `<html>` and only steps down, when too many frames are long; the tier is kept in `sessionStorage` (`fx-tier`). Tier 1: no ambient glitches. Tier 2: no reactive glitches and noise at 8 fps instead of 15. Tier 3: text decoding off. `localStorage['fx-tier-lock']` (`0`-`3`) pins a tier and disables measuring; the perf script locks tier 0.
- Reduced motion disables the boot sequence, decoding, glitches and reveals; explicit `terminal-effect-*` opt-ins still work.
- `ClientRouter` replaces `<html>` attributes and classes on every swap, so anything stored on `<html>` (including `data-fx-tier`) must be reapplied on `astro:after-swap`.

### Theme system

Five themes exist: `green` (default), `amber`, `cyber`, `cyber-yellow`, and `severance`. They work as a chain:

1. `CustomStyles.astro` defines a `.theme-*` class per theme, setting `--theme-*` variables, then maps them to `--terminal-*`.
2. `tailwind.config.js` exposes those as `terminal-*` and `terminal-bg-*` color utilities.
3. `ApplyColorMode.astro` applies the saved theme inline in `<head>` to prevent a flash, and `Layout.astro` preserves it across view transitions.

Always style with these theme-aware classes rather than fixed colors, so components work under all five themes; `/styleguide` (`src/pages/styleguide.astro`) shows the palette.

Adding or renaming a theme means updating every place that hardcodes the list: `CustomStyles.astro`, `ThemeSwitcher.astro`, `ApplyColorMode.astro`, `Layout.astro`, and `BasicScripts.astro`.

The selected theme is stored in `localStorage.theme`, a key that AstroWind's light/dark logic in `ApplyColorMode.astro` also reads. Terminal effect toggles are stored under `terminal-effect-*`.

### Configuration

`src/config.yaml` is loaded by the local integration in `vendor/integration/` and exposed as the virtual module `astrowind:config` (`SITE`, `I18N`, `METADATA`, `APP_BLOG`, `UI`, `ANALYTICS`).

Projects were added on top of the template and are not wired into this: `configBuilder.ts` does not read the `apps.projects` block in `config.yaml`. Project route flags, robots, and base paths are hardcoded in `src/utils/projects.ts` and `src/utils/permalinks.ts`, so change them there.

### Content and routing

Two collections are defined in `src/content/config.ts`, whose loaders read from `src/data/`, not `src/content/`:

- `post`: `src/data/post/*.md(x)`, served at the root (`/%slug%`), with lists at `/blog`.
- `project`: `src/data/projects/*.mdx`, served at `/projects/<slug>`. These import components such as `ProjectComponents/TextAndImage.astro` and `ProjectStats.astro` directly in the MDX.

In `src/pages/[...blog]/` and `src/pages/[...projects]/`, `index.astro` renders a **single item** and `[...page].astro` renders the **paginated list**. Data access goes through `src/utils/blog.ts` and `src/utils/projects.ts`.

### Conventions

- **Imports:** `~/` maps to `src/` and is what the code overwhelmingly uses. `@components/`, `@layouts/`, `@assets/`, `@content/`, `@utils/`, and `@styles/` also exist. There is no `@data/` alias.
- **Component styles:** keep CSS in a `<style>` tag inside the component. Use Tailwind utilities first, and `@apply` once three or more elements share the same classes.
- **Tailwind base styles are disabled** (`applyBaseStyles: false`); base styles live in `src/assets/styles/tailwind.css`.
- **Images are not processed at build time** (`passthroughImageService`). Project content references files in `public/` by absolute path, so optimize them with the `optimize:*` scripts.
