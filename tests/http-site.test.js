import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';

function getSite(address, options = {}) {
  return new Promise((resolve, reject) => {
    const req = request(address, { method: options.method || 'GET', headers: options.headers }, async response => {
      try {
        const chunks = [];
        for await (const chunk of response) chunks.push(chunk);
        resolve(new Response(Buffer.concat(chunks), { status: response.statusCode, headers: response.headers }));
      } catch (error) { reject(error); }
    });
    req.once('error', reject);
    req.end();
  });
}

async function withSite(environment, check) {
  const dataDir = await mkdtemp(join(tmpdir(), 'aimlab-site-'));
  const child = spawn(process.execPath, ['--import', './tests/fixtures/public-provider.js', 'server/index.js'], {
    env: { ...process.env, PORT: '0', AIMLAB_ENV: environment, AIMLAB_DATA_DIR: dataDir, AIMLAB_API_ORIGIN: '', POSTHOG_PROJECT_TOKEN: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const listening = new Promise((resolve, reject) => {
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/listening on 127\.0\.0\.1:(\d+)/);
      if (match) resolve(`http://127.0.0.1:${match[1]}`);
    });
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`Fixture site exited ${code}`)));
  });
  try { await check(await listening); }
  finally {
    if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
    await rm(dataDir, { recursive: true, force: true });
  }
}

test('complete VPS site preserves canonical pages, static files, redirects and same-origin APIs', { timeout: 15000 }, async () => {
  await withSite('production', async origin => {
    const get = (path, options = {}) => getSite(origin + path, { ...options, headers: { Host: 'aimlab-tracker.saibot.site', ...options.headers } });
    const page = await get('/benchmarks/voltaic?benchmark=aimlabs_s3&level=novice');
    assert.equal(page.status, 200);
    assert.equal(page.headers.get('x-aimlab-renderer'), 'vps');
    assert.match(page.headers.get('strict-transport-security'), /max-age=/);
    assert.match(page.headers.get('cache-control'), /s-maxage=60/);
    const html = await page.text();
    assert.match(html, /VT Angleshot Novice S3/);
    assert.match(html, /name="robots" content="index,follow/);
    assert.match(html, /canonical[^>]+https:\/\/aimlab-tracker\.saibot\.site\/benchmarks\/voltaic/);
    const bootstrap = JSON.parse(html.match(/<script id="page-data" type="application\/json">(.*?)<\/script>/s)[1]);
    assert.equal(bootstrap.responses['/api/benchmarks/voltaic'].status, 200);
    const assets = [...new Set([...html.matchAll(/(?:href|src)="(\/assets\/[^" ]+)"/g)].map(match => match[1]))];
    assert.ok(assets.length > 0);
    for (const path of assets) {
      const asset = await get(path);
      assert.equal(asset.status, 200, path);
      assert.match(asset.headers.get('cache-control'), /immutable/);
      assert.ok((await asset.arrayBuffer()).byteLength > 0);
    }
    for (const path of ['/aimlab-logo.svg', '/social-card.png', '/rank-img/ra/gold.png', '/guide/task-overview.png', '/fonts/poppins-v24-latin-400.woff2', '/googleb46c4e92b2751d24.html', '/sitemap.xml']) {
      const file = await get(path);
      assert.equal(file.status, 200, path);
      assert.ok((await file.arrayBuffer()).byteLength > 0);
    }
    const robots = await get('/robots.txt');
    assert.match(await robots.text(), /Allow: \/\nDisallow: \/api\/\nSitemap: https:\/\/aimlab-tracker\.saibot\.site\/sitemap.xml/);
    const api = await get('/api/benchmarks/revosect');
    assert.equal(api.status, 200);
    assert.match(api.headers.get('x-robots-tag'), /noindex/);
    assert.ok((await api.json()).sets.every(set => set.community === 'revosect'));
    const profile = await get('/profile/Fixture/overview');
    assert.equal(profile.status, 200);
    assert.match(await profile.text(), /profile-username/);
    assert.equal((await get('/tasks/fixture-task/leaderboard')).status, 200);
    for (const [path, target] of [['/?utm_source=old', '/home?utm_source=old'], ['/leaderboards?level=hard', '/leaderboards/ra?level=hard'], ['/profile/Fixture', '/profile/Fixture/overview']]) {
      const redirect = await get(path, { redirect: 'manual' });
      assert.equal(redirect.status, 308);
      assert.equal(redirect.headers.get('location'), target);
    }
    const legacy = await get('/home?old=1', { redirect: 'manual', headers: { Host: 'aimlab-tracker.vercel.app' } });
    assert.equal(legacy.status, 308);
    assert.equal(legacy.headers.get('location'), 'https://aimlab-tracker.saibot.site/home?old=1');
    assert.equal((await get('/googleb46c4e92b2751d24.html', { headers: { Host: 'aimlab-tracker.vercel.app' } })).status, 200);
    for (const path of ['/assets/private.js.map', '/assets/missing.js', '/.vite/ssr-manifest.json', '/package.json', '/api/render', '/not-a-page']) {
      const missing = await get(path);
      assert.equal(missing.status, 404, path);
      assert.equal(missing.headers.get('cache-control'), 'no-store');
    }
    const head = await get('/home', { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    const post = await get('/home', { method: 'POST' });
    assert.equal(post.status, 405);
    assert.equal(post.headers.get('allow'), 'GET, HEAD');
    assert.equal((await get('/profile/%ZZ/overview')).status, 400);
    assert.equal((await get('/home?x=' + 'x'.repeat(2048))).status, 414);
    const privatePage = await get('/home', { headers: { Host: 'vps.snapper-cod.ts.net:5180', 'X-Forwarded-Host': 'aimlab-tracker.saibot.site' } });
    assert.equal(privatePage.headers.get('cache-control'), 'no-store');
    assert.match(privatePage.headers.get('x-robots-tag'), /noindex/);
  });
});

test('staging stays excluded from indexing on pages, robots and sitemap', { timeout: 15000 }, async () => {
  await withSite('staging', async origin => {
    for (const path of ['/home', '/robots.txt', '/sitemap.xml']) {
      const response = await getSite(origin + path, { headers: { Host: 'aimlab-tracker.saibot.site' } });
      assert.equal(response.status, 200);
      assert.match(response.headers.get('x-robots-tag'), /noindex/);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      if (path === '/robots.txt') assert.equal(await response.text(), 'User-agent: *\nDisallow: /\n');
    }
  });
});
