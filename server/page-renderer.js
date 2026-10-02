import { readFile } from 'node:fs/promises';
import { parsePage, pageMetadata, metadataHtml, safeJson, SITE_ORIGIN } from '../shared/seo.js';

let bundle;
let template;
let manifest;
async function fetchApi(origin, path) {
  try {
    const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(6000), headers: { Accept: 'application/json' }, redirect: 'error' });
    const reader = response.body.getReader();
    const chunks = []; let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 1024 * 1024) throw new Error('Response too large');
        chunks.push(Buffer.from(value));
      }
      const body = JSON.parse(Buffer.concat(chunks).toString());
      return { status: response.status, body };
    } finally { await reader.cancel().catch(() => {}); }
  } catch { return { status: 503, body: { error: 'Aimlabs data is temporarily unavailable.' } }; }
}

export async function loadPageData(page, apiOrigin, read = path => fetchApi(apiOrigin, path)) {
  const bootstrap = { path: page.path, url: page.path + (new URLSearchParams(page.query).size ? '?' + new URLSearchParams(page.query) : ''), status: page.status, responses: {} };
  const load = async path => { const response = await read(path); bootstrap.responses[path] = response; return response; };
  const primary = async path => {
    const result = await load(path);
    if (result.status !== 200) bootstrap.status = result.status === 404 ? 404 : result.status === 400 ? 400 : 503;
    return result;
  };
  if (page.status !== 200) return bootstrap;
  if (page.kind === 'catalog' || page.kind === 'standings') {
    const catalog = await primary(`/api/benchmarks/${page.community}`);
    if (bootstrap.status !== 200) return bootstrap;
    const set = catalog.body.sets.find(set => set.id === page.benchmark);
    if (page.kind === 'standings' && page.query.view !== 'scenarios' && Object.values(set.results)[0].rankingAvailable !== false) {
      const number = Number(page.query.page || 1);
      const pageNumber = Number.isSafeInteger(number) && number > 0 ? number : 1;
      const sort = set.rankingOptions.some(option => option.value === page.query.sort) ? page.query.sort : 'overall';
      await load(`/api/leaderboards/${page.community === 'voltaic' ? 'vt' : 'ra'}/${set.id}/${page.level}/page?page=${pageNumber}&sort=${sort}`);
    }
  } else if (page.kind === 'player') {
    const path = `/api/profiles/${encodeURIComponent(page.username)}`;
    await primary(path);
    if (bootstrap.status !== 200) return bootstrap;
    await Promise.all([load(`${path}/details`), ...(page.section === 'activity' ? [load(`${path}/activity`)] : [])]);
  } else if (page.kind === 'task') {
    const path = `/api/tasks/${encodeURIComponent(page.taskId)}`;
    await primary(path);
    if (bootstrap.status !== 200) return bootstrap;
    const params = new URLSearchParams({ page: 0 });
    if (page.query.weapon) params.set('weapon', page.query.weapon);
    if (page.query.mode !== undefined) params.set('mode', page.query.mode);
    await load(`${path}/leaderboard?${params}`);
  } else if (page.kind === 'runs') {
    const path = `/api/profiles/${encodeURIComponent(page.username)}/tasks/${encodeURIComponent(page.taskId)}/runs`;
    await primary(path + (page.query.after ? `?after=${encodeURIComponent(page.query.after)}` : ''));
  }
  return bootstrap;
}

export async function renderPage(address, { apiOrigin, indexable = false, read } = {}) {
  const page = parsePage(address);
  if (page.redirect) return { status: 308, headers: { Location: page.redirect, 'Cache-Control': 'public, max-age=3600' }, body: '' };
  const bootstrap = await loadPageData(page, apiOrigin, read);
  const task = bootstrap.responses[`/api/tasks/${encodeURIComponent(page.taskId)}`]?.body;
  const history = Object.entries(bootstrap.responses).find(([path]) => path.includes('/runs'))?.[1].body;
  const metadata = pageMetadata(page, { task, history, status: bootstrap.status });
  template ||= readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  bundle ||= import('../dist-ssr/entry-server.js');
  manifest ||= readFile(new URL('../dist-ssr/client-manifest.json', import.meta.url), 'utf8').then(JSON.parse);
  const [html, { render }, files] = await Promise.all([template, bundle, manifest]);
  const { content, modules } = await render(bootstrap.url, bootstrap);
  const assets = [...new Set(modules.flatMap(module => files[module] || []).map(file => file.startsWith('/') ? file : '/' + file))]
    .filter(file => !html.includes(`"${file}"`));
  const links = assets.map(file => file.endsWith('.css')
    ? `<link rel="stylesheet" href="${file}" />`
    : file.endsWith('.js') ? `<link rel="modulepreload" crossorigin href="${file}" />` : '').join('');
  const analyticsConnection = indexable ? '<link rel="preconnect" href="https://edge.saibot.site" crossorigin />' : '';
  const body = html.replace('<!--page-head-->', () => metadataHtml(metadata, indexable && metadata.indexable) + links + analyticsConnection)
    .replace('<!--page-content-->', () => content)
    .replace('<!--page-data-->', () => `<script id="page-data" type="application/json">${safeJson(bootstrap)}</script>`);
  const hasFailure = Object.values(bootstrap.responses).some(result => result.status !== 200);
  return {
    status: bootstrap.status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': !indexable || !metadata.indexable || hasFailure ? 'no-store' : 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
      ...(!indexable || !metadata.indexable ? { 'X-Robots-Tag': 'noindex, follow' } : {}),
      ...(bootstrap.status === 503 ? { 'Retry-After': '60' } : {}),
    },
    body,
  };
}

export function isPublicHost(host) {
  return host === new URL(SITE_ORIGIN).host;
}
