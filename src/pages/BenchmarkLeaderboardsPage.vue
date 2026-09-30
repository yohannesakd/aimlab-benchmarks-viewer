<template>
  <section class="space-y-4">
    <div v-if="selectedSet" class="panel standings-controls">
      <benchmark-controls :sets="sets" :selected-set="selectedSet.id" :level="level" :levels="levels" @set-change="selectSet" @level-change="selectLevel" />
      <div class="standings-view"><span class="field-label">View</span><dropdown label="View" :options="viewOptions" :model-value="view" @update:model-value="selectView" /></div>
      <div v-if="view === 'overall'" class="standings-ranking"><span class="field-label">Ranking</span><dropdown label="Ranking" :options="selectedSet.rankingOptions" :model-value="sort" @update:model-value="selectSort" /></div>
    </div>
    <div v-if="catalogLoading || loading" class="panel status-panel" aria-live="polite"><loading-spinner /></div>
    <div v-else-if="error" class="panel status-panel" role="alert">{{ error }}</div>
    <template v-else-if="selectedSet">
      <section v-if="view === 'scenarios'" class="panel scenario-standings">
        <h2 class="leaderboard-heading">{{ selectedSet.label }} · {{ levelLabel }}</h2>
        <div v-for="group in scenarioGroups" :key="group.label">
          <h3 v-if="group.label" class="scenario-group">{{ group.label }}</h3>
          <router-link v-for="bench in group.benchmarks" :key="bench.id" class="scenario-link" :to="{ path: '/tasks/' + encodeURIComponent(bench.id) + '/leaderboard', query: { weapon: bench.weapon } }"><strong>{{ bench.name }}</strong><span class="text-link">Leaderboard →</span></router-link>
        </div>
      </section>
      <section v-else class="panel leaderboard-panel">
        <div class="standings-heading"><h2>{{ selectedSet.label }} · {{ levelLabel }}</h2><time v-if="pageData.generatedAt" :datetime="pageData.generatedAt">Updated {{ formatDate(pageData.generatedAt) }}</time></div>
        <div class="leaderboard-row leaderboard-row--head" aria-hidden="true"><span>Rank</span><span>Player</span><span>{{ community === 'voltaic' ? 'Energy' : 'Points' }}</span><span>Overall rank</span></div>
        <router-link v-for="(player, index) in pageData.players" :key="player.username" class="leaderboard-row leaderboard-row--player" :aria-label="`${(page - 1) * 25 + index + 1}. ${player.username}: ${player.selectedPoints} ${community === 'voltaic' ? 'energy' : 'points'}, overall rank ${player.overallRank}`" :to="{ path: '/profile/' + encodeURIComponent(player.username) + '/' + community, query: { benchmark: selectedSet.id, level } }">
          <span>{{ (page - 1) * 25 + index + 1 }}</span><span class="player-name">{{ player.username }}</span><span class="points">{{ player.selectedPoints.toLocaleString() }}</span><span class="rank-badge"><img :src="rankImage(player.overallRank)" alt="" /><span>{{ player.overallRank }}</span></span>
        </router-link>
        <p v-if="!pageData.total" class="status-panel">No standings yet.</p>
        <div v-else class="pagination">
          <span>{{ (page - 1) * 25 + 1 }}–{{ Math.min(page * 25, pageData.total) }} of {{ pageData.total.toLocaleString() }}</span>
          <div class="pagination-controls">
            <button type="button" class="page-button" :disabled="page <= 1" aria-label="Previous page" @click="changePage(page - 1)"><chevron-icon direction="left" class="h-4 w-4" /></button><span class="page-button active">{{ page }} / {{ pageData.pageCount }}</span><button type="button" class="page-button" :disabled="page >= pageData.pageCount" aria-label="Next page" @click="changePage(page + 1)"><chevron-icon direction="right" class="h-4 w-4" /></button>
            <input v-model.number="goToPageInput" class="page-input" type="number" min="1" :max="pageData.pageCount" aria-label="Go to page" @keydown.enter="goToPage" /><button type="button" class="page-button" @click="goToPage">Go</button>
          </div>
        </div>
      </section>
    </template>
  </section>
</template>
<script>
import { rankImage } from '../helpers/rankAssets.js';
import BenchmarkControls from '../components/BenchmarkControls.vue';
import { fetchData } from '../helpers/api.js';
export default {
  components: { BenchmarkControls },
  props: { community: String },
  data() { return { sets: [], catalogLoading: false, loading: false, error: '', pageData: { players: [], total: 0, pageCount: 0 }, goToPageInput: null, requestVersion: 0, catalogVersion: 0 }; },
  computed: {
    levels() { return this.community === 'voltaic' ? ['Novice', 'Intermediate', 'Advanced'] : ['Easy', 'Medium', 'Hard']; },
    levelLabel() { return this.levels.find(label => label.toLowerCase() === this.$route.query.level) || this.levels[0]; },
    level() { return this.levelLabel.toLowerCase(); },
    selectedSet() {
      const id = this.community === 'voltaic' && this.$route.query.benchmark === 'legacy' ? 'aimlabs_s2' : this.$route.query.benchmark;
      return this.sets.find(set => set.id === id) || this.sets[0];
    },
    result() { return this.selectedSet?.results[`${this.community === 'voltaic' ? 'VT' : 'RA'}${this.levelLabel}`]; },
    viewOptions() { return [...(this.result?.rankingAvailable !== false ? [{ value: 'overall', label: 'Overall standings' }] : []), { value: 'scenarios', label: 'Scenario leaderboards' }]; },
    view() { return this.result?.rankingAvailable === false || this.$route.query.view === 'scenarios' ? 'scenarios' : 'overall'; },
    sort() { return this.selectedSet?.rankingOptions?.some(option => option.value === this.$route.query.sort) ? this.$route.query.sort : 'overall'; },
    page() { const value = Number(this.$route.query.page || 1); return Number.isSafeInteger(value) && value > 0 ? value : 1; },
    selectionKey() { return this.selectedSet ? `${this.community}:${this.selectedSet.id}:${this.level}:${this.view}:${this.sort}:${this.page}` : ''; },
    scenarioGroups() {
      const groups = [];
      for (const bench of this.result.benchmarks) {
        const label = bench.subCategory || '';
        let group = groups.find(item => item.label === label);
        if (!group) { group = { label, benchmarks: [] }; groups.push(group); }
        group.benchmarks.push(bench);
      }
      return groups;
    },
  },
  watch: { community: { immediate: true, handler: 'loadCatalog' }, selectionKey: 'loadLeaderboard' },
  beforeUnmount() { this.requestVersion++; this.catalogVersion++; },
  methods: {
    async loadCatalog() {
      const version = ++this.catalogVersion;
      this.requestVersion++; this.sets = []; this.error = ''; this.loading = false; this.catalogLoading = true;
      try {
        const data = await fetchData(`/api/benchmarks/${this.community}`);
        if (version === this.catalogVersion) this.sets = data.sets;
      } catch { if (version === this.catalogVersion) this.error = 'Could not load benchmark definitions.'; }
      finally { if (version === this.catalogVersion) this.catalogLoading = false; }
    },
    navigate(query) { this.$router.push({ query: { benchmark: this.selectedSet.id, level: this.level, view: this.view, sort: this.sort, ...query } }); },
    selectSet(benchmark) { this.navigate({ benchmark, sort: 'overall' }); },
    selectLevel(level) { this.navigate({ level }); },
    selectView(view) { this.navigate({ view }); },
    selectSort(sort) { this.navigate({ sort }); },
    changePage(page) { this.navigate({ page }); },
    async loadLeaderboard() {
      const version = ++this.requestVersion;
      this.error = ''; this.loading = false;
      if (!this.selectedSet || this.view !== 'overall') return;
      this.loading = true;
      const prefix = this.community === 'voltaic' ? 'vt' : 'ra';
      const set = this.selectedSet.id;
      const mode = `${prefix}-${set === 'legacy' ? '' : set + '-'}${this.level}`;
      try {
        const result = await fetchData(`/api/leaderboards/${prefix}/${set}/${this.level}/page?page=${this.page}&sort=${this.sort}`);
        if (result.mode !== mode || result.benchmarkSet !== set || !Array.isArray(result.players)) throw new Error('Invalid leaderboard response');
        if (version === this.requestVersion) this.pageData = result;
      } catch (error) {
        if (version === this.requestVersion) this.error = error.status === 503 ? 'Standings are being collected.' : 'Could not load standings. Try again later.';
      } finally { if (version === this.requestVersion) this.loading = false; }
    },
    goToPage() { if (Number.isInteger(this.goToPageInput)) this.changePage(Math.min(Math.max(this.goToPageInput, 1), this.pageData.pageCount || 1)); this.goToPageInput = null; },
    rankImage(rank) { return rankImage(this.community, rank); },
    formatDate(value) { return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); },
  },
};
</script>
<style scoped>
.standings-controls { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; padding: 16px; }
.standings-controls :deep(.benchmark-controls) { flex: 2 1 340px; margin: 0; }
.standings-controls :deep(.set-control) { flex: 1 1 160px; }
.standings-controls :deep(.level-control) { flex: 1 1 150px; }
.standings-view { flex: 1 1 190px; }
.standings-ranking { flex: 1 1 160px; }
.standings-heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px; padding: 16px 20px; border-bottom: 1px solid var(--line); }
.standings-heading h2 { font-size: 1.05rem; font-weight: 600; }
.standings-heading time { color: var(--muted); font-size: .75rem; }
.scenario-group { padding: 6px 20px; color: var(--muted); border-block: 1px solid var(--line); background: #172537; font-size: .75rem; text-transform: capitalize; }
.scenario-link { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 20px; border-bottom: 1px solid var(--line); font-size: .85rem; }
.scenario-link:last-child { border-bottom: 0; }
.scenario-link:hover { background: var(--raised); }
.scenario-link .text-link { white-space: nowrap; font-size: .8rem; }
@media (max-width: 600px) { .standings-controls :deep(.benchmark-controls), .standings-view, .standings-ranking { flex-basis: 100%; } .scenario-link { flex-wrap: wrap; gap: 6px; } }
</style>
