# Portfolio SEO implementation

Reviewed November 3, 2026. Goal: represent Alec Reimel for broad software developer roles, prioritizing US remote hiring inquiries. Preserve the terminal aesthetic and substantiate technical claims with public work.

## Implemented TODOs

- [x] Replace template About content with a factual personal profile.
- [x] Remove template services, pricing, and terms routes.
- [x] Replace demo privacy content and link it from both contact forms.
- [x] Add a text identity H1, employer contact links, and an HTML résumé at `/resume` with a downloadable original PDF.
- [x] Add the supplied employment timeline, education, and career outcomes to the résumé and About page.
- [x] Surface user-confirmed GitHub and LinkedIn profiles in visible links, Person schema, and `llms.txt`; keep freelance work secondary.
- [x] Correct project repository links mislabeled as live demos.
- [x] Rewrite analytics and scanner pages using public repository evidence; distinguish scanner plans from implemented code.
- [x] Replace stock imagery in those case studies with diagrams of the verified code.
- [x] Update existing articles, authorship, and internal project links.
- [x] Use page-specific metadata and a shorter title suffix.
- [x] Standardize canonical URLs on HTTPS www and preserve the root slash.
- [x] Configure canonical host redirects for Netlify and Vercel.
- [x] Keep robots crawling enabled and retain the build-generated sitemap reference.
- [x] Exclude styleguide, CMS, test fixtures, and retired routes from the sitemap; mark styleguide/error documents noindex.
- [x] Add safely serialized Person, WebSite, WebPage/ProfilePage, article/project, and visible breadcrumb structured data.
- [x] Add `/llms.txt` generated from the same project collection and canonical configuration.
- [x] Preserve Open Graph dimensions and support image alternative text.
- [x] Wire project routing/indexability settings to configuration and correct category links.
- [x] Add responsive WebP images with intrinsic dimensions and a reproducible generation script.
- [x] Use WOFF2 CSS fonts and preload both visible terminal fonts. Preserve the original boot font-progress downloads following the animation regression review.
- [x] Preserve the original full-screen terminal boot animation. The SEO commit's corner-badge redesign was reverted during the animation regression review (see `animation-regression-review.md`).
- [x] Fix long project-title wrapping and keep navigation readable on narrow or short screens.
- [x] Add SEO regression coverage, including safe serialization and client navigation.

## Evidence and content boundaries

- [ARDA Analytics](https://github.com/areimel/ARDA-Analytics) contains TypeScript browser services, GTM event integration, journey triggers, a demonstration application, and test definitions. These support implementation discussion, not unmeasured adoption or performance claims.
- [ARDA Site Scanner](https://github.com/areimel/ARDA-Site-Scanner) currently exposes a terminal application scaffold. Playwright auditing, crawling, and reporting are described as planned, not shipped.
- Public project dates are preserved; article update dates reflect these substantive edits.
- `/resume` summarizes the employment history, education, skills, and outcomes in Alec’s supplied 2026 résumé. The original PDF is served unchanged at `/resume/alec-reimel-resume-2026.pdf`. It lists a résumé contact email that differs from the original website email; the website email is retained pending Alec’s preference.
- LinkedIn (`https://www.linkedin.com/in/alecwreimel/`) and GitHub (`https://github.com/areimel`) were confirmed directly by Alec. Past employment is not marked as current in schema.
- Structured data mirrors public content. It does not promise rich results. `llms.txt` is an optional discovery aid, not a Google ranking improvement.
- The live public GTM container currently includes Google Analytics tags. No analytics account or container changes were made.

## Validation completed

- `pnpm run check`: Astro diagnostics, ESLint, and Prettier passed (zero Astro errors, warnings, or hints).
- `pnpm run build`: production build passed.
- Chromium regression run: 83 tests passed across SEO, contact forms, boot behavior, routes, themes, and UI animation.
- SEO suite across Chromium, Firefox, WebKit, and mobile: 72 tests passed.
- Browser checks cover 320px, 390px, and 768px layouts, no-JavaScript contact access, responsive images, and client-side metadata updates. The settings control also remained reachable on a 1024×600 viewport.
- Every generated local `href`/`src` destination resolved in the output; all 27 production JSON-LD blocks parsed successfully. All 82 responsive image files referenced by the manifest exist.
- `git diff --check` passed. Changes are local and have not been deployed.

## Résumé and profile follow-up validation

- Supplied résumé copied unchanged; source and public PDF SHA-256 match.
- `pnpm run check` and `pnpm run build` passed after adding résumé content and profile links.
- Updated SEO suite: 38 checks passed across Chromium and mobile, including PDF retrieval, LinkedIn/GitHub identity, education schema, `llms.txt`, and responsive layouts.
- Production output includes the downloadable PDF; the generated HTML scan found no missing local link or image destinations.

## Remaining TODOs requiring personal material or deployed services

- [x] Receive and integrate the current résumé/PDF, employment timeline, education details, and confirmed LinkedIn/GitHub URLs.
- [ ] Supply approved anonymized professional examples: personal contribution, tradeoffs, validation, and publishable outcomes.
- [ ] Deploy the reviewed changes; verify hosting redirects and retired-route status codes on the actual platform. Local Astro preview does not execute hosting redirect rules.
- [ ] Confirm Search Console ownership and submit `https://www.alecreimel.com/sitemap-index.xml`; inspect Google's chosen canonical and indexing for representative pages.
- [ ] Validate the deployed JSON-LD in Schema.org Validator and Google Rich Results Test.
- [ ] Confirm analytics tags/events in the connected GTM/GA accounts. Count successful hiring contact events, résumé engagement, and relevant search impressions; avoid collecting message content as analytics data.
- [ ] Measure deployed mobile pages with PageSpeed Insights and Search Console field data. Target LCP ≤2.5 seconds, INP ≤200 milliseconds, CLS ≤0.1 at the 75th percentile. Local animation benchmarks do not establish field Core Web Vitals.
- [ ] Review search impressions and employer inquiries after deployment; update content based on useful queries and actual hiring conversations.

## Hosting behavior

Vercel uses `trailingSlash: false`. Netlify applies CDN URL normalization before redirect rules; its redirect engine cannot safely add or remove trailing slashes with a path rule. Canonical tags remain consistent without a trailing slash, and deployed behavior must be checked on the actual host. See [Netlify redirect options](https://docs.netlify.com/manage/routing/redirects/redirect-options/).

## Maintenance

- After adding or replacing local images, run `pnpm run optimize:responsive` and commit both the generated images and `src/generated/responsive-images.json`.
- Font regeneration is documented in `scripts/generate-webfonts.py`; keep original font files and licensing metadata.
- Keep identity and availability consistent in About, the professional overview, visible project content, and public profiles. JSON-LD and `llms.txt` derive canonical URLs from configuration.
- Do not add empty category/tag archives. Enable them only when they provide useful distinct navigation and content.
- For changes, run `pnpm run check`, `pnpm run build`, and the relevant Playwright specs. SEO tests run with `pnpm exec playwright test tests/seo.spec.ts --project=chromium --workers=1`.
