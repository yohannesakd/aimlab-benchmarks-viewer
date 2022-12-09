<template>
    <div class="relative min-h-max">
        <!-- <div
            v-if="!VTBenchmarks.overallEnergy"
            class="grid place-items-center p-10"
        >
            <loading-spinner></loading-spinner>
        </div> -->
        <div id="mode-wrapper">
            <!-- Overall Benchmark Stats -->
            <div
                class="mt-4 flex max-h-96 w-full justify-center gap-4 font-oswald"
            >
                <dropdown
                    class="ml-4 mr-auto self-start"
                    :selected-tab="currentTab"
                >
                    <li
                        class="px-4 py-1 transition hover:bg-slate-600"
                        v-for="(element, index) in dropdownElements"
                        :key="index"
                        @click="handleDropdownSelect(index)"
                    >
                        {{ element }}
                    </li>
                </dropdown>

                <div class="my-2 mr-auto flex gap-20">
                    <div
                        class="flex flex-col items-center justify-center text-center"
                    >
                        <img
                            class="h-36"
                            :src="
                                getImagePath(VTBenchmarks.overallRank, 'medal')
                            "
                            alt=""
                        />
                        <p
                            class="font-bold uppercase tracking-widest"
                            :class="colorLookup[VTBenchmarks.overallRank]"
                        >
                            {{ VTBenchmarks.overallRank }}
                        </p>
                        <p class="flex items-center gap-1">
                            <span class="-mt-1">Overall Energy :</span>
                            <span
                                class="font-bold"
                                :class="colorLookup[VTBenchmarks.overallRank]"
                                >{{ VTBenchmarks.overallEnergy }}</span
                            >
                        </p>
                    </div>
                    <div
                        class="flex flex-col items-center justify-center tracking-wide text-slate-200"
                    >
                        <p class="text-lg font-bold">SubCategories</p>
                        <ul class="mt-4 grid grid-cols-2 gap-1">
                            <li
                                v-for="(item, index) in mappedEnergy"
                                :key="index"
                                class="flex items-center gap-2 pr-4"
                            >
                                {{ item.category }} :
                                <span class="font-bold">{{ item.energy }}</span>
                                <img
                                    :src="getImagePath(item.rank, 'badge')"
                                    class="inline-block w-6"
                                    alt=""
                                />
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- Benchmarks table -->
            <section class="relative p-4" id="benchmark-table">
                <header class="grid grid-cols-12 bg-slate-700 py-2 pr-4 pl-16">
                    <p class="col-span-4 ml-2">Scenario</p>
                    <p>Score</p>
                    <p class="col-span-3">Rank</p>
                    <p class="col-span-2">Energy</p>
                </header>
                <div
                    v-for="(bench, index) in VTBenchmarks.benchmarks"
                    :key="index"
                    class="mt-1 ml-14 grid grid-cols-12 bg-slate-800 px-4 py-2 text-slate-200"
                >
                    <p class="col-span-4">{{ bench.name }}</p>
                    <p class="font-semibold tracking-wide">
                        {{ bench.maxScore }}
                    </p>
                    <p
                        class="col-span-3 flex gap-2"
                        :class="colorLookup[bench.rank]"
                    >
                        <img
                            class="h-5 self-center"
                            :src="getImagePath(bench.rank, 'badge')"
                            alt=""
                        />
                        {{ bench.rank }}
                    </p>
                    <div
                        class="relative col-span-3 flex items-center justify-between"
                    >
                        <span
                            class="absolute left-1/2 z-10 -translate-x-1/2 transform text-right"
                            >{{ bench.energy }}</span
                        >
                        <progress-bar
                            class="h-5 w-full bg-slate-600"
                            :value="energyBar(bench.energy).value"
                            :max="energyBar(bench.energy).max"
                            color="bg-blue-500"
                        ></progress-bar>
                        <!-- colors: bg-grandmaster bg-nova bg-celestial bg-astra bg-iron bg-bronze bg-silver bg-gold bg-platinum bg-diamond bg-jade bg-master -->
                    </div>
                    <p
                        class="relative col-start-12 ml-4 flex items-center justify-center"
                    >
                        <chevron-icon
                            direction="down"
                            class="absolute h-full w-12 transition hover:translate-y-0.5 hover:text-slate-400"
                            :class="bench.detailsOpen ? 'rotate-180' : ''"
                            @click="toggleBenchDetails(bench)"
                        ></chevron-icon>
                    </p>
                    <div
                        class="col-span-12 mt-2 gap-10 border-t-2 border-t-slate-600 py-2 pl-4 text-slate-200 transition"
                        v-if="bench.detailsOpen"
                    >
                        <div class="pb-4">
                            <div class="flex flex-col gap-0.5">
                                <div
                                    class="min-w-3/4 grid gap-0.5 text-center"
                                    :class="scoreReqGrid"
                                >
                                    <span
                                        v-for="(rank, index) in rankList"
                                        :key="index"
                                        class="bg-slate-700 px-8 py-2 text-center"
                                        :class="colorLookup[rank]"
                                        >{{ rank }}</span
                                    >
                                </div>
                                <div
                                    class="grid gap-0.5 text-center"
                                    :class="scoreReqGrid"
                                >
                                    <span
                                        v-for="(
                                            score, index
                                        ) in bench.scores.slice(1)"
                                        :key="index"
                                        class="bg-slate-700 px-8 py-2"
                                        >{{ score }}</span
                                    >
                                </div>
                            </div>
                        </div>
                        <div class="flex">
                            <div class="flex flex-col gap-2">
                                <div class="grid grid-cols-2">
                                    <p v-if="bench.count">
                                        PB Accuracy :
                                        {{ Math.floor(bench.maxAcc) }}%
                                    </p>
                                    <p>Total Plays : {{ bench.count }}</p>
                                </div>
                                <div class="grid grid-cols-2">
                                    <p v-if="bench.count">
                                        Avg. Score :
                                        {{ Math.floor(bench.avgScore) }}
                                    </p>
                                    <p v-if="bench.count">
                                        Avg. Accuracy :
                                        {{ Math.floor(bench.avgAcc) }}%
                                    </p>
                                </div>
                            </div>
                            <div
                                class="ml-auto mr-10 flex items-center gap-10 text-white"
                            >
                                <button
                                    class="flex items-center"
                                    :class="
                                        bench.count == 0
                                            ? 'disabled pointer-events-none text-slate-500'
                                            : ''
                                    "
                                    @click="replayLink(bench.id, bench.weapon)"
                                >
                                    <span v-if="replayLoading">Loading...</span>
                                    <span
                                        v-else
                                        class="transition hover:text-slate-400"
                                        >Watch Replay</span
                                    >
                                </button>
                                <button
                                    class="flex cursor-pointer items-center gap-1 transition hover:text-slate-400"
                                    @click="handlePlayScenario(bench.id)"
                                >
                                    <play-icon
                                        class="h-5 w-5 transition"
                                    ></play-icon
                                    >Play
                                </button>
                                <router-link
                                    class="transition hover:text-slate-400"
                                    :to="'/tasks/' + bench.id"
                                    >View Leaderboard</router-link
                                >
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Categories sidebar -->
                <!-- <div
          class="text-center origin-top-left absolute rotate-90"
          id="category-bar"
        >
          <div class="grid grid-cols-6 gap-1" id="category-item">
            <span
              class="bg-slate-700"
              v-for="item in subCategories"
              :key="item"
              >{{ item }}</span
            >
          </div>
          <div class="grid grid-cols-6 gap-0.5 min-w-full">
            <span
              id="subcategory-item"
              class="col-span-2 bg-slate-800"
              v-for="category in categories"
              :key="category"
              >{{ category }}</span
            >
          </div>
        </div> -->
            </section>
        </div>
    </div>
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
    replayDeepLink,
    taskDeepLink,
} from "../helpers/functions";
export default {
    data() {
        return {
            replayLoading: false,
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
        scoreReqGrid() {
            return `grid-cols-${this.rankList.length}`;
        },
    },
    methods: {
        getImagePath(rank, option) {
            let rankType = rank.replace(/ /g, "");
            if (!rank) return "";
            if (option == "badge") {
                return `../../rank-img/${rankType.toLowerCase()}_badge.png`;
            } else if (option == "medal") {
                return `../../rank-img/${rankType.toLowerCase()}.png`;
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
        collapseBenchDetails() {
            this.VTBenchmarks.forEach((element) => {
                element.detailsOpen = false;
            });
        },
        async handlePlayScenario(taskId) {
            const workshopId = await findWorkshopId(taskId);
            const taskLink = taskDeepLink(workshopId);
            window.open(taskLink, "_blank");
        },
        async replayLink(taskId, weapon) {
            this.replayLoading = true;
            let link = await findReplay(
                this.currentPlayerInfo.username,
                taskId,
                weapon
            );
            if (link) {
                window.open(link, "_blank");
            }
            this.replayLoading = false;
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
