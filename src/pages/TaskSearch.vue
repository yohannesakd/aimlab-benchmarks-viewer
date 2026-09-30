<template>
  <main class="page-shell">
    <div class="search-layout">
      <div class="page-intro">
        <p class="eyebrow">Scenario lookup</p>
        <h1 class="page-title">Find a task</h1>
        <p class="page-subtitle">Search Aimlab scenarios to view their details and leaderboard.</p>
      </div>
      <div class="panel panel-body">
        <form class="search-form" @submit.prevent="searchTask">
          <label class="sr-only" for="taskname">Task or scenario name</label>
          <input id="taskname" class="text-field" type="text" autocomplete="off" placeholder="Enter a task or scenario name" v-model.trim="taskNameInput" />
          <button class="btn-primary" type="submit">Search</button>
        </form>
        <p class="result-meta mt-3">Specific names give the best results.</p>
      </div>
      <div v-if="searchStatus" class="panel search-result status-panel" role="status">{{ searchStatus }}</div>
      <div v-if="taskList.length" class="panel search-result">
        <div class="panel-header"><h2 class="section-title">Matching tasks</h2><span class="result-meta">{{ taskList.length }} results</span></div>
        <router-link v-for="task in taskList" :key="task.id" class="result-row" :to="taskLeaderboardLink(task.id)">
          <div>
            <h3 class="result-title">{{ task.name }}</h3>
            <p class="result-meta">By {{ task.author?.username || "Unknown creator" }}</p>
          </div>
          <div class="result-action">
            <img v-if="task.image_url" :src="task.image_url" alt="" class="task-thumbnail" />
            <span aria-hidden="true">→</span>
          </div>
        </router-link>
      </div>
    </div>
  </main>
</template>
<style scoped>
.result-action { display: flex; align-items: center; gap: 14px; color: var(--accent); }
.task-thumbnail { width: 44px; height: 44px; object-fit: cover; border: 1px solid var(--line); }
</style>

<script>
import { fetchData } from "../helpers/api.js";
export default {
  data() {
    return {
      taskNameInput: "",
      taskList: [],
      searchStatus: "",
      requestVersion: 0,
    };
  },
  beforeUnmount() {
    this.requestVersion++;
  },
  methods: {
    async searchTask() {
      const name = this.taskNameInput;
      if (!name) return;
      const version = ++this.requestVersion;
      this.taskList = [];
      this.searchStatus = "Searching...";
      try {
        const data = await fetchData(`/api/tasks/search?name=${encodeURIComponent(name)}`);
        if (version !== this.requestVersion) return;
        if (!Array.isArray(data)) throw new Error("Missing task search results");
        this.taskList = data;
        this.searchStatus = this.taskList.length ? "" : "No tasks found";
        window.umami?.track("task-search", {
          result: this.taskList.length ? "found" : "missing",
        });
      } catch (error) {
        if (version === this.requestVersion) {
          console.error(error);
          this.searchStatus = "Search is unavailable. Try again.";
          window.umami?.track("task-search", { result: "error" });
        }
      }
    },
    taskLeaderboardLink(id) {
      return "/tasks/" + encodeURIComponent(id) + "/leaderboard";
    },
  },
};
</script>
