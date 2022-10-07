<template>
  <header
    class="
      flex
      justify-between
      items-center
      px-16
      py-6
      bg-slate-700
      shadow-lg
      text-white
    "
  >
    <h1 class="text-3xl font-semibold">
      <router-link to="/home" id="header-text"
        >Aimlab Benchmarks Viewer</router-link
      >
    </h1>
    <nav id="nav">
      <ul class="flex gap-4">
        <li v-for="link in navLinks" :key="link">
          <router-link
            class="
              border border-slate-600
              px-6
              py-3
              uppercase
              text-lg
              tracking-wide
              hover:bg-slate-500 hover:text-white
              transition
            "
            :class="
              $route.path.includes(link) ? 'router-link-exact-active' : ''
            "
            :to="'/' + link"
          >
            {{ link }}
          </router-link>
        </li>
      </ul>
    </nav>
  </header>
</template>

<script>
export default {
  data() {
    return {
      navLinks: ["home", "profile", "tasks"],
    };
  },
  computed: {},
};
</script>

<style scoped>
nav .router-link-active,
nav .router-link-exact-active {
  @apply bg-slate-500 text-white;
}
</style>