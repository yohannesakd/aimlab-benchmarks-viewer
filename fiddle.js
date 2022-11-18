// const test = new Date();

// const window = {
//   week: `${test.getFullYear()}-${parseInt(
//     test.getMonth() + 1
//   )}-${test.getDate()}`,
//   month: `${test.getFullYear()}-${parseInt(test.getMonth() + 1)}`,
//   year: `${test.getFullYear()}`,
// };

class PlayedTask {
  name = "";
  id = "";
  playCount = 0;
  avgScore = 0;
  avgAcc = 0;
  maxScore = 0;
  maxAcc = 0;
}

class PlayedBenchmarkTask extends PlayedTask {}
