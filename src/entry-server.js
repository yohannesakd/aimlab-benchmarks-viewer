import { renderToString } from 'vue/server-renderer';
import { createApplication } from './app.js';

export async function render(url, bootstrap) {
  const { app, router } = createApplication(bootstrap);
  await router.push(url);
  await router.isReady();
  const context = {};
  const content = await renderToString(app, context);
  return { content, modules: [...context.modules] };
}
