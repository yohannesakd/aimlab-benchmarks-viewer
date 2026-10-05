import { readFile } from 'node:fs/promises';
import { renderPage } from './page-renderer.js';

const assetTypes = {
  js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml',
  png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg',
  jpeg: 'image/jpeg', gif: 'image/gif', woff2: 'font/woff2',
};

export async function handlePublicPageRequest(request, response, url, { apiOrigin, environment }) {
  const page = url.pathname.match(/^\/api\/pages\/(public|preview)(\/.*)$/);
  const asset = url.pathname.startsWith('/api/site-assets/');
  if (!page && !asset) return false;
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' }).end();
    return true;
  }
  if (asset) {
    let name;
    try { name = decodeURIComponent(url.pathname.slice('/api/site-assets/'.length)); }
    catch { response.writeHead(400, { 'Cache-Control': 'no-store' }).end(); return true; }
    const extension = name.match(/^[A-Za-z0-9_.-]+\.([a-z0-9]+)$/)?.[1];
    if (!Object.hasOwn(assetTypes, extension)) {
      response.writeHead(404, { 'Cache-Control': 'no-store' }).end();
      return true;
    }
    try {
      const body = await readFile(new URL(`../dist/assets/${name}`, import.meta.url));
      response.writeHead(200, {
        'Content-Type': assetTypes[extension],
        'Content-Length': body.length,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'CDN-Cache-Control': 'max-age=31536000',
      }).end(request.method === 'HEAD' ? '' : body);
    } catch (error) {
      if (error.code !== 'ENOENT') console.error('Site asset failed', error.name);
      response.writeHead(error.code === 'ENOENT' ? 404 : 503, { 'Cache-Control': 'no-store' }).end();
    }
    return true;
  }
  const path = page[2];
  if (path.startsWith('//')) {
    response.writeHead(400, { 'Cache-Control': 'no-store' }).end();
    return true;
  }
  try {
    const result = await renderPage(path + url.search, {
      apiOrigin,
      indexable: environment === 'production' && page[1] === 'public',
    });
    response.writeHead(result.status, { ...result.headers, 'X-Aimlab-Renderer': 'vps' })
      .end(request.method === 'HEAD' ? '' : result.body);
  } catch (error) {
    console.error('Page rendering failed', error.name);
    response.writeHead(503, {
      'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '60',
    }).end(request.method === 'HEAD' ? '' : 'Page temporarily unavailable. Please try again.');
  }
  return true;
}
