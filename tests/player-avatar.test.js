import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { getPlayerAvatar } from '../server/player-avatar.js';

const base = 'https://marketplace-api-public-prod.s3.amazonaws.com/avatar_asset/profile_image/';
const originalFetch = globalThis.fetch;
const source = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#42cbc3' } }).png().toBuffer();

test('avatar requests reject arbitrary hosts, paths and redirects before downloading', async () => {
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error('Unexpected download'); };
  try {
    for (const url of [null, 'http://127.0.0.1/avatar.png', base.replace('https:', 'http:') + 'x.png', base.replace('/avatar_asset/profile_image/', '/other/') + 'x.png', base + 'x.png?redirect=elsewhere', base.replace('https://', 'https://user:password@') + 'x.png']) {
      await assert.rejects(getPlayerAvatar(url), { status: 404 });
    }
    assert.equal(requests, 0);
    globalThis.fetch = async (_url, options) => {
      assert.equal(options.redirect, 'error');
      throw new TypeError('Redirect refused');
    };
    await assert.rejects(getPlayerAvatar(base + 'redirect.png'), /Redirect refused/);
  } finally { globalThis.fetch = originalFetch; }
});

test('shared downloads yield cached 88-pixel WebP images and failed requests remain retryable', async () => {
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    if (requests === 1) return new Response('', { status: 503 });
    return new Response(source, { headers: { 'Content-Type': 'image/png' } });
  };
  try {
    const url = base + 'retry.png';
    await assert.rejects(getPlayerAvatar(url), { status: 502 });
    const results = await Promise.all([getPlayerAvatar(url), getPlayerAvatar(url)]);
    const image = await sharp(results[0].body).metadata();
    assert.equal(image.format, 'webp');
    assert.equal(image.width, 88);
    assert.equal(image.height, 88);
    assert.equal(results[0], results[1]);
    assert.equal(await getPlayerAvatar(url), results[0]);
    assert.equal(requests, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test('avatar input limits reject large streams, declared sizes, oversized images and unsupported formats', async () => {
  try {
    globalThis.fetch = async () => new Response(source, { headers: { 'Content-Type': 'image/png', 'Content-Length': 6 * 1024 * 1024 } });
    await assert.rejects(getPlayerAvatar(base + 'declared-large.png'), { status: 502 });
    let cancelled = false;
    globalThis.fetch = async () => new Response(new ReadableStream({
      pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)); },
      cancel() { cancelled = true; },
    }), { headers: { 'Content-Type': 'image/png' } });
    await assert.rejects(getPlayerAvatar(base + 'stream-large.png'), { status: 502 });
    assert.ok(cancelled);
    globalThis.fetch = async () => new Response('<svg xmlns="http://www.w3.org/2000/svg"/>', { headers: { 'Content-Type': 'image/svg+xml' } });
    await assert.rejects(getPlayerAvatar(base + 'unsupported.svg'), { status: 502 });
    globalThis.fetch = async () => new Response('<svg xmlns="http://www.w3.org/2000/svg"/>', { headers: { 'Content-Type': 'application/octet-stream' } });
    await assert.rejects(getPlayerAvatar(base + 'unsupported-binary.svg'), { status: 502 });
    const huge = await sharp({ create: { width: 4097, height: 4097, channels: 3, background: 'white' } }).png().toBuffer();
    globalThis.fetch = async () => new Response(huge, { headers: { 'Content-Type': 'image/png' } });
    await assert.rejects(getPlayerAvatar(base + 'huge.png'), /pixel limit/);
  } finally { globalThis.fetch = originalFetch; }
});

test('avatar processing bounds simultaneous downloads and recovers its capacity', async () => {
  const resolveDownloads = [];
  globalThis.fetch = () => new Promise(resolve => resolveDownloads.push(() => resolve(new Response(source, { headers: { 'Content-Type': 'image/png' } }))));
  const pending = Array.from({ length: 4 }, (_, i) => getPlayerAvatar(base + `parallel-${i}.png`));
  try {
    await assert.rejects(getPlayerAvatar(base + 'busy.png'), { status: 503 });
    assert.equal(resolveDownloads.length, 4);
    for (const resolve of resolveDownloads) resolve();
    await Promise.all(pending);
    globalThis.fetch = async () => new Response(source, { headers: { 'Content-Type': 'image/png' } });
    assert.ok((await getPlayerAvatar(base + 'busy.png')).body.length);
  } finally {
    for (const resolve of resolveDownloads) resolve();
    await Promise.allSettled(pending);
    globalThis.fetch = originalFetch;
  }
});
