<template>
  <div class="flex flex-col min-h-screen">
    <the-header class="shrink-0"></the-header>
    <router-view class="flex-1"></router-view>
    <the-footer class="shrink-0"></the-footer>
  </div>
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