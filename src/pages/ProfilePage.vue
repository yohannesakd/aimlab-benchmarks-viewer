<template>
  <base-card class="mt-10">
    <form class="flex flex-col gap-2 items-center">
      <input
        class="border-2 block rounded py-1 px-2 w-3/4"
        type="text"
        id="username"
        autocomplete="off"
        v-model="usernameInput"
      />
      <label class="block" for="username"
        >Enter your Aimlab Username (<span class="italic">Case Sensitive</span
        >)</label
      >
    </form>
    <button
      @click="searchUser"
      class="border border-gray-400 p-2"
      type="button"
    >
      Search
    </button>
  </base-card>
  <base-card>
    <p v-if="isLoading">Searching...</p>
    <p v-else-if="!playerInfo">User not found</p>
    <div class="flex justify-between" v-else>
      <div>
        <h2>{{ playerInfo.username }}</h2>
        <p>{{ playerInfo.rank }}</p>
      </div>
      <a
        class="
          self-center
          border-2 border-gray-500
          p-2
          rounded-md
          transition
          hover:bg-gray-800 hover:text-gray-200
        "
        >Go to Profile</a
      >
    </div>
  </base-card>
</template>

<script>
import * as queries from "../helpers/queries.js";
import axios from "axios";
export default {
  data() {
    return {
      usernameInput: "",
      playerInfo: {},
      isLoading: false,
    };
  },
  computed: {
    playerProfileLink() {
      return this.$route.path + "/" + this.usernameInput;
    },
  },
  methods: {
    async searchUser() {
      this.playerInfo = {};
      try {
        this.isLoading = true;
        let aimlabProfile = await axios({
          url: queries.API_ENDPOINT,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          data: {
            query: queries.GET_USER_INFO,
            variables: {
              username: this.usernameInput,
            },
          },
        });
        this.isLoading = false;
        this.playerInfo = aimlabProfile.data.data.aimlabProfile;
        console.log(this.playerInfo);
      } catch (error) {
        console.log(error);
      }
    },
  },
};
</script>