<template>
  <footer class="inset-x-0 bg-slate-700">
    <div class="px-[10%] py-4">
      <p class="text-center text-slate-300">
        Created By: <a href="">Yohannes A.</a> | {{ year }}
      </p>
    </div>
  </footer>
</template>

<script>
export default {
  computed: {
    year() {
      let date = new Date();
      return date.getFullYear();
    },
  },
};
</script>