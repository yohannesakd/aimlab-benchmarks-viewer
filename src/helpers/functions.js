import {
  advancedRanks,
  advancedEnergy,
  intermediateEnergy,
  intermediateRanks,
  noviceEnergy,
  noviceRanks,
} from "../store/modules/voltaicData";
import _ from "lodash";

export function caclulateAll(playerTasks, playerBench, mode) {
  playerBench.forEach((bench) => {
    bench.avgAcc = 0;
    bench.count = 0;
    bench.maxScore = 0;
    bench.avgScore = 0;
    bench.energy = 0;
    bench.rank = "Unranked";
  });
  for (let i = 0; i < playerTasks.length; i++) {
    for (let j = 0; j < playerBench.length; j++) {
      if (playerTasks[i].id == playerBench[j].id) {
        let rankData = [0, "Unranked"];
        if (playerTasks[i].count > 0) {
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
  const energyList = Object.entries(grouped).map(([_, group]) => {
    return Math.max(...group.map(({ energy }) => energy));
  });
  const harmonicMean = Math.floor(
    6 / energyList.reduce((acc, curr) => acc + 1 / curr, 0)
  );
  const floorEnergy = Math.floor(harmonicMean / 100) * 100;
  //switch mode
  let overallRank = null;
  switch (mode) {
    case "advanced":
      overallRank = advancedRanks[floorEnergy] || "Unranked";
      checkComplete(overallRank, energyList, "advanced");
      break;
    case "intermediate":
      overallRank = intermediateRanks[floorEnergy] || "Unranked";
      break;
    case "novice":
      overallRank = noviceRanks[floorEnergy] || "Unranked";
      break;
    default:
      overallRank = advancedRanks[floorEnergy] || "Unranked";
      break;
  }
  if (mode == "intermediate") {
    console.log(energyList);

    // console.log({
    //   overallEnergy: harmonicMean,
    //   overallRank: overallRank,
    //   subCategoryEnergy: energyList,
    //   benchmarks: playerBench,
    // });
  }
  return {
    overallEnergy: harmonicMean,
    overallRank: overallRank,
    subCategoryEnergy: energyList,
    benchmarks: playerBench,
  };
}

function calculateRankAdv(bench, userTask) {
  //lower scorelimit is 800
  let energy = 0;
  if (userTask.maxScore <= bench.scores[0]) {
    energy = Math.floor((userTask.maxScore / bench.scores[0]) * 800);
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

function checkComplete(rank, energyList, mode) {}

function calculateRankInt(bench, userTask) {
  //lower score limit is 300
  let energy = 0;
  if (userTask.maxScore <= bench.scores[0]) {
    energy = Math.floor((userTask.maxScore / bench.scores[0]) * 300);
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
  return [energy, rank];
}
function calculateRankNov(bench, userTask) {
  let energy = 0;
  if (userTask.maxScore <= bench.scores[0]) {
    energy = Math.floor((userTask.maxScore / bench.scores[0]) * 800);
  } else if (userTask.maxScore >= bench.scores[4]) {
    energy = noviceEnergy[4];
  } else {
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
  let rank = noviceRanks[Math.floor(energy / 100) * 100] || "Unranked";
  return [energy, rank];
}
