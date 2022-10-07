export function calculateEnergyAdv(bench, userTask, energyList, rankList) {
  let energy = 0;
  if (userTask.maxScore <= bench.scores[0]) {
    energy = Math.floor((userTask.maxScore / bench.scores[0]) * 800);
  } else if (userTask.maxScore >= bench.scores[4]) {
    energy = energyList[4];
  } else {
    let i = 0;
    bench.scores.forEach((score, index) => {
      if (userTask.maxScore > score) {
        energy = energyList[index];
        i = index;
      }
    });
    energy += Math.floor(
      ((userTask.maxScore - bench.scores[i]) * 100) /
        (bench.scores[i + 1] - bench.scores[i])
    );
  }
  let rank = rankList[Math.floor(energy / 100) * 100] || "Unranked";
  return [energy, rank];
}

export function calculateEnergy(bench, userTask, energyList, rankList) {
  let energy = 0;
  if (userTask.maxScore <= bench.scores[0]) {
    energy = Math.floor((userTask.maxScore / bench.scores[0]) * 800);
  } else if (userTask.maxScore >= bench.scores[4]) {
    energy = energyList[4];
    if (
      userTask.maxScore >=
      bench.scores[4] + (bench.scores[4] - bench.scores[3])
    ) {
      energy += 100;
      console.log(energy);
    } else {
      energy += Math.floor(
        ((userTask.maxScore - bench.scores[4]) * 100) /
          (bench.scores[4] - bench.scores[3])
      );
    }
  } else {
    let i = 0;
    bench.scores.forEach((score, index) => {
      if (userTask.maxScore > score) {
        energy = energyList[index];
        i = index;
      }
    });
    energy += Math.floor(
      ((userTask.maxScore - bench.scores[i]) * 100) /
        (bench.scores[i + 1] - bench.scores[i])
    );
  }
  let rank =
    (energy == 900
      ? rankList[energyList[4]]
      : rankList[Math.floor(energy / 100) * 100]) || "Unranked";
  return [energy, rank];
}

// console.log(calculateEnergy(bench, user, energyList, rankList));
