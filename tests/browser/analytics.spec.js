import { test, expect } from '@playwright/test';
import { gunzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';

// PostHog excludes automation; exercise the same capture path as a normal visitor.
test.use({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36' });

function unpack(value) {
  if (typeof value === 'string' && value.startsWith('\u001f\u008b')) {
    return unpack(JSON.parse(gunzipSync(Buffer.from(value, 'latin1')).toString()));
  }
  if (Array.isArray(value)) return value.map(unpack);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, unpack(item)]));
  return value;
}

test('SPA events and replay exclude query strings and input text', async ({ page }) => {
  const events = [];
  const logs = [];
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'userAgentData', { get: () => undefined });
  });
  const legacyRequests = [];
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());

    if (/umami|aimlab-analytics|vercel\/insights/.test(url.href) || url.hostname.endsWith('posthog.com')) legacyRequests.push(url.href);
    if (url.hostname === 'edge.saibot.site' || url.hostname.endsWith('posthog.com')) {
      if (url.pathname.endsWith('/logs.js')) {
        const body = await readFile(new URL('../../node_modules/posthog-js/dist/logs.js', import.meta.url));
        return route.fulfill({ contentType: 'application/javascript', body });
      }
      if (/\/(posthog-recorder|lazy-recorder)\.js$/.test(url.pathname)) {
        const body = await readFile(new URL('../../node_modules/posthog-js/dist/posthog-recorder.js', import.meta.url));
        return route.fulfill({ contentType: 'application/javascript', body });
      }
      if (url.pathname.endsWith('.js')) return route.fulfill({ contentType: 'application/javascript', body: '' });
      if (request.method() === 'POST' && !url.pathname.includes('flags')) {
        const raw = request.postDataBuffer();
        if (raw) {
          const payload = JSON.parse(url.searchParams.get('compression') === 'gzip-js' ? gunzipSync(raw).toString() : raw.toString());
          if (url.pathname === '/i/v1/logs') logs.push(payload);
          else events.push(...(Array.isArray(payload) ? payload : payload.batch || [payload]));
        }
      }
      return route.fulfill({ json: { autocapture_opt_out: false, featureFlags: {}, sessionRecording: {
        endpoint: '/s/', sampleRate: 1,
        networkPayloadCapture: { capturePerformance: true, recordHeaders: false, recordBody: false },
      } } });
    }
    if (url.pathname === '/api/telemetry/config') return route.fulfill({ json: { enabled: true, token: 'phc_fixture', host: 'https://edge.saibot.site', uiHost: 'https://eu.posthog.com', environment: 'production' } });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { sets: [], pagination: { pageCount: 0 }, data: [] } });
    if (url.hostname === 'aimlab-tracker.saibot.site') {
      const response = await route.fetch({ url: `http://127.0.0.1:5294${url.pathname}${url.search}` });
      return route.fulfill({ response });
    }
    return route.continue();
  });
  // A non-localhost origin exercises the SDK's real network recording path.
  await page.goto('https://aimlab-tracker.saibot.site/home?private=never-capture-me');
  await expect.poll(() => events.filter(event => event.event === '$pageview').length).toBe(1);
  await page.waitForFunction(() => Boolean(window.__PosthogExtensions__?.rrweb?.record));
  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await page.getByRole('textbox', { name: 'Aimlab username · case sensitive' }).fill('never-capture-me');
  await page.evaluate(async () => {
    const moduleUrl = performance.getEntriesByType('resource').find(entry => /assets\/module-/.test(entry.name)).name;
    const posthog = (await import(moduleUrl)).default;
    posthog.logger.info('Diagnostic never-capture-me https://aimlab-tracker.saibot.site/api/tasks/search?q=never-capture-me token=log-secret person@example.com', { api_key: 'log-secret' });
    console.warn('Diagnostic console never-capture-me');
  });
  await expect.poll(() => logs.length, { timeout: 10000 }).toBeGreaterThan(0);
  await expect.poll(() => events.filter(event => event.event === '$snapshot').length, { timeout: 10000 }).toBeGreaterThan(0);
  await page.getByRole('link', { name: 'About this project', exact: true }).click();
  await expect.poll(() => events.filter(event => event.event === '$pageview').length).toBe(3);
  await page.evaluate(() => {
    const app = document.querySelector('#app').__vue_app__;
    return app.config.globalProperties.$router.push('/about?level=hard');
  });
  await expect.poll(() => events.filter(event => event.event === 'benchmark_selection').length).toBe(1);
  await page.evaluate(() => fetch('/api/tasks/search?name=never-capture-me'));
  await page.getByRole('heading', { name: 'About Aimlab Tracker', exact: true }).click();
  await expect.poll(() => JSON.stringify(unpack(events)).includes('https://aimlab-tracker.saibot.site/api/tasks/search'), { timeout: 10000 }).toBe(true);
  await page.evaluate(async () => {
    const moduleUrl = performance.getEntriesByType('resource').find(entry => /assets\/module-/.test(entry.name)).name;
    const posthog = (await import(moduleUrl)).default;
    window.__PosthogExtensions__.rrweb.record.takeFullSnapshot();
    posthog.stopSessionRecording();
  });
  await expect.poll(() => events.filter(event => event.event === '$snapshot').length, { timeout: 10000 }).toBeGreaterThan(1);
  expect(events.filter(event => event.event === '$pageview').map(event => event.properties.$pathname)).toEqual(['/home', '/profile', '/about']);
  const decoded = unpack(events);
  const snapshots = decoded.filter(event => event.event === '$snapshot').flatMap(event => event.properties.$snapshot_data);
  expect(snapshots.some(snapshot => snapshot.type === 2)).toBe(true);
  expect(snapshots.some(snapshot => snapshot.type === 4 && snapshot.data.href === 'https://aimlab-tracker.saibot.site/home')).toBe(true);
  expect(JSON.stringify(snapshots)).toContain('https://aimlab-tracker.saibot.site/api/tasks/search');
  expect(JSON.stringify(decoded).includes('never-capture-me')).toBe(false);
  const logged = JSON.stringify(logs);
  expect(logged.includes('never-capture-me') || logged.includes('log-secret') || logged.includes('person@example.com')).toBe(false);
  expect(logged).toContain('Diagnostic console');
  expect(events.some(event => event.event === '$autocapture')).toBe(true);
  const heatmap = events.find(event => event.event === '$$heatmap');
  expect(heatmap.properties.$heatmap_data['https://aimlab-tracker.saibot.site/home'].length).toBeGreaterThan(0);
  expect(events.filter(event => event.event === '$pageleave').map(event => event.properties.$pathname)).toEqual(['/home', '/profile']);
  expect(legacyRequests).toEqual([]);
});

for (const scenario of [
  { name: 'retired public domain', origin: 'https://aimlab-tracker.vercel.app', environment: 'production', automated: false },
  { name: 'private VPS', origin: 'https://vps.snapper-cod.ts.net:5194', environment: 'production', automated: false },
  { name: 'staging', origin: 'https://aimlab-tracker.saibot.site', environment: 'staging', automated: false },
  { name: 'automation', origin: 'https://aimlab-tracker.saibot.site', environment: 'production', automated: true },
]) {
  test(`${scenario.name} visits do not initialize browser analytics`, async ({ page }) => {
    await page.addInitScript(automated => {
      Object.defineProperty(navigator, 'webdriver', { get: () => automated });
    }, scenario.automated);
    const analyticsRequests = [];
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'edge.saibot.site' || url.hostname.endsWith('posthog.com')) {
        analyticsRequests.push(url.href);
        return route.fulfill({ json: {} });
      }
      if (url.pathname === '/api/telemetry/config') return route.fulfill({ json: {
        enabled: true, token: 'phc_fixture', host: 'https://edge.saibot.site',
        uiHost: 'https://eu.posthog.com', environment: scenario.environment,
      } });
      if (url.origin === scenario.origin) {
        const response = await route.fetch({ url: `http://127.0.0.1:5294${url.pathname}${url.search}` });
        return route.fulfill({ response });
      }
      return route.continue();
    });
    const configured = page.waitForResponse(response => new URL(response.url()).pathname === '/api/telemetry/config');
    await page.goto(`${scenario.origin}/home`);
    await configured;
    await page.getByRole('link', { name: 'About this project', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'About Aimlab Tracker', exact: true })).toBeVisible();
    expect(analyticsRequests).toEqual([]);
  });
}
