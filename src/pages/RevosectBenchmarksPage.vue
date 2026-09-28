<template>
  <section class="benchmark-view">
    <div class="bench-overview">
      <div class="panel bench-overview-main">
        <dropdown :selected-tab="currentTab">
          <li v-for="(element, index) in dropdownElements" :key="element" @click="handleDropdownSelect(index)">{{ element }}</li>
        </dropdown>
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

    <p v-if="actionError" class="panel status-panel mb-4" role="alert">{{ actionError }}</p>
    <section id="benchmark-table" class="panel bench-table">
      <h2 class="panel-header section-title">Scenario results</h2>
      <div class="bench-table-head"><span>Scenario</span><span>Score</span><span>Rank</span><span>Points</span><span></span></div>
      <div v-for="(bench, index) in RABenchmarks.benchmarks" :key="index" class="bench-row">
        <div class="bench-main">
          <span class="bench-name">{{ bench.name }}</span>
          <span class="bench-score">{{ bench.maxScore }}</span>
          <span class="bench-rank" :class="colorLookup[bench.rank]"><img :src="getImagePath(bench.rank)" alt="" />{{ bench.rank }}</span>
          <span class="bench-points">{{ bench.points }}<progress-bar class="progress-bar" :value="bench.progress" color="bg-mainCyan"></progress-bar></span>
          <button type="button" class="bench-expand" :aria-expanded="!!bench.detailsOpen" :aria-label="'Details for ' + bench.name" @click="toggleBenchDetails(bench)">
            <chevron-icon direction="down" class="h-4 w-4" :class="{ 'rotate-180': bench.detailsOpen }"></chevron-icon>
          </button>
        </div>
        <div v-if="bench.detailsOpen" class="bench-details">
          <p class="field-label">Rank score requirements</p>
          <div class="bench-threshold-wrap">
            <div class="bench-thresholds" :style="{ gridTemplateColumns: 'repeat(' + rankList.length + ', minmax(90px, 1fr))' }">
              <span v-for="rank in rankList" :key="rank" :class="colorLookup[rank]">{{ rank }}</span>
              <span v-for="(score, scoreIndex) in bench.scores" :key="scoreIndex">{{ score }}</span>
            </div>
          </div>
          <div class="bench-extra">
            <div class="bench-stats">
              <span>Total plays: {{ bench.count }}</span>
              <span v-if="bench.count">PB accuracy: {{ Math.floor(bench.maxAcc) }}%</span>
              <span v-if="bench.count">Average score: {{ Math.floor(bench.avgScore) }}</span>
              <span v-if="bench.count">Average accuracy: {{ Math.floor(bench.avgAcc) }}%</span>
            </div>
            <div class="bench-actions">
              <button type="button" @click="handlePlayScenario(bench.id)"><play-icon class="h-4 w-4"></play-icon>Play</button>
              <button type="button" :disabled="!bench.count || replayLoading" @click="replayLink(bench.id, bench.weapon)">{{ replayLoading ? "Loading…" : "Watch replay" }}</button>
              <router-link :to="'/tasks/' + bench.id">View leaderboard</router-link>
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
    findReplay,
    findWorkshopId,
    taskDeepLink,
} from "@/helpers/functions.js";
export default {
    data() {
        return {
            replayLoading: false,
            actionError: "",
            currentTabIndex: 2,
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
        currentTab() {
            return {
                value: this.dropdownElements[
                    this.currentTabIndex
                ].toLowerCase(),
                label: this.dropdownElements[this.currentTabIndex],
            };
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
            switch (this.currentTab.value) {
                case "hard":
                    return this.$store.getters.RAHard;
                case "medium":
                    return this.$store.getters.RAMedium;
                case "easy":
                    return this.$store.getters.RAEasy;
                default:
                    return this.$store.getters.RAHard;
            }
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
        handleDropdownSelect(index) {
            this.currentTabIndex = index;
        },
        toggleBenchDetails(bench) {
            bench.detailsOpen = !bench.detailsOpen;
        },
        async handlePlayScenario(taskId) {
            this.actionError = "";
            try {
                const workshopId = await findWorkshopId(taskId);
                window.open(taskDeepLink(workshopId), "_blank");
            } catch (error) {
                console.error(error);
                this.actionError = "Could not open this task. Try again.";
            }
        },
        async replayLink(taskId, weapon) {
            this.actionError = "";
            this.replayLoading = true;
            try {
                const link = await findReplay(
                    this.currentPlayerInfo.username,
                    taskId,
                    weapon
                );
                if (link) window.open(link, "_blank");
                else this.actionError = "Replay not found.";
            } catch (error) {
                console.error(error);
                this.actionError = "Could not find this replay. Try again.";
            } finally {
                this.replayLoading = false;
            }
        },
    },
};
</script>

<style scoped>
#category-bar {
    min-width: 788px;
    left: 64px;
    top: 60px;
}
#category-bar span {
    transform: scale(-1, -1);
}
</style>
