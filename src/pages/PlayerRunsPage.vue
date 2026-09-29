<template>
  <main class="page-shell">
    <router-link :to="`/profile/${encodeURIComponent(username)}/overview`" class="text-link">← {{ username }}'s profile</router-link>
    <div class="page-intro run-heading">
      <div>
        <p class="eyebrow">Run history</p>
        <h1 class="page-title">{{ history?.taskName || taskId }}</h1>
        <p v-if="history" class="page-subtitle">
          {{ history.totalCount.toLocaleString() }} solo task runs reported by Aimlabs
        </p>
      </div>
      <router-link :to="`/tasks/${encodeURIComponent(taskId)}/leaderboard`" class="btn-secondary">
        Task leaderboard
      </router-link>
    </div>

    <div v-if="isLoading" class="panel status-panel"><loading-spinner /></div>
    <div v-else-if="loadError" class="panel status-panel" role="alert">{{ loadError }}</div>
    <template v-else-if="history">
      <section v-if="selectedRun" id="run-detail" class="panel run-detail">
        <div class="run-detail-heading">
          <div>
            <p class="eyebrow">Selected run</p>
            <h2 class="section-title">{{ selectedRun.score.toLocaleString() }} points</h2>
            <p class="muted">{{ formatDate(selectedRun.endedAt || selectedRun.startedAt) }}</p>
          </div>
          <router-link :to="{ path: $route.path, query: pageQuery }" class="text-link">Close</router-link>
        </div>
        <div class="run-metrics">
          <div v-for="item in runDetails" :key="item.label" class="run-metric">
            <span class="result-meta">{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
        <p class="result-meta run-note">These are Aimlabs' reported run values. Scores and stat meanings can vary by scenario.</p>
        <a v-if="selectedRun.replayAvailable" :href="replayLink(selectedRun.id)" target="_blank" rel="noopener noreferrer" class="text-link run-replay">
          <play-icon class="h-5 w-5" /> Open replay in Aimlabs
        </a>
      </section>
      <div v-else-if="selectedRunId" class="panel status-panel run-detail">This run is not on the selected history page. Open it from the run list.</div>

      <section v-if="history.runs.length" class="panel run-list">
        <div class="run-row run-row-head">
          <span>Date</span><span>Score</span><span>Mode</span><span>Weapon</span><span>Run</span>
        </div>
        <div v-for="run in history.runs" :key="run.id" class="run-row">
          <span class="muted">{{ formatDate(run.endedAt || run.startedAt) }}</span>
          <strong>{{ run.score.toLocaleString() }} points</strong>
          <span>{{ modeLabel(run.convertedMode) }}</span>
          <span class="run-weapon muted">
            {{ run.weaponId || 'Unknown' }}
            <small>Version {{ run.taskVersion || 'unknown' }}</small>
          </span>
          <router-link :to="{ path: $route.path, query: { ...pageQuery, run: run.id } }" class="text-link">View details →</router-link>
        </div>
      </section>
      <div v-else class="panel status-panel">No solo runs were returned for this task.</div>

      <div class="run-pagination">
        <router-link v-if="afterCursor" :to="{ path: $route.path }" class="btn-secondary">First page</router-link>
        <router-link v-if="history.pageInfo.hasNextPage && history.pageInfo.endCursor" :to="{ path: $route.path, query: { after: history.pageInfo.endCursor } }" class="btn-secondary">Older runs →</router-link>
      </div>
      <p class="result-meta run-note">Runs are ordered by Aimlabs. Mode, weapon and version are shown per run so different settings are not treated as comparable scores.</p>
    </template>
  </main>
</template>

<style scoped>
.run-heading, .run-detail-heading { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 18px; }
.run-heading { margin-top: 20px; }
.run-detail { padding: 20px; margin-bottom: 18px; }
.run-metrics { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; margin-top: 20px; }
.run-metric { min-width: 0; padding: 12px; border: 1px solid var(--line); background: var(--raised); }
.run-metric strong { display: block; margin-top: 5px; overflow-wrap: anywhere; }
.run-note { margin-top: 17px; line-height: 1.6; }
.run-replay { display: inline-flex; align-items: center; gap: 8px; margin-top: 17px; }
.run-list { overflow: hidden; }
.run-row { display: grid; grid-template-columns: minmax(170px, 1.4fr) minmax(110px, .8fr) minmax(80px, .7fr) minmax(130px, 1fr) minmax(110px, .7fr); align-items: center; gap: 12px; padding: 14px 18px; border-top: 1px solid var(--line); font-size: .84rem; }
.run-row-head { border-top: 0; background: var(--raised); color: var(--muted); font-size: .76rem; font-weight: 600; }
.run-weapon { overflow-wrap: anywhere; }
.run-weapon small { display: block; font-size: .72rem; }
.run-pagination { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
@media (max-width: 800px) {
  .run-row-head { display: none; }
  .run-row { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px 12px; }
  .run-row > :first-child, .run-row > :last-child { grid-column: 1 / -1; }
}
</style>

<script>
import { replayDeepLink } from "../helpers/functions.js";

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
    selectedRun() {
      return this.history?.runs.find((run) => run.id === this.selectedRunId) || null;
    },
    pageQuery() {
      return this.afterCursor ? { after: this.afterCursor } : {};
    },
    requestKey() {
      return JSON.stringify([this.username, this.taskId, this.afterCursor]);
    },
    runDetails() {
      const run = this.selectedRun;
      if (!run) return [];
      const details = [
        { label: "Mode", value: `${this.modeLabel(run.convertedMode)} (raw ${run.mode})` },
        { label: "Weapon", value: run.weaponId || "Unavailable" },
        { label: "Task version", value: run.taskVersion || "Unavailable" },
        { label: "Recorded duration", value: Number.isFinite(run.duration) ? `${Math.round(run.duration)} s` : "Unavailable" },
        { label: "Input device", value: run.inputDevice?.join(", ") || "Unavailable" },
      ];
      const metrics = [
        ["hitsTotal", "Hits"], ["shotsTotal", "Shots"], ["killTotal", "Kills"],
        ["targetsTotal", "Targets"], ["accTotal", "Reported accuracy"],
      ];
      for (const [key, label] of metrics) {
        if (Number.isFinite(run.metrics[key])) details.push({ label, value: run.metrics[key].toLocaleString() });
      }
      return details;
    },
  },
  watch: {
    requestKey: { immediate: true, handler: "loadRuns" },
    selectedRun(run) {
      if (run) this.$nextTick(() => document.getElementById("run-detail")?.scrollIntoView({ block: "start" }));
    },
  },
  beforeUnmount() {
    this.requestVersion++;
  },
  methods: {
    formatDate(value) {
      return new Date(value).toLocaleString();
    },
    modeLabel(mode) {
      return mode === 0 ? "Normal" : `Mode ${mode}`;
    },
    replayLink(playId) {
      return replayDeepLink(playId);
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
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Run history is unavailable. Try again.");
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
