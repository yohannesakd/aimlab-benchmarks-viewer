<template>
  <header
    class="flex justify-between items-center px-16 py-6 bg-gray-100 shadow-lg"
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
              px-6
              py-3
              font-semibold
              border border-gray-400
              uppercase
              text-lg
              hover:bg-gray-500 hover:text-white
              transition
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
nav .router-link-active {
  @apply bg-gray-500 text-white;
}
</style>