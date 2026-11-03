# Repository Guidelines

## Project Structure & Module Organization

This is an Astro 5 portfolio built on AstroWind, using TypeScript and Tailwind CSS with a retro terminal aesthetic.

- `src/pages/` defines routes; `src/layouts/` provides shared page shells.
- `src/components/` contains reusable Astro components, grouped by feature (for example, `TerminalComponents/`, `ProjectComponents/`, and `blog/`).
- `src/data/post/` holds Markdown blog posts; `src/data/projects/` holds MDX projects. Collection schemas live in `src/content/config.ts`.
- `src/assets/` contains processed assets and Tailwind styles; `public/` contains directly served images, fonts, and Decap CMS files. Additional font styles live in `src/styles/`.
- `src/utils/` contains shared helpers; `vendor/integration/` contains AstroWind configuration integration.
- Site settings and navigation live in `src/config.yaml` and `src/navigation.ts`.

## Build, Test, and Development Commands

Use pnpm for development:

- `pnpm install`: install dependencies.
- `pnpm run dev`: start the local server at `http://localhost:4321`.
- `pnpm run build`: generate the production site in `dist/`.
- `pnpm run preview`: serve the production build locally.
- `pnpm run check`: run Astro diagnostics, ESLint, and Prettier checks.
- `pnpm run fix`: apply ESLint and Prettier fixes across the repository; review the resulting diff.
- `pnpm run optimize:preview`: preview image optimization opportunities.

## Coding Style & Naming Conventions

Follow `.prettierrc.cjs`: two-space indentation, single quotes, semicolons, a 120-character print width, and ES5 trailing commas. ESLint covers JavaScript, TypeScript, and Astro files.

Use PascalCase for Astro components (such as `ProjectHeader.astro`), camelCase for utilities, and kebab-case for content filenames. Keep Astro frontmatter at the top. Prefer configured import aliases such as `@components/`, `@layouts/`, and `~/`. Reuse existing Tailwind theme settings and terminal styles.

## Testing Guidelines

Playwright tests live in `tests/` (`pnpm run test:e2e` builds to `.test-dist` and runs chromium, firefox, webkit and mobile projects; no coverage threshold is configured). Run `pnpm run check`, `pnpm run build`, and the specs relevant to your change before submitting. On a memory-constrained machine, run single specs with `pnpm exec playwright test tests/<file>.spec.ts --project=chromium --workers=1`. Preview affected routes and verify responsive layouts, theme switching, animation controls, and contact forms when relevant. Match content frontmatter to the collection schemas.

## Commit & Pull Request Guidelines

History uses short, descriptive messages without a mandatory prefix, such as `updated SEO config`. Keep commits focused and describe the change clearly.

For pull requests, summarize the purpose, list validation performed, link relevant issues, and include screenshots for visual changes. Note any content, configuration, or deployment impact.
