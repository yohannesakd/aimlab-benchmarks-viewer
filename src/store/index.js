import { createStore } from "vuex";
import PlayerData from "./modules/PlayerData";
import Benchmarks from "./modules/Benchmarks";

const store = createStore({
  modules: {
    PlayerData,
    Benchmarks,
  },
  state() {
    return {};
  },
});

export default store;
