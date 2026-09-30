import { createRouter, createWebHistory } from "vue-router";

import HomePage from "./pages/HomePage.vue";
import ProfileSearch from "./pages/ProfileSearch.vue";
import TaskSearch from "./pages/TaskSearch.vue";
import PlayerProfile from "./pages/PlayerProfile.vue";
import PlayerTasksOverview from "./pages/PlayerTasksOverview.vue";
import PlayerActivityPage from "./pages/PlayerActivityPage.vue";
import RevosectBenchmarksPage from "./pages/RevosectBenchmarksPage.vue";
import VoltaicBenchmarksPage from "./pages/VoltaicBenchmarksPage.vue";
import LeaderboardsPage from "./pages/LeaderboardsPage.vue";
import BenchmarkLeaderboardsPage from "./pages/BenchmarkLeaderboardsPage.vue";
import TaskView from "./pages/TaskView.vue";
import PlayerRunsPage from "./pages/PlayerRunsPage.vue";
import AboutPage from "./pages/AboutPage.vue";

import BenchmarkCatalogPage from './pages/BenchmarkCatalogPage.vue';

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
