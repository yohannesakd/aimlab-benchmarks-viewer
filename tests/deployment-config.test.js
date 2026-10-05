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
    assert.equal(config.rewrites.length, environment === 'production' ? 8 : 7);
    assert.deepEqual(config.rewrites.slice(0, 5).map(rule => rule.destination), ['leaderboards', 'profiles', 'tasks', 'benchmarks', 'telemetry'].map(namespace => `https://${host}/api/${namespace}/:path*`));
    assert.equal(config.rewrites[5].destination, `https://${host}/api/site-assets/:path*`);
    assert.equal(config.rewrites.at(-1).destination, `https://${host}/api/pages/preview/$1`);
    assert.equal(config.functions, undefined);
    assert.ok(config.rewrites.every(rule => rule.destination.startsWith('https://')));
    assert.equal(config.headers.filter(rule => rule.headers.some(header => header.key === 'x-vercel-enable-rewrite-caching' && header.value === '1')).length, 2);
    if (environment === 'production') {
      assert.equal(config.rewrites[6].destination, `https://${host}/api/pages/public/$1`);
      assert.deepEqual(config.rewrites[6].has, [{ type: 'host', value: 'aimlab-tracker.saibot.site' }]);
    }
    assert.equal(config.headers.some(rule => rule.source === '/:path*'), environment === 'preview');
    const migration = config.redirects.filter(rule => rule.has?.some(condition => condition.type === 'host' && condition.value === 'aimlab-tracker.vercel.app'));
    assert.equal(migration.length, environment === 'production' ? 2 : 0);
    if (environment === 'production') {
      assert.equal(migration[0].destination, 'https://aimlab-tracker.saibot.site/home');
      assert.equal(migration[1].destination, 'https://aimlab-tracker.saibot.site/$1');
      assert.equal(migration[1].permanent, true);
      const paths = new RegExp('^' + migration[1].source + '$');
      assert.equal(paths.test('/googleb46c4e92b2751d24.html'), false);
      assert.equal(paths.exec('/profile/Fixture/tasks/sixshot/runs')[1], 'profile/Fixture/tasks/sixshot/runs');
    }
  }
  assert.equal((await configuration('preview', 'https://fixture.invalid')).rewrites[0].destination, 'https://fixture.invalid/api/leaderboards/:path*');
  for (const origin of ['http://fixture.invalid', 'https://secret:password@fixture.invalid', 'https://fixture.invalid/path']) {
    await assert.rejects(configuration('preview', origin), /HTTPS origin/);
  }
});
