<template>
    <div class="space-y-10">
        <base-card class="flex items-center gap-10">
            <div>
                <p class="mb-1 ml-1">Benchmark</p>

                <dropdown
                    class="relative"
                    :selectedTab="{ label: benchmarksRA[selectedBenchmarkRA] }"
                >
                    <li
                        class="w-full bg-slate-700 px-4 py-1 transition hover:bg-slate-500"
                        v-for="(element, index) in benchmarksRA"
                        :key="index"
                        @click="changeBenchmark(index)"
                    >
                        {{ element }}
                    </li>
                </dropdown>
            </div>
            <div>
                <p class="mb-1 ml-1">Category</p>
                <dropdown
                    class="relative"
                    :selectedTab="{ label: categoriesRA[selectedCategoryRA] }"
                >
                    <li
                        class="w-full bg-slate-700 px-4 py-1 transition hover:bg-slate-500"
                        v-for="(element, index) in categoriesRA"
                        :key="index"
                        @click="changeCategory(index)"
                    >
                        {{ element }}
                    </li>
                </dropdown>
            </div>
            <div v-if="selectedCategoryRA != 3">
                <p class="mb-1 ml-1">Sub-Category</p>
                <dropdown
                    class="relative"
                    :selectedTab="{
                        label: subCategoriesRA[
                            categoriesRA[selectedCategoryRA]
                        ][selectedSubCategoryRA],
                    }"
                >
                    <li
                        class="w-full bg-slate-700 px-4 py-1 transition hover:bg-slate-500"
                        v-for="(element, index) in subCategoriesRA[
                            categoriesRA[selectedCategoryRA]
                        ]"
                        :key="index"
                        @click="changeSubCategory(index)"
                    >
                        {{ element }}
                    </li>
                </dropdown>
            </div>

        </base-card>

        <div
            v-if="leaderboardLoading"
            class="mb-16 flex items-center justify-center rounded-sm border border-slate-600 bg-slate-900 py-10"
        >
            <loading-spinner></loading-spinner>
        </div>
        <div v-else-if="leaderboardError" class="rounded-sm border border-slate-600 bg-slate-900 p-4" role="alert">
            {{ leaderboardError }}
        </div>
        <div v-else class="rounded-sm border border-slate-600 bg-slate-900">
            <div class="mx-2 mt-2 grid grid-cols-4 bg-slate-600 px-6 py-2">
                <p>Rank</p>
                <p>Name</p>
                <p>Points</p>
                <p>Overall Rank</p>
            </div>
            <router-link
                v-for="(player, index) in paginatedPlayerList.data"
                :key="index"
                class="mx-2 mt-1 grid grid-cols-4 bg-slate-700 px-6 py-2"
                :to="'/profile/' + player.username + '/'"
            >
                <p>{{ paginatedPlayerList.start + index + 1 }}</p>
                <p>{{ player.username }}</p>
                <p>{{ player.selectedPoints }}</p>
                <p class="flex items-center space-x-2">
                    <img
                        :src="getImagePath(player.overallRank)"
                        alt=""
                        class="inline-block h-6 w-6"
                    />
                    <span>{{ player.overallRank }}</span>
                </p>


            </router-link>

            <div class="mx-auto my-4 flex max-w-max items-center gap-1">
                <button
                    type="button"
                    class="inline-block h-full bg-slate-700 px-3 py-2.5"
                    @click="currentPage--"
                    :class="
                        currentPage > 0
                            ? ''
                            : 'disabled pointer-events-none text-slate-500'
                    "
                >
                    <chevron-icon
                        direction="left"
                        class="h-5 w-5 text-center"
                    ></chevron-icon>
                </button>


                <div class="flex gap-1">
                    <p
                        class="border border-slate-700 bg-slate-700 py-2 px-4 hover:cursor-pointer"
                        v-for="page in pageNumbers"
                        :key="page"
                        :class="{
                            'pointer-events-none border-slate-400 bg-slate-600':
                                this.currentPage == page - 1,
                            ' hover:bg-slate-600': !!parseInt(page),
                        }"
                        @click="handlePageSelect($event)"
                    >
                        {{ page }}
                    </p>
                </div>


                <button
                    type="button"
                    class="inline-block bg-slate-700 px-3 py-2.5 transition hover:bg-slate-600"
                    @click="currentPage++"
                    :class="
                        currentPage < paginatedPlayerList.pageCount
                            ? ''
                            : 'disabled pointer-events-none text-slate-500'
                    "
                >
                    <chevron-icon
                        class="h-5 w-5"
                        direction="right"
                    ></chevron-icon>
                </button>
                <input
                    type="text"
                    v-model.number="goToPageInput"
                    @keydown.enter="goToPage"
                    @blur="goToPage"
                    class="ml-2 w-10 bg-slate-600 py-2 text-center outline-none ring-inset ring-slate-300 transition focus:ring-2"
                />
                <button
                    class="w-10 bg-slate-600 py-2 text-center outline-none transition hover:bg-slate-500"
                    @click="goToPage"
                >
                    Go
                </button>
            </div>
        </div>
    </div>
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
            return `../../rank-img/ra/${rank.toLowerCase()}.png`;
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
