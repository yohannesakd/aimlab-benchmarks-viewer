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
export default {
  data() {
    return {
      usernameInput: "",
      playerInfo: {},
      isLoading: false,
      searchError: false,
      searchTimer: null,
      requestVersion: 0,
    };
  },
  computed: {
    playerProfileLink() {
      return "/profile/" + encodeURIComponent(this.playerInfo.username);
    },
  },
  beforeUnmount() {
    clearTimeout(this.searchTimer);
    this.requestVersion++;
  },
  methods: {
    debouncedSearch() {
      clearTimeout(this.searchTimer);
      this.requestVersion++;
      this.searchTimer = setTimeout(() => this.searchUser(), 600);
    },
    async searchUser() {
      const username = this.usernameInput;
      const version = ++this.requestVersion;
      this.playerInfo = {};
      this.searchError = false;
      if (!username) {
        this.isLoading = false;
        return;
      }
      this.isLoading = true;
      try {
        const data = await fetchData(`/api/profiles/${encodeURIComponent(username)}/lookup`);
        if (version !== this.requestVersion) return;
        this.playerInfo = data;
        window.umami?.track("profile-search", { result: "found" });
      } catch (error) {
        if (version === this.requestVersion) {
          console.error(error);
          this.searchError = error.status !== 404;
          window.umami?.track("profile-search", { result: "error" });
        }
      } finally {
        if (version === this.requestVersion) this.isLoading = false;
      }
    },
  },
};
</script>
