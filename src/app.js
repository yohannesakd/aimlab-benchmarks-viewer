import { createApp, createSSRApp, ref } from 'vue';
import { createAppRouter } from './router.js';
import { createAppStore } from './store/index.js';
import App from './App.vue';
import BaseCard from './components/UI/BaseCard.vue';
import ProgressBar from './components/UI/ProgressBar.vue';
import ChevronIcon from './components/UI/ChevronIcon.vue';
import Dropdown from './components/UI/Dropdown.vue';
import PlayIcon from './components/UI/PlayIcon.vue';
import LoadingSpinner from './components/LoadingSpinner.vue';
import { parsePage } from '../shared/seo.js';

export function createApplication(bootstrap = null) {
  const app = (bootstrap ? createSSRApp : createApp)(App);
  const router = createAppRouter();
  const store = createAppStore();
  const displayZone = ref({ locale: 'en-US', timeZone: 'UTC' });
  const page = bootstrap ? parsePage(bootstrap.url) : {};
  const profile = bootstrap?.responses[`/api/profiles/${encodeURIComponent(page.username)}`];
  const task = bootstrap?.responses[`/api/tasks/${encodeURIComponent(page.taskId)}`];
  if (profile?.status === 200) store.commit('setProfileSnapshot', profile.body);
  if (task?.status === 200) store.commit('setCurrentTask', task.body);
  const leaderboard = Object.entries(bootstrap?.responses || {}).find(([path]) => path.startsWith(`/api/tasks/${encodeURIComponent(page.taskId)}/leaderboard?`))?.[1];
  if (leaderboard?.status === 200) store.commit('setCurrentTaskLeaderboard', leaderboard.body);
  app.config.globalProperties.$bootstrap = bootstrap;
  app.config.globalProperties.$formatDate = (value, options) => new Date(value).toLocaleString(displayZone.value.locale, { ...options, timeZone: displayZone.value.timeZone });
  app.mixin({ data() { return { initialResponses: { ...bootstrap?.responses } }; } });
  app.component('base-card', BaseCard).component('loading-spinner', LoadingSpinner)
    .component('progress-bar', ProgressBar).component('dropdown', Dropdown)
    .component('chevron-icon', ChevronIcon).component('play-icon', PlayIcon)
    .use(store).use(router);
  return { app, router, store, displayZone, clearInitialData() {
    bootstrap = null;
    app.config.globalProperties.$bootstrap = null;
  } };
}
