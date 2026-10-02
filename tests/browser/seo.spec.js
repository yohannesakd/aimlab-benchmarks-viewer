import { test, expect } from '@playwright/test';

test('server HTML hydrates without mismatch, duplicate initial reads, or losing benchmark navigation', async ({ page }) => {
  const errors = [];
  const reads = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (/hydration/i.test(message.text())) errors.push(message.text()); });
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/benchmarks/')) reads.push(request.url()); });
  await page.addInitScript(() => localStorage.setItem('aimlab-tracker-saved-profile', 'SavedPlayer'));
  const response = await page.goto('/benchmarks/voltaic?benchmark=aimlabs_s3&level=novice');
  expect((await response.text()).split('<script id="page-data"')[0]).toContain('VT Angleshot Novice S3');
  await expect(page.locator('.catalog-table')).toContainText('VT Angleshot Novice S3');
  await expect(page).toHaveTitle('Voltaic Season 3 Novice Benchmarks | Aimlab Tracker');
  expect(reads).toEqual([]);
  await page.getByRole('button', { name: /Benchmark set:/ }).click();
  await page.getByRole('option', { name: 'Season 2' }).click();
  await expect(page).toHaveURL(/benchmark=aimlabs_s2/);
  await expect(page).toHaveTitle(/Season 2/);
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open saved profile' })).toHaveAttribute('href', '/profile/SavedPlayer');
  expect(errors).toEqual([]);
});

test('task and profile HTML hydrate populated data, and missing profiles return real 404s', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (/hydration/i.test(message.text())) errors.push(message.text()); });
  let response = await page.goto('/tasks/fixture-task/leaderboard');
  expect(await response.text()).toContain('Fixture task Leaderboard');
  await expect(page.locator('.task-score-row')).toContainText(['Rank', '200']);
  await expect(page).toHaveTitle('Fixture task Leaderboard | Aimlab Tracker');
  response = await page.goto('/profile/Fixture/overview');
  expect(await response.text()).toContain('profile-username');
  await expect(page.locator('.profile-username')).toHaveText('Fixture');
  response = await page.goto('/profile/Missing/overview');
  expect(response.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex,follow');
  expect(errors).toEqual([]);
});
