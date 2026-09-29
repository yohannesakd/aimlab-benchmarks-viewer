<template>
  <main class="px-[8%] py-10 max-w-7xl mx-auto w-full">
    <router-link :to="`/profile/${encodeURIComponent(username)}/overview`" class="text-slate-300 hover:text-white">
      ← {{ username }}'s profile
    </router-link>

    <div class="mt-5 mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="uppercase tracking-wide text-sm text-slate-400">Run history</p>
        <h1 class="text-2xl font-semibold">{{ history?.taskName || taskId }}</h1>
        <p v-if="history" class="text-slate-300 mt-1">
          {{ history.totalCount.toLocaleString() }} solo task runs reported by Aimlabs
        </p>
      </div>
      <router-link :to="`/tasks/${encodeURIComponent(taskId)}/leaderboard`" class="border border-slate-500 px-4 py-2 hover:bg-slate-700">
        Task leaderboard
      </router-link>
    </div>

    <base-card v-if="isLoading" class="max-w-xl"><loading-spinner /></base-card>
    <base-card v-else-if="loadError" class="max-w-xl">{{ loadError }}</base-card>
    <template v-else-if="history">
      <base-card v-if="selectedRun" id="run-detail" class="mb-6 border border-slate-500">
        <div class="flex flex-wrap justify-between gap-3 mb-5">
          <div>
            <p class="text-slate-400 text-sm uppercase tracking-wide">Selected run</p>
            <h2 class="text-xl font-semibold">{{ selectedRun.score.toLocaleString() }} points</h2>
            <p class="text-slate-300">{{ formatDate(selectedRun.endedAt || selectedRun.startedAt) }}</p>
          </div>
          <router-link :to="{ path: $route.path, query: pageQuery }" class="text-slate-300 hover:text-white">Close</router-link>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div v-for="item in runDetails" :key="item.label" class="bg-slate-800 border border-slate-600 p-3">
            <p class="text-slate-400 text-sm">{{ item.label }}</p>
            <p class="font-semibold break-words">{{ item.value }}</p>
          </div>
        </div>
        <p class="text-slate-400 text-sm mt-4">These are Aimlabs' reported run values. Scores and stat meanings can vary by scenario.</p>
        <a v-if="selectedRun.replayAvailable" :href="replayLink(selectedRun.id)" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 mt-4 text-mainCyan hover:text-white">
          <play-icon class="h-5 w-5" /> Open replay in Aimlabs
        </a>
      </base-card>
      <base-card v-else-if="selectedRunId" class="mb-6">This run is not on the selected history page. Open it from the run list.</base-card>

      <div v-if="history.runs.length" class="border border-slate-600 bg-slate-900">
        <div class="hidden md:grid grid-cols-12 gap-3 bg-slate-800 px-4 py-3 text-slate-300">
          <span class="col-span-3">Date</span><span class="col-span-2">Score</span><span class="col-span-2">Mode</span>
          <span class="col-span-3">Weapon</span><span class="col-span-2">Run</span>
        </div>
        <div v-for="run in history.runs" :key="run.id" class="grid md:grid-cols-12 gap-2 md:gap-3 px-4 py-4 border-t border-slate-700 items-center">
          <span class="md:col-span-3 text-slate-300">{{ formatDate(run.endedAt || run.startedAt) }}</span>
          <span class="md:col-span-2 font-semibold">{{ run.score.toLocaleString() }} points</span>
          <span class="md:col-span-2">{{ modeLabel(run.convertedMode) }}</span>
          <span class="md:col-span-3 break-all text-slate-300">
            {{ run.weaponId || 'Unknown' }}
            <small class="block text-xs text-slate-400">Version {{ run.taskVersion || 'unknown' }}</small>
          </span>
          <router-link :to="{ path: $route.path, query: { ...pageQuery, run: run.id } }" class="md:col-span-2 text-mainCyan hover:text-white">View details →</router-link>
        </div>
      </div>
      <base-card v-else>No solo runs were returned for this task.</base-card>

      <div class="flex gap-3 mt-5">
        <router-link v-if="afterCursor" :to="{ path: $route.path }" class="bg-slate-700 px-4 py-2 hover:bg-slate-600">First page</router-link>
        <router-link v-if="history.pageInfo.hasNextPage && history.pageInfo.endCursor" :to="{ path: $route.path, query: { after: history.pageInfo.endCursor } }" class="bg-slate-700 px-4 py-2 hover:bg-slate-600">Older runs →</router-link>
      </div>
      <p class="text-slate-400 text-sm mt-4">Runs are ordered by Aimlabs. Mode, weapon and version are shown per run so different settings are not treated as comparable scores.</p>
    </template>
  </main>
</template>

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
