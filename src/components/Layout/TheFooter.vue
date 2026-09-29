<template>
  <footer class="site-footer">
    <div class="site-footer-inner">
      <span>Saibot · {{ year }}</span>
      <router-link to="/about">About this project</router-link>
    </div>
  </footer>
</template>

<script>
export default {
  computed: {
    year() {
      return new Date().getFullYear();
    },
  },
};
</script>
<style scoped>
.site-footer { border-top: 1px solid var(--line); background: var(--header); color: var(--muted); font-size: .8rem; }
.site-footer-inner { width: min(100% - 48px, 1240px); min-height: 64px; margin: auto; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.site-footer a:hover { color: var(--accent); }
@media (max-width: 620px) { .site-footer-inner { width: min(100% - 32px, 1240px); } }
</style>
