# Frontend dependency upgrade

Keep the current pages, URLs, calculations, API contracts, hosting, and analytics policy.

## Chunks

1. Vue Router 5, Vite patch, PostHog browser SDK patch, Prettier 3 and its Tailwind plugin.
2. Replace both Vuex modules and all callers with request-local Pinia stores.
3. Tailwind 4 with the Vite plugin; preserve existing computed styles and layout.

## Verification

- Baseline: build, 51 Node tests, four Python importer tests, and 13 browser tests pass on Node 24.16.0. Chromium uses `LD_LIBRARY_PATH=/tmp/aimlab-browser-libs/extracted/usr/lib/x86_64-linux-gnu` on this VPS.
- Development: compare 28 scratch screenshots at 1280px and 390px across home, search, about, benchmark catalogs/profile tabs, profile tasks, task standings, history, missing pages, dropdowns and run modals. Preserve the baseline; never regenerate it to accept a regression.
- Each chunk: build and applicable existing contract/browser tests. Final: all suites, fresh install, full diff review, and no Vuex references or obsolete Tailwind configuration.
- Preview: verify Vercel readiness, production-like navigation, hydration, assets, SEO and error handling with the shared browser. Verify preview analytics stays excluded and inspect the personal PostHog project 289968.
- Release: independently verify the final PR, merge through GitHub, deploy an immutable VPS release with the previous release retained, and verify Vercel production, canonical redirects, private source maps, telemetry and health endpoints.

The staging and production source trees match at the baseline. Preview browser capture is intentionally disabled; absence of preview pageviews in PostHog is expected.

## Results

- Router/tooling and Pinia chunks pass build, Node tests and all browser checks; all 28 screenshots match the original baseline exactly.
- Tailwind 4 also matches all 28 screenshots with zero differing pixels. Existing benchmark colors and progress-bar blue remain exact hex values.
- The personal PostHog project reports 55 production pageviews and no `$exception` events in the day before release. Versioned browser observations in the previous seven days meet Tailwind 4's requirements; imported history without browser versions cannot establish compatibility.
- One lasting regression test extends existing SSR coverage to concurrent task metadata and standings. The 28 screenshot comparisons are scratch checks retained outside Git.
