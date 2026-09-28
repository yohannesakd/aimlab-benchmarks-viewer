<template>
  <div>
    <base-card class="mt-10 mx-auto max-w-md">
      <form
        @submit.prevent="null"
        class="flex flex-col gap-3 items-center py-2"
      >
        <input
          class="
            border-2
            block
            rounded
            py-1
            px-2
            w-3/4
            text-black
            outline-2 outline-blue-500
          "
          type="text"
          id="username"
          autocomplete="off"
          v-model.trim="usernameInput"
          @input="searchUser"
        />
        <label class="block" for="username"
          >Enter your Aimlab Username (<span class="italic">Case Sensitive</span
          >)</label
        >
      </form>
    </base-card>
    <base-card class="mx-auto mt-4 max-w-md" v-if="usernameInput">
      <p v-if="isLoading">Searching...</p>
      <p v-else-if="searchError">Search is unavailable. Try again.</p>
      <p v-else-if="!playerInfo.username">User not found</p>
      <div v-else class="flex justify-between">
        <div>
          <h2 class="text-slate-300">Profile Found</h2>
          <h2>
            <span class="text-slate-300">Username :</span>
            {{ playerInfo.username }}
          </h2>
          <p>
            <span class="text-slate-300">Rank :</span> {{ playerInfo.rank }}
          </p>
        </div>
        <router-link
          :to="playerProfileLink"
          class="
            self-center
            border-2 border-gray-500
            p-2
            rounded-md
            transition
            hover:bg-gray-800 hover:text-gray-200
          "
          >Go to Profile</router-link
        >
      </div>
    </base-card>
  </div>
</template>

<script>
import * as queries from "../helpers/queries.js";
import debounce from "lodash/debounce";
export default {
  data() {
    return {
      usernameInput: "",
      playerInfo: {},
      isLoading: false,
      searchError: false,
    };
  },
  computed: {
    playerProfileLink() {
      return this.$route.path + "/" + this.playerInfo.username;
    },
  },
  beforeUnmount() {
    this.searchUser.cancel();
  },
  methods: {
    searchUser: debounce(async function () {
      const username = this.usernameInput;
      this.playerInfo = {};
      this.searchError = false;
      if (!username) {
        this.isLoading = false;
        return;
      }
      this.isLoading = true;
      try {
        const data = await queries.APIFetch(queries.GET_USER_INFO, { username });
        if (username !== this.usernameInput) return;
        if (data.aimlabProfile) {
          this.playerInfo = {
            username: data.aimlabProfile.username,
            id: data.aimlabProfile.user.id,
            rank: data.aimlabProfile.ranking.rank.displayName,
            skill: data.aimlabProfile.ranking.skill,
          };
        }
        window.umami?.track("profile-search", {
          result: data.aimlabProfile ? "found" : "missing",
        });
      } catch (error) {
        if (username === this.usernameInput) {
          console.error(error);
          this.searchError = true;
          window.umami?.track("profile-search", { result: "error" });
        }
      } finally {
        if (username === this.usernameInput) this.isLoading = false;
      }
    }, 600),
  },
};
</script>
