<template>
  <main class="page-shell run-page">
    <router-link :to="`/profile/${encodeURIComponent(username)}/overview`" class="text-link">← {{ username }}'s profile</router-link>
    <div class="page-intro run-heading">
      <h1 class="page-title">Run history</h1>
      <router-link :to="`/tasks/${encodeURIComponent(taskId)}/leaderboard`" class="btn-secondary">
        Task leaderboard
      </router-link>
    </div>
    <div class="panel status-panel">Aimlabs no longer provides public run history.</div>
  </main>
</template>

<style scoped>
.run-page { max-width: 980px; }
.run-heading { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 18px; margin-top: 20px; }
</style>

<script>
export default {
  props: { username: String, taskId: String },
};
</script>
