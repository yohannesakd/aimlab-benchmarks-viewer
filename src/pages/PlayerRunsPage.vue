<template>
  <main class="page-shell run-page">
    <router-link :to="`/profile/${encodeURIComponent(username)}/overview`" class="text-link">← {{ username }}'s profile</router-link>
    <div class="page-intro run-heading">
      <div>
        <h1 class="page-title">{{ history?.taskName || taskId }}</h1>
        <p v-if="history" class="page-subtitle">
          {{ history.totalCount.toLocaleString() }} solo runs
        </p>
      </div>
      <router-link :to="`/tasks/${encodeURIComponent(taskId)}/leaderboard`" class="btn-secondary">
        Task leaderboard
      </router-link>
    </div>

    <div v-if="isLoading" class="panel status-panel"><loading-spinner /></div>
    <div v-else-if="loadError" class="panel status-panel" role="alert">{{ loadError }}</div>
    <template v-else-if="history">
      <section v-if="history.runs.length" class="panel run-list">
        <div class="run-row run-row-head">
          <span>Score</span><span>Accuracy</span><span>Shots</span><span class="run-date">Date</span><span class="run-action">Run</span>
        </div>
        <div v-for="run in history.runs" :key="run.id" class="run-row">
          <strong>{{ run.score.toLocaleString() }} points</strong>
          <span class="run-accuracy muted">{{ accuracy(run) }}</span>
          <span class="run-shots muted">{{ run.metrics.shotsTotal?.toLocaleString() ?? '—' }}</span>
          <time class="run-date muted" :datetime="run.endedAt || run.startedAt">
            <span>{{ formatDay(run.endedAt || run.startedAt) }}</span>
            <small> · {{ formatClock(run.endedAt || run.startedAt) }}</small>
          </time>
          <button type="button" class="text-link run-action" @click="showRun(run)">View details →</button>
        </div>
      </section>
      <div v-else class="panel status-panel">No solo runs were returned for this task.</div>

      <div class="run-pagination">
        <router-link v-if="afterCursor" :to="{ path: $route.path }" class="btn-secondary">First page</router-link>
        <router-link v-if="history.pageInfo.hasNextPage && history.pageInfo.endCursor" :to="{ path: $route.path, query: { after: history.pageInfo.endCursor } }" class="btn-secondary">Older runs →</router-link>
      </div>
    </template>
  </main>
</template>

<style scoped>
.run-page { max-width: 980px; }
.run-heading { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 18px; margin-top: 20px; }
.run-list { overflow: hidden; }
.run-row { display: grid; grid-template-columns: minmax(130px, 1fr) 90px 60px minmax(180px, 1fr) 115px; align-items: center; gap: 16px; padding: 10px 18px; border-top: 1px solid var(--line); font-size: .84rem; }
.run-row-head { border-top: 0; background: var(--raised); color: var(--muted); font-size: .76rem; font-weight: 600; }
.run-date { white-space: nowrap; }
.run-date small { font-size: .72rem; }
.run-action { text-align: right; }
.run-pagination { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
@media (max-width: 800px) {
  .run-row { grid-template-columns: minmax(0, 1fr) 80px 50px auto; gap: 8px 12px; }
  .run-row-head { display: none; }
  .run-date { grid-column: 1 / 4; grid-row: 2; font-size: .75rem; }
  .run-action { grid-column: 4; grid-row: 1 / 3; }
}
@media (max-width: 520px) {
  .run-row { grid-template-columns: minmax(0, 1fr) auto; }
  .run-accuracy { grid-column: 1; grid-row: 2; }
  .run-accuracy::before { content: 'Accuracy: '; }
  .run-shots { display: none; }
  .run-date { grid-column: 1; grid-row: 3; white-space: normal; }
  .run-action { grid-column: 2; grid-row: 1 / 4; }
}
</style>

<script>
import { openRunDetails } from "../helpers/runDetails.js";

export default {
  props: { username: String, taskId: String },
  data() {
    return { history: null, isLoading: false, loadError: "", requestVersion: 0 };
  },
  computed: {
    afterCursor() {
      return typeof this.$route.query.after === "string" ? this.$route.query.after : "";
    },
    selectedRunId() {
      return typeof this.$route.query.run === "string" ? this.$route.query.run : "";
    },
    requestKey() {
      return JSON.stringify([this.username, this.taskId, this.afterCursor]);
    },
  },
  watch: {
    requestKey: { immediate: true, handler: "loadRuns" },
    selectedRunId() { this.openLinkedRun(); },
    history() { this.openLinkedRun(); },
  },
  beforeUnmount() {
    this.requestVersion++;
  },
  methods: {
    accuracy(run) { return Number.isFinite(run.metrics.accTotal) ? `${Math.round(run.metrics.accTotal * 100) / 100}%` : '—'; },
    showRun(run) { openRunDetails({ username: this.username, taskId: this.taskId, taskName: this.history.taskName, run }); },
    openLinkedRun() {
      if (!this.selectedRunId || !this.history) return;
      const run = this.history.runs.find(run => run.id === this.selectedRunId);
      openRunDetails({ username: this.username, taskId: this.taskId, taskName: this.history.taskName, playId: this.selectedRunId, run });
    },
    formatDay(value) {
      return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    },
    formatClock(value) {
      return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    },
    async loadRuns() {
      const version = ++this.requestVersion;
      this.isLoading = true;
      this.loadError = "";
      this.history = null;
      const path = `/api/profiles/${encodeURIComponent(this.username)}/tasks/${encodeURIComponent(this.taskId)}/runs`;
      const url = this.afterCursor ? `${path}?after=${encodeURIComponent(this.afterCursor)}` : path;
      try {
        const response = await fetch(url);
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error || "Run history is unavailable. Try again.");
        if (!body) throw new Error("Run history is unavailable. Try again.");
        if (version === this.requestVersion) this.history = body;
      } catch (error) {
        if (version === this.requestVersion) this.loadError = error.message;
      } finally {
        if (version === this.requestVersion) this.isLoading = false;
      }
    },
  },
};
</script>
