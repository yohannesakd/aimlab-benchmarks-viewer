<template>
  <main class="page-shell">
    <div class="page-intro"><h1 class="page-title">Benchmarks</h1></div>
    <section class="panel catalog-toolbar" aria-label="Benchmark selection">
      <nav class="tab-list catalog-communities" aria-label="Benchmark communities"><router-link class="tab-link" to="/benchmarks/voltaic">Voltaic</router-link><router-link class="tab-link" to="/benchmarks/revosect">Revosect</router-link></nav>
      <div v-if="selectedSet" class="catalog-controls">
        <benchmark-controls :sets="sets" :selected-set="selectedSet.id" :level="level" :levels="levels" @set-change="selectSet" @level-change="selectLevel" />
        <form class="catalog-profile" @submit.prevent="openProfile">
          <label class="field-label" for="catalog-username">Player</label>
          <div class="catalog-profile-fields">
            <input id="catalog-username" v-model.trim="username" class="text-field" placeholder="Aimlabs username" />
            <button class="btn-primary" type="submit">View scores</button>
          </div>
        </form>
      </div>
    </section>
    <p v-if="error" class="panel status-panel" role="alert">{{ error }}</p>
    <div v-else-if="!selectedSet" class="panel status-panel"><loading-spinner /></div>
    <template v-else>
      <div class="panel catalog-table">
        <table :style="{ '--rank-count': rankList.length }" :aria-label="`${selectedSet.label} ${level} scenarios`">
          <colgroup><col class="catalog-scenario-col" /><template v-if="hasRequirements"><col v-for="rank in rankList" :key="rank" /></template><col v-else /><col class="catalog-action-col" /></colgroup>
          <thead><tr><th scope="col">Scenario</th><template v-if="hasRequirements"><th v-for="rank in rankList" :key="rank" scope="col">{{ rank }}</th></template><th v-else scope="col">Rank requirements</th><th scope="col"><span class="sr-only">Leaderboard</span></th></tr></thead>
          <tbody v-for="group in scenarioGroups" :key="group.label" class="catalog-group">
            <tr v-if="group.label" class="catalog-group-heading"><th scope="rowgroup" :colspan="hasRequirements ? rankList.length + 2 : 3">{{ group.label }}</th></tr>
            <tr v-for="bench in group.benchmarks" :key="bench.id" class="catalog-row">
              <th scope="row" class="catalog-name">{{ bench.name }}</th>
              <template v-if="hasRequirements"><td v-for="(score, index) in scoreRequirements(bench)" :key="index" class="catalog-score"><span class="catalog-score-label">{{ rankList[index] }}</span>{{ score.toLocaleString('en-US') }}</td></template>
              <td v-else class="catalog-unavailable muted">Unavailable</td>
              <td class="catalog-action"><router-link class="text-link" :to="{ path: '/tasks/' + encodeURIComponent(bench.id) + '/leaderboard', query: { weapon: bench.weapon } }">Leaderboard →</router-link></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </main>
</template>
<script>
import BenchmarkControls from '../components/BenchmarkControls.vue';
import { fetchData } from '../helpers/api.js';
import { takeInitialResponse } from '../helpers/initialData.js';
export default {
  components: { BenchmarkControls },
  props: { community: String },
  data() { return { sets: [], error: '', username: '', requestVersion: 0 }; },
  computed: {
    levels() { return this.community === 'voltaic' ? ['Novice', 'Intermediate', 'Advanced'] : ['Easy', 'Medium', 'Hard']; },
    level() { return this.levels.map(value => value.toLowerCase()).includes(this.$route.query.level) ? this.$route.query.level : this.levels[0].toLowerCase(); },
    selectedSet() { return this.sets.find(set => set.id === (this.community === 'voltaic' && this.$route.query.benchmark === 'legacy' ? 'aimlabs_s2' : this.$route.query.benchmark)) || this.sets.find(set => set.id === (this.community === 'voltaic' ? 'aimlabs_s3' : 'revosect_s4')) || this.sets[0]; },
    result() { const name = this.level[0].toUpperCase() + this.level.slice(1); return this.selectedSet.results[`${this.community === 'voltaic' ? 'VT' : 'RA'}${name}`]; },
    rankList() { return this.result.rankList || (this.community === 'voltaic' ? { novice: ['Iron', 'Bronze', 'Silver', 'Gold'], intermediate: ['Platinum', 'Diamond', 'Jade', 'Master'], advanced: ['Grandmaster', 'Nova', 'Astra', 'Celestial'] } : { easy: ['Bronze', 'Silver', 'Gold', 'Platinum'], medium: ['Ace', 'Legend', 'Sentinel', 'Valour'], hard: ['Mythic', 'Immortal', 'Archon', 'Ethereal', 'Divine'] })[this.level]; },
    hasRequirements() { return this.result.rankingAvailable !== false; },
    scenarioGroups() {
      const groups = [];
      for (const bench of this.result.benchmarks) {
        const label = bench.subCategory || '';
        let group = groups.find(group => group.label === label);
        if (!group) { group = { label, benchmarks: [] }; groups.push(group); }
        group.benchmarks.push(bench);
      }
      return groups;
    },
  },
  watch: { community: { immediate: true, handler: 'load' } },
  beforeUnmount() { this.requestVersion++; },
  methods: {
    async load() {
      const initial = takeInitialResponse(this, `/api/benchmarks/${this.community}`);
      if (initial) { this.sets = initial.body?.sets || []; this.error = initial.status === 200 ? '' : 'Could not load benchmark definitions.'; return; }
      if (import.meta.env.SSR) return;
      const version = ++this.requestVersion; this.sets = []; this.error = '';
      try { const data = await fetchData(`/api/benchmarks/${this.community}`); if (version === this.requestVersion) this.sets = data.sets; }
      catch { if (version === this.requestVersion) this.error = 'Could not load benchmark definitions.'; }
    },
    selectSet(benchmark) { this.$router.push({ query: { benchmark, level: this.level } }); },
    selectLevel(level) { this.$router.push({ query: { benchmark: this.selectedSet.id, level } }); },
    scoreRequirements(bench) { return bench.scores || []; },
    openProfile() { if (this.username) this.$router.push({ path: `/profile/${encodeURIComponent(this.username)}/${this.community}`, query: { benchmark: this.selectedSet.id, level: this.level } }); },
  },
};
</script>
<style scoped>
.catalog-toolbar { margin-bottom: 20px; }
.catalog-communities { padding: 14px 16px; border-bottom: 1px solid var(--line); }
.catalog-controls { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: end; gap: 24px; padding: 16px; }
.catalog-controls :deep(.benchmark-controls) { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); margin: 0; }
.catalog-controls :deep(.set-control), .catalog-controls :deep(.level-control) { min-width: 0; }
.catalog-controls :deep(.dropdown-trigger) { min-height: 46px; }
.catalog-profile-fields { display: flex; gap: 8px; }
.catalog-profile input { min-width: 0; flex: 1; }
.catalog-profile .btn-primary { flex-shrink: 0; }
.catalog-table { overflow: hidden; }
.catalog-table table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: .84rem; }
.catalog-scenario-col { width: 34%; }
.catalog-action-col { width: 142px; }
.catalog-table th, .catalog-table td { padding: 8px 16px; text-align: right; vertical-align: middle; }
.catalog-table thead { background: var(--raised); color: var(--muted); font-size: .75rem; }
.catalog-table thead th { font-weight: 500; }
.catalog-table thead th:first-child, .catalog-table .catalog-name { text-align: left; }
.catalog-group-heading th { padding: 6px 16px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); background: #172537; color: var(--muted); font-size: .75rem; font-weight: 600; text-align: left; text-transform: capitalize; }
.catalog-name { font-weight: 600; overflow-wrap: anywhere; }
.catalog-row { border-bottom: 1px solid var(--line); }
.catalog-row:last-child { border-bottom: 0; }
.catalog-row:hover { background: var(--raised); }
.catalog-score { font-variant-numeric: tabular-nums; }
.catalog-score-label { display: none; }
.catalog-action .text-link { display: inline-flex; align-items: center; min-height: 28px; white-space: nowrap; font-size: .8rem; }
.catalog-unavailable { font-size: .78rem; }
@media (max-width: 900px) { .catalog-controls { grid-template-columns: 1fr; gap: 16px; } }
@media (max-width: 760px) {
  .catalog-table table, .catalog-group { display: block; }
  .catalog-table colgroup, .catalog-table thead { display: none; }
  .catalog-row { display: grid; grid-template-columns: repeat(var(--rank-count), minmax(0, 1fr)); padding: 12px 16px; gap: 10px; }
  .catalog-table .catalog-name, .catalog-action, .catalog-unavailable { grid-column: 1 / -1; }
  .catalog-table .catalog-row th, .catalog-table .catalog-row td { padding: 0; }
  .catalog-table .catalog-score { text-align: left; }
  .catalog-score-label { display: block; margin-bottom: 3px; color: var(--muted); font-size: .65rem; overflow-wrap: anywhere; }
  .catalog-group-heading { display: block; }
  .catalog-group-heading th { display: block; }
  .catalog-table .catalog-unavailable { text-align: left; }
}
@media (max-width: 400px) { .catalog-profile-fields { flex-direction: column; } }
</style>
