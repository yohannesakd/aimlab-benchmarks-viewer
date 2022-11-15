const test = new Date();

const window = {
  week: `${test.getFullYear()}-${parseInt(
    test.getMonth() + 1
  )}-${test.getDate()}`,
  month: `${test.getFullYear()}-${parseInt(test.getMonth() + 1)}`,
  year: `${test.getFullYear()}`,
};
