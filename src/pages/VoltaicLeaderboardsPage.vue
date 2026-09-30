<template>
  <section class="space-y-4">
    <div class="panel filter-bar">
      <div>
        <label class="field-label">Level</label>
        <dropdown label="Level" :options="benchmarks.map((label, value) => ({ label, value }))" :model-value="benchmark" @update:model-value="benchmark = $event" />
      </div>
      <div>
        <label class="field-label">Category</label>
        <dropdown label="Category" :options="categories.map((label, value) => ({ label, value }))" :model-value="category" @update:model-value="category = $event" />
      </div>
      <div v-if="category !== 3">
        <label class="field-label">Subcategory</label>
        <dropdown label="Subcategory" :options="subCategories[category].map((label, value) => ({ label, value }))" :model-value="subCategory" @update:model-value="subCategory = $event" />
      </div>
    </div>

    <div v-if="loading" class="panel status-panel" aria-live="polite"><loading-spinner></loading-spinner></div>
    <div v-else-if="error" class="panel status-panel" role="alert">{{ error }}</div>
    <div v-else class="panel leaderboard-panel">
      <h2 class="leaderboard-heading">Voltaic · Archived Season 2 · {{ benchmarks[benchmark] }}</h2>
      <div class="leaderboard-row leaderboard-row--head" aria-hidden="true">
        <span>Rank</span><span>Player</span><span>Energy</span><span>Overall rank</span>
      </div>
      <router-link
        v-for="(player, index) in pageData.players"
        :key="index"
        class="leaderboard-row leaderboard-row--player"
        :to="{ path: '/profile/' + encodeURIComponent(player.username) + '/voltaic', query: { benchmark: 'legacy', level: benchmarks[benchmark].toLowerCase() } }"
      >
        <span>{{ (page - 1) * 25 + index + 1 }}</span>
        <span class="player-name">{{ player.username }}</span>
        <span class="points">{{ player.selectedPoints }}</span>
        <span class="rank-badge"><img :src="getImagePath(player.overallRank)" alt="" /><span>{{ player.overallRank }}</span></span>
      </router-link>
      <div class="pagination">
        <span>Showing {{ (page - 1) * 25 + 1 }}–{{ Math.min((page - 1) * 25 + pageData.players.length, pageData.total || 0) }} of {{ (pageData.total || 0).toLocaleString() }} players</span>
        <div class="pagination-controls">
          <button type="button" class="page-button" :disabled="page <= 1" aria-label="Previous page" @click="page--"><chevron-icon direction="left" class="h-4 w-4"></chevron-icon></button>
          <span class="page-button active">{{ page }} / {{ pageData.pageCount || 1 }}</span>
          <button type="button" class="page-button" :disabled="page >= pageData.pageCount" aria-label="Next page" @click="page++"><chevron-icon direction="right" class="h-4 w-4"></chevron-icon></button>
          <input class="page-input" type="number" min="1" :max="pageData.pageCount" aria-label="Go to page" v-model.number="goToPageInput" @keydown.enter="goToPage" />
          <button type="button" class="page-button" @click="goToPage">Go</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
import Dropdown from "../components/UI/Dropdown.vue";

export default {
    components: { Dropdown },
    data() {
        return {
            benchmarks: ["Novice", "Intermediate", "Advanced"],
            categories: ["Clicking", "Tracking", "Switching", "Overall"],
            subCategories: [["Dynamic", "Static", "Overall"], ["Precise", "Reactive", "Overall"], ["Speed", "Evasive", "Overall"]],
            benchmark: Math.max(0, ["novice", "intermediate", "advanced"].indexOf(this.$route.query.level)),
            category: 3,
            subCategory: 2,
            page: 1,
            pageData: { players: [], pageCount: 0 },
            goToPageInput: null,
            loading: false,
            error: "",
            requestVersion: 0,
        };
    },
    computed: {
        sort() {
            if (this.category === 3) return "overall";
            if (this.subCategory === 2) return ["clicking", "tracking", "switching"][this.category];
            return [["first", "second"], ["third", "fourth"], ["fifth", "sixth"]][this.category][this.subCategory];
        },
    },
    watch: {
        benchmark() {
            this.$router.replace({ query: { ...this.$route.query, level: this.benchmarks[this.benchmark].toLowerCase() } });
            this.resetAndLoad();
        },
        '$route.query.level'(level) {
            const index = this.benchmarks.findIndex(name => name.toLowerCase() === level);
            this.benchmark = Math.max(0, index);
        },
        sort() { this.resetAndLoad(); },
        page() { this.loadLeaderboard(); },
    },
    methods: {
        resetAndLoad() {
            if (this.page === 1) this.loadLeaderboard();
            else this.page = 1;
        },
        async loadLeaderboard() {
            const version = ++this.requestVersion;
            const mode = this.benchmarks[this.benchmark].toLowerCase();
            this.loading = true;
            this.error = "";
            try {
                const response = await fetch(`/api/leaderboards/vt/${mode}/page?page=${this.page}&sort=${this.sort}`);
                if (response.status === 503) {
                    if (version === this.requestVersion) this.error = "The leaderboard is being prepared. Check back after the first refresh.";
                    return;
                }
                if (!response.ok) throw new Error(`Leaderboard request failed: ${response.status}`);
                const result = await response.json();
                if (result.mode !== `vt-${mode}` || !Array.isArray(result.players)) throw new Error("Invalid leaderboard response");
                if (version === this.requestVersion) this.pageData = result;
            } catch (error) {
                if (version === this.requestVersion) {
                    console.error(error);
                    this.error = "Could not load the leaderboard. Try again later.";
                }
            } finally {
                if (version === this.requestVersion) this.loading = false;
            }
        },
        goToPage() {
            if (Number.isInteger(this.goToPageInput)) this.page = Math.min(Math.max(this.goToPageInput, 1), this.pageData.pageCount || 1);
            this.goToPageInput = null;
        },
        getImagePath(rank) {
            return `/rank-img/${rank.replace(/ /g, "").toLowerCase()}_badge.png`;
        },
    },
    mounted() { this.loadLeaderboard(); },
    beforeUnmount() { this.requestVersion++; },
};
</script>
