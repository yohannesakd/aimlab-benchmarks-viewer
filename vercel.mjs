import { SITE_ORIGIN } from './shared/seo.js';

const origin = new URL(process.env.AIMLAB_API_ORIGIN || (process.env.VERCEL_ENV === 'production'
  ? 'https://aimlab-api.saibot.site'
  : 'https://aimlab-staging-api.saibot.site'));
if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) {
  throw new Error('AIMLAB_API_ORIGIN must be an HTTPS origin');
}
export const apiOrigin = origin.origin;

export default {
  functions: { 'api/render.js': { includeFiles: '{dist/index.html,dist-ssr/**}', maxDuration: 30 } },
  headers: [
    ...['leaderboards', 'profiles', 'tasks', 'benchmarks', 'telemetry'].map(namespace => ({ source: `/api/${namespace}/:path*`, headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] })),
    ...(process.env.VERCEL_ENV !== 'production' ? [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }] : []),
  ],
  redirects: [
    ...(process.env.VERCEL_ENV === 'production' ? [
      { source: '/', has: [{ type: 'host', value: 'aimlab-tracker.vercel.app' }], destination: `${SITE_ORIGIN}/home`, permanent: true },
      { source: '/((?!googleb46c4e92b2751d24\\.html$).*)', has: [{ type: 'host', value: 'aimlab-tracker.vercel.app' }], destination: `${SITE_ORIGIN}/$1`, permanent: true },
    ] : []),
    { source: '/', destination: '/home', permanent: true },
    { source: '/index.html', destination: '/home', permanent: true },
    { source: '/leaderboards', destination: '/leaderboards/ra', permanent: true },
  ],
  rewrites: [
  ...['leaderboards', 'profiles', 'tasks', 'benchmarks', 'telemetry'].map(namespace => ({
      source: `/api/${namespace}/:path*`,
      destination: `${origin.origin}/api/${namespace}/:path*`,
    })),
    { source: '/((?!api(?:/|$)|assets(?:/|$)).*)', destination: '/api/render?__page=/$1' },
  ],
};
