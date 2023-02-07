<template>
  <div class="px-[8%] relative">
    <section class="py-8 flex items-start justify-between">
      <base-card
        v-if="isLoading"
        class="grid place-items-center max-w-md py-5 px-10"
      >
        <loading-spinner></loading-spinner>
      </base-card>
      <base-card
        v-else
        class="
          bg-slate-700
          text-gray-900
          tracking-wide
          p-8
          flex flex-1
          gap-10
          max-w-xl
        "
      >
        <div class="flex flex-col gap-4 w-[40%]">
          <span class="block text-2xl font-semibold">{{
            currentPlayerInfo.username
          }}</span>
          <span class="block"
            >{{ currentPlayerInfo.rank }} -
            {{ Math.floor(currentPlayerInfo.skill) }}</span
          >

          <progress-bar
            class="w-40 h-5 bg-slate-200 rounded-sm"
            :value="playerSkill"
            :color="'bg-mainCyan'"
          ></progress-bar>
        </div>
        <div class="flex flex-col text-lg">
          <span>Unique Tasks Played - {{ tasksPlayed }}</span>
          <span>Total Play Count - {{ totalPlays }}</span>
          <span
            >VT Rank - {{ overallRankVT }}
            <img
              :src="`../../rank-img/${imagePath(overallRankVT)}_badge.png`"
              class="h-5 inline"
              alt=""
          /></span>
          <span
            >rA Rank - {{ overallRankRA }}
            <img
              :src="`../../rank-img/ra/${imagePath(overallRankRA)}.png`"
              class="h-5 inline"
              alt=""
          /></span>
        </div>
      </base-card>
      <button
        class="
          right-0
          border-2 border-slate-500
          px-6
          py-2
          rounded
          transition
          hover:bg-slate-500
        "
        @click="handleSwitchProfile"
      >
        Switch Profile
      </button>
    </section>

    <div class="relative z-10" id="profile-nav">
      <ul class="flex">
        <li v-for="(tab, key) in tabs" :key="tab">
          <router-link
            class="
              py-2
              px-4
              bg-slate-600
              inline-block
              border border-slate-600
              hover:bg-slate-500
            "
            :to="{ name: tab }"
            @click="displayRoute"
          >
            {{ key }}
          </router-link>
        </li>
      </ul>
    </div>
    <router-view
      :isLoading="isLoading"
      class="border border-slate-600 bg-slate-900 rounded-b-md mb-10"
    ></router-view>
  </div>
</template>

<script>
// import axios from "axios";
import { mapGetters } from "vuex";
import * as queries from "../helpers/queries.js";
export default {
  props: {
    username: String,
  },
  data() {
    return {
      playerInfo: {},
      isLoading: false,
      tabs: {
        Overview: "profile-overview",
        Voltaic: "vt-benches",
        Revosect: "ra-benches",
      },
    };
  },
  computed: {
    ...mapGetters([
      "VTAdvanced",
      "VTIntermediate",
      "VTNovice",
      "RAHard",
      "RAMedium",
      "RAEasy",
      "currentPlayerTasks",
      "currentPlayerInfo",
    ]),
    overallRankVT() {
      return this.VTAdvanced.overallRank != "Unranked"
        ? this.VTAdvanced.overallRank
        : this.VTIntermediate.overallRank != "Unranked"
        ? this.VTIntermediate.overallRank
        : this.VTNovice.overallRank;
    },
    overallRankRA() {
      return this.RAHard.overallRank != "Unranked"
        ? this.RAHard.overallRank
        : this.RAMedium.overallRank != "Unranked"
        ? this.RAMedium.overallRank
        : this.RAEasy.overallRank;
    },
    playerSkill() {
      if (this.currentPlayerInfo.skill) {
        if (this.currentPlayerInfo.skill == 1000) return 100;
        return this.currentPlayerInfo.skill % 100;
      } else {
        return 0;
      }
    },
    tasksPlayed() {
      return this.$store.getters.tasksPlayed;
    },
    totalPlays() {
      return this.$store.getters.totalPlays;
    },
  },
  watch: {
    currentPlayerTasks(newArr) {
      if (newArr.length) {
        this.isLoading = false;
      }
    },
  },
  methods: {
    imagePath(rank) {
      return rank.replace(/ /g, "").toLowerCase();
    },
    handleSwitchProfile() {
      sessionStorage.removeItem("currentPlayer");
      this.$router.push("/profile");
    },
    displayRoute() {
      // console.log(this.$route);
    },
  },
  //Fetching the Player ID and Username again
  // Assigning the fetched data to our component
  // Fetching player Task History using ID from the previous request

  async mounted() {
    if (this.username == this.$store.getters.currentPlayerInfo.username) return;

    this.playerInfo = {};
    this.isLoading = true;
    let aimlabProfile = await queries.APIFetch(queries.GET_USER_INFO, {
      username: this.username,
    });

    if (aimlabProfile != null) {
      this.playerInfo = {
        username: aimlabProfile.aimlabProfile.username,
        id: aimlabProfile.aimlabProfile.user.id,
        rank: aimlabProfile.aimlabProfile.ranking.rank.displayName,
        skill: aimlabProfile.aimlabProfile.ranking.skill,
      };
      let plays_agg = await queries.APIFetch(queries.GET_USER_PLAYS_AGG, {
        where: {
          is_practice: {
            _eq: false,
          },
          score: {
            _gt: 0,
          },
          user_id: {
            _eq: this.playerInfo.id,
          },
        },
      });
      if (!plays_agg?.aimlab) {
        this.$router.go();
      }
      sessionStorage.setItem("currentPlayer", this.playerInfo.username);
      this.$store.dispatch("updateCurrentPlayerInfo", this.playerInfo);
      this.$store.dispatch(
        "updateCurrentPlayerTasks",
        plays_agg.aimlab.plays_agg
      );
      this.$store.dispatch("setVTBenches");
      this.$store.dispatch("setRABenches");
    }
  },
};
</script>

<style scoped>
#profile-nav .router-link-active {
  @apply bg-slate-900 border-b-transparent;
}

#profile-nav {
  top: 1px;
}

ul li:first-of-type a {
  border-top-left-radius: 0.25rem;
}
ul li:last-of-type a {
  border-top-right-radius: 0.25rem;
}
</style>