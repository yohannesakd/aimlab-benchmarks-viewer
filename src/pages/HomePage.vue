<template>
  <main class="page-shell home-page">
    <section class="home-hero">
      <h1 class="page-title home-title">Track your aim.</h1>
      <form class="home-search" @submit.prevent="openProfile">
        <label class="sr-only" for="home-username">Search Aimlab username</label>
        <input id="home-username" class="text-field" v-model.trim="username" type="text" autocomplete="off" placeholder="Search Aimlab username" />
        <button class="btn-primary" type="submit">View profile <span aria-hidden="true">↗</span></button>
      </form>
    </section>

    <section class="home-benchmarks" aria-label="Benchmark sets">
      <article class="panel benchmark-card">
        <div class="benchmark-card-top"><h2 class="section-title">Revosect</h2><span class="benchmark-mark">rA</span></div>
        <div class="level-list"><router-link v-for="level in ['Easy', 'Medium', 'Hard']" :key="level" :to="{ path: '/benchmarks/revosect', query: { level: level.toLowerCase() } }">{{ level }}</router-link></div>
        <router-link class="text-link" to="/leaderboards/ra">Archived leaderboards <span aria-hidden="true">→</span></router-link>
      </article>
      <article class="panel benchmark-card">
        <div class="benchmark-card-top"><h2 class="section-title">Voltaic</h2><span class="benchmark-mark">VT</span></div>
        <div class="level-list"><router-link v-for="level in ['Novice', 'Intermediate', 'Advanced']" :key="level" :to="{ path: '/benchmarks/voltaic', query: { level: level.toLowerCase() } }">{{ level }}</router-link></div>
        <router-link class="text-link" to="/leaderboards/vt">Archived leaderboards <span aria-hidden="true">→</span></router-link>
      </article>
    </section>

    <section class="home-bottom">
      <div class="panel home-action">
        <h2 class="section-title">Task search</h2>
        <router-link class="btn-secondary" to="/tasks">Find a task <span aria-hidden="true">→</span></router-link>
      </div>
      <div class="panel home-action">
        <h2 class="section-title">{{ savedProfile ? savedProfile : 'Profile overview' }}</h2>
        <router-link class="btn-secondary" :to="savedProfile ? '/profile/' + encodeURIComponent(savedProfile) : '/profile'">{{ savedProfile ? 'Open saved profile' : 'Search profiles' }} <span aria-hidden="true">→</span></router-link>
      </div>
    </section>
  </main>
</template>

<script>
import { savedProfile } from '../helpers/savedProfile.js';
export default {
  data() { return { username: "" }; },
  computed: { savedProfile() { return savedProfile.value; } },
  methods: {
    openProfile() {
      if (this.username) this.$router.push(`/profile/${encodeURIComponent(this.username)}`);
    },
  },
};
</script>

<style scoped>
.home-page { padding-top: 64px; }
.home-hero { max-width: 1050px; margin-bottom: 30px; }
.home-title { font-size: clamp(2.4rem, 5vw, 3.6rem); }
.home-search { display: flex; gap: 10px; margin-top: 27px; max-width: 930px; }
.home-search .text-field { flex: 1; min-width: 0; min-height: 54px; }
.home-search .btn-primary { min-width: 160px; }
.level-list a:hover, .level-list a:focus-visible { border-color: var(--accent); color: var(--accent); }
.home-benchmarks, .home-bottom { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.benchmark-card { padding: 22px; }
.benchmark-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; }
.benchmark-mark { display: inline-flex; width: 34px; height: 34px; align-items: center; justify-content: center; border: 1px solid var(--line); color: var(--accent); font-size: .9rem; font-weight: 500; }
.level-list { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 20px; }
.level-list a { min-width: 78px; padding: 6px 11px; border: 1px solid var(--line); color: var(--muted); font-size: .8rem; text-align: center; }
.home-bottom { margin-top: 14px; }
.home-action { display: flex; flex-direction: column; align-items: flex-start; gap: 7px; padding: 25px; }
.home-action .btn-secondary { margin-top: 10px; }
@media (max-width: 760px) { .home-benchmarks, .home-bottom { grid-template-columns: 1fr; } }
@media (max-width: 620px) { .home-page { padding-top: 36px; } .home-search { flex-direction: column; } .home-search .btn-primary { width: 100%; } }
</style>
