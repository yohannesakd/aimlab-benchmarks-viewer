<template>
  <div>
    <router-link
      :to="{ name: 'ra-leaderboards' }"
      class="
        border-2 border-slate-400
        px-6
        py-2
        rounded-sm
        transition
        hover:bg-slate-500
        inline-block
      "
      >Revosect</router-link
    >
    <router-link
      :to="{ name: 'vt-leaderboards' }"
      class="
        border-2 border-slate-400
        px-6
        py-2
        rounded-sm
        transition
        hover:bg-slate-500
        inline-block
      "
      >Voltaic</router-link
    >

    <router-view></router-view>
  </div>
</template>
<style scoped>
.router-link-active,
.router-link-exact-active {
  @apply bg-slate-500 text-white;
}
</style>