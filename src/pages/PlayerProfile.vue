<template>
  <main class="page-shell">
    <div class="page-intro profile-heading">
      <div>
        <h1 class="page-title">Player profile</h1>
      </div>
      <div class="profile-heading-actions">
        <button v-if="!isLoading && !loadError" type="button" class="btn-secondary" @click="toggleSavedProfile">{{ savedProfile === currentPlayerInfo.username ? 'Remove saved profile' : 'Save profile' }}</button>
        <button type="button" class="btn-secondary" @click="handleSwitchProfile">Switch profile</button>
      </div>
    </div>

    <p v-if="saveError" class="muted season-note" role="status">{{ saveError }}</p>
    <div v-if="isLoading" class="panel status-panel"><loading-spinner></loading-spinner></div>
    <div v-if="loadError" class="panel status-panel" role="alert">{{ loadError }} <button class="text-link" @click="loadPlayer(username)">Try again</button></div>
    <template v-if="!isLoading && currentPlayerInfo.username === username">
      <section class="panel profile-summary" aria-label="Player statistics">
        <div class="profile-identity">
          <img v-if="publicDetails?.imageUrl && failedAvatar !== avatarUrl" :key="avatarUrl" class="profile-avatar" :src="avatarUrl" width="44" height="44" decoding="async" alt="" @error="failedAvatar = $event.target.getAttribute('src')" />
          <div class="profile-name">
            <strong class="profile-username">{{ currentPlayerInfo.username }}</strong>
            <span class="muted profile-aimlab">Aimlab {{ currentPlayerInfo.rank }} · {{ Math.floor(currentPlayerInfo.skill || 0) }} skill</span>
          </div>
        </div>
        <dl class="profile-stats">
          <div><dt>Tasks played</dt><dd>{{ Number(tasksPlayed).toLocaleString('en-US') }}</dd></div>
          <div><dt>Total plays</dt><dd>{{ Number(totalPlays).toLocaleString('en-US') }}</dd></div>
          <template v-if="publicDetails">
            <div><dt>Account age</dt><dd>{{ daysLabel(publicDetails.accountAgeDays) }}</dd></div>
            <div><dt>Current streak</dt><dd>{{ daysLabel(publicDetails.currentStreakDays) }}</dd></div>
            <div><dt>Best streak</dt><dd>{{ daysLabel(publicDetails.bestDailyStreakDays) }}</dd></div>
            <div><dt>Latest streak</dt><dd>{{ daysLabel(publicDetails.latestDailyStreak?.days) }}<small v-if="publicDetails.latestDailyStreak?.endedOn" class="result-meta">Ended {{ publicDetails.latestDailyStreak.endedOn }}</small></dd></div>
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
.profile-heading-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.profile-summary { display: grid; grid-template-columns: minmax(230px, 1.8fr) minmax(0, 6fr); margin-bottom: 18px; }
.profile-identity { display: flex; align-items: center; gap: 12px; min-width: 0; padding: 16px 18px; border-right: 1px solid var(--line); }
.profile-avatar { flex: 0 0 44px; width: 44px; height: 44px; border: 1px solid var(--line); border-radius: 2px; object-fit: cover; }
.profile-name { min-width: 0; }
.profile-username { display: block; font-size: 1.1rem; font-weight: 600; overflow-wrap: anywhere; }
.profile-aimlab { display: block; margin-top: 3px; font-size: .75rem; }
.profile-stats { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); margin: 0; }
.profile-stats > div { min-width: 0; padding: 17px 12px; border-right: 1px solid var(--line); }
.profile-stats > div:last-child { border-right: 0; }
.profile-stats dt { color: var(--muted); font-size: .73rem; }
.profile-stats dd { margin: 6px 0 0; font-size: .94rem; font-weight: 600; line-height: 1.3; }
.profile-stats small { display: block; margin-top: 3px; font-size: .68rem; font-weight: 400; }
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
import { savedProfile, saveProfile } from '../helpers/savedProfile.js';
import { mapState, mapActions } from 'pinia';
import { usePlayerStore } from '../store/player.js';
import { fetchData } from "../helpers/api.js";
import { takeInitialResponse } from '../helpers/initialData.js';
export default {
  props: {
    username: String,
  },
  data() {
    return {
      saveError: "",
      isLoading: false,
      loadError: "",
      requestVersion: 0,
      profileController: null,
      detailsController: null,
      publicDetails: null,
      failedAvatar: null,
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
    avatarUrl() { return `/api/profiles/${encodeURIComponent(this.username)}/avatar`; },
    savedProfile() { return savedProfile.value; },
    ...mapState(usePlayerStore, ['currentPlayerInfo', 'tasksPlayed', 'totalPlays', 'profileFetchedAt']),
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
    this.profileController?.abort();
    this.detailsController?.abort();
  },
  methods: {
    ...mapActions(usePlayerStore, ['setProfileSnapshot']),
    toggleSavedProfile() {
      const username = savedProfile.value === this.currentPlayerInfo.username ? '' : this.currentPlayerInfo.username;
      this.saveError = saveProfile(username) ? '' : 'This browser could not save the profile. Check its storage settings.';
    },
    daysLabel(value) {
      return Number.isFinite(value) ? `${value.toLocaleString('en-US')} ${value === 1 ? "day" : "days"}` : "Unavailable";
    },
    async loadPublicDetails(username) {
      const initial = takeInitialResponse(this, `/api/profiles/${encodeURIComponent(username)}/details`);
      if (initial) { this.publicDetails = initial.status === 200 ? initial.body : null; return; }
      if (import.meta.env.SSR) return;
      const version = ++this.detailsVersion;
      this.detailsController?.abort();
      this.detailsController = new AbortController();
      this.publicDetails = null;
      this.detailsError = "";
      try {
        const details = await fetchData(`/api/profiles/${encodeURIComponent(username)}/details`, { signal: this.detailsController.signal });
        if (version === this.detailsVersion) this.publicDetails = details;
      } catch (error) {
        if (version === this.detailsVersion) this.detailsError = error.message;
      }
    },
    handleSwitchProfile() {
      this.$router.push("/profile");
    },
    async loadPlayer(username) {
      const initial = takeInitialResponse(this, `/api/profiles/${encodeURIComponent(username)}`);
      if (initial) return;
      if (import.meta.env.SSR) return;
      const version = ++this.requestVersion;
      this.profileController?.abort();
      this.profileController = new AbortController();
      this.isLoading = username !== this.currentPlayerInfo.username;
      this.loadError = "";

      try {
        const data = await fetchData(`/api/profiles/${encodeURIComponent(username)}`, { signal: this.profileController.signal });
        if (version !== this.requestVersion) return;
        this.$setSeoStatus(200);
        this.setProfileSnapshot({ ...data, fetchedAt: data.fetchedAt || new Date().toISOString() });
      } catch (error) {
        if (version === this.requestVersion) {
          this.$setSeoStatus(error.status || 503);
          this.loadError = username === this.currentPlayerInfo.username
            ? `Could not refresh. Showing the profile fetched at ${new Date(this.profileFetchedAt).toLocaleString('en-US')}.`
            : "Could not load this profile.";
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
