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
      <div class="profile-summary">
        <div class="panel profile-stat">
          <div class="profile-identity">
            <img v-if="publicDetails?.imageUrl" class="profile-avatar" :src="publicDetails.imageUrl" alt="" />
            <dl>
              <dt>Username</dt>
              <dd class="profile-username">{{ currentPlayerInfo.username }}</dd>
            </dl>
          </div>
          <p class="muted profile-aimlab">Aimlab {{ currentPlayerInfo.rank }} · {{ Math.floor(currentPlayerInfo.skill || 0) }} skill</p>
          <progress-bar class="profile-progress" :value="playerSkill" color="bg-mainCyan"></progress-bar>
        </div>
        <div class="panel profile-stat"><dl><dt>Tasks played</dt><dd>{{ Number(tasksPlayed).toLocaleString() }}</dd></dl></div>
        <div class="panel profile-stat"><dl><dt>Total plays</dt><dd>{{ Number(totalPlays).toLocaleString() }}</dd></dl></div>
        <div class="panel profile-stat rank-summary">
          <div><span class="muted">Revosect</span><span><img :src="'/rank-img/ra/' + imagePath(overallRankRA) + '.png'" alt="" />{{ overallRankRA }}</span></div>
          <div><span class="muted">Voltaic</span><span><img :src="'/rank-img/' + imagePath(overallRankVT) + '_badge.png'" alt="" />{{ overallRankVT }}</span></div>
        </div>
      </div>
      <section v-if="publicDetails" class="panel profile-discovery">
        <div class="panel-header"><div><h2 class="section-title">Aimlabs activity</h2><p class="result-meta">Public profile details reported by Aimlabs.</p></div></div>
        <div class="profile-discovery-grid">
          <div><span class="result-meta">Account age</span><strong>{{ daysLabel(publicDetails.accountAgeDays) }}</strong></div>
          <div><span class="result-meta">Current daily streak</span><strong>{{ daysLabel(publicDetails.currentStreakDays) }}</strong></div>
          <div><span class="result-meta">Best daily streak</span><strong>{{ daysLabel(publicDetails.bestDailyStreakDays) }}</strong></div>
          <div><span class="result-meta">Latest daily streak</span><strong>{{ daysLabel(publicDetails.latestDailyStreak?.days) }}</strong><small v-if="publicDetails.latestDailyStreak?.endedOn" class="result-meta">Ended {{ publicDetails.latestDailyStreak.endedOn }}</small></div>
        </div>
        <div v-if="publicDetails.dailyPick" class="profile-daily-pick">
          <span class="result-meta">Aimlabs daily pick</span>
          <router-link class="text-link" :to="`/tasks/${encodeURIComponent(publicDetails.dailyPick.taskId)}/leaderboard`">{{ publicDetails.dailyPick.name }} →</router-link>
        </div>
      </section>
      <div v-else-if="detailsError" class="panel status-panel profile-details-error" role="status">Additional Aimlabs details are unavailable right now.</div>
      <nav class="tab-list" aria-label="Profile sections">
        <router-link v-for="(tab, key) in tabs" :key="tab" class="tab-link" :to="{ name: tab }">{{ key }}</router-link>
      </nav>
      <router-view class="profile-content panel" :isLoading="isLoading"></router-view>
    </template>
  </main>
</template>
<style scoped>
.profile-heading { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
.profile-identity { display: flex; align-items: center; gap: 12px; }
.profile-avatar { width: 42px; height: 42px; border: 1px solid var(--line); border-radius: 2px; object-fit: cover; }
.profile-username { overflow-wrap: anywhere; }
.profile-aimlab { margin-top: 7px; font-size: .82rem; }
.profile-progress { max-width: 260px; height: 6px; margin-top: 14px; background: var(--raised); }
.rank-summary { display: flex; flex-direction: column; justify-content: space-between; gap: 12px; }
.rank-summary > div { display: flex; flex-direction: column; gap: 3px; font-size: .78rem; }
.rank-summary > div > span:last-child { display: flex; align-items: center; gap: 7px; font-size: .88rem; font-weight: 600; }
.rank-summary img { width: 22px; height: 22px; object-fit: contain; }
.profile-discovery { margin-bottom: 18px; }
.profile-discovery-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; padding: 16px 20px; }
.profile-discovery-grid > div { min-width: 0; padding: 12px; border: 1px solid var(--line); background: var(--raised); }
.profile-discovery-grid strong { display: block; margin-top: 5px; font-size: .92rem; }
.profile-discovery-grid small { display: block; margin-top: 3px; }
.profile-daily-pick { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; padding: 0 20px 18px; }
.profile-details-error { margin-bottom: 18px; }
@media (max-width: 800px) { .profile-discovery-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 620px) { .profile-heading { align-items: start; flex-direction: column; } }
</style>

<script>
import { mapGetters } from "vuex";
import * as queries from "../helpers/queries.js";
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
    imagePath(rank) {
      return rank.replace(/ /g, "").toLowerCase();
    },
    handleSwitchProfile() {
      sessionStorage.removeItem("currentPlayer");
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
        const data = await queries.APIFetch(queries.GET_USER_INFO, { username });
        if (!data.aimlabProfile) {
          if (version === this.requestVersion) this.loadError = "Profile not found";
          return;
        }
        const profile = data.aimlabProfile;
        const playerInfo = {
          username: profile.username,
          id: profile.user.id,
          rank: profile.ranking.rank.displayName,
          skill: profile.ranking.skill,
        };
        const plays = await queries.APIFetch(queries.GET_USER_PLAYS_AGG, {
          where: {
            is_practice: { _eq: false },
            score: { _gt: 0 },
            user_id: { _eq: playerInfo.id },
          },
        });
        if (!plays.aimlab?.plays_agg) throw new Error("Missing player history");
        if (version !== this.requestVersion) return;

        this.$store.dispatch("updateCurrentPlayerInfo", playerInfo);
        this.$store.dispatch("updateCurrentPlayerTasks", plays.aimlab.plays_agg);
        this.$store.dispatch("setVTBenches");
        this.$store.dispatch("setRABenches");
        sessionStorage.setItem("currentPlayer", playerInfo.username);
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
