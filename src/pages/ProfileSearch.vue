<template>
  <main class="page-shell">
    <div class="search-layout">
      <div class="page-intro">
        <p class="eyebrow">Player lookup</p>
        <h1 class="page-title">Find a profile</h1>
        <p class="page-subtitle">Search by Aimlab username to see tasks played and benchmark ranks.</p>
      </div>
      <div class="panel panel-body">
        <label class="field-label" for="username">Aimlab username · case sensitive</label>
        <input id="username" class="text-field" type="text" autocomplete="off" placeholder="Enter a username" v-model.trim="usernameInput" @input="searchUser" />
      </div>
      <div v-if="usernameInput" class="panel search-result">
        <p v-if="isLoading" class="status-panel">Searching…</p>
        <p v-else-if="searchError" class="status-panel" role="alert">Search is unavailable. Try again.</p>
        <p v-else-if="!playerInfo.username" class="status-panel">User not found.</p>
        <div v-else class="result-row">
          <div>
            <p class="eyebrow">Profile found</p>
            <h2 class="result-title">{{ playerInfo.username }}</h2>
            <p class="result-meta">Aimlab rank · {{ playerInfo.rank }}</p>
          </div>
          <router-link :to="playerProfileLink" class="btn-primary">View profile <span aria-hidden="true">→</span></router-link>
        </div>
      </div>
    </div>
  </main>
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
