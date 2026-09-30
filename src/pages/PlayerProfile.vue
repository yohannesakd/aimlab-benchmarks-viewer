<template>
  <main class="page-shell">
    <div class="page-intro profile-heading">
      <div>
        <p class="eyebrow">Player overview</p>
        <h1 class="page-title">Player profile</h1>
      </div>
      <button type="button" class="btn-secondary" @click="handleSwitchProfile">Switch profile</button>
    </div>

    <div v-if="isLoading" class="panel status-panel"><loading-spinner></loading-spinner></div>
    <div v-else-if="loadError" class="panel status-panel" role="alert">{{ loadError }}</div>
    <template v-else>
      <section class="panel profile-summary" aria-label="Player statistics">
        <div class="profile-identity">
          <img v-if="publicDetails?.imageUrl" class="profile-avatar" :src="publicDetails.imageUrl" alt="" />
          <div class="profile-name">
            <span class="result-meta">Username</span>
            <strong class="profile-username">{{ currentPlayerInfo.username }}</strong>
            <span class="muted profile-aimlab">Aimlab {{ currentPlayerInfo.rank }} · {{ Math.floor(currentPlayerInfo.skill || 0) }} skill</span>
            <progress-bar class="profile-progress" :value="playerSkill" color="bg-mainCyan"></progress-bar>
          </div>
        </div>
        <dl class="profile-stats">
          <div><dt>Tasks played</dt><dd>{{ Number(tasksPlayed).toLocaleString() }}</dd></div>
          <div><dt>Total plays</dt><dd>{{ Number(totalPlays).toLocaleString() }}</dd></div>
          <template v-if="publicDetails">
            <div><dt>Account age</dt><dd>{{ daysLabel(publicDetails.accountAgeDays) }}</dd></div>
            <div><dt>Current streak</dt><dd>{{ daysLabel(publicDetails.currentStreakDays) }}</dd></div>
            <div><dt>Best streak</dt><dd>{{ daysLabel(publicDetails.bestDailyStreakDays) }}</dd></div>
            <div><dt>Latest streak</dt><dd>{{ daysLabel(publicDetails.latestDailyStreak?.days) }}</dd><small v-if="publicDetails.latestDailyStreak?.endedOn" class="result-meta">Ended {{ publicDetails.latestDailyStreak.endedOn }}</small></div>
          </template>
        </dl>
      </section>
      <p v-if="detailsError" class="result-meta profile-details-error" role="status">Aimlabs activity is unavailable right now.</p>
      <nav class="tab-list" aria-label="Profile sections">
        <router-link v-for="(tab, key) in tabs" :key="tab" class="tab-link" :to="{ name: tab }">{{ key }}</router-link>
      </nav>
      <router-view class="profile-content panel" :isLoading="isLoading"></router-view>
    </template>
  </main>
</template>
<style scoped>
.profile-heading { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
.profile-summary { display: grid; grid-template-columns: minmax(230px, 1.8fr) minmax(0, 6fr); margin-bottom: 18px; }
.profile-identity { display: flex; align-items: center; gap: 12px; min-width: 0; padding: 16px 18px; border-right: 1px solid var(--line); }
.profile-avatar { flex: 0 0 44px; width: 44px; height: 44px; border: 1px solid var(--line); border-radius: 2px; object-fit: cover; }
.profile-name { min-width: 0; }
.profile-username { display: block; font-size: 1.1rem; font-weight: 600; overflow-wrap: anywhere; }
.profile-aimlab { display: block; margin-top: 3px; font-size: .75rem; }
.profile-progress { max-width: 210px; height: 4px; margin-top: 9px; background: var(--raised); }
.profile-stats { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); margin: 0; }
.profile-stats > div { min-width: 0; padding: 17px 12px; border-right: 1px solid var(--line); }
.profile-stats > div:last-child { border-right: 0; }
.profile-stats dt { color: var(--muted); font-size: .73rem; }
.profile-stats dd { margin: 6px 0 0; font-size: .94rem; font-weight: 600; line-height: 1.3; }
.profile-stats small { display: block; margin-top: 3px; font-size: .68rem; }
.profile-details-error { margin: -6px 0 16px; }
@media (max-width: 1050px) {
  .profile-summary { grid-template-columns: 1fr; }
  .profile-identity { border-right: 0; border-bottom: 1px solid var(--line); }
}
@media (max-width: 800px) { .profile-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); } .profile-stats > div:nth-child(-n+3) { border-bottom: 1px solid var(--line); } }
@media (max-width: 620px) { .profile-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } .profile-stats > div { padding: 12px 14px; border-bottom: 1px solid var(--line); } .profile-stats > div:nth-last-child(-n+2) { border-bottom: 0; } }
@media (max-width: 620px) { .profile-heading { align-items: start; flex-direction: column; } }
</style>

<script>
import { mapGetters } from "vuex";
import { fetchData } from "../helpers/api.js";
export default {
  props: {
    username: String,
  },
  data() {
    return {
      isLoading: false,
      loadError: "",
      requestVersion: 0,
      publicDetails: null,
      detailsError: "",
      detailsVersion: 0,
      tabs: {
        Overview: "profile-overview",
        Activity: "profile-activity",
        Voltaic: "vt-benches",
        Revosect: "ra-benches",
      },
    };
  },
  computed: {
    ...mapGetters([
      "currentPlayerInfo",
    ]),
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
    username: { immediate: true, handler(username) {
      this.loadPlayer(username);
      this.loadPublicDetails(username);
    } },
  },
  beforeUnmount() {
    this.requestVersion++;
    this.detailsVersion++;
  },
  methods: {
    daysLabel(value) {
      return Number.isFinite(value) ? `${value.toLocaleString()} ${value === 1 ? "day" : "days"}` : "Unavailable";
    },
    async loadPublicDetails(username) {
      const version = ++this.detailsVersion;
      this.publicDetails = null;
      this.detailsError = "";
      try {
        const response = await fetch(`/api/profiles/${encodeURIComponent(username)}/details`);
        const details = await response.json().catch(() => null);
        if (!response.ok || !details) throw new Error("Additional Aimlabs details unavailable");
        if (version === this.detailsVersion) this.publicDetails = details;
      } catch (error) {
        if (version === this.detailsVersion) this.detailsError = error.message;
      }
    },
    handleSwitchProfile() {
      this.$router.push("/profile");
    },
    async loadPlayer(username) {
      const version = ++this.requestVersion;
      if (username === this.currentPlayerInfo.username) {
        this.isLoading = false;
        this.loadError = "";
        return;
      }
      this.isLoading = true;
      this.loadError = "";

      try {
        const data = await fetchData(`/api/profiles/${encodeURIComponent(username)}`);
        if (version !== this.requestVersion) return;
        const playerInfo = data.playerInfo;
        this.$store.dispatch("updateCurrentPlayerInfo", playerInfo);
        this.$store.dispatch("updateCurrentPlayerTasks", data.tasks);
        this.$store.dispatch("updateTotals", data.totals);
        this.$store.dispatch("setPlayerBenchmarks", data.benchmarkSets);
      } catch (error) {
        if (version === this.requestVersion) {
          console.error(error);
          this.loadError = "Could not load this profile. Try again.";
        }
      } finally {
        if (version === this.requestVersion) this.isLoading = false;
      }
    },
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
