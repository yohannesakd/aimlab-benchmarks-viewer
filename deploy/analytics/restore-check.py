#!/usr/bin/env python3
"""Restore a copied dump into disposable, network-isolated Umami containers."""
import argparse
import json
import pathlib
import subprocess
import tempfile
import time
import uuid


def docker(*arguments, input=None):
    result = subprocess.run(['docker', *arguments], input=input, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, timeout=120)
    if result.returncode:
        # Do not print provider logs, credentials, tokens or environment values.
        raise RuntimeError('Docker operation failed: ' + arguments[0])
    return result.stdout


def wait_for(arguments, attempts=40):
    for _ in range(attempts):
        try:
            docker(*arguments)
            return
        except RuntimeError:
            time.sleep(1)
    raise RuntimeError('Isolated service did not become ready')


def restore_check(dump, credentials, live_app):
    username, password = credentials.read_text().splitlines()
    suffix = uuid.uuid4().hex[:12]
    network, database, app = ['aimlab-restore-' + suffix + kind for kind in ['-network', '-db', '-app']]
    with tempfile.TemporaryDirectory(prefix='aimlab-restore-') as folder:
        env_file = pathlib.Path(folder) / 'app.env'
        try:
            # Read only the existing app keys; keep them in a restricted file, never argv/output.
            source = json.loads(docker('inspect', live_app))[0]
            environment = dict(item.split('=', 1) for item in source['Config']['Env'] if '=' in item)
            keys = ['APP_SECRET', 'TWO_FACTOR_ENCRYPTION_KEY']
            if not all(environment.get(key) for key in keys):
                raise RuntimeError('Existing application keys are required for a meaningful restore')
            env_file.touch(mode=0o600)
            env_file.write_text('\n'.join([*(key + '=' + environment[key] for key in keys),
                'DATABASE_URL=postgresql://umami@' + database + ':5432/umami', 'DISABLE_TELEMETRY=1']) + '\n')
            docker('network', 'create', '--internal', network)
            docker('run', '--detach', '--name', database, '--network', network,
                   '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
                   '-e', 'POSTGRES_USER=umami', '-e', 'POSTGRES_DB=umami', 'postgres:15-alpine')
            wait_for(['exec', database, 'pg_isready', '-U', 'umami', '-d', 'umami'])
            with dump.open('rb') as stream:
                result = subprocess.run(['docker', 'exec', '-i', database, 'pg_restore',
                                         '--exit-on-error', '--no-owner', '-U', 'umami', '-d', 'umami'],
                                        stdin=stream, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120)
            if result.returncode:
                raise RuntimeError('Isolated pg_restore failed')
            tables = int(docker('exec', database, 'psql', '-U', 'umami', '-d', 'umami', '-Atc',
                               "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'").strip())
            if not tables:
                raise RuntimeError('Restored schema is empty')
            docker('run', '--detach', '--name', app, '--network', network, '--env-file', str(env_file),
                   'ghcr.io/umami-software/umami:3.4.0')
            wait_for(['exec', app, 'node', '-e', "fetch('http://localhost:3000/api/heartbeat').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"])
            check = """
let input = ''; for await (const chunk of process.stdin) input += chunk;
const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST', headers: {'Content-Type': 'application/json'}, body: input,
});
const login = await response.json();
if (!response.ok || !login.token) process.exit(1);
const websites = await fetch('http://localhost:3000/api/websites', {
  headers: {Authorization: 'Bearer ' + login.token},
});
if (!websites.ok) process.exit(1);
const list = await websites.json();
if (!Array.isArray(list.data) || !list.data.length) process.exit(1);
"""
            docker('exec', '-i', app, 'node', '--input-type=module', '-e', check,
                   input=json.dumps({'username': username, 'password': password}).encode())
            print('Restore passed: schema, application heartbeat, stored admin login and authenticated websites API.')
            print('Live volumes were not mounted; disposable containers have no published ports.')
        finally:
            # Cleanup names are unique to this rehearsal; no live container/volume is touched.
            subprocess.run(['docker', 'rm', '--force', app, database], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            subprocess.run(['docker', 'network', 'rm', network], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('dump', type=pathlib.Path)
    parser.add_argument('--credentials', type=pathlib.Path, required=True,
                        help='Owner-only file containing username and password on separate lines')
    parser.add_argument('--live-app', default='aimlab-analytics-umami-1')
    args = parser.parse_args()
    if args.credentials.stat().st_mode & 0o077:
        raise SystemExit('Credentials must be readable only by their owner')
    try:
        restore_check(args.dump, args.credentials, args.live_app)
    except (RuntimeError, subprocess.TimeoutExpired, ValueError, OSError) as error:
        raise SystemExit('Restore check failed: ' + str(error))
