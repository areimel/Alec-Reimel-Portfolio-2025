# Known failures on the untouched branch (Task 1)

Recorded before any animation changes, on `feat/animation-engine` at 1322f6d.

- `pnpm run test:e2e`: 216 passed, 0 failed (chromium, firefox, webkit, mobile).
- `pnpm run check`: `astro check` 0 errors, 0 warnings (7 hints in `LoadingScreenV1.astro` and `TerminalComponents/LoadingScreen.astro`); eslint clean.
- `pnpm run check:prettier` fails on 7 pre-existing docs files (Prettier formatting only):
  - `.superpowers/sdd/2026-11-02-animejs-engine/constraints.md`
  - `.superpowers/sdd/2026-11-02-animejs-engine/implementer-rules.md`
  - `.superpowers/sdd/2026-11-02-animejs-engine/progress.md`
  - `.superpowers/sdd/2026-11-02-animejs-engine/reviewer-rules.md`
  - `.superpowers/sdd/2026-11-02-animejs-engine/task-1-brief.md`
  - `docs/superpowers/plans/2026-11-02-animejs-engine.md`
  - `docs/superpowers/specs/2026-11-02-animejs-engine-design.md`

Not fixed here; they are planning documents outside this task's scope.
