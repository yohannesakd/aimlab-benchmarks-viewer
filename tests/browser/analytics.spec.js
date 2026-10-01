import { test, expect } from '@playwright/test';
import { gunzipSync } from 'node:zlib';

// PostHog excludes automation; exercise the same capture path as a normal visitor.
test.use({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36' });

test('SPA pageviews are unique, query changes are events, and input text stays out of capture', async ({ page }) => {
  const events = [];
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'userAgentData', { get: () => undefined });
  });
  const legacyRequests = [];
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());

    if (/umami|aimlab-analytics|vercel\/insights/.test(url.href)) legacyRequests.push(url.href);
    if (url.hostname.endsWith('posthog.com')) {
      if (url.pathname.endsWith('.js')) return route.fulfill({ contentType: 'application/javascript', body: '' });
      if (request.method() === 'POST' && !url.pathname.includes('flags')) {
        const raw = request.postDataBuffer();
        if (raw) {
          const payload = JSON.parse(url.searchParams.get('compression') === 'gzip-js' ? gunzipSync(raw).toString() : raw.toString());
          events.push(...(Array.isArray(payload) ? payload : payload.batch || [payload]));
        }
      }
      return route.fulfill({ json: { featureFlags: {}, sessionRecording: false } });
    }
    if (url.pathname === '/api/telemetry/config') return route.fulfill({ json: { enabled: true, token: 'phc_fixture', host: 'https://eu.i.posthog.com', environment: 'test' } });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { sets: [], pagination: { pageCount: 0 }, data: [] } });
    return route.continue();
  });
  await page.goto('/home?private=never-capture-me');
  await expect.poll(() => events.filter(event => event.event === '$pageview').length).toBe(1);
  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await page.getByRole('textbox', { name: 'Aimlab username · case sensitive' }).fill('never-capture-me');
  await page.getByRole('link', { name: 'About this project', exact: true }).click();
  await expect.poll(() => events.filter(event => event.event === '$pageview').length).toBe(3);
  await page.evaluate(() => {
    const app = document.querySelector('#app').__vue_app__;
    return app.config.globalProperties.$router.push('/about?level=hard');
  });
  await expect.poll(() => events.filter(event => event.event === 'benchmark_selection').length).toBe(1);
  expect(events.filter(event => event.event === '$pageview').map(event => event.properties.$pathname)).toEqual(['/home', '/profile', '/about']);
  expect(JSON.stringify(events)).not.toContain('never-capture-me');
  expect(legacyRequests).toEqual([]);
});
