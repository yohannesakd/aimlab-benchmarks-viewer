import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function withServer(environment, check) {
  const dataDir = await mkdtemp(join(tmpdir(), 'aimlab-render-'));
  const child = spawn(process.execPath, ['--import', './tests/fixtures/public-provider.js', 'server/public-api.js'], {
    env: { ...process.env, PUBLIC_API_PORT: '0', AIMLAB_ENV: environment, AIMLAB_DATA_DIR: dataDir, POSTHOG_PROJECT_TOKEN: '' },
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
    child.once('exit', code => reject(new Error(`Fixture server exited ${code}`)));
  });
  try { await check(await listening); }
  finally {
    if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
    await rm(dataDir, { recursive: true, force: true });
  }
}

test('VPS page entrypoint preserves HTML, query data, canonical URLs, caching and bounded assets', { timeout: 15000 }, async () => {
  await withServer('production', async origin => {
    const page = await fetch(origin + '/api/pages/public/benchmarks/voltaic?benchmark=aimlabs_s3&level=novice');
    assert.equal(page.status, 200);
    assert.equal(page.headers.get('x-aimlab-renderer'), 'vps');
    assert.match(page.headers.get('cache-control'), /s-maxage=60/);
    const html = await page.text();
    assert.match(html, /VT Angleshot Novice S3/);
    assert.match(html, /name="robots" content="index,follow/);
    assert.match(html, /canonical[^>]+https:\/\/aimlab-tracker\.saibot\.site\/benchmarks\/voltaic/);
    assert.ok(!html.includes('saibot.site/api/pages/'));
    const bootstrap = JSON.parse(html.match(/<script id="page-data" type="application\/json">(.*?)<\/script>/s)[1]);
    assert.equal(bootstrap.path, '/benchmarks/voltaic');
    assert.equal(bootstrap.responses['/api/benchmarks/voltaic'].status, 200);
    const assetPath = html.match(/(?:href|src)="\/assets\/([^" ]+\.(?:css|js))"/)[1];
    const asset = await fetch(origin + '/api/site-assets/' + assetPath);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('cache-control'), /immutable/);
    assert.ok((await asset.arrayBuffer()).byteLength > 0);
    assert.equal((await fetch(origin + '/api/site-assets/missing.js')).status, 404);
    assert.equal((await fetch(origin + '/api/site-assets/private.js.map')).status, 404);
    assert.equal((await fetch(origin + '/api/site-assets/private.constructor')).status, 404);
    assert.equal((await fetch(origin + '/api/site-assets/%2e%2e%2fpackage.json')).status, 404);
    assert.equal((await fetch(origin + '/api/site-assets/%ZZ')).status, 400);
    const head = await fetch(origin + '/api/pages/public/home', { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    const post = await fetch(origin + '/api/pages/public/home', { method: 'POST' });
    assert.equal(post.status, 405);
    assert.equal(post.headers.get('allow'), 'GET, HEAD');
    const redirect = await fetch(origin + '/api/pages/public/profile/Fixture', { redirect: 'manual' });
    assert.equal(redirect.status, 308);
    assert.equal(redirect.headers.get('location'), '/profile/Fixture/overview');
    const missing = await fetch(origin + '/api/pages/public/not-a-page');
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get('cache-control'), 'no-store');
    assert.equal((await fetch(origin + '/api/pages/public/profile/%ZZ/overview')).status, 400);
    assert.equal((await fetch(origin + '/api/pages/public//external')).status, 400);
    assert.equal((await fetch(origin + '/api/pages/other/home')).status, 404);
    const preview = await fetch(origin + '/api/pages/preview/home');
    assert.equal(preview.headers.get('cache-control'), 'no-store');
    assert.match(preview.headers.get('x-robots-tag'), /noindex/);
    const profile = await fetch(origin + '/api/pages/public/profile/Fixture/overview');
    assert.equal(profile.status, 200);
    assert.match(await profile.text(), /Fixture/);
    const runs = await fetch(origin + '/api/pages/public/profile/Fixture/tasks/fixture-task/runs');
    assert.equal(runs.status, 200);
    assert.equal(runs.headers.get('cache-control'), 'no-store');
  });
});

test('staging render origin stays noindex even with the public visibility path', { timeout: 15000 }, async () => {
  await withServer('staging', async origin => {
    const response = await fetch(origin + '/api/pages/public/home');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(response.headers.get('x-robots-tag'), /noindex/);
  });
});
