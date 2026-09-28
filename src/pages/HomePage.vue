<template>
  <main class="page-shell home-page">
    <section class="home-hero">
      <p class="eyebrow">Aim training, in one place</p>
      <h1 class="page-title home-title">Track your aim.</h1>
      <p class="page-subtitle home-description">Find a player, explore the Revosect and Voltaic benchmarks, or check a task leaderboard.</p>
      <form class="home-search" @submit.prevent="openProfile">
        <label class="sr-only" for="home-username">Search Aimlab username</label>
        <input id="home-username" class="text-field" v-model.trim="username" type="text" autocomplete="off" placeholder="Search Aimlab username" />
        <button class="btn-primary" type="submit">View profile <span aria-hidden="true">↗</span></button>
      </form>
    </section>

    <section class="home-benchmarks" aria-label="Benchmark sets">
      <article class="panel benchmark-card">
        <div class="benchmark-card-top"><span class="eyebrow">01 / Benchmark set</span><span class="benchmark-mark">rA</span></div>
        <h2 class="section-title">Revosect</h2>
        <p class="muted">Compare clicking, tracking, and switching across three existing benchmark levels.</p>
        <div class="level-list"><span>Easy</span><span>Medium</span><span>Hard</span></div>
        <router-link class="text-link" to="/leaderboards/ra">View leaderboards <span aria-hidden="true">→</span></router-link>
      </article>
      <article class="panel benchmark-card">
        <div class="benchmark-card-top"><span class="eyebrow">02 / Benchmark set</span><span class="benchmark-mark">VT</span></div>
        <h2 class="section-title">Voltaic</h2>
        <p class="muted">Browse player energy and ranks from Novice through Advanced.</p>
        <div class="level-list"><span>Novice</span><span>Intermediate</span><span>Advanced</span></div>
        <router-link class="text-link" to="/leaderboards/vt">View leaderboards <span aria-hidden="true">→</span></router-link>
      </article>
    </section>

    <section class="home-bottom">
      <div class="panel home-action">
        <span class="eyebrow">Find a scenario</span>
        <h2 class="section-title">Task search</h2>
        <p class="muted">Look up a task to see its scores, leaderboard, and play link.</p>
        <router-link class="btn-secondary" to="/tasks">Find a task <span aria-hidden="true">→</span></router-link>
      </div>
      <div class="panel home-action">
        <span class="eyebrow">Follow a player</span>
        <h2 class="section-title">Profile overview</h2>
        <p class="muted">See personal bests, play counts, and rank icons for both benchmark sets.</p>
        <router-link class="btn-secondary" to="/profile">Search profiles <span aria-hidden="true">→</span></router-link>
      </div>
    </section>
  </main>
</template>

<script>
export default {
  data() { return { username: "" }; },
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
.home-title { margin-top: 14px; font-size: clamp(2.8rem, 6vw, 4.5rem); }
.home-description { max-width: 630px; font-size: 1rem; }
.home-search { display: flex; gap: 10px; margin-top: 27px; max-width: 930px; }
.home-search .text-field { flex: 1; min-width: 0; min-height: 54px; }
.home-search .btn-primary { min-width: 160px; }
.home-benchmarks, .home-bottom { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.benchmark-card { min-height: 270px; padding: 25px; }
.benchmark-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; }
.benchmark-mark { display: inline-flex; width: 34px; height: 34px; align-items: center; justify-content: center; border: 1px solid var(--line); color: var(--accent); font-family: Oswald, sans-serif; font-size: 1.05rem; }
.benchmark-card .muted { max-width: 440px; margin: 8px 0 20px; font-size: .85rem; line-height: 1.6; }
.level-list { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 20px; }
.level-list span { min-width: 78px; padding: 6px 11px; border: 1px solid var(--line); color: var(--muted); font-size: .8rem; text-align: center; }
.home-bottom { margin-top: 14px; }
.home-action { display: flex; flex-direction: column; align-items: flex-start; gap: 7px; padding: 25px; }
.home-action .muted { min-height: 42px; font-size: .85rem; line-height: 1.6; }
.home-action .btn-secondary { margin-top: 10px; }
@media (max-width: 760px) { .home-benchmarks, .home-bottom { grid-template-columns: 1fr; } }
@media (max-width: 620px) { .home-page { padding-top: 36px; } .home-search { flex-direction: column; } .home-search .btn-primary { width: 100%; } .benchmark-card { min-height: auto; } }
</style>
