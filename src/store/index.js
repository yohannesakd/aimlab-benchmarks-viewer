import { createStore } from "vuex";
import PlayerData from "./modules/PlayerData";
import Benchmarks from "./modules/Benchmarks";
import TaskData from "./modules/TaskData";
import Leaderboards from "./modules/Leaderboards";

const store = createStore({
  modules: {
    PlayerData,
    Benchmarks,
    TaskData,
    Leaderboards,
  },
  state() {
    return {};
  },
});

export default store;
