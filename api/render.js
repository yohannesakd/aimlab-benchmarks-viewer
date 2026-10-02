import { renderPage, isPublicHost } from '../server/page-renderer.js';
import { apiOrigin } from '../vercel.mjs';

export default async function handler(request, response) {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
  const url = new URL(request.url, 'https://localhost');
  const path = url.searchParams.get('__page') || url.pathname;
  url.searchParams.delete('__page');
  if (!path.startsWith('/') || path.startsWith('//')) { response.writeHead(400).end(); return; }
  try {
    const result = await renderPage(path + (url.searchParams.size ? '?' + url.searchParams : ''), {
      apiOrigin, indexable: process.env.VERCEL_ENV === 'production' && isPublicHost(request.headers.host),
    });
    response.writeHead(result.status, result.headers).end(request.method === 'HEAD' ? '' : result.body);
  } catch (error) {
    console.error('Page rendering failed', error.name);
    response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '60' }).end('Page temporarily unavailable. Please try again.');
  }
}
