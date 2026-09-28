<template>
    <div class="space-y-10">
        <base-card class="flex items-center gap-10">
            <div>
                <p class="mb-1 ml-1">Benchmark</p>
                <dropdown class="relative" :selectedTab="{ label: benchmarks[benchmark] }">
                    <li v-for="(name, index) in benchmarks" :key="name" class="w-full bg-slate-700 px-4 py-1 transition hover:bg-slate-500" @click="benchmark = index">{{ name }}</li>
                </dropdown>
            </div>
            <div>
                <p class="mb-1 ml-1">Category</p>
                <dropdown class="relative" :selectedTab="{ label: categories[category] }">
                    <li v-for="(name, index) in categories" :key="name" class="w-full bg-slate-700 px-4 py-1 transition hover:bg-slate-500" @click="category = index">{{ name }}</li>
                </dropdown>
            </div>
            <div v-if="category !== 3">
                <p class="mb-1 ml-1">Sub-Category</p>
                <dropdown class="relative" :selectedTab="{ label: subCategories[category][subCategory] }">
                    <li v-for="(name, index) in subCategories[category]" :key="name" class="w-full bg-slate-700 px-4 py-1 transition hover:bg-slate-500" @click="subCategory = index">{{ name }}</li>
                </dropdown>
            </div>
        </base-card>

        <div v-if="loading" class="mb-16 flex items-center justify-center rounded-sm border border-slate-600 bg-slate-900 py-10"><loading-spinner></loading-spinner></div>
        <div v-else-if="error" class="rounded-sm border border-slate-600 bg-slate-900 p-4" role="alert">{{ error }}</div>
        <div v-else class="rounded-sm border border-slate-600 bg-slate-900">
            <div class="mx-2 mt-2 grid grid-cols-4 bg-slate-600 px-6 py-2"><p>Rank</p><p>Name</p><p>Energy</p><p>Overall Rank</p></div>
            <router-link v-for="(player, index) in pageData.players" :key="player.username" class="mx-2 mt-1 grid grid-cols-4 bg-slate-700 px-6 py-2" :to="'/profile/' + player.username + '/voltaic'">
                <p>{{ (page - 1) * 25 + index + 1 }}</p>
                <p>{{ player.username }}</p>
                <p>{{ player.selectedPoints }}</p>
                <p class="flex items-center space-x-2"><img :src="getImagePath(player.overallRank)" alt="" class="inline-block h-6 w-6" /><span>{{ player.overallRank }}</span></p>
            </router-link>
            <div class="mx-auto my-4 flex max-w-max items-center gap-1">
                <button type="button" class="bg-slate-700 px-3 py-2.5 disabled:text-slate-500" :disabled="page <= 1" @click="page--"><chevron-icon direction="left" class="h-5 w-5"></chevron-icon></button>
                <span class="bg-slate-700 px-4 py-2">{{ page }} / {{ pageData.pageCount || 1 }}</span>
                <button type="button" class="bg-slate-700 px-3 py-2.5 disabled:text-slate-500" :disabled="page >= pageData.pageCount" @click="page++"><chevron-icon direction="right" class="h-5 w-5"></chevron-icon></button>
                <input type="number" min="1" :max="pageData.pageCount" v-model.number="goToPageInput" @keydown.enter="goToPage" class="ml-2 w-14 bg-slate-600 py-2 text-center outline-none ring-inset ring-slate-300 transition focus:ring-2" />
                <button type="button" class="w-10 bg-slate-600 py-2 transition hover:bg-slate-500" @click="goToPage">Go</button>
            </div>
        </div>
    </div>
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
            benchmark: 0,
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
        benchmark() { this.resetAndLoad(); },
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
            return `../../rank-img/${rank.replace(/ /g, "").toLowerCase()}_badge.png`;
        },
    },
    mounted() { this.loadLeaderboard(); },
    beforeUnmount() { this.requestVersion++; },
};
</script>
