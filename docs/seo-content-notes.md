# SEO content implementation notes

Reviewed November 3, 2026. Public source was inspected read-only; the external repositories were not changed, built, or tested.

## Verified project evidence

- [ARDA Analytics orchestration service](https://github.com/areimel/ARDA-Analytics/blob/HEAD/plugin/src/analytics.service.ts): TypeScript modules coordinate UTM capture, form helpers, GTM forwarding, and journey triggers.
- [ARDA Analytics GTM module](https://github.com/areimel/ARDA-Analytics/blob/HEAD/plugin/src/analytics-micro-services/gtm-event-push.ts): pushes `CustomEvent` with `eventLabel` to the data layer. The portfolio describes this actual wire shape without promising automatic reporting configuration.
- [ARDA Analytics tests](https://github.com/areimel/ARDA-Analytics/blob/HEAD/plugin/src/__tests__/index.test.js): Jest definitions cover initialization, configuration, event handling, and cleanup. Test presence is described without a claim that the suite was run or passed.
- [ARDA Analytics repository](https://github.com/areimel/ARDA-Analytics): separate plugin and React website directories.
- [ARDA Site Scanner CLI](https://github.com/areimel/ARDA-Site-Scanner/blob/HEAD/src/cli.tsx), [UI](https://github.com/areimel/ARDA-Site-Scanner/blob/HEAD/src/ui.tsx), and [manifest](https://github.com/areimel/ARDA-Site-Scanner/blob/HEAD/package.json): current public source is a ts-ink-template greeting application. No Playwright dependency or scanning implementation was present. The portfolio now labels it in progress and distinguishes planned features from the current scaffold.
- [AI Prompt Directory repository](https://github.com/areimel/company-ai-prompts): README documents Astro, Tailwind CSS, content collections, prompt pages, browsing, and templating. No adoption figures or quantified outcomes were added.
- [Bio-Link repository](https://github.com/areimel/Bio-Link): README still uses AstroWind template documentation. Existing portfolio project intent is retained, without treating template benchmark scores as Alec's results.

Architecture diagrams for Analytics and Site Scanner are original SVG assets derived from the inspected code, with WebP display copies. They are diagrams, not screenshots of running software. The scanner diagram explicitly labels the implemented scaffold and planned scanning functionality.

## Content changes

- Replaced the fictitious organization/about page with a factual personal biography.
- Expanded `/resume` with employment dates, roles, employers, education, and outcomes from Alec’s supplied 2026 résumé. Published the PDF unchanged and connected the user-confirmed LinkedIn and GitHub URLs through visible links, schema, and `llms.txt`. No current employment or extra credentials were inferred.
- Removed template-only services, pricing, and terms routes. The rewritten privacy page describes contact forms, browser preferences, analytics, and privacy contact details.
- Replaced the blog template introduction. Rewrote both articles as practical engineering evaluation guides without invented first-person experiments or obsolete model/headset recommendations; existing URLs and publication dates are preserved with substantive update dates.
- Added Alec Reimel as project and article author. Removed every duplicate project-as-live URL; repositories remain available through source links.

## Supplied career evidence

Alec supplied `alec-reimel-resume-2026-r1.pdf`, his LinkedIn URL (`https://www.linkedin.com/in/alecwreimel/`), and GitHub (`https://github.com/areimel`). The PDF is copied byte-for-byte to `public/resume/alec-reimel-resume-2026.pdf`. Its employment and education details are maintained in `src/data/profile.ts`; the HTML résumé and About page use those facts. The public location is Doylestown, Pennsylvania. No phone number was added to HTML or schema.

## Facts still needed from Alec

- Preferred website contact email: the supplied résumé and original site use different email addresses.
- Permission to identify clients/employers and publish outcomes, plus actual measurement evidence.
- Actual project demos, screenshots, package publication details, and completed scanner code if maintained elsewhere.
- Hosting/log retention and contact-message retention details; the privacy page does not invent a retention period or claim no analytics collection.

The public GTM container was separately inspected by the parent reviewer and includes Google Analytics tags. The privacy copy acknowledges analytics rather than claiming that a null source-code analytics ID disables measurement.
