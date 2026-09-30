import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Actual HTTP entrypoint with only the external provider substituted.
test('public API serves bounded namespaces and distinguishes invalid sorts, collection and unknown routes', { timeout: 15000 }, async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'aimlab-http-'));
  const child = spawn(process.execPath, ['--import', './tests/fixtures/public-provider.js', 'server/public-api.js'], {
    env: { ...process.env, PUBLIC_API_PORT: '0', AIMLAB_DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'pipe'],
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
  try {
    const origin = await listening;
    for (const path of ['/api/profiles/Fixture', '/api/tasks/fixture-task', '/api/tasks/fixture-task/leaderboard', '/api/benchmarks/voltaic', '/api/profiles/Fixture/tasks/fixture-task/runs', '/api/tasks/fixture-task/run?username=Fixture&playId=fixture-run&weapon=9mm&score=200&mode=0']) {
      const response = await fetch(origin + path);
      assert.equal(response.status, 200, path);
      assert.match(response.headers.get('content-type'), /application\/json/);
      assert.ok(await response.json());
    }
    const invalid = await fetch(origin + '/api/leaderboards/vt/aimlabs_s3/advanced/page?sort=constructor');
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error, 'Invalid sort');
    assert.equal((await fetch(origin + '/api/leaderboards/vt/aimlabs_s3/advanced/page')).status, 503);
    assert.equal((await fetch(origin + '/api/unrecognized')).status, 404);
    assert.equal((await fetch(origin + '/api/tasks/fixture-task?mode=invalid', { method: 'POST' })).status, 405);
  } finally {
    if (child.exitCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
    await rm(dataDir, { recursive: true, force: true });
  }
});
