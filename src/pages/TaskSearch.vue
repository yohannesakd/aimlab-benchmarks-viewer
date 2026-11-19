<template>
  <main class="page-shell">
    <div class="search-layout">
      <div class="page-intro">
        <h1 class="page-title">Find a task</h1>
      </div>
      <div class="panel panel-body">
        <form class="search-form" @submit.prevent="submitSearch">
          <label class="sr-only" for="taskname">Task or scenario name</label>
          <input id="taskname" class="text-field" type="text" autocomplete="off" placeholder="Enter a task or scenario name" v-model.trim="taskNameInput" />
          <button class="btn-primary" type="submit">Search</button>
        </form>
      </div>
      <div v-if="searchStatus" class="panel search-result status-panel" role="status">{{ searchStatus }}</div>
      <div v-if="taskList.length" class="panel search-result">
        <div class="panel-header"><h2 class="section-title">Matching tasks</h2><span class="result-meta">{{ taskList.length }} results</span></div>
        <p v-if="taskList.length >= providerResultLimit" class="result-meta search-limit">Aimlabs returns only the first {{ providerResultLimit }} matches. Type more of the name to find other tasks.</p>
        <router-link v-for="task in taskList" :key="task.id" class="result-row" :to="taskLeaderboardLink(task.id)">
          <div>
            <h3 class="result-title">{{ task.name }}</h3>
            <p v-if="task.author?.username" class="result-meta">{{ task.author.username }}</p>
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
.search-limit { padding: 10px 20px; border-bottom: 1px solid var(--line); }
.result-action { display: flex; align-items: center; gap: 14px; color: var(--accent); }
.task-thumbnail { width: 44px; height: 44px; object-fit: cover; border: 1px solid var(--line); }
</style>

<script>
import { fetchData } from "../helpers/api.js";
import { captureEvent } from '../helpers/analytics.js';
export default {
  data() {
    return {
      taskNameInput: "",
      taskList: [],
      searchStatus: "",
      requestVersion: 0,
      providerResultLimit: 10,
    };
  },
  // The search text is in the URL, so Back from a task returns to the same results.
  watch: { '$route.query.q': { immediate: true, handler(query) {
    const name = typeof query === 'string' ? query.trim() : '';
    this.taskNameInput = name;
    if (name) this.searchTask(name);
    else { this.requestVersion++; this.taskList = []; this.searchStatus = ''; }
  } } },
  beforeUnmount() {
    this.requestVersion++;
  },
  methods: {
    submitSearch() {
      const name = this.taskNameInput;
      if (!name) return;
      if (name === this.$route.query.q) this.searchTask(name);
      else this.$router.push({ query: { q: name } });
    },
    async searchTask(name) {
      if (import.meta.env.SSR) return;
      const version = ++this.requestVersion;
      this.taskList = [];
      this.searchStatus = "Searching...";
      try {
        const data = await fetchData(`/api/tasks/search?name=${encodeURIComponent(name)}`);
        if (version !== this.requestVersion) return;
        if (!Array.isArray(data)) throw new Error("Missing task search results");
        this.taskList = data;
        this.searchStatus = this.taskList.length ? "" : "No tasks found";
        captureEvent('task_search', {
          result: this.taskList.length ? "found" : "missing",
        });
      } catch (error) {
        if (version === this.requestVersion) {
          console.error(error);
          this.searchStatus = "Search is unavailable. Try again.";
          captureEvent('task_search', { result: 'error' });
        }
      }
    },
    taskLeaderboardLink(id) {
      return "/tasks/" + encodeURIComponent(id) + "/leaderboard";
    },
  },
};
</script>
