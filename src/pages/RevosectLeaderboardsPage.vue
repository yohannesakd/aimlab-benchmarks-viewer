<template>
  <section class="space-y-4">
    <div class="panel filter-bar">
      <div>
        <label class="field-label">Level</label>
        <dropdown :selectedTab="{ label: benchmarksRA[selectedBenchmarkRA] }">
          <li v-for="(element, index) in benchmarksRA" :key="element" @click="changeBenchmark(index)">{{ element }}</li>
        </dropdown>
      </div>
      <div>
        <label class="field-label">Category</label>
        <dropdown :selectedTab="{ label: categoriesRA[selectedCategoryRA] }">
          <li v-for="(element, index) in categoriesRA" :key="element" @click="changeCategory(index)">{{ element }}</li>
        </dropdown>
      </div>
      <div v-if="selectedCategoryRA !== 3">
        <label class="field-label">Subcategory</label>
        <dropdown :selectedTab="{ label: subCategoriesRA[categoriesRA[selectedCategoryRA]][selectedSubCategoryRA] }">
          <li v-for="(element, index) in subCategoriesRA[categoriesRA[selectedCategoryRA]]" :key="element" @click="changeSubCategory(index)">{{ element }}</li>
        </dropdown>
      </div>
      <span class="filter-status">Refreshed daily</span>
    </div>

    <div v-if="leaderboardLoading" class="panel status-panel" aria-live="polite"><loading-spinner></loading-spinner></div>
    <div v-else-if="leaderboardError" class="panel status-panel" role="alert">{{ leaderboardError }}</div>
    <div v-else class="panel leaderboard-panel">
      <h2 class="leaderboard-heading">Revosect · {{ benchmarksRA[selectedBenchmarkRA] }}</h2>
      <div class="leaderboard-row leaderboard-row--head" aria-hidden="true">
        <span>Rank</span><span>Player</span><span>Points</span><span>Overall rank</span>
      </div>
      <router-link
        v-for="(player, index) in paginatedPlayerList.data"
        :key="index"
        class="leaderboard-row leaderboard-row--player"
        :to="'/profile/' + player.username + '/'"
      >
        <span>{{ paginatedPlayerList.start + index + 1 }}</span>
        <span class="player-name">{{ player.username }}</span>
        <span class="points">{{ player.selectedPoints }}</span>
        <span class="rank-badge"><img :src="getImagePath(player.overallRank)" alt="" /><span>{{ player.overallRank }}</span></span>
      </router-link>
      <div class="pagination">
        <span>Showing {{ paginatedPlayerList.start + 1 }}–{{ Math.min(paginatedPlayerList.start + paginatedPlayerList.data.length, pageData.total || 0) }} of {{ (pageData.total || 0).toLocaleString() }} players</span>
        <div class="pagination-controls">
          <button type="button" class="page-button" :disabled="currentPage <= 0" aria-label="Previous page" @click="currentPage--"><chevron-icon direction="left" class="h-4 w-4"></chevron-icon></button>
          <button v-for="(page, index) in pageNumbers" :key="index" type="button" class="page-button page-number" :class="{ active: page === currentPage + 1 }" :disabled="page === '...'" @click="handlePageSelect($event)">{{ page }}</button>
          <button type="button" class="page-button" :disabled="currentPage >= paginatedPlayerList.pageCount" aria-label="Next page" @click="currentPage++"><chevron-icon direction="right" class="h-4 w-4"></chevron-icon></button>
          <span class="page-status">Page {{ currentPage + 1 }} / {{ pageData.pageCount || 1 }}</span>
          <input class="page-input" type="number" min="1" :max="pageData.pageCount" aria-label="Go to page" v-model.number="goToPageInput" @keydown.enter="goToPage" />
          <button type="button" class="page-button" @click="goToPage">Go</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
import { mapGetters } from "vuex";
import Dropdown from "../components/UI/Dropdown.vue";
export default {
    components: { Dropdown },
    data() {
        return {
            currentPage: 0,
            goToPageInput: null,
            pageData: { players: [], pageCount: 0 },
            leaderboardLoading: false,
            leaderboardError: "",
            requestVersion: 0,
            benchmark: ["Easy", "Medium", "Hard"],
            category: ["Clicking", "Tracking", "Switching", "Overall"],
            subCategory: {
                Clicking: ["Static", "Dynamic", "Overall"],
                Tracking: ["Precise", "Reactive", "Overall"],
                Switching: ["Flick", "Track", "Overall"],
            },
        };
    },
    watch: {
        selectedBenchmarkRA() {
            this.resetAndLoad();
        },
        selectedCategoryRA() {
            this.resetAndLoad();
        },
        selectedSubCategoryRA() {
            this.resetAndLoad();
        },
        currentPage() {
            this.loadLeaderboard();
        },
    },
    computed: {
        ...mapGetters([
            "selectedBenchmarkRA",
            "selectedCategoryRA",
            "selectedSubCategoryRA",
            "benchmarksRA",
            "subCategoriesRA",
            "categoriesRA",
        ]),
        selectedLeaderboard() {
            return this.pageData.players;
        },
        selectedSort() {
            if (this.selectedCategoryRA === 3) return "overall";
            if (this.selectedSubCategoryRA === 2) {
                return ["clicking", "tracking", "switching"][this.selectedCategoryRA];
            }
            return [
                ["first", "second"],
                ["third", "fourth"],
                ["fifth", "sixth"],
            ][this.selectedCategoryRA][this.selectedSubCategoryRA];
        },
        paginatedPlayerList() {
            return {
                data: this.selectedLeaderboard,
                start: this.currentPage * 25,
                pageCount: Math.max(0, this.pageData.pageCount - 1),
            };
        },
        pageNumbers() {
            let pages = [];
            if (this.currentPage > 1) pages.push(1);
            if (this.currentPage > 2) pages.push("...");
            for (
                let i = this.currentPage;
                i < this.currentPage + 3 &&
                i < this.paginatedPlayerList.pageCount + 2;
                i++
            ) {
                if (i > 0) pages.push(i);
            }
            if (this.currentPage < this.paginatedPlayerList.pageCount - 2)
                pages.push("...");
            if (this.currentPage < this.paginatedPlayerList.pageCount - 1)
                pages.push(this.paginatedPlayerList.pageCount + 1);
            return pages;
        },
    },
    methods: {
        changeBenchmark(index) {
            this.$store.commit("setSelectedBenchmarkRA", index);
        },
        changeCategory(index) {
            this.$store.commit("setSelectedCategoryRA", index);
        },
        changeSubCategory(index) {
            this.$store.commit("setSelectedSubCategoryRA", index);
        },

        resetAndLoad() {
            if (this.currentPage === 0) this.loadLeaderboard();
            else this.currentPage = 0;
        },

        async loadLeaderboard() {
            const version = ++this.requestVersion;
            const mode = this.benchmark[this.selectedBenchmarkRA].toLowerCase();
            this.leaderboardError = "";
            this.leaderboardLoading = true;
            try {
                const response = await fetch(`/api/leaderboards/ra/${mode}/page?page=${this.currentPage + 1}&sort=${this.selectedSort}`);
                if (response.status === 503) {
                    if (version === this.requestVersion) this.leaderboardError = "The leaderboard is being prepared. Check back after the first refresh.";
                    return;
                }
                if (!response.ok) throw new Error(`Leaderboard request failed: ${response.status}`);
                const page = await response.json();
                if (page.mode !== `ra-${mode}` || !Array.isArray(page.players)) throw new Error("Invalid leaderboard response");
                if (version === this.requestVersion) this.pageData = page;
            } catch (error) {
                if (version === this.requestVersion) {
                    console.error(error);
                    this.leaderboardError = "Could not load the leaderboard. Try again later.";
                }
            } finally {
                if (version === this.requestVersion) this.leaderboardLoading = false;
            }
        },

        handlePageSelect(event) {
            let value = parseInt(event.target.textContent);
            if (value) {
                this.currentPage = value - 1;
            }
        },
        goToPage() {
            if (Number.isInteger(this.goToPageInput)) {
                this.currentPage = Math.min(
                    Math.max(this.goToPageInput - 1, 0),
                    this.paginatedPlayerList.pageCount
                );
            }
            this.goToPageInput = null;
        },
        getImagePath(rank) {
            return `/rank-img/ra/${rank.toLowerCase()}.png`;
        },
    },

    mounted() {
        this.loadLeaderboard();
    },
    beforeUnmount() {
        this.requestVersion++;
    },
};
</script>
