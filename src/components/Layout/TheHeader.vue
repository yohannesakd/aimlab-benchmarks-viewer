<template>
  <header class="site-header">
    <div class="site-header-inner">
      <router-link to="/home" class="site-brand" aria-label="Aimlab Tracker home">
        <img src="/aimlab-logo.svg" alt="" class="site-brand-icon" />
        <span>Aimlab <span class="brand-accent">Tracker</span></span>
      </router-link>
      <button type="button" class="menu-toggle" :aria-expanded="menuOpen" aria-controls="site-nav" aria-label="Toggle navigation" @click="menuOpen = !menuOpen">
        <span></span><span></span><span></span>
      </button>
      <nav id="site-nav" class="site-nav" :class="{ 'site-nav-open': menuOpen }" aria-label="Main navigation">
        <router-link v-for="link in navLinks" :key="link.label" :to="link.to" class="site-nav-link" :class="{ 'is-current': $route.path.startsWith(link.activePath || link.to) }">{{ link.label }}</router-link>
      </nav>
    </div>
  </header>
</template>

<script>
export default {
  data() {
    return {
      menuOpen: false,
      navLinks: [
        { label: "Home", to: "/home" },
        { label: "Profile", to: "/profile" },
        { label: "Tasks", to: "/tasks" },
        { label: "Benchmarks", to: "/benchmarks/voltaic", activePath: "/benchmarks" },
        { label: "Leaderboards", to: "/leaderboards" },
      ],
    };
  },
  watch: { $route() { this.menuOpen = false; } },
};
</script>

<style scoped>
.site-header { background: var(--header); border-bottom: 1px solid var(--line); }
.site-header-inner { width: min(100% - 48px, 1240px); min-height: 72px; margin: auto; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.site-brand { display: inline-flex; align-items: center; gap: 10px; white-space: nowrap; font-size: 1.3rem; font-weight: 600; letter-spacing: -.02em; }
.site-brand-icon { width: 28px; height: 28px; object-fit: contain; }
.brand-accent { color: var(--accent); }
.site-nav { display: flex; align-items: stretch; gap: 24px; align-self: stretch; }
.site-nav-link { display: inline-flex; align-items: center; border-bottom: 2px solid transparent; color: var(--muted); font-size: .86rem; font-weight: 500; transition: color .15s, border-color .15s; }
.site-nav-link:hover { color: var(--text); }
.site-nav-link.router-link-active, .site-nav-link.is-current { color: var(--text); border-bottom-color: var(--accent); font-weight: 600; }
.menu-toggle { display: none; width: 42px; height: 42px; align-items: center; justify-content: center; flex-direction: column; gap: 5px; border: 1px solid var(--line); border-radius: 2px; }
.menu-toggle span { display: block; width: 17px; height: 2px; background: var(--text); }
@media (max-width: 620px) {
  .site-header-inner { width: min(100% - 32px, 1240px); min-height: 64px; flex-wrap: wrap; }
  .site-brand { font-size: 1.08rem; }
  .site-brand-icon { width: 24px; height: 24px; }
  .menu-toggle { display: flex; }
  .site-nav { display: none; width: 100%; height: auto; flex-direction: column; gap: 0; padding-bottom: 12px; }
  .site-nav-open { display: flex; }
  .site-nav-link { min-height: 42px; border-bottom: 1px solid var(--line); }
  .site-nav-link.router-link-active, .site-nav-link.is-current { border-bottom-color: var(--accent); }
}
</style>
