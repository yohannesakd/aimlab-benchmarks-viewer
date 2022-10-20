import { APIFetch, GET_TASK_LEADERBOARD } from "./queries";
import { hardBench } from "./revosectData";

async function getLeaderboardPlayers(fullBench) {
  console.time("allPlayersList");
  const fullPlayerList = [];
  for (let benchItem of fullBench) {
    let limit = 100;
    let offset = 0;
    const playerList = [];
    while (true) {
      let res = await APIFetch(GET_TASK_LEADERBOARD, {
        leaderboardInput: {
          clientId: "aimlab",
          limit: limit,
          offset: offset,
          taskId: benchItem.id,
          taskMode: 0,
          weaponId: benchItem.weapon,
        },
      });
      if (res?.aimlab?.leaderboard) {
        const data = res.aimlab.leaderboard.data;
        const filteredData = data.map((scen) => {
          return {
            id: scen.user_id,
            username: scen.username,
          };
        });
        playerList.push(...filteredData);
        //
        if (data[data.length - 1].score > benchItem.scores[0]) {
          offset += limit;
          continue;
        }
        break;
      } else continue;
    }
    fullPlayerList.push(...playerList);
  }
  console.timeEnd("allPlayersList");
  return fullPlayerList;
}

onmessage = async (work) => {
  console.log("message received");
  const fullList = await getLeaderboardPlayers(work.data);
  const uniquePlayersList = [
    ...new Map(fullList.map((item) => [item["id"], item])).values(),
  ];
  postMessage(uniquePlayersList);
};
