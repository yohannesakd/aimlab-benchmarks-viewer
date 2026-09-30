<template>
  <div class="flex flex-col min-h-screen">
    <the-header class="shrink-0"></the-header>
    <router-view class="flex-1"></router-view>
    <run-details-modal />
    <the-footer class="shrink-0"></the-footer>
  </div>
</template>
<script>
import RunDetailsModal from "./components/RunDetailsModal.vue";
import TheHeader from "./components/Layout/TheHeader.vue";
import TheFooter from "./components/Layout/TheFooter.vue";
export default {
  components: {
    RunDetailsModal,
    TheHeader,
    TheFooter,
  },
};
</script>
