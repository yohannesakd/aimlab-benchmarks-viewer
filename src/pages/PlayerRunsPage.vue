<template>
  <main class="page-shell run-page">
    <router-link :to="`/profile/${encodeURIComponent(username)}/overview`" class="text-link">← {{ username }}'s profile</router-link>
    <div class="page-intro run-heading">
      <div>
        <p class="eyebrow">Run history</p>
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
      <section v-if="selectedRun" id="run-detail" class="panel run-detail">
        <div class="run-detail-heading">
          <div>
            <p class="eyebrow">Selected run</p>
            <h2 class="section-title">{{ selectedRun.score.toLocaleString() }} points</h2>
            <p class="muted">{{ formatDate(selectedRun.endedAt || selectedRun.startedAt) }}</p>
          </div>
          <router-link :to="{ path: $route.path, query: pageQuery }" class="text-link">Close</router-link>
        </div>
        <div class="run-detail-body">
          <section class="run-detail-section">
            <h3>Run</h3>
            <dl class="run-facts">
              <div v-for="item in runMetadata" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div>
            </dl>
          </section>
          <section class="run-detail-section">
            <h3>Performance</h3>
            <dl class="run-facts">
              <div v-for="item in runPerformance" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div>
            </dl>
          </section>
        </div>
        <div class="run-detail-footer">
          <p class="result-meta">Statistics come from Aimlabs. Their definitions can vary by scenario.</p>
          <a v-if="selectedRun.replayAvailable" :href="replayLink(selectedRun.id)" target="_blank" rel="noopener noreferrer" class="text-link run-replay"><play-icon class="h-5 w-5" /> Open replay in Aimlabs</a>
        </div>
      </section>
      <div v-else-if="selectedRunId" class="panel status-panel run-detail">This run is not on the selected history page. Open it from the run list.</div>

      <section v-if="history.runs.length" class="panel run-list">
        <div class="run-row run-row-head">
          <span>Score</span><span class="run-date">Date</span><span class="run-action">Run</span>
        </div>
        <div v-for="run in history.runs" :key="run.id" class="run-row">
          <strong>{{ run.score.toLocaleString() }} points</strong>
          <time class="run-date muted" :datetime="run.endedAt || run.startedAt">
            <span>{{ formatDay(run.endedAt || run.startedAt) }}</span>
            <small> · {{ formatClock(run.endedAt || run.startedAt) }}</small>
          </time>
          <router-link :to="{ path: $route.path, query: { ...pageQuery, run: run.id } }" class="text-link run-action">View details →</router-link>
        </div>
      </section>
      <div v-else class="panel status-panel">No solo runs were returned for this task.</div>

      <div class="run-pagination">
        <router-link v-if="afterCursor" :to="{ path: $route.path }" class="btn-secondary">First page</router-link>
        <router-link v-if="history.pageInfo.hasNextPage && history.pageInfo.endCursor" :to="{ path: $route.path, query: { after: history.pageInfo.endCursor } }" class="btn-secondary">Older runs →</router-link>
      </div>
      <p class="result-meta run-note">Runs are shown in Aimlabs order. Scores may reflect different scenario settings.</p>
    </template>
  </main>
</template>

<style scoped>
.run-page { max-width: 980px; }
.run-heading, .run-detail-heading { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 18px; }
.run-heading { margin-top: 20px; }
.run-detail { padding: 20px; margin-bottom: 18px; }
.run-detail-body { display: grid; gap: 18px; margin-top: 16px; }
.run-detail-section h3 { padding-bottom: 8px; border-bottom: 1px solid var(--line); color: var(--muted); font-size: .76rem; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; }
.run-facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 18px; margin: 0; }
.run-facts > div { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid var(--line); font-size: .8rem; }
.run-facts dt { color: var(--muted); }
.run-facts dd { margin: 0; font-weight: 600; text-align: right; overflow-wrap: anywhere; }
.run-detail-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px 24px; margin-top: 14px; }
.run-note { margin-top: 17px; line-height: 1.6; }
.run-replay { display: inline-flex; align-items: center; gap: 8px; }
.run-list { overflow: hidden; }
.run-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: center; gap: 16px; padding: 10px 18px; border-top: 1px solid var(--line); font-size: .84rem; }
.run-row-head { border-top: 0; background: var(--raised); color: var(--muted); font-size: .76rem; font-weight: 600; }
.run-date { white-space: nowrap; }
.run-date small { font-size: .72rem; }
.run-pagination { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
@media (max-width: 800px) {
  .run-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 620px) {
  .run-facts { grid-template-columns: 1fr; }
  .run-row-head { display: none; }
  .run-row { grid-template-columns: minmax(0, 1fr) auto; gap: 6px 12px; }
  .run-row > :first-child { grid-column: 1; grid-row: 1; }
  .run-row > :nth-child(2) { grid-column: 2; grid-row: 1; text-align: right; white-space: normal; }
  .run-row > :last-child { grid-column: 2; grid-row: 2; }
  .run-date { font-size: .75rem; }
  .run-action { text-align: right; }
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
    runMetadata() {
      const run = this.selectedRun;
      if (!run) return [];
      const details = [];
      if (run.taskVersion !== null && run.taskVersion !== undefined && run.taskVersion !== "") details.push({ label: "Task version", value: run.taskVersion });
      if (Number.isFinite(run.duration)) details.push({ label: "Duration", value: `${Math.round(run.duration)} s` });
      if (Number.isFinite(run.pauseDuration) && run.pauseDuration > 0) details.push({ label: "Time paused", value: this.formatPaused(run.pauseDuration) });
      if (run.inputDevice?.length) details.push({ label: "Input device", value: run.inputDevice.join(", ") });
      if (run.gridshieldStatus) details.push({ label: "Run status", value: run.gridshieldStatus.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase()) });
      if (run.appVersion) details.push({ label: "App version", value: run.appVersion });
      if (run.analyticsVersion) details.push({ label: "Analytics version", value: run.analyticsVersion });
      return details;
    },
    runPerformance() {
      const run = this.selectedRun;
      if (!run) return [];
      const details = [];
      const metrics = [
        ["hitsTotal", "Hits"], ["shotsTotal", "Shots"], ["missesTotal", "Misses"],
        ["killTotal", "Kills"], ["targetsTotal", "Targets"],
        ["headshots", "Headshots"], ["bodyshots", "Bodyshots"],
        ["damageTotal", "Damage"], ["accTotal", "Accuracy"],
        ["avgDist", "Average distance"], ["timePerKill", "Time per kill"],
      ];
      for (const [key, label] of metrics) {
        if (key === "timePerKill" && !run.metrics.killTotal) continue;
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
    formatPaused(milliseconds) {
      const seconds = Math.round(milliseconds / 1000);
      if (!seconds) return "<1 s";
      if (seconds < 60) return `${seconds} s`;
      return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
    },
    formatDate(value) {
      return new Date(value).toLocaleString();
    },
    formatDay(value) {
      return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    },
    formatClock(value) {
      return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
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
