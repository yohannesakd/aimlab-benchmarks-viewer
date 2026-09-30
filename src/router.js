import { createRouter, createWebHistory } from "vue-router";

const HomePage = () => import('./pages/HomePage.vue');
const ProfileSearch = () => import('./pages/ProfileSearch.vue');
const TaskSearch = () => import('./pages/TaskSearch.vue');
const PlayerProfile = () => import('./pages/PlayerProfile.vue');
const PlayerTasksOverview = () => import('./pages/PlayerTasksOverview.vue');
const PlayerActivityPage = () => import('./pages/PlayerActivityPage.vue');
const RevosectBenchmarksPage = () => import('./pages/RevosectBenchmarksPage.vue');
const VoltaicBenchmarksPage = () => import('./pages/VoltaicBenchmarksPage.vue');
const LeaderboardsPage = () => import('./pages/LeaderboardsPage.vue');
const BenchmarkLeaderboardsPage = () => import('./pages/BenchmarkLeaderboardsPage.vue');
const TaskView = () => import('./pages/TaskView.vue');
const PlayerRunsPage = () => import('./pages/PlayerRunsPage.vue');
const AboutPage = () => import('./pages/AboutPage.vue');

const BenchmarkCatalogPage = () => import('./pages/BenchmarkCatalogPage.vue');

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/home" },
    { path: "/home", component: HomePage },
    {
      path: "/profile",
      component: ProfileSearch,
    },
    {
      path: "/profile/:username/tasks/:taskId/runs",
      component: PlayerRunsPage,
      props: true,
    },
    {
      path: "/profile/:username",
      component: PlayerProfile,
      props: true,
      children: [
        {
          path: "",
          redirect: { name: "profile-overview" },
        },
        {
          name: "profile-overview",
          path: "overview",
          component: PlayerTasksOverview,
        },
        {
          name: "profile-activity",
          path: "activity",
          component: PlayerActivityPage,
          props: true,
        },
        {
          name: "vt-benches",
          path: "voltaic",
          component: VoltaicBenchmarksPage,
        },
        {
          name: "ra-benches",
          path: "revosect",
          component: RevosectBenchmarksPage,
        },
      ],
    },
    {
      path: "/tasks",
      component: TaskSearch,
    },
    {
      path: "/tasks/:taskId",
      redirect: { name: "task-view" },
    },
    {
      name: "task-view",
      path: "/tasks/:taskId/leaderboard",
      component: TaskView,
      props: true,
    },

    {
      path: "/leaderboards",
      component: LeaderboardsPage,
      children: [
        { path: "", redirect: { name: "ra-leaderboards" } },
        {
          name: "vt-leaderboards",
          path: "vt",
          component: BenchmarkLeaderboardsPage,
          props: { community: "voltaic" },
        },
        {
          name: "ra-leaderboards",
          path: "ra",
          component: BenchmarkLeaderboardsPage,
          props: { community: "revosect" },
        },
      ],
    },
    { path: "/benchmarks/:community(voltaic|revosect)", component: BenchmarkCatalogPage, props: true },
    { path: "/about", component: AboutPage },
    { path: "/:notFound(.*)", component: null },
  ],
});

export default router;
