import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { createRequestCache } from './request-cache.js';
import { getPublicProfileDetails } from './public-details.js';

const cached = createRequestCache({ ttlMs: 3_600_000, maxEntries: 64, name: 'avatar' });
const maxBytes = 5 * 1024 * 1024;
let activeDownloads = 0;

function unavailable(status = 502) {
  return Object.assign(new Error('Avatar unavailable'), { status });
}

export function getPlayerAvatar(imageUrl) {
  let url;
  try { url = new URL(imageUrl); } catch { return Promise.reject(unavailable(404)); }
  if (url.origin !== 'https://marketplace-api-public-prod.s3.amazonaws.com'
      || !url.pathname.startsWith('/avatar_asset/profile_image/')
      || url.username || url.password || url.search || url.hash) {
    return Promise.reject(unavailable(404));
  }
  return cached(url.href, async () => {
    if (activeDownloads >= 4) throw unavailable(503);
    activeDownloads++;
    try {
      const response = await fetch(url.href, { redirect: 'error', signal: AbortSignal.timeout(5000) });
      if (!response.ok || !response.body || Number(response.headers.get('content-length')) > maxBytes
          || !/^(image\/(png|jpeg|webp|gif)|application\/octet-stream)(;|$)/i.test(response.headers.get('content-type') || '')) {
        await response.body?.cancel();
        throw unavailable();
      }
      const chunks = [];
      let bytes = 0;
      for await (const chunk of response.body) {
        bytes += chunk.byteLength;
        if (bytes > maxBytes) throw unavailable();
        chunks.push(chunk);
      }
      const input = Buffer.concat(chunks);
      const png = input.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
      const jpeg = input.subarray(0, 3).toString('hex') === 'ffd8ff';
      const gif = ['GIF87a', 'GIF89a'].includes(input.subarray(0, 6).toString('ascii'));
      const webp = input.subarray(0, 4).toString('ascii') === 'RIFF' && input.subarray(8, 12).toString('ascii') === 'WEBP';
      if (!png && !jpeg && !gif && !webp) throw unavailable();
      const image = sharp(input, { limitInputPixels: 16_777_216, animated: false });
      const body = await image.rotate().resize(88, 88, { fit: 'cover' }).webp({ quality: 80 }).timeout({ seconds: 3 }).toBuffer();
      return { body, etag: `"${createHash('sha256').update(body).digest('hex')}"` };
    } finally {
      activeDownloads--;
    }
  });
}

export async function handlePlayerAvatarRequest(request, response, pathname) {
  const match = pathname.match(/^\/api\/profiles\/([^/]+)\/avatar$/);
  if (!match) return false;
  response.setHeader('X-Robots-Tag', 'noindex');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' }).end();
    return true;
  }
  let username;
  try { username = decodeURIComponent(match[1]); } catch {
    response.writeHead(400, { 'Cache-Control': 'no-store' }).end();
    return true;
  }
  if (!username || username.length > 64 || /[\x00-\x1f]/.test(username)) {
    response.writeHead(400, { 'Cache-Control': 'no-store' }).end();
    return true;
  }
  try {
    const profile = await getPublicProfileDetails(username);
    const { body, etag } = await getPlayerAvatar(profile.imageUrl);
    const headers = { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=300, s-maxage=3600', ETag: etag };
    if (request.headers['if-none-match'] === etag) response.writeHead(304, headers).end();
    else response.writeHead(200, { ...headers, 'Content-Length': body.length }).end(request.method === 'HEAD' ? '' : body);
  } catch (error) {
    const status = [404, 429, 503].includes(error.status) ? error.status : 502;
    response.writeHead(status, { 'Cache-Control': 'no-store', ...(status === 429 || status === 503 ? { 'Retry-After': String(error.retryAfter || 5) } : {}) }).end();
  }
  return true;
}
