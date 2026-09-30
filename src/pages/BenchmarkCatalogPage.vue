<template>
  <main class="page-shell">
    <div class="page-intro"><p class="eyebrow">Aimlabs benchmarks</p><h1 class="page-title">{{ community === 'voltaic' ? 'Voltaic' : 'Revosect' }}</h1></div>
    <nav class="tab-list" aria-label="Benchmark communities"><router-link class="tab-link" to="/benchmarks/voltaic">Voltaic</router-link><router-link class="tab-link" to="/benchmarks/revosect">Revosect</router-link></nav>
    <p v-if="error" class="panel status-panel" role="alert">{{ error }}</p>
    <div v-else-if="!selectedSet" class="panel status-panel"><loading-spinner /></div>
    <template v-else>
      <benchmark-controls :sets="sets" :selected-set="selectedSet.id" :level="level" :levels="levels" @set-change="selectSet" @level-change="selectLevel" />
      <form class="catalog-profile" @submit.prevent="openProfile">
        <label class="sr-only" for="catalog-username">Aimlabs username</label><input id="catalog-username" v-model.trim="username" class="text-field" placeholder="Aimlabs username" />
        <button class="btn-primary" type="submit">View player scores</button>
      </form>
      <p v-if="result.rankingAvailable === false" class="muted season-note">Score requirements are awaiting verification. Task leaderboards and player runs are available.</p>
      <div class="panel catalog-table">
        <div class="catalog-row catalog-head"><span>Scenario</span><span>Rank score requirements</span><span>Scores</span></div>
        <div v-for="bench in result.benchmarks" :key="bench.id" class="catalog-row">
          <strong>{{ bench.name }}</strong>
          <div class="catalog-thresholds"><span v-for="(score, index) in scoreRequirements(bench)" :key="index"><small>{{ rankList[index] }}</small>{{ score.toLocaleString() }}</span><span v-if="!scoreRequirements(bench).length" class="muted">Awaiting requirements</span></div>
          <router-link class="text-link" :to="'/tasks/' + encodeURIComponent(bench.id) + '/leaderboard'">Leaderboard →</router-link>
        </div>
      </div>
      <p v-if="selectedSet.source" class="result-meta catalog-source">Definitions: <a class="text-link" :href="selectedSet.source" target="_blank" rel="noopener noreferrer">{{ community === 'voltaic' ? 'Voltaic' : 'Revosect' }}</a></p>
    </template>
  </main>
</template>
<script>
import BenchmarkControls from '../components/BenchmarkControls.vue';
import { fetchData } from '../helpers/api.js';
export default {
  components: { BenchmarkControls },
  props: { community: String },
  data() { return { sets: [], error: '', username: '', requestVersion: 0 }; },
  computed: {
    levels() { return this.community === 'voltaic' ? ['Novice', 'Intermediate', 'Advanced'] : ['Easy', 'Medium', 'Hard']; },
    level() { return this.levels.map(value => value.toLowerCase()).includes(this.$route.query.level) ? this.$route.query.level : this.levels[0].toLowerCase(); },
    selectedSet() { return this.sets.find(set => set.id === this.$route.query.benchmark) || this.sets.find(set => set.id === (this.community === 'voltaic' ? 'aimlabs_s3' : 'revosect_s4')) || this.sets[0]; },
    result() { const name = this.level[0].toUpperCase() + this.level.slice(1); return this.selectedSet.results[`${this.community === 'voltaic' ? 'VT' : 'RA'}${name}`]; },
    rankList() { return this.result.rankList || (this.community === 'voltaic' ? { novice: ['Iron', 'Bronze', 'Silver', 'Gold'], intermediate: ['Platinum', 'Diamond', 'Jade', 'Master'], advanced: ['Grandmaster', 'Nova', 'Astra', 'Celestial'] } : { easy: ['Bronze', 'Silver', 'Gold', 'Platinum'], medium: ['Ace', 'Legend', 'Sentinel', 'Valour'], hard: ['Mythic', 'Immortal', 'Archon', 'Ethereal', 'Divine'] })[this.level]; },
  },
  watch: { community: { immediate: true, handler: 'load' } },
  beforeUnmount() { this.requestVersion++; },
  methods: {
    async load() {
      const version = ++this.requestVersion; this.sets = []; this.error = '';
      try { const data = await fetchData(`/api/benchmarks/${this.community}`); if (version === this.requestVersion) this.sets = data.sets; }
      catch { if (version === this.requestVersion) this.error = 'Could not load benchmark definitions.'; }
    },
    selectSet(benchmark) { this.$router.push({ query: { benchmark, level: this.level } }); },
    selectLevel(level) { this.$router.push({ query: { benchmark: this.selectedSet.id, level } }); },
    scoreRequirements(bench) { const scores = bench.scores || []; return this.community === 'voltaic' && this.selectedSet.id === 'legacy' ? scores.slice(1) : scores; },
    openProfile() { if (this.username) this.$router.push({ path: `/profile/${encodeURIComponent(this.username)}/${this.community}`, query: { benchmark: this.selectedSet.id, level: this.level } }); },
  },
};
</script>
<style scoped>
.catalog-profile { display: flex; gap: 10px; max-width: 620px; margin: 16px 0; }
.catalog-profile input { min-width: 0; flex: 1; }
.catalog-row { display: grid; grid-template-columns: minmax(220px, 1fr) minmax(320px, 1.4fr) 120px; align-items: center; gap: 16px; padding: 13px 18px; border-bottom: 1px solid var(--line); font-size: .85rem; }
.catalog-row:last-child { border-bottom: 0; }
.catalog-head { color: var(--muted); background: var(--raised); }
.catalog-thresholds { display: flex; justify-content: space-between; gap: 12px; }
.catalog-thresholds small { display: block; color: var(--muted); font-size: .7rem; }
.catalog-source { margin-top: 14px; }
@media (max-width: 800px) { .catalog-row { grid-template-columns: 1fr 120px; } .catalog-row > strong { grid-column: 1 / -1; } .catalog-head { display: none; } }
@media (max-width: 480px) { .catalog-profile { flex-direction: column; } .catalog-row { grid-template-columns: 1fr; } .catalog-thresholds { flex-wrap: wrap; } }
</style>
