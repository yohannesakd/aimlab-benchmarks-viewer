import {
  advancedRanks,
  advancedEnergy,
  intermediateEnergy,
  intermediateRanks,
  noviceEnergy,
  noviceRanks,
} from "./voltaicData";
import { APIFetch, GET_TASK_LEADERBOARD } from "./queries.js";
import _ from "lodash";

//Take player full task list and the benchmark data
export function caclulateAll(playerTasks, playerBench, mode) {
  playerBench.forEach((bench) => {
    bench.avgAcc = 0;
    bench.count = 0;
    bench.maxScore = 0;
    bench.avgScore = 0;
    bench.energy = 0;
    bench.rank = "Unranked";
  });
  // find the benchmark scenario within the player task list by matching IDs
  for (let i = 0; i < playerTasks.length; i++) {
    for (let j = 0; j < playerBench.length; j++) {
      if (playerTasks[i].id == playerBench[j].id) {
        let rankData = [0, "Unranked"];
        if (playerTasks[i].count > 0) {
          //calculate rank and energy for different modes
          switch (mode) {
            case "advanced":
              rankData = calculateRankAdv(playerBench[j], playerTasks[i]);
              break;
            case "intermediate":
              rankData = calculateRankInt(playerBench[j], playerTasks[i]);
              break;
            case "novice":
              rankData = calculateRankNov(playerBench[j], playerTasks[i]);
              break;
            default:
              rankData = calculateRankAdv(playerBench[j], playerTasks[i]);
              break;
          }
        }
        playerBench[j] = {
          ...playerBench[j],
          ...playerTasks[i],
        };
        playerBench[j].energy = rankData[0] || 0;
        playerBench[j].rank = rankData[1] || "Unranked";
      }
    }
  }
  playerBench.sort((a, b) => a.scenarioID - b.scenarioID);
  // calculating category energy
  const grouped = _.groupBy(playerBench, "categoryID");
  const allEnergyList = playerBench.map((bench) => bench.energy);
  const categoryEnergyList = Object.entries(grouped).map(([_, group]) => {
    return Math.max(...group.map(({ energy }) => energy));
  });
  const harmonicMean = Math.floor(
    6 / categoryEnergyList.reduce((acc, curr) => acc + 1 / curr, 0)
  );
  //Calculating Overall rank
  const floorEnergy = Math.floor(harmonicMean / 100) * 100;
  let overallRank = null;
  switch (mode) {
    case "advanced":
      overallRank = advancedRanks[floorEnergy] || "Unranked";
      break;
    case "intermediate":
      overallRank = intermediateRanks[floorEnergy] || "Unranked";
      break;
    case "novice":
      overallRank = noviceRanks[floorEnergy] || "Unranked";
      break;
    default:
      overallRank = "Unranked";
      break;
  }
  // Check complete rank scenario
  if (checkComplete(overallRank, allEnergyList, mode))
    overallRank += " Complete";

  return {
    overallEnergy: harmonicMean,
    overallRank: overallRank,
    subCategoryEnergy: categoryEnergyList,
    benchmarks: playerBench,
  };
}
function checkComplete(rank, energyList, mode) {
  let minEnergy = Math.floor(Math.min(...energyList) / 100) * 100;
  let complete =
    energyList.filter((energy) => energy >= minEnergy).length ==
    energyList.length;

  switch (mode) {
    case "intermediate":
      return complete && intermediateRanks[minEnergy] == rank;
    case "advanced":
      return complete && advancedRanks[minEnergy] == rank;
    case "novice":
      return complete && noviceRanks[minEnergy] == rank;
  }
}

function calculateRankAdv(bench, userTask) {
  //lower scorelimit is 800
  let energy = 0;
  if (userTask.maxScore <= bench.scores[0]) {
    energy = Math.floor(
      (userTask.maxScore / bench.scores[0]) * advancedEnergy[0]
    );
  } else if (userTask.maxScore >= bench.scores[4]) {
    energy = advancedEnergy[4];
  } else {
    let i = 0;
    bench.scores.forEach((score, index) => {
      if (userTask.maxScore > score) {
        energy = advancedEnergy[index];
        i = index;
      }
    });
    energy += Math.floor(
      ((userTask.maxScore - bench.scores[i]) * 100) /
        (bench.scores[i + 1] - bench.scores[i])
    );
  }
  let rank = advancedRanks[Math.floor(energy / 100) * 100] || "Unranked";
  return [energy, rank];
}

function calculateRankInt(bench, userTask) {
  //lower score limit is 300
  let energy = 0;
  if (userTask.maxScore <= bench.scores[0]) {
    energy = Math.floor(
      (userTask.maxScore / bench.scores[0]) * intermediateEnergy[0]
    );
  } else if (userTask.maxScore >= bench.scores[4]) {
    let userDiff = userTask.maxScore - bench.scores[4];
    let rankDiff = bench.scores[4] - bench.scores[3];
    let energyGain = Math.floor((userDiff / rankDiff) * 100);
    if (energyGain > 100) {
      energyGain = 100;
    }
    energy = intermediateEnergy[4] + energyGain;
  } else {
    let i = 0;
    bench.scores.forEach((score, index) => {
      if (userTask.maxScore > score) {
        energy = intermediateEnergy[index];
        i = index;
      }
    });
    energy += Math.floor(
      ((userTask.maxScore - bench.scores[i]) * 100) /
        (bench.scores[i + 1] - bench.scores[i])
    );
  }
  let rank = intermediateRanks[Math.floor(energy / 100) * 100] || "Unranked";
  // console.log([energy, rank]);
  if (energy === 900) rank = intermediateRanks[800];
  return [energy, rank];
}

//Calculate Rank and Energy for a Scenario from the Novice Benches
//Check scenarios if score is greater than the upper requirement or lower than the lower requirement and apply energy accordingly

function calculateRankNov(bench, userTask) {
  // lower limit is 0
  let energy = 0;
  if (userTask.maxScore >= bench.scores[4]) {
    //calculating additional energy beyond the max requirement
    let userDiff = userTask.maxScore - bench.scores[4];
    let rankDiff = bench.scores[4] - bench.scores[3];
    let energyGain = Math.floor((userDiff / rankDiff) * 100);
    if (energyGain > 100) {
      energyGain = 100;
    }
    energy = noviceEnergy[4] + energyGain;
  } else {
    //calculating for energy between ranks
    let i = 0;
    bench.scores.forEach((score, index) => {
      if (userTask.maxScore > score) {
        energy = noviceEnergy[index];
        i = index;
      }
    });
    energy += Math.floor(
      ((userTask.maxScore - bench.scores[i]) * 100) /
        (bench.scores[i + 1] - bench.scores[i])
    );
  }
  //Finding rank through rounding by 100 and looking up
  let rank = noviceRanks[Math.floor(energy / 100) * 100] || "Unranked";
  //When user has max energy
  if (energy === 500) rank = noviceRanks[400];
  return [energy, rank];
}

export function taskDeepLink(taskId) {
  return `https://go.aimlab.gg/v1/redirects?link=aimlab://workshop?id=${taskId}&source=EEDCC708991834C0&link=steam://rungameid/714010`;
}
export function replayDeepLink(playId) {
  return `https://go.aimlab.gg/v1/redirects?link=aimlab%3a%2f%2fcompare%3fid%3d${playId}%26source%3d84966503A24BD515&link=steam%3a%2f%2frungameid%2f714010`;
}
export async function findReplay(playerName, taskId, weapon) {
  let limit = 100;
  let offset = 0;
  let playerFound = false;
  while (!playerFound) {
    let ldb = await APIFetch(GET_TASK_LEADERBOARD, {
      leaderboardInput: {
        clientId: "aimlab",
        limit: limit,
        offset: offset,
        taskId: taskId,
        taskMode: 0,
        weaponId: weapon,
      },
    });

    if (ldb?.aimlab.leaderboard) {
      let located = [...ldb.aimlab.leaderboard.data].filter(
        (entry) => entry.username == playerName
      );
      console.log(located);
      if (_.isEmpty(located)) {
        console.log("not found on page", offset / limit + 1);
        offset += limit;
        if (offset >= ldb.aimlab.leaderboard.metadata.totalRows) {
          console.log("Score not found");
          return false;
        }
        continue;
      } else {
        console.log("found on page", offset / limit + 1);
        playerFound = true;
        return replayDeepLink(located[0].play_id);
      }
    } else continue;
  }
}
