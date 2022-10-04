import { createStore } from "vuex";
import PlayerData from "./modules/PlayerData";

const store = createStore({
  modules: {
    PlayerData,
  },
  state() {
    return {};
  },
});

export default store;
