import { SITE_ORIGIN } from './shared/seo.js';

const origin = new URL(process.env.AIMLAB_API_ORIGIN || (process.env.VERCEL_ENV === 'production'
  ? 'https://aimlab-api.saibot.site'
  : 'https://aimlab-staging-api.saibot.site'));
if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) {
  throw new Error('AIMLAB_API_ORIGIN must be an HTTPS origin');
}

export default {
  headers: [
    { source: '/((?!api(?:/|$)|assets(?:/|$)).*)', headers: [{ key: 'x-vercel-enable-rewrite-caching', value: '1' }] },
    { source: '/assets/:path*', headers: [{ key: 'x-vercel-enable-rewrite-caching', value: '1' }] },
    { source: '/fonts/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
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
    { source: '/assets/:path*', destination: `${origin.origin}/api/site-assets/:path*` },
    ...(process.env.VERCEL_ENV === 'production' ? [{
      source: '/((?!api(?:/|$)|assets(?:/|$)).*)',
      has: [{ type: 'host', value: new URL(SITE_ORIGIN).host }],
      destination: `${origin.origin}/api/pages/public/$1`,
    }] : []),
    { source: '/((?!api(?:/|$)|assets(?:/|$)).*)', destination: `${origin.origin}/api/pages/preview/$1` },
  ],
};
