<template>
  <the-header></the-header>
  <router-view></router-view>
</template>
<script>
import TheHeader from "./components/Layout/TheHeader.vue";

export default {
  components: {
    TheHeader,
  },
};
</script>
<style>
html {
  @apply bg-slate-800  text-white;
}
* {
  @apply font-poppins;
}
</style>