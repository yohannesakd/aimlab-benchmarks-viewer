<template>
  <main class="page-shell">
    <div class="search-layout">
      <div class="page-intro">
        <h1 class="page-title">Find a profile</h1>
      </div>
      <div class="panel panel-body">
        <label class="field-label" for="username">Aimlab username · case sensitive</label>
        <input id="username" class="text-field" type="text" autocomplete="off" placeholder="Enter a username" v-model.trim="usernameInput" @input="debouncedSearch" />
      </div>
      <div v-if="usernameInput" class="panel search-result">
        <p v-if="isLoading" class="status-panel">Searching…</p>
        <p v-else-if="searchError" class="status-panel" role="alert">Search is unavailable. Try again.</p>
        <p v-else-if="!playerInfo.username" class="status-panel">User not found.</p>
        <div v-else class="result-row">
          <div>
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
import { fetchData } from "../helpers/api.js";
import debounce from "lodash/debounce";
export default {
  data() {
    return {
      usernameInput: "",
      playerInfo: {},
      isLoading: false,
      searchError: false,
      debouncedSearch: null,
    };
  },
  computed: {
    playerProfileLink() {
      return "/profile/" + encodeURIComponent(this.playerInfo.username);
    },
  },
  created() {
    this.debouncedSearch = debounce(() => this.searchUser(), 600);
  },
  beforeUnmount() {
    this.debouncedSearch.cancel();
  },
  methods: {
    async searchUser() {
      const username = this.usernameInput;
      this.playerInfo = {};
      this.searchError = false;
      if (!username) {
        this.isLoading = false;
        return;
      }
      this.isLoading = true;
      try {
        const data = await fetchData(`/api/profiles/${encodeURIComponent(username)}/lookup`);
        if (username !== this.usernameInput) return;
        this.playerInfo = data;
        window.umami?.track("profile-search", { result: "found" });
      } catch (error) {
        if (username === this.usernameInput) {
          console.error(error);
          this.searchError = error.status !== 404;
          window.umami?.track("profile-search", { result: "error" });
        }
      } finally {
        if (username === this.usernameInput) this.isLoading = false;
      }
    },
  },
};
</script>
