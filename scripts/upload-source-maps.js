import { execFileSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';

const configured = Boolean(process.env.POSTHOG_CLI_API_KEY);
if (process.env.VERCEL_ENV === 'production' && !configured) {
  throw new Error('Production requires the private PostHog source-map upload key.');
}
if (configured) {
  if (!process.env.POSTHOG_CLI_HOST || !process.env.POSTHOG_CLI_PROJECT_ID) {
    throw new Error('Source-map uploads require an explicit PostHog host and project ID.');
  }
  const release = process.env.VERCEL_GIT_COMMIT_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  for (const directory of ['dist/assets', 'dist-ssr']) {
    execFileSync('node_modules/.bin/posthog-cli', [
      'sourcemap', 'process', '--directory', directory,
      '--release-name', 'aimlab-tracker', '--release-version', release,
      '--delete-after', '--concurrency', '2',
    ], { stdio: 'inherit', timeout: 120_000 });
  }
}
for (const directory of ['dist', 'dist-ssr']) {
  const files = await readdir(directory, { recursive: true });
  if (files.some(file => file.endsWith('.map'))) throw new Error(`Source maps remain in ${directory}; refusing to publish.`);
}
