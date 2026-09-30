<template>
  <section class="benchmark-view">
    <benchmark-controls :sets="benchmarkSets" :selected-set="selectedSet.id" :level="currentTab.value" :levels="dropdownElements" @set-change="selectSet" @level-change="selectLevel" />
    <div v-if="RABenchmarks.rankingAvailable !== false" class="bench-overview">
      <div class="panel bench-overview-main">
        <div class="bench-medal">
          <img :src="getImagePath(RABenchmarks.overallRank)" alt="" />
          <div>
            <small>Overall rank</small>
            <strong :class="colorLookup[RABenchmarks.overallRank]">{{ RABenchmarks.overallRank }}</strong>
            <small>{{ RABenchmarks.overallPoints }} points</small>
          </div>
        </div>
      </div>
      <div class="panel bench-categories">
        <h2>Category points</h2>
        <div class="bench-categories-grid">
          <div v-for="(item, index) in subCategoryPoints" :key="index"><span>{{ displaySubCategories[index] }}</span><strong>{{ item }}</strong></div>
        </div>
      </div>
    </div>

    <p v-if="RABenchmarks.rankingAvailable === false" class="muted season-note">Series 4 scores and runs are available. Ranks will appear once the Aimlabs score requirements are verified.</p>
    <p v-if="actionError" class="panel status-panel mb-4" role="alert">{{ actionError }}</p>
    <section id="benchmark-table" class="panel bench-table">
      <h2 class="panel-header section-title">Scenario results</h2>
      <div class="bench-table-head"><span>Scenario</span><span>Score</span><span>{{ RABenchmarks.rankingAvailable === false ? 'Plays' : 'Rank' }}</span><span>{{ RABenchmarks.rankingAvailable === false ? 'Average score' : 'Points' }}</span><span></span></div>
      <div v-for="(bench, index) in RABenchmarks.benchmarks" :key="index" class="bench-row">
        <div class="bench-main">
          <span class="bench-name">{{ bench.name }}</span>
          <button v-if="bench.count" type="button" class="bench-score text-link" :aria-label="`View best run for ${bench.name}: ${bench.maxScore} points`" @click="showBestRun(bench)">{{ bench.maxScore }}</button><span v-else class="bench-score">—</span>
          <span v-if="RABenchmarks.rankingAvailable === false">{{ bench.count }}</span>
          <span v-else class="bench-rank" :class="colorLookup[bench.rank]"><img :src="getImagePath(bench.rank)" alt="" />{{ bench.rank }}</span>
          <span v-if="RABenchmarks.rankingAvailable === false">{{ bench.count ? Math.round(bench.avgScore).toLocaleString() : '—' }}</span>
          <span v-else class="bench-points">{{ bench.points }}<progress-bar class="progress-bar" :value="bench.progress" color="bg-mainCyan"></progress-bar></span>
          <button type="button" class="bench-expand" :aria-expanded="!!bench.detailsOpen" :aria-label="'Details for ' + bench.name" @click="toggleBenchDetails(bench)">
            <chevron-icon direction="down" class="h-4 w-4" :class="{ 'rotate-180': bench.detailsOpen }"></chevron-icon>
          </button>
        </div>
        <div v-if="bench.detailsOpen" class="bench-details">
          <p v-if="RABenchmarks.rankingAvailable !== false" class="field-label">Rank score requirements</p>
          <div v-if="RABenchmarks.rankingAvailable !== false" class="bench-threshold-wrap">
            <div class="bench-thresholds" :style="{ gridTemplateColumns: 'repeat(' + rankList.length + ', minmax(90px, 1fr))' }">
              <span v-for="rank in rankList" :key="rank" :class="colorLookup[rank]">{{ rank }}</span>
              <span v-for="(score, scoreIndex) in bench.scores" :key="scoreIndex">{{ score }}</span>
            </div>
          </div>
          <div class="bench-extra">
            <div class="bench-stats">
              <span>Total plays: {{ bench.count }}</span>
              <span v-if="bench.count">Best accuracy: {{ Math.floor(bench.maxAcc) }}%</span>
              <span v-if="bench.count">Average score: {{ Math.floor(bench.avgScore) }}</span>
              <span v-if="bench.count">Average accuracy: {{ Math.floor(bench.avgAcc) }}%</span>
            </div>
            <div class="bench-actions">
              <button type="button" @click="handlePlayScenario(bench)"><play-icon class="h-4 w-4"></play-icon>Play</button>
              <button type="button" :disabled="!bench.count" @click="showBestRun(bench)">View best run</button>
              <router-link :to="historyLink(bench.id)">View runs</router-link>
              <router-link :to="{ path: '/tasks/' + encodeURIComponent(bench.id) + '/leaderboard', query: { weapon: bench.weapon } }">View leaderboard</router-link>
            </div>
          </div>
        </div>
      </div>
    </section>
  </section>
</template>

<script>
import * as ra from "../helpers/revosectData.js";
import {
    findWorkshopId,
    taskDeepLink,
} from "@/helpers/functions.js";
import BenchmarkControls from "../components/BenchmarkControls.vue";
import { openRunDetails } from "../helpers/runDetails.js";
export default {
    components: { BenchmarkControls },
    data() {
        return {
            actionError: "",
            categories: ["Clicking", "Tracking", "Switching"],
            subCategories: [
                "Static",
                "Dynamic",
                "Precise",
                "Reactive",
                "Flick",
                "Track",
            ],
            dropdownElements: ["Easy", "Medium", "Hard"],
        };
    },
    computed: {
        currentPlayerInfo() {
            return this.$store.getters.currentPlayerInfo;
        },
        benchmarkSets() { return this.$store.getters.benchmarkSets.filter(set => !set.community || set.community === 'revosect').map(set => set.id === 'legacy' ? { ...set, label: 'Series 2 (archived thresholds)' } : set); },
        selectedSet() { return this.benchmarkSets.find(set => set.id === this.$route.query.benchmark) || this.benchmarkSets.find(set => set.id === "revosect_s4") || this.benchmarkSets[0]; },
        currentTab() {
            const label = this.dropdownElements.find(value => value.toLowerCase() === this.$route.query.level) || "Hard";
            return { value: label.toLowerCase(), label };
        },
        rankList() {
            switch (this.currentTab.value) {
                case "hard":
                    return [
                        "Mythic",
                        "Immortal",
                        "Archon",
                        "Ethereal",
                        "Divine",
                    ];

                case "medium":
                    return ["Ace", "Legend", "Sentinel", "Valour"];

                case "easy":
                    return ["Bronze", "Silver", "Gold", "Platinum"];
            }
        },
        pointList() {
            switch (this.currentTab.value) {
                case "hard":
                    return ra.hardSubPoints;
                case "medium":
                    return ra.mediumPoints;
                case "easy":
                    return ra.easySubPoints;
            }
        },
        RABenchmarks() {
            return this.selectedSet.results[`RA${this.currentTab.label}`];
        },
        colorLookup() {
            return {
                Iron: "text-iron",
                Bronze: "text-bronze",
                Silver: "text-silver",
                Gold: "text-gold",
                Platinum: "text-platinum",
                Mythic: "text-mythic",
                Immortal: "text-immortal",
                Archon: "text-archon",
                Ethereal: "text-ethereal",
                Divine: "text-divine",
            };
        },
        subCategoryPoints() {
            return this.RABenchmarks.subCategoryPoints;
        },
        displaySubCategories() {
            return this.currentTab.value === "easy"
                ? ["Static", "Dynamic", "Precise", "Flick"]
                : this.subCategories;
        },
    },
    methods: {
        getImagePath(rank) {
            return `/rank-img/ra/${rank.toLowerCase()}.png`;
        },
        selectSet(id) { this.$router.push({ query: { benchmark: id, level: this.currentTab.value } }); },
        selectLevel(level) { this.$router.push({ query: { benchmark: this.selectedSet.id, level } }); },
        historyLink(taskId) { return `/profile/${encodeURIComponent(this.currentPlayerInfo.username)}/tasks/${encodeURIComponent(taskId)}/runs`; },
        showBestRun(bench) { openRunDetails({ username: this.currentPlayerInfo.username, taskId: bench.id, taskName: bench.name, weapon: bench.weapon, score: bench.maxScore }); },
        toggleBenchDetails(bench) {
            bench.detailsOpen = !bench.detailsOpen;
        },
        async handlePlayScenario(bench) {
            this.actionError = "";
            try {
                const workshopId = bench.workshopId || await findWorkshopId(bench.id);
                window.open(taskDeepLink(workshopId), "_blank");
            } catch (error) {
                console.error(error);
                this.actionError = "Could not open this task. Try again.";
            }
        },
    },
};
</script>
