import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parsePage, pageMetadata, safeJson, SITE_ORIGIN } from '../shared/seo.js';
import { renderPage } from '../server/page-renderer.js';
import { calculateProfile, getBenchmarkCatalog } from '../server/app-data.js';

test('SEO preserves benchmark identities, removes tracking/modal queries and rejects missing routes', () => {
  const metadata = pageMetadata(parsePage('/benchmarks/voltaic?benchmark=legacy&level=advanced&utm_source=campaign'));
  assert.equal(metadata.canonical, `${SITE_ORIGIN}/benchmarks/voltaic?benchmark=aimlabs_s2&level=advanced`);
  assert.match(metadata.title, /Season 2 Advanced/);
  assert.equal(pageMetadata(parsePage('/profile/Fixture/tasks/sixshot/runs?run=private-link')).indexable, false);
  assert.equal(pageMetadata(parsePage('/leaderboards/vt?sort=clicking&page=2')).indexable, false);
  assert.equal(parsePage('/tasks/sixshot').redirect, '/tasks/sixshot/leaderboard');
  assert.equal(parsePage('/profile/Fixture').redirect, '/profile/Fixture/overview');
  assert.equal(parsePage('/not-a-page').status, 404);
  assert.equal(parsePage('/profile/%ZZ/overview').status, 400);
  assert.equal(parsePage('/profile/' + 'a'.repeat(65) + '/overview').status, 400);
  assert.equal(parsePage('/benchmarks/voltaic?level=novice&level=advanced').status, 400);
  assert.match(pageMetadata(parsePage('/profile/Fixture/voltaic')).title, /Season 3 Advanced/);
  assert.ok(!safeJson({ username: '</script><script>alert(1)</script>' }).includes('<'));
});

test('SSR renders catalog content and styles before JavaScript; private pages stay noindex', async () => {
  const result = await renderPage('/benchmarks/voltaic?benchmark=aimlabs_s3&level=novice', {
    indexable: true, read: async () => ({ status: 200, body: getBenchmarkCatalog('voltaic') }),
  });
  assert.equal(result.status, 200);
  const html = result.body.split('<script id="page-data"')[0];
  assert.match(html, /VT Angleshot Novice S3/);
  assert.match(html, /350/);
  assert.match(html, /stylesheet[^>]+BenchmarkCatalogPage/);
  assert.match(html, /modulepreload[^>]+BenchmarkCatalogPage[^>]+\.js/);
  assert.ok(!html.includes('modulepreload" crossorigin href="/assets/HomePage'));
  const preloads = [...html.matchAll(/rel="modulepreload"[^>]+href="([^"]+)"/g)].map(match => match[1]);
  assert.equal(preloads.length, new Set(preloads).size);
  assert.match(html, /rel="preconnect" href="https:\/\/edge.saibot.site" crossorigin/);
  assert.match(html, /name="robots" content="index,follow/);
  const privatePage = await renderPage('/home');
  assert.match(privatePage.headers['X-Robots-Tag'], /noindex/);
  assert.equal(privatePage.headers['Cache-Control'], 'no-store');
  assert.match(privatePage.body, /modulepreload[^>]+HomePage[^>]+\.js/);
  assert.ok(!privatePage.body.includes('rel="preconnect"'));
});

test('concurrent SSR profiles cannot share player state or serialize executable names', async () => {
  const names = ['Alice', 'Bob', '</script><script>window.bad=true</script>', '$&'];
  const pages = await Promise.all(names.map(username => renderPage(`/profile/${encodeURIComponent(username)}/overview`, {
    indexable: true,
    read: async path => path.endsWith('/details')
      ? { status: 200, body: {} }
      : { status: 200, body: calculateProfile({ username, id: username, rank: 'Gold', skill: 400 }, []) },
  })));
  for (let index = 0; index < 2; index++) {
    assert.match(pages[index].body, new RegExp(`profile-username[^>]*>${names[index]}`));
    assert.ok(!pages[index].body.includes(names[1 - index]));
  }
  assert.ok(!pages[2].body.includes('<script>window.bad=true</script>'));
  assert.match(pages[3].body, /<title>\$&amp;/);
});

test('missing data returns 404 and provider failure returns retryable 503 without caching either', async () => {
  for (const [upstream, expected] of [[404, 404], [502, 503]]) {
    const result = await renderPage('/profile/Missing/overview', { indexable: true, read: async () => ({ status: upstream, body: { error: 'Unavailable' } }) });
    assert.equal(result.status, expected);
    assert.equal(result.headers['Cache-Control'], 'no-store');
    assert.match(result.body, /name="robots" content="noindex,follow"/);
    assert.match(result.body, expected === 404 ? /Page not found/ : /Data temporarily unavailable/);
    assert.equal(result.headers['Retry-After'], expected === 503 ? '60' : undefined);
  }
});

test('sitemap contains canonical benchmark variants and task links, not users, runs, or duplicate archives', async () => {
  const xml = await readFile('dist/sitemap.xml', 'utf8');
  assert.match(xml, /benchmark=aimlabs_s3&amp;level=novice/);
  assert.match(xml, /benchmark=aimlabs_s2&amp;level=advanced/);
  assert.match(xml, /benchmark=revosect_s4/);
  assert.match(xml, /\/tasks\/[^<]+\/leaderboard/);
  assert.ok(!xml.includes('/profile/'));
  assert.ok(!xml.includes('voltaic?benchmark=legacy'));
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
  assert.equal(urls.length, new Set(urls).size);
});
