<template>
  <section class="benchmark-view">
    <div class="bench-overview">
      <div class="panel bench-overview-main">
        <dropdown :selected-tab="currentTab">
          <li v-for="(element, index) in dropdownElements" :key="element" @click="handleDropdownSelect(index)">{{ element }}</li>
        </dropdown>
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
          <span class="bench-score">{{ bench.maxScore }}</span>
          <span class="bench-rank" :class="colorLookup[bench.rank]"><img :src="getImagePath(bench.rank, 'badge')" alt="" />{{ bench.rank }}</span>
          <span class="bench-points">{{ bench.energy }}<progress-bar class="progress-bar" :value="energyBar(bench.energy).value" :max="energyBar(bench.energy).max" color="bg-mainCyan"></progress-bar></span>
          <button type="button" class="bench-expand" :aria-expanded="!!bench.detailsOpen" :aria-label="'Details for ' + bench.name" @click="toggleBenchDetails(bench)">
            <chevron-icon direction="down" class="h-4 w-4" :class="{ 'rotate-180': bench.detailsOpen }"></chevron-icon>
          </button>
        </div>
        <div v-if="bench.detailsOpen" class="bench-details">
          <p class="field-label">Rank score requirements</p>
          <div class="bench-threshold-wrap">
            <div class="bench-thresholds" :style="{ gridTemplateColumns: 'repeat(' + rankList.length + ', minmax(90px, 1fr))' }">
              <span v-for="rank in rankList" :key="rank" :class="colorLookup[rank]">{{ rank }}</span>
              <span v-for="(score, scoreIndex) in bench.scores.slice(1)" :key="scoreIndex">{{ score }}</span>
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
import {
    advancedRanks,
    intermediateRanks,
    noviceRanks,
    categories,
    advancedEnergy,
    intermediateEnergy,
    noviceEnergy,
} from "@/helpers/voltaicData.js";
import { findReplay } from "@/helpers/functions.js";
import {
    findWorkshopId,
    taskDeepLink,
} from "../helpers/functions";
export default {
    data() {
        return {
            replayLoading: false,
            actionError: "",
            currentTabIndex: 2,
            categories: ["Clicking", "Tracking", "Switching"],
            subCategories: [
                "Dynamic",
                "Static",
                "Precise",
                "Reactive",
                "Speed",
                "Evasive",
            ],
            dropdownElements: ["Novice", "Intermediate", "Advanced"],
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
        VTBenchmarks() {
            switch (this.currentTab.value) {
                case "advanced":
                    return this.$store.getters.VTAdvanced;
                case "intermediate":
                    return this.$store.getters.VTIntermediate;
                case "novice":
                    return this.$store.getters.VTNovice;
                default:
                    return this.$store.getters.VTAdvanced;
            }
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
        mappedEnergy() {
            let energyList;
            let rankList;
            switch (this.currentTab.value) {
                case "advanced":
                    energyList = advancedEnergy;
                    rankList = advancedRanks;
                    break;
                case "intermediate":
                    energyList = intermediateEnergy;
                    rankList = intermediateRanks;
                    break;
                case "novice":
                    energyList = noviceEnergy;
                    rankList = noviceRanks;
                    break;
                default:
                    break;
            }
            return this.VTBenchmarks.subCategoryEnergy.map((energy, index) => {
                return {
                    rank:
                        energy < energyList[1]
                            ? "Unranked"
                            : rankList[Math.floor(energy / 100) * 100],
                    energy,
                    category: categories[index],
                };
            });
        },
        rankList() {
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
        energyBar(energy) {
            let energyList = null;
            let value = 0;
            let max = 0;
            switch (this.currentTab.value) {
                case "advanced":
                    energyList = advancedEnergy;
                    max = energy < 900 ? 900 : 100;
                    break;
                case "intermediate":
                    energyList = intermediateEnergy;
                    max = energy < 500 ? 500 : 100;
                    break;
                case "novice":
                    energyList = noviceEnergy;
                    max = 100;
                    break;
            }
            if (energy >= energyList[4]) value = 100;
            else if (energy < energyList[1]) value = energy;
            else value = energy % 100;
            return {
                value,
                max,
            };
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
