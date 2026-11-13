import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPageData } from '../server/page-renderer.js';
import { createServer } from 'node:http';

for (const status of [200, 400, 404, 502]) {
  test(`player SSR starts independent requests together and preserves primary ${status}`, async () => {
    const started = [];
    const resolve = new Map();
    const page = { kind: 'player', username: 'Alice', section: 'activity', path: '/profile/Alice/activity', query: {}, status: 200 };
    const pending = loadPageData(page, '', path => {
      started.push(path);
      return new Promise(done => resolve.set(path, done));
    });
    const path = '/api/profiles/Alice';
    assert.deepEqual(started, [`${path}?publicSummary=1`, `${path}/details`, `${path}/activity`]);
    resolve.get(`${path}/activity`)({ status: 200, body: { username: 'Alice' } });
    resolve.get(`${path}/details`)({ status: 503, body: { error: 'Unavailable' } });
    resolve.get(`${path}?publicSummary=1`)({ status, body: { playerInfo: { username: 'Alice' } } });
    const bootstrap = await pending;
    assert.equal(bootstrap.status, status === 502 ? 503 : status);
    assert.equal(bootstrap.path, page.path);
    assert.equal(bootstrap.responses[`${path}/activity`].body.username, 'Alice');
    assert.equal(Object.keys(bootstrap.responses).some(key => key.includes('Bob')), false);
  });
}

test('SSR waits for a valid profile beyond the former six-second cutoff', { timeout: 10000 }, async t => {
  const server = createServer(async (request, response) => {
    if (!request.url.endsWith('/details')) await new Promise(resolve => setTimeout(resolve, 6500));
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ username: 'Alice' }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const page = { kind: 'player', username: 'Alice', section: 'overview', path: '/profile/Alice/overview', query: {}, status: 200 };
  const result = await loadPageData(page, `http://127.0.0.1:${server.address().port}`);
  assert.equal(result.status, 200);
  assert.equal(result.responses['/api/profiles/Alice'].body.username, 'Alice');
});
