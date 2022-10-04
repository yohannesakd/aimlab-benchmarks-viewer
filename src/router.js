import { createRouter, createWebHistory } from "vue-router";

//Pages
import HomePage from "./pages/HomePage.vue";
import ProfilePage from "./pages/ProfilePage.vue";
import TasksPage from "./pages/TasksPage.vue";
import PlayerProfile from "./pages/PlayerProfile.vue";
import PlayerTasksOverview from "./pages/PlayerTasksOverview.vue";
import RevosectBenchmarksPage from "./pages/RevosectBenchmarksPage.vue";
import VoltaicBenchmarksPage from "./pages/VoltaicBenchmarksPage.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/home" },
    { path: "/home", component: HomePage },
    { path: "/profile", component: ProfilePage },
    {
      path: "/profile/:username",
      component: PlayerProfile,
      props: true,
      children: [
        { path: "", redirect: { name: "profile-overview" } },
        {
          name: "profile-overview",
          path: "overview",
          component: PlayerTasksOverview,
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
    { path: "/tasks", component: TasksPage },
  ],
});

export default router;
