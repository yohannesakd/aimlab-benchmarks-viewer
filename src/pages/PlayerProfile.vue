<template>
  <div class="px-32">
    <section class="py-8">
      <base-card v-if="isLoading" class="grid place-items-center">
        <loading-spinner></loading-spinner>
      </base-card>
      <base-card
        v-else
        class="
          bg-zinc-200
          text-gray-900
          max-w-max
          tracking-wide
          p-8
          flex
          gap-10
          max-w
        "
        size="lg"
      >
        <div class="flex flex-col gap-4">
          <span class="block text-2xl font-semibold">{{
            playerInfo.username
          }}</span>
          <span class="block"
            >{{ playerInfo.rank }} - {{ playerInfo.skill }}</span
          >
          <progress
            id="skill"
            max="100"
            class="bg-zinc-100"
            :value="playerSkill"
          ></progress>
        </div>
        <div class="flex flex-col text-lg">
          <span>Unique Tasks Played - {{ tasksPlayed }}</span>
          <span>Total Play Count - {{ totalPlays }}</span>
          <span>VT Rank</span>
          <span>rA Rank</span>
        </div>
      </base-card>
    </section>
    <div class="mx-auto" id="profile-nav">
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
          >
            {{ key }}
          </router-link>
        </li>
      </ul>
    </div>
    <router-view
      class="border border-slate-500 border-t-transparent"
    ></router-view>
  </div>
</template>

<script>
// import axios from "axios";
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
    playerSkill() {
      if (this.playerInfo.skill) {
        return this.playerInfo.skill % 100;
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
  //Fetching the Player ID and Username again
  // Assigning the fetched data to our component
  // Fetching player Task History using ID from the previous request
  async mounted() {
    this.playerInfo = {};
    this.isLoading = true;
    let aimlabProfile = await queries.APIFetch(queries.GET_USER_INFO, {
      username: this.username,
    });
    this.isLoading = false;
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
      this.$store.dispatch("updateCurrentUserInfo", this.playerInfo);
      this.$store.dispatch(
        "updateCurrentUserTasks",
        plays_agg.aimlab.plays_agg
      );
    }
  },
};
</script>

<style scoped>
#profile-nav .router-link-active {
  @apply bg-transparent border-b-transparent;
}
</style>