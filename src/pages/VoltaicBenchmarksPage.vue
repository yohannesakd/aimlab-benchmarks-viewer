<template>
  <section class="benchmark-view">
    <benchmark-controls :sets="benchmarkSets" :selected-set="selectedSet.id" :level="currentTab.value" :levels="dropdownElements" @set-change="selectSet" @level-change="selectLevel" />
    <div class="bench-overview">
      <div class="panel bench-overview-main">
        <div class="bench-medal">
          <img :src="getImagePath(VTBenchmarks.overallRank, 'medal')" alt="" />
          <div>
            <small>Overall rank</small>
            <strong :class="colorLookup[VTBenchmarks.overallRank]">{{ VTBenchmarks.overallRank }}</strong>
            <small>{{ VTBenchmarks.overallEnergy }} energy</small>
          </div>
        </div>
      </div>
      <div class="panel bench-categories">
        <h2>Category energy</h2>
        <div class="bench-categories-grid">
          <div v-for="(item, index) in mappedEnergy" :key="index">
            <span>{{ item.category }}</span>
            <strong>{{ item.energy }} <img :src="getImagePath(item.rank, 'badge')" alt="" class="inline-block h-4 w-4 object-contain" /></strong>
          </div>
        </div>
      </div>
    </div>

    <p v-if="actionError" class="panel status-panel mb-4" role="alert">{{ actionError }}</p>
    <section id="benchmark-table" class="panel bench-table">
      <h2 class="panel-header section-title">Scenario results</h2>
      <div class="bench-table-head"><span>Scenario</span><span>Score</span><span>Rank</span><span>Energy</span><span></span></div>
      <div v-for="(bench, index) in VTBenchmarks.benchmarks" :key="index" class="bench-row">
        <div class="bench-main">
          <span class="bench-name">{{ bench.name }}</span>
          <button v-if="bench.count" type="button" class="bench-score text-link" :aria-label="`View best run for ${bench.name}: ${bench.maxScore} points`" @click="showBestRun(bench)">{{ bench.maxScore }}</button><span v-else class="bench-score">—</span>
          <span class="bench-rank" :class="colorLookup[bench.rank]"><img :src="getImagePath(bench.rank, 'badge')" alt="" />{{ bench.rank }}</span>
          <span class="bench-points">{{ bench.energy }}<progress-bar class="progress-bar" :value="bench.energyProgress.value" :max="bench.energyProgress.max" color="bg-mainCyan"></progress-bar></span>
          <button type="button" class="bench-expand" :aria-expanded="!!bench.detailsOpen" :aria-label="'Details for ' + bench.name" @click="toggleBenchDetails(bench)">
            <chevron-icon direction="down" class="h-4 w-4" :class="{ 'rotate-180': bench.detailsOpen }"></chevron-icon>
          </button>
        </div>
        <div v-if="bench.detailsOpen" class="bench-details">
          <p class="field-label">Rank score requirements</p>
          <div class="bench-threshold-wrap">
            <div class="bench-thresholds" :style="{ gridTemplateColumns: 'repeat(' + rankList.length + ', minmax(90px, 1fr))' }">
              <span v-for="rank in rankList" :key="rank" :class="colorLookup[rank]">{{ rank }}</span>
              <span v-for="(score, scoreIndex) in selectedSet.id === 'legacy' ? bench.scores.slice(1) : bench.scores" :key="scoreIndex">{{ score }}</span>
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
import {
    findWorkshopId,
    taskDeepLink,
} from "../helpers/functions";
import BenchmarkControls from "../components/BenchmarkControls.vue";
import { openRunDetails } from "../helpers/runDetails.js";
export default {
    components: { BenchmarkControls },
    data() {
        return {
            actionError: "",
            dropdownElements: ["Novice", "Intermediate", "Advanced"],
        };
    },
    computed: {
        currentPlayerInfo() {
            return this.$store.getters.currentPlayerInfo;
        },
        benchmarkSets() { return this.$store.getters.benchmarkSets.filter(set => !set.community || set.community === 'voltaic').map(set => set.id === 'legacy' ? { ...set, label: 'Season 2 (archived thresholds)' } : set); },
        selectedSet() { return this.benchmarkSets.find(set => set.id === this.$route.query.benchmark) || this.benchmarkSets.find(set => set.id === "aimlabs_s3") || this.benchmarkSets[0]; },
        currentTab() {
            const label = this.dropdownElements.find(value => value.toLowerCase() === this.$route.query.level) || "Advanced";
            return { value: label.toLowerCase(), label };
        },
        VTBenchmarks() {
            return this.selectedSet.results[`VT${this.currentTab.label}`];
        },

        colorLookup() {
            return {
                Iron: "text-iron",
                Bronze: "text-bronze",
                Silver: "text-silver",
                Gold: "text-gold",
                Platinum: "text-platinum",
                Diamond: "text-diamond",
                Jade: "text-jade",
                Master: "text-master",
                Grandmaster: "text-grandmaster",
                Nova: "text-nova",
                Astra: "text-astra",
                Celestial: "text-celestial",
            };
        },
        mappedEnergy() { return this.VTBenchmarks.categories; },
        rankList() {
            if (this.VTBenchmarks.rankList) return this.VTBenchmarks.rankList;
            switch (this.currentTab.value) {
                case "advanced":
                    return ["Grandmaster", "Nova", "Astra", "Celestial"];

                case "intermediate":
                    return ["Platinum", "Diamond", "Jade", "Master"];

                case "novice":
                    return ["Iron", "Bronze", "Silver", "Gold"];
            }
        },
    },
    methods: {
        getImagePath(rank, option) {
            if (!rank) return "";
            let rankType = rank.replace(/ /g, "");
            if (option == "badge") {
                return `/rank-img/${rankType.toLowerCase()}_badge.png`;
            } else if (option == "medal") {
                if (rankType.endsWith("Complete")) return `/rank-img/${rankType.toLowerCase()}_badge.png`;
                return `/rank-img/${rankType.toLowerCase()}.png`;
            }
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
