import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Vercel redirects to VPS production and retains the Google verification file', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.framework, null);
  assert.equal(config.functions, undefined);
  assert.equal(config.rewrites, undefined);
  assert.equal(config.installCommand, 'true');
  assert.equal(config.outputDirectory, '.vercel-static');
  assert.deepEqual(config.redirects[0], {
    source: '/', destination: 'https://aimlab-tracker.saibot.site/home', permanent: true,
  });
  const redirect = config.redirects[1];
  assert.equal(redirect.destination, 'https://aimlab-tracker.saibot.site/$1');
  assert.equal(redirect.permanent, true);
  const paths = new RegExp('^' + redirect.source + '$');
  assert.equal(paths.test('/googleb46c4e92b2751d24.html'), false);
  assert.equal(paths.exec('/profile/Fixture/tasks/sixshot/runs')[1], 'profile/Fixture/tasks/sixshot/runs');
  assert.deepEqual(config.headers, [{
    source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
  }]);
  assert.equal(
    (await readFile(new URL('../public/googleb46c4e92b2751d24.html', import.meta.url), 'utf8')).trim(),
    'google-site-verification: googleb46c4e92b2751d24.html',
  );
});
