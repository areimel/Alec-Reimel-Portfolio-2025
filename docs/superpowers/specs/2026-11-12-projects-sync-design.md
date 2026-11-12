# Projects sync with bio.alecreimel.com: design

Date: 2026-11-12 · Branch: `content/new-projects`

## Intent

The portfolio's Projects section should show the same projects, in the same order, as the quick-bio landing page (https://bio.alecreimel.com/, repo `areimel/bio-link-2026`). Each page is written from the project's actual repository, not from the bio blurb, and claims only what the code does (see `docs/seo-content-notes.md`).

## Project set and order

| order | slug                     | repo                            | live / package                                        |
| ----- | ------------------------ | ------------------------------- | ----------------------------------------------------- |
| 1     | `ai-hub`                 | areimel/alec-ai-hub             | ai-hub.alecreimel.com                                 |
| 2     | `ccstatusboard`          | areimel/ccstatusboard           | areimel.github.io/ccstatusboard · npm `ccstatusboard` |
| 3     | `arda-analytics`         | areimel/ARDA-Analytics          | arda-analytics.netlify.app                            |
| 4     | `arda-site-scanner`      | areimel/playwright-site-scanner | npm `arda-site-scan`                                  |
| 5     | `local-company-template` | private, so no links            | none                                                  |
| 6     | `node-bonsai`            | areimel/node-bonsai             | areimel.github.io/node-bonsai                         |

## Decisions

- **Removed:** `bio-link` and `company-ai-prompts` (owner's call). 301s in `netlify.toml`: `/projects/bio-link` → `/projects`, and `/projects/company-ai-prompts` → `/projects/ai-hub` (AI Hub succeeds it).
- **ARDA Site Scan:** `areimel/ARDA-Site-Scanner` is a single-commit Ink template scaffold, and the real tool is `areimel/playwright-site-scanner`. The page keeps the `arda-site-scanner` slug for URL and test stability, but its content and repo link now point at the real tool.
- **Ordering:** the new optional `order` field in the project schema (`src/content/config.ts`) sorts ascending in `src/utils/projects.ts`. Projects without one fall back to newest-first. `publishDate` keeps the real first-commit dates, so nothing is backdated just to sort.
- **Private repo:** Local Company Template is written as a case study, with no repo links, no client data, and "source available on request".
- **Images:** card images for 4 projects come from the bio site's assets. Each new diagram is a hand-written 1200×630 SVG with a WebP copy, in the existing ARDA diagram style.
- **Unverified README claims are left out**, for example the "AI-powered" summary and broken-link detection in Site Scan, and homelab hosting for AI Hub (the code deploys to GitHub Pages).

## Non-goals

- No redesign of the project templates or components.
- No changes to the bio site itself.
