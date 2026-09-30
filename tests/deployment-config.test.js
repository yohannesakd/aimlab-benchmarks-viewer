import assert from 'node:assert/strict';
import test from 'node:test';

let revision = 0;
async function configuration(environment, origin) {
  const previous = { environment: process.env.VERCEL_ENV, origin: process.env.AIMLAB_API_ORIGIN };
  process.env.VERCEL_ENV = environment;
  if (origin === undefined) delete process.env.AIMLAB_API_ORIGIN;
  else process.env.AIMLAB_API_ORIGIN = origin;
  try { return (await import(`../vercel.mjs?fixture=${revision++}`)).default; }
  finally {
    if (previous.environment === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previous.environment;
    if (previous.origin === undefined) delete process.env.AIMLAB_API_ORIGIN; else process.env.AIMLAB_API_ORIGIN = previous.origin;
  }
}

test('preview and production proxies choose the intended API and reject credential-bearing or path origins', async () => {
  for (const [environment, host] of [['preview', 'aimlab-staging-api.saibot.site'], ['production', 'aimlab-api.saibot.site']]) {
    const config = await configuration(environment);
    assert.equal(config.rewrites.length, 5);
    assert.deepEqual(config.rewrites.slice(0, 4).map(rule => rule.destination), ['leaderboards', 'profiles', 'tasks', 'benchmarks'].map(namespace => `https://${host}/api/${namespace}/:path*`));
  }
  assert.equal((await configuration('preview', 'https://fixture.invalid')).rewrites[0].destination, 'https://fixture.invalid/api/leaderboards/:path*');
  for (const origin of ['http://fixture.invalid', 'https://secret:password@fixture.invalid', 'https://fixture.invalid/path']) {
    await assert.rejects(configuration('preview', origin), /HTTPS origin/);
  }
});
