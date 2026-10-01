import { test, expect } from '@playwright/test';
import { calculateProfile } from '../../server/app-data.js';

const run = { id: 'selected-run', score: 200, mode: 42, convertedMode: 0, weaponId: '9mm', endedAt: '2026-09-24T12:00:00Z', metrics: { accTotal: 85, shotsTotal: 100 }, replayAvailable: false };
function snapshot(username, count = 1) {
  return calculateProfile({ username, id: username, rank: 'Gold', skill: 400 }, [{
    group_by: { task_id: 'sixshot', task_name: 'Sixshot', task_mode_mod: 0, weapon_id: '9mm' },
    aggregate: { count, avg: { score: 100, accuracy: 80 }, max: { score: 200, accuracy: 85 } },
  }]);
}

async function fixtures(page, overrides = {}) {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:5294') return route.fulfill({ status: 200, body: '' });
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const custom = overrides[url.pathname];
    if (custom) return custom(route, url);
    let body;
    if (url.pathname === '/api/telemetry/config') body = { enabled: false };
    else if (url.pathname.endsWith('/runs')) body = { taskName: 'Sixshot', totalCount: 1, pageInfo: { hasNextPage: false }, runs: [run] };
    else if (url.pathname.endsWith('/details')) body = {};
    else if (url.pathname.endsWith('/lookup')) body = { username: url.pathname.split('/')[3] };
    else if (url.pathname.startsWith('/api/profiles/')) body = snapshot(url.pathname.split('/')[3]);
    else if (url.pathname.startsWith('/api/benchmarks/')) body = { sets: snapshot('Fixture').benchmarkSets.filter(set => set.community === url.pathname.split('/')[3]).map(set => ({ ...set, rankingOptions: [{ value: 'overall', label: 'Overall' }] })) };
    else if (url.pathname.endsWith('/leaderboard')) body = { weaponId: '9mm', mode: 0, pagination: { pageCount: 0 }, data: [{ rank: 1, username: 'Fixture', score: 200, shotsHit: 85, accuracy: '85%', playId: run.id }] };
    else if (url.pathname.endsWith('/run')) body = run;
    else body = { id: 'sixshot', name: 'Sixshot', weapon_id: '9mm' };
    await route.fulfill({ json: body });
  });
}

test('run modal closes, restores focus, reopens and preserves identity in navigation', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await fixtures(page);
  await page.goto('/profile/Fixture/tasks/sixshot/runs');
  const open = page.getByRole('button', { name: 'View details →' });
  await open.click();
  await expect(page.locator('dialog[open] .run-summary')).toContainText('200 points');
  await expect(page.locator('dialog[open] .run-summary')).toContainText('Fixture');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('dialog')).not.toHaveAttribute('open');
  await expect(open).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  await open.click();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog')).not.toHaveAttribute('open');
  await open.click();
  await page.getByRole('link', { name: 'Task leaderboard →', exact: true }).click();
  await expect(page).toHaveURL(/\/tasks\/sixshot\/leaderboard\?weapon=9mm&mode=0/);
  await expect(page.locator('dialog')).not.toHaveAttribute('open');
  await page.getByRole('button', { name: 'View run →' }).click();
  await expect(page.locator('dialog[open] .run-summary')).toContainText('200 points');
  expect(errors).toEqual([]);
});

test('profile reentry refreshes the snapshot and a failed refresh retains dated data', async ({ page }) => {
  let reads = 0;
  await fixtures(page, { '/api/profiles/Fixture': async route => {
    reads++;
    return reads === 3 ? route.fulfill({ status: 502, json: { error: 'Unavailable' } }) : route.fulfill({ json: snapshot('Fixture', reads) });
  } });
  await page.goto('/profile/Fixture/overview');
  await expect(page.locator('.profile-task-grid')).toContainText('1 plays');
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await page.getByRole('textbox', { name: 'Aimlab username · case sensitive' }).fill('Fixture');
  await page.getByRole('link', { name: 'View profile' }).click();
  await expect(page.locator('.profile-task-grid')).toContainText('2 plays');
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await page.getByRole('textbox', { name: 'Aimlab username · case sensitive' }).fill('Fixture');
  await page.getByRole('link', { name: 'View profile' }).click();
  await expect(page.getByRole('alert')).toContainText('Could not refresh. Showing the profile fetched at');
  await expect(page.locator('.profile-task-grid')).toContainText('2 plays');
  expect(reads).toBe(3);
});

test('a late profile response cannot overwrite a newer player', async ({ page }) => {
  let release;
  const deferred = new Promise(resolve => { release = resolve; });
  let requested;
  const received = new Promise(resolve => { requested = resolve; });
  await fixtures(page, { '/api/profiles/Slow': async route => {
    requested();
    await deferred;
    await route.fulfill({ json: snapshot('Slow', 99) }).catch(() => {});
  } });
  await page.goto('/profile/Slow/overview');
  await received;
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await page.getByRole('textbox', { name: 'Aimlab username · case sensitive' }).fill('Fixture');
  await page.getByRole('link', { name: 'View profile' }).click();
  await expect(page.locator('.profile-username')).toHaveText('Fixture');
  release();
  await expect(page.locator('.profile-task-grid')).toContainText('1 plays');
  await expect(page.locator('.profile-username')).toHaveText('Fixture');
});

test('benchmark selection stays in the URL and expansion stays local to its selection', async ({ page }) => {
  await fixtures(page);
  await page.goto('/profile/Fixture/voltaic?benchmark=aimlabs_s2&level=novice');
  await page.locator('.bench-expand').first().click();
  await expect(page.locator('.bench-details')).toHaveCount(1);
  await page.getByRole('button', { name: 'Benchmark set:' }).click();
  await page.getByRole('option', { name: 'Season 3' }).click();
  await expect(page).toHaveURL(/benchmark=aimlabs_s3&level=novice/);
  await expect(page.locator('.bench-details')).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/benchmark=aimlabs_s2&level=novice/);
  await page.getByRole('button', { name: 'Difficulty:' }).click();
  await page.getByRole('option', { name: 'Advanced' }).click();
  await expect(page).toHaveURL(/benchmark=aimlabs_s2&level=advanced/);
});

test('a leaderboard under collection displays status instead of empty standings', async ({ page }) => {
  await fixtures(page, { '/api/leaderboards/vt/aimlabs_s3/novice/page': route => route.fulfill({ status: 503, json: { error: 'Leaderboard is being prepared' } }) });
  await page.goto('/leaderboards/vt?benchmark=aimlabs_s3&level=novice');
  await expect(page.getByRole('alert')).toHaveText('Standings are being collected.');
  await expect(page.getByText('No standings yet.')).toHaveCount(0);
});

test('a delayed run lookup cannot replace the next selected score', async ({ page }) => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const requests = [];
  await fixtures(page, {
    '/api/tasks/sixshot/leaderboard': route => route.fulfill({ json: { weaponId: '9mm', mode: 1, pagination: { pageCount: 0 }, data: [
      { rank: 1, username: 'Fixture', score: 200, playId: 'slow-run' },
      { rank: 2, username: 'Other', score: 201, playId: 'fast-run' },
    ] } }),
    '/api/tasks/sixshot/run': async (route, url) => {
      requests.push(Object.fromEntries(url.searchParams));
      if (url.searchParams.get('playId') === 'slow-run') await pending;
      await route.fulfill({ json: { ...run, id: url.searchParams.get('playId'), score: Number(url.searchParams.get('score')), convertedMode: 1 } }).catch(() => {});
    },
  });
  await page.goto('/tasks/sixshot/leaderboard?weapon=9mm&mode=1');
  await page.getByRole('button', { name: 'View run →' }).first().click();
  await expect(page.locator('dialog[open]')).toContainText('Loading run details');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'View run →' }).nth(1).click();
  await expect(page.locator('dialog[open] .run-summary')).toContainText('201 points');
  release();
  await expect(page.locator('dialog[open] .run-summary')).toContainText('Other');
  expect(requests).toEqual([
    { username: 'Fixture', playId: 'slow-run', weapon: '9mm', mode: '1', score: '200' },
    { username: 'Other', playId: 'fast-run', weapon: '9mm', mode: '1', score: '201' },
  ]);
});
