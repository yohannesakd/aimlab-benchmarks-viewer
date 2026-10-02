import "./style.css";
import { createApplication } from './app.js';
import { initAnalytics } from './helpers/analytics.js';
import { initSeo } from './helpers/seo.js';
import { loadSavedProfile } from './helpers/savedProfile.js';

const element = document.getElementById('page-data');
const bootstrap = element ? JSON.parse(element.textContent) : null;
element?.remove();
const { app, router, store, displayZone, clearInitialData } = createApplication(bootstrap);
initSeo(router, store, app);
await router.isReady();
app.mount('#app');
void initAnalytics(router, app);
clearInitialData();
loadSavedProfile();
displayZone.value = { locale: navigator.language, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
