<template>
  <dialog ref="dialog" class="run-modal panel" aria-labelledby="run-modal-title" @cancel.prevent="close" @click="backdropClick">
    <div class="modal-heading">
      <div>
        <p class="eyebrow">Run details · {{ selection?.username }}</p>
        <h2 id="run-modal-title" class="section-title">{{ selection?.taskName || 'Scenario run' }}</h2>
      </div>
      <button type="button" class="btn-secondary" autofocus @click="close">Close</button>
    </div>
    <p v-if="loading" class="status-panel" role="status">Loading run details…</p>
    <div v-else-if="error" class="modal-status" role="alert">
      <p>{{ error }}</p><button type="button" class="text-link" @click="load">Try again</button>
    </div>
    <div v-else-if="run" class="modal-content">
      <div class="run-summary"><strong>{{ run.score.toLocaleString() }} points</strong><time>{{ dateLabel }}</time></div>
      <section v-if="performance.length">
        <h3>Performance</h3>
        <dl class="run-facts"><div v-for="item in performance" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div></dl>
      </section>
      <section v-if="metadata.length">
        <h3>Run</h3>
        <dl class="run-facts"><div v-for="item in metadata" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div></dl>
      </section>
      <p v-if="run.detailsSource === 'leaderboard'" class="result-meta">Aimlabs only provides leaderboard statistics for this older run.</p>
      <p class="result-meta">Statistics come from Aimlabs. Their definitions can vary by scenario.</p>
      <a v-if="run.replayAvailable !== false" :href="replayLink" target="_blank" rel="noopener noreferrer" class="text-link">Open run in Aimlabs ↗</a>
    </div>
    <div v-if="selection" class="modal-footer">
      <router-link v-if="$route.path !== historyLink" class="text-link" :to="historyLink" @click="close">Player’s run history →</router-link>
      <router-link v-if="!$route.path.startsWith('/tasks/')" class="text-link" :to="{ path: `/tasks/${encodeURIComponent(selection.taskId)}/leaderboard`, query: { weapon: selection.weapon } }" @click="close">Task leaderboard →</router-link>
    </div>
  </dialog>
</template>

<script>
import { selectedRun, closeRunDetails } from "../helpers/runDetails.js";
import { fetchData } from "../helpers/api.js";
import { replayDeepLink } from "../helpers/functions.js";

export default {
  data() { return { run: null, loading: false, error: "", controller: null, previousOverflow: null }; },
  computed: {
    selection() { return selectedRun.value; },
    historyLink() { return `/profile/${encodeURIComponent(this.selection.username)}/tasks/${encodeURIComponent(this.selection.taskId)}/runs`; },
    dateLabel() { const value = this.run?.endedAt || this.run?.startedAt; return value ? new Date(value).toLocaleString() : "Date unavailable"; },
    replayLink() { return replayDeepLink(this.run.id); },
    metadata() {
      const run = this.run;
      if (!run) return [];
      const items = [];
      if (run.taskVersion) items.push({ label: "Task version", value: run.taskVersion });
      if (Number.isFinite(run.duration)) items.push({ label: "Duration", value: `${Math.round(run.duration)} s` });
      if (Number.isFinite(run.pauseDuration) && run.pauseDuration > 0) {
        const seconds = Math.round(run.pauseDuration / 1000);
        items.push({ label: "Time paused", value: seconds < 60 ? `${seconds || '<1'} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s` });
      }
      if (run.inputDevice?.length) items.push({ label: "Input device", value: run.inputDevice.map(value => value.toLowerCase()).join(", ") });
      if (run.gridshieldStatus) items.push({ label: "Run status", value: run.gridshieldStatus.replaceAll("_", " ").toLowerCase().replace(/^./, letter => letter.toUpperCase()) });
      if (run.appVersion) items.push({ label: "App version", value: run.appVersion });
      if (run.analyticsVersion) items.push({ label: "Analytics version", value: run.analyticsVersion });
      return items;
    },
    performance() {
      const metrics = this.run?.metrics || {};
      return [["hitsTotal", "Hits"], ["shotsTotal", "Shots"], ["missesTotal", "Misses"], ["killTotal", "Kills"], ["targetsTotal", "Targets"], ["headshots", "Headshots"], ["bodyshots", "Bodyshots"], ["damageTotal", "Damage"], ["accTotal", "Accuracy"], ["avgDist", "Average distance"], ["timePerKill", "Time per kill"]]
        .filter(([key]) => Number.isFinite(metrics[key]) && (key !== "timePerKill" || metrics.killTotal > 0))
        .map(([key, label]) => ({ label, value: `${metrics[key].toLocaleString(undefined, { maximumFractionDigits: 3 })}${key === 'accTotal' ? '%' : ''}` }));
    },
  },
  watch: {
    selection: { async handler(selection) {
      this.controller?.abort();
      if (!selection) {
        this.$refs.dialog.close();
        this.restoreScroll();
        return;
      }
      await this.$nextTick();
      if (selection !== this.selection) return;
      if (!this.$refs.dialog.open) {
        this.previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        this.$refs.dialog.showModal();
      }
      this.load();
    } },
    '$route.path'() { this.close(); },
  },
  beforeUnmount() { this.controller?.abort(); this.restoreScroll(); },
  methods: {
    close: closeRunDetails,
    restoreScroll() {
      if (this.previousOverflow !== null) document.body.style.overflow = this.previousOverflow;
      this.previousOverflow = null;
    },
    backdropClick(event) { if (event.target === this.$refs.dialog) { const rect = event.target.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) this.close(); } },
    async load() {
      const selection = this.selection;
      if (!selection) return;
      this.controller?.abort();
      const controller = new AbortController();
      this.controller = controller;
      this.run = null;
      this.error = "";
      this.loading = true;
      try {
        if (selection.run) this.run = selection.run;
        else {
          const params = new URLSearchParams({ username: selection.username });
          if (selection.playId) params.set("playId", selection.playId);
          if (selection.weapon) params.set("weapon", selection.weapon);
          if (Number.isFinite(selection.score)) params.set("score", selection.score);
          const run = await fetchData(`/api/tasks/${encodeURIComponent(selection.taskId)}/run?${params}`, { signal: controller.signal });
          if (!controller.signal.aborted && selection === this.selection) this.run = run;
        }
      } catch (error) {
        if (!controller.signal.aborted && selection === this.selection) this.error = error.message;
      } finally {
        if (!controller.signal.aborted && selection === this.selection) this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.run-modal { width: min(760px, calc(100% - 32px)); max-height: calc(100dvh - 48px); margin: auto; padding: 0; color: var(--text); overflow-y: auto; }
.run-modal::backdrop { background: rgb(0 0 0 / .7); }
.modal-heading, .modal-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 20px; }
.modal-heading { border-bottom: 1px solid var(--line); }
.modal-heading > div { min-width: 0; overflow-wrap: anywhere; }
.modal-heading .btn-secondary { flex-shrink: 0; }
.modal-heading .section-title { margin-top: 4px; }
.modal-content, .modal-status { padding: 20px; }
.modal-content { display: grid; gap: 18px; }
.modal-footer { border-top: 1px solid var(--line); flex-wrap: wrap; }
.run-summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.run-summary strong { font-size: 1.2rem; }
.run-summary time { color: var(--muted); font-size: .8rem; }
h3 { margin-bottom: 6px; color: var(--muted); font-size: .75rem; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; }
.run-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 24px; }
.run-facts > div { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid var(--line); font-size: .8rem; }
.run-facts dt { color: var(--muted); }
.run-facts dd { margin: 0; text-align: right; font-weight: 600; overflow-wrap: anywhere; }
.modal-status .text-link { margin-top: 12px; }
@media (max-width: 520px) { .run-facts { grid-template-columns: 1fr; } .modal-heading { align-items: start; } }
</style>
