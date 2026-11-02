# Testing and bug fixes — review-2026

## TODO

- [x] Review themes, components, animations, and validation with three parallel reviewers.
- [x] Create `review-2026` and preserve pre-existing local changes.
- [x] Repair theme defaults, storage migration, and navigation.
- [x] Resolve Astro and ESLint errors; isolate formatting cleanup.
- [x] Repair animation, modal, tooltip, effect, form, and navigation behavior.
- [x] Complete cross-browser tests and final validation.

## Changes for review

| Priority | Finding                                                                      | Implemented change                                                                                                     |
| -------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| High     | Saved `light`, `dark`, or invalid themes removed every supported palette     | Validate terminal IDs; migrate light/dark into `color-scheme`; preserve valid terminal selections                      |
| High     | Default theme was green; missing palette tokens yielded monochrome styling   | Severance Blue server default, head initialization, and CSS root fallback                                              |
| High     | Unavailable browser storage interrupted theme/effect initialization          | Guard storage and retain selections in memory                                                                          |
| High     | Theme buttons stopped responding after Astro navigation                      | Delegated theme handling, incoming-document theme application, synchronized selection and ARIA state                   |
| High     | BasicScripts had an illegal top-level return                                 | Wrap initialization in a function so browser scripts can execute                                                       |
| High     | Astro reported 19 errors and ESLint reported 25                              | Repair syntax, imports, SVG contracts, image types, GTM creation, declarations, and lint failures                      |
| High     | Image metadata could become an invalid `[object Object]` URL                 | Normalize metadata sources before rendering                                                                            |
| Medium   | Decoder work survived navigation; wrapper triggers were broken               | One animation controller with timer/observer cleanup, replay, and one delay                                            |
| Medium   | Decoder content depended on JavaScript and contained extra character spacing | Visible server text, exact character content, reduced-motion/mobile bypass, Unicode offsets                            |
| Medium   | Modals and tooltips accumulated lifecycle handlers                           | Abort listeners and clean up timers/observers; restore focus and trap Tab in open dialogs                              |
| Medium   | Contact forms accepted HTTP 200 application rejections as success            | Require successful API result, preserve rejected input, prevent duplicate/concurrent submission, ignore detached forms |
| Medium   | Effect controls failed with blocked storage and ignored reduced motion       | Guard preferences and preserve in-memory choices across navigation; moving effects default off for reduced motion      |
| Medium   | Detail-page navigation used the wrong route prefixes                         | Supply explicit blog/projects section context through the layout                                                       |
| Medium   | Production preload links referenced unpublished `/src/` files                | Remove source preloads; provide the expected local icon directory                                                      |
| Medium   | Loading overlay obscured content with JavaScript disabled                    | Hide loader in noscript mode; disable its pulse for reduced motion                                                     |
| Low      | Existing formatting debt obscured functional changes                         | Separate repository formatting commit; preserve pre-existing user edits                                                |
| Medium   | Facts cards and skill headings overflowed phone/tablet viewports             | Use constrained grid tracks and responsive heading sizes                                                               |
| Medium   | VR article referenced three missing placeholder images                       | Remove broken embeds while preserving article text                                                                     |
| Low      | Form focus rings and modal shadows referenced undefined color variables      | Use existing terminal palette tokens                                                                                   |

## Validation

Baseline: build passed (17 pages); Astro had 19 errors, ESLint 25, Prettier flagged 85 files.

| Validation          | Result                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| `pnpm run check`    | Pass: zero Astro errors/warnings; ESLint and Prettier pass. Seven legacy type-inference hints remain. |
| `pnpm run build`    | Pass: 17 pages; no test fixtures in production output.                                                |
| `pnpm run test:e2e` | Pass: 216 tests across Chromium, Firefox, WebKit, and mobile WebKit; zero failures or retries.        |
| Responsive checks   | Pass at 320, 390, 768, 800, and 1024px across Chromium, Firefox, WebKit, and mobile WebKit.           |

Browser tests cover theme storage migration/fallback, all palettes, blocked storage, navigation/history, CSS/no-JavaScript fallback, animations, reduced motion, forms, effects, emitted routes, assets, and responsive sizing. External analytics are isolated; contact responses are mocked, so these checks do not verify backend delivery.

The initial cross-browser run exposed WebKit timing limits; repeated standalone navigation completed in 188–297ms without errors. Navigation tests now have explicit budgets for their multiple transitions, with automatic retries disabled.

Run `pnpm run check`, `pnpm run build`, and `pnpm run test:e2e`.
Install browser binaries and operating-system dependencies with `pnpm exec playwright install --with-deps` on a fresh test machine.
The browser suite builds separate `.test-dist` output with animation fixtures enabled. Normal production builds exclude these fixtures.
Tests mock contact submissions; no messages are sent. Homepage screenshots and failure traces are written under ignored `test-results/`.

## Commit checkpoints

1. Add Playwright theme regression coverage.
2. Make Severance the validated theme fallback.
3. Keep theme controls working across navigation.
4. Resolve diagnostics and repair image prop handling.
5. Repair decoder timing and navigation cleanup.
6. Unify animation wrapper trigger behavior.
7. Clean up modal and tooltip navigation handlers.
8. Repair forms, effect preferences and route indicators.
9. Format existing repository files.
10. Complete browser regression coverage and review report.

Existing local edits to `CLAUDE.md`, `AGENTS.md`, and `pnpm-workspace.yaml` are excluded from session commits. No deployment is included.
