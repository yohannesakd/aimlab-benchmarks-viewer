import { createRouter, createWebHistory } from "vue-router";

//Pages
import HomePage from "./pages/HomePage.vue";
import ProfilePage from "./pages/ProfilePage.vue";
import TasksPage from "./pages/TasksPage.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/home" },
    { path: "/home", component: HomePage },
    { path: "/profile", component: ProfilePage },
    { path: "/tasks", component: TasksPage },
  ],
});

export default router;
