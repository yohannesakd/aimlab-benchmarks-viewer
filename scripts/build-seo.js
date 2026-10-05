import { writeFile, rename } from 'node:fs/promises';
import { getBenchmarkCatalog } from '../server/app-data.js';
import { SITE_ORIGIN, escapeHtml, parsePage, pageMetadata } from '../shared/seo.js';

const paths = new Set(['/home', '/about', '/profile', '/tasks']);
await rename('dist/.vite/ssr-manifest.json', 'dist-ssr/client-manifest.json');
for (const community of ['voltaic', 'revosect']) {
  for (const set of getBenchmarkCatalog(community).sets) {
    for (const [key, result] of Object.entries(set.results)) {
      const level = key.slice(2).toLowerCase();
      paths.add(`/benchmarks/${community}?benchmark=${set.id}&level=${level}`);
      paths.add(`/leaderboards/${community === 'voltaic' ? 'vt' : 'ra'}?benchmark=${set.id}&level=${level}`);
      for (const task of result.benchmarks) {
        paths.add(`/tasks/${encodeURIComponent(task.id)}/leaderboard?weapon=${encodeURIComponent(task.weapon)}`);
      }
    }
  }
}
const canonicals = [...new Set([...paths].map(path => pageMetadata(parsePage(path)).canonical))].sort();
await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${canonicals.map(url => `  <url><loc>${escapeHtml(url)}</loc></url>`).join('\n')}\n</urlset>\n`);
await writeFile('dist/robots.txt', process.env.AIMLAB_ENV === 'production'
  ? `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`
  : 'User-agent: *\nDisallow: /\n');
console.log(`SEO: sitemap generated with ${canonicals.length} canonical URLs; no upstream API calls.`);
