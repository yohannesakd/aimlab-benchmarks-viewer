<template>
  <the-header></the-header>
  <router-view></router-view>
  <the-footer></the-footer>
</template>
<script>
import TheHeader from "./components/Layout/TheHeader.vue";
import TheFooter from "./components/Layout/TheFooter.vue";

export default {
  components: {
    TheHeader,
    TheFooter,
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