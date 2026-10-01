const origin = new URL(process.env.AIMLAB_API_ORIGIN || (process.env.VERCEL_ENV === 'production'
  ? 'https://aimlab-api.saibot.site'
  : 'https://aimlab-staging-api.saibot.site'));
if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) {
  throw new Error('AIMLAB_API_ORIGIN must be an HTTPS origin');
}

export default {
  rewrites: [
  ...['leaderboards', 'profiles', 'tasks', 'benchmarks', 'telemetry'].map(namespace => ({
      source: `/api/${namespace}/:path*`,
      destination: `${origin.origin}/api/${namespace}/:path*`,
    })),
    { source: '/((?!api(?:/|$)).*)', destination: '/index.html' },
  ],
};
