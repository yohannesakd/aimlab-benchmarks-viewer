export const SITE_ORIGIN = 'https://aimlab-tracker.saibot.site';
export const SITE_NAME = 'Aimlab Tracker';
const communities = { voltaic: 'Voltaic', revosect: 'Revosect' };
const levels = { voltaic: ['novice', 'intermediate', 'advanced'], revosect: ['easy', 'medium', 'hard'] };
const sets = { voltaic: ['aimlabs_s3', 'aimlabs_s2'], revosect: ['revosect_s4', 'legacy'] };
export const titleCase = value => value[0].toUpperCase() + value.slice(1);

export function parsePage(address) {
  const url = new URL(address, SITE_ORIGIN);
  const page = { path: url.pathname, query: Object.fromEntries(url.searchParams), status: 200 };
  if (url.pathname.length > 2048 || url.search.length > 2048) return { ...page, status: 414 };
  if ([...url.searchParams].length !== new Set(url.searchParams.keys()).size) return { ...page, status: 400 };
  const trimmed = url.pathname.replace(/\/+$/, '') || '/';
  if (trimmed !== url.pathname) return { ...page, redirect: trimmed + url.search };
  if (['/', '/index.html'].includes(page.path)) return { ...page, redirect: '/home' + url.search };
  if (['/home', '/about', '/profile', '/tasks'].includes(page.path)) return { ...page, kind: page.path.slice(1) };
  if (page.path === '/leaderboards') return { ...page, redirect: '/leaderboards/ra' + url.search };
  let match;
  try {
    if ((match = page.path.match(/^\/profile\/([^/]+)(?:\/(overview|activity|voltaic|revosect)|\/tasks\/([^/]+)\/runs)?$/))) {
      page.username = decodeURIComponent(match[1]);
      if (!page.username || page.username.length > 64 || /[\x00-\x1f]/.test(page.username)) throw new URIError();
      page.kind = match[3] ? 'runs' : 'player';
      page.section = match[2] || 'overview';
      if (match[3]) page.taskId = decodeURIComponent(match[3]);
      if (!match[2] && !match[3]) return { ...page, redirect: `${page.path}/overview${url.search}` };
      if (communities[page.section]) page.community = page.section;
    } else if ((match = page.path.match(/^\/tasks\/([^/]+)(\/leaderboard)?$/))) {
      page.kind = 'task'; page.taskId = decodeURIComponent(match[1]);
      if (!match[2]) return { ...page, redirect: `${page.path}/leaderboard${url.search}` };
    } else if ((match = page.path.match(/^\/benchmarks\/(voltaic|revosect)$/))) {
      page.kind = 'catalog'; page.community = match[1];
    } else if ((match = page.path.match(/^\/leaderboards\/(vt|ra)$/))) {
      page.kind = 'standings'; page.community = match[1] === 'vt' ? 'voltaic' : 'revosect';
    } else return { ...page, status: 404 };
    if (page.taskId && (page.taskId.length > 256 || /[\x00-\x1f]/.test(page.taskId))) throw new URIError();
  } catch { return { ...page, status: 400 }; }
  if (page.community) {
    const requested = page.community === 'voltaic' && page.query.benchmark === 'legacy' ? 'aimlabs_s2' : page.query.benchmark;
    page.benchmark = sets[page.community].includes(requested) ? requested : sets[page.community][0];
    page.level = levels[page.community].includes(page.query.level) ? page.query.level : (page.kind === 'player' ? levels[page.community].at(-1) : levels[page.community][0]);
  }
  return page;
}

export function pageMetadata(page, data = {}) {
  const params = new URLSearchParams();
  let label = SITE_NAME;
  let description = 'Track Aimlabs player stats, scores and run history. Explore Voltaic and Revosect benchmark ranks, score requirements and leaderboards.';
  const community = communities[page.community];
  const season = page.benchmark === 'legacy' ? 'Series 2' : page.benchmark === 'revosect_s4' ? 'Series 4' : `Season ${page.benchmark?.slice(-1)}`;
  const selection = community ? `${community} ${season} ${titleCase(page.level)}` : '';
  if (community) { params.set('benchmark', page.benchmark); params.set('level', page.level); }
  switch (page.kind) {
    case 'home': label = 'Aimlabs Stats, Benchmarks & Leaderboards'; break;
    case 'about': label = 'About'; description = 'About Aimlab Tracker, its Aimlabs player statistics, Voltaic and Revosect benchmarks, data sources and privacy.'; break;
    case 'profile': label = 'Find an Aimlabs Player'; description = 'Search Aimlabs players and explore their scores, personal bests, training activity, run history and benchmark ranks.'; break;
    case 'tasks': label = 'Find an Aimlabs Task'; description = 'Search Aimlabs tasks and scenarios to view score leaderboards and individual run statistics.'; break;
    case 'catalog': label = `${selection} Benchmarks`; description = `${selection} Aimlabs scenarios and rank score requirements. Compare thresholds and open each task leaderboard.`; break;
    case 'standings': {
      const scenarios = page.query.view === 'scenarios' || (page.community === 'revosect' && page.benchmark === 'revosect_s4');
      if (scenarios && !(page.community === 'revosect' && page.benchmark === 'revosect_s4')) params.set('view', 'scenarios');
      label = `${selection} ${scenarios ? 'Scenario Leaderboards' : 'Leaderboard'}`;
      description = `${selection} Aimlabs ${scenarios ? 'scenario score leaderboards' : 'player standings and benchmark ranks'}, with ${page.community === 'voltaic' ? 'energy' : 'points'} and links to player scores.`;
      break;
    }
    case 'player': {
      label = `${page.username} · ${community ? selection : page.section === 'activity' ? 'Training Activity' : 'Aimlabs Stats'}`;
      description = `${page.username}'s ${community ? `${selection} benchmark scores and ranks` : 'Aimlabs scores, personal bests, training activity and run history'}.`;
      break;
    }
    case 'runs': label = `${page.username} · ${data.history?.taskName || 'Aimlabs'} Run History`; description = `View ${page.username}'s ${data.history?.taskName || 'Aimlabs scenario'} runs, scores, accuracy, shots and dates.`; break;
    case 'task': {
      const name = data.task?.name || 'Aimlabs Task';
      label = `${name} Leaderboard`;
      description = `${name} Aimlabs scores, player rankings and run statistics.${data.task?.description ? ' ' + data.task.description.replace(/\s+/g, ' ').slice(0, 100) : ''}`;
      if (page.query.weapon) params.set('weapon', page.query.weapon);
      if (page.query.mode && page.query.mode !== '0') params.set('mode', page.query.mode);
      break;
    }
  }
  const status = data.status || page.status;
  if (status >= 400) { label = status === 404 ? 'Page Not Found' : 'Data Temporarily Unavailable'; description = status === 404 ? 'This page could not be found.' : 'Aimlabs data is temporarily unavailable. Please try again later.'; }
  const canonical = SITE_ORIGIN + page.path + (params.size ? `?${params}` : '');
  const indexable = status === 200 && page.kind !== 'runs' && !page.query.after && !page.query.run
    && !(Number(page.query.page) > 1) && (!page.query.sort || page.query.sort === 'overall');
  const title = `${label} | ${SITE_NAME}`;
  const breadcrumbs = [{ '@type': 'ListItem', position: 1, name: SITE_NAME, item: SITE_ORIGIN + '/home' }];
  if (page.kind !== 'home') breadcrumbs.push({ '@type': 'ListItem', position: 2, name: label, item: canonical });
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': SITE_ORIGIN + '/#website', url: SITE_ORIGIN + '/home', name: SITE_NAME, alternateName: 'Aimlab Stats Tracker', inLanguage: 'en' },
      { '@type': page.kind === 'player' ? 'ProfilePage' : page.kind === 'catalog' || page.kind === 'standings' ? 'CollectionPage' : 'WebPage', '@id': canonical, url: canonical, name: title, description, isPartOf: { '@id': SITE_ORIGIN + '/#website' }, ...(page.kind === 'player' ? { mainEntity: { '@type': 'Person', name: page.username } } : {}) },
      { '@type': 'BreadcrumbList', itemListElement: breadcrumbs },
    ],
  };
  return { title, description, canonical, indexable, structuredData };
}

export function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export function metadataHtml(metadata, indexable = metadata.indexable) {
  return `<title>${escapeHtml(metadata.title)}</title>
    <meta name="description" content="${escapeHtml(metadata.description)}" />
    <meta name="robots" content="${indexable ? 'index,follow,max-image-preview:large' : 'noindex,follow'}" />
    <link rel="canonical" href="${escapeHtml(metadata.canonical)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:title" content="${escapeHtml(metadata.title)}" />
    <meta property="og:description" content="${escapeHtml(metadata.description)}" />
    <meta property="og:url" content="${escapeHtml(metadata.canonical)}" />
    <meta property="og:image" content="${SITE_ORIGIN}/social-card.png" />
    <meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Aimlab Tracker — player statistics, benchmarks and leaderboards" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(metadata.title)}" />
    <meta name="twitter:description" content="${escapeHtml(metadata.description)}" />
    <meta name="twitter:image" content="${SITE_ORIGIN}/social-card.png" />
    <script id="structured-data" type="application/ld+json">${safeJson(metadata.structuredData)}</script>`;
}
