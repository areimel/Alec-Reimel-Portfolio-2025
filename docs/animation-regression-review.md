# Animation regression review

## Cause and scope

The SEO update was committed as `225227f`. Comparing it with `c02afd1` identified three changes that altered the opening experience:

- `src/components/LoadingScreenV1.astro` replaced the full-screen, centered terminal loader with a small bottom-right badge. It also reduced the container padding and heading size and disabled pointer interception. The CRT flicker, collapse, and fade therefore played in a small corner instead of covering the viewport.
- `src/animation/boot.ts` removed the weighted font-loading progress sequence and replaced it with a single `document.fonts.ready` update. This changed the progress display even though the exit durations and completion event remained intact.
- `src/components/common/CommonMeta.astro` removed the preload for the visible UAV OSD Mono display font. The homepage layout-shift test reproduced approximately 0.0256 CLS, with the résumé button among the affected nodes. Restoring that font's preload (using the existing WOFF2 asset) made the test pass without changing the decoder or weakening its assertions.

These changes came from expanding the SEO work into loading-performance optimization. They changed the site's presentation and should have been kept out of that work. The loader component and boot module have now been restored byte-for-byte from the pre-SEO commit, and both visible terminal fonts are preloaded. SEO content, structured data, crawler files, responsive images, and WOFF2 CSS assets remain in place.

The other animation-engine change in that commit was an `onComplete` callback in `ui.ts` that releases a finished scroll reveal's inline styles. It preserves the reveal's duration, easing, and stagger. Existing reveal and navigation tests pass with it, so it is retained rather than restoring the previously observed lingering-transform problem. The decode, glitch, overlay, governor, and engine lifecycle modules were unchanged by the SEO commit.

## Why the earlier checks missed it

The boot tests checked animation properties, completion events, session behavior, reduced motion, failed chunks, and navigation. A corner badge satisfies those checks. They did not assert that the opening screen covers the viewport or retains its original container dimensions.

The blocked-chunk boot test now checks the loader's viewport bounds, pointer interception, and container maximum width before testing its fail-safe dismissal. Before the fix, the Chromium assertion failed with an actual 288 × 122 badge at (980, 586), versus the expected 1280 × 720 screen at (0, 0).

The initial investigation also found the homepage layout-shift failure described above in the broader animation suite. Other decode, reveal, cursor, modal, and boot lifecycle tests passed in that run; that evidence does not indicate a global animation-engine failure.

## Reported frozen effects in development

The reported symptoms were a motionless loader that eventually disappears, missing animated static, and a scanline stuck at the bottom. These were observed on the development server in normal Chrome; the user confirmed that animations work in an incognito window. That distinction points to browser-profile or development-session state, but does not by itself distinguish stale modules/cache from extensions or browser animation settings.

A fresh Chromium session against the development server confirmed that both overlay layers have running native animations: the noise transforms changed between samples, and the scanline's animation time advanced from approximately 917 to 2133 milliseconds. The SEO commit did not modify the overlay module or its CSS. No overlay algorithm change has been made without evidence of a reproducible source-code defect.

The existing boot behavior also intentionally plays the full flicker/beam sequence only once per browser session (`sessionStorage['fx-booted']`); subsequent document loads use a short fade. An incognito window starts a new session. That can explain a difference in the loader, but does not explain a permanently frozen scanline. Its normal cycle includes a 4.875-second hold after the 2.625-second sweep.

## Validation

- `pnpm run check` and `pnpm run build` passed.
- 94 Chromium tests passed across animation, boot, UI, glitches, engine lifecycle, effect settings, themes, and SEO.
- 26 additional targeted checks passed across Firefox, WebKit, and mobile; the desktop-only mid-reveal test was skipped on mobile as intended.
- All 20 overlay tests passed across Chromium, Firefox, WebKit, and mobile, including actual noise movement and animation survival across navigation.
- Manual automated development-server checks passed for effect tiers 0–3 on initial load, client navigation, and reload (12 scenarios, with both overlay transforms advancing and no page errors).
- The restored loader component and boot module match their pre-SEO versions byte-for-byte.
