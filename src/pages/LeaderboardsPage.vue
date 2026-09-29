<template>
  <main class="page-shell">
    <div class="page-intro">
      <p class="eyebrow">Community benchmarks</p>
      <h1 class="page-title">Leaderboards</h1>
      <p class="page-subtitle">Compare player results across Revosect and Voltaic.</p>
    </div>
    <nav class="tab-list leaderboard-tabs" aria-label="Benchmark source">
      <router-link class="tab-link" :to="{ name: 'ra-leaderboards' }">Revosect</router-link>
      <router-link class="tab-link" :to="{ name: 'vt-leaderboards' }">Voltaic</router-link>
    </nav>
    <router-view></router-view>
  </main>
</template>
<style scoped>
.leaderboard-tabs { margin-bottom: 14px; }
</style>
