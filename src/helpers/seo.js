import { watch, ref } from 'vue';
import { parsePage, pageMetadata, SITE_ORIGIN, safeJson } from '../../shared/seo.js';

export function initSeo(router, store, app) {
  const status = ref(app.config.globalProperties.$bootstrap?.status || 200);
  app.config.globalProperties.$setSeoStatus = value => { status.value = value; };
  const update = () => {
    const page = parsePage(router.currentRoute.value.fullPath);
    const metadata = pageMetadata(page, { task: store.getters.currentTask.id === page.taskId ? store.getters.currentTask : null, status: status.value === 200 ? page.status : status.value });
    document.title = metadata.title;
    const set = (selector, attributes) => {
      let element = document.head.querySelector(selector);
      if (!element) { element = document.createElement(selector.startsWith('link') ? 'link' : 'meta'); document.head.append(element); }
      for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    };
    set('meta[name="description"]', { name: 'description', content: metadata.description });
    set('meta[name="robots"]', { name: 'robots', content: metadata.indexable && location.origin === SITE_ORIGIN ? 'index,follow,max-image-preview:large' : 'noindex,follow' });
    set('link[rel="canonical"]', { rel: 'canonical', href: metadata.canonical });
    for (const [property, content] of Object.entries({ 'og:title': metadata.title, 'og:description': metadata.description, 'og:url': metadata.canonical })) set(`meta[property="${property}"]`, { property, content });
    for (const [name, content] of Object.entries({ 'twitter:title': metadata.title, 'twitter:description': metadata.description })) set(`meta[name="${name}"]`, { name, content });
    let structured = document.getElementById('structured-data');
    if (!structured) { structured = document.createElement('script'); structured.id = 'structured-data'; structured.type = 'application/ld+json'; document.head.append(structured); }
    structured.textContent = safeJson(metadata.structuredData);
  };
  let firstNavigation = true;
  router.afterEach((to, from, failure) => { if (!failure) { if (!firstNavigation) status.value = 200; firstNavigation = false; update(); } });
  watch([router.currentRoute, () => store.getters.currentTask, status], update);
  void router.isReady().then(update);
}
