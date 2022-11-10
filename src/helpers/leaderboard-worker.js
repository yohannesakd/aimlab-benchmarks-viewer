let count = 0;
self.onmessage = async (e) => {
  let allData = [];
  for (let i = 0; i < 10; i++) {
    const worker = new Worker("/src/helpers/ldb-fetch.js");
    worker.onmessage = async (event) => {
      // if (e.data.id == "CsLevel.rA Theo.rA Airtr.R3GBA9") {
      //   console.log(event.data);
      // }
      allData.push(await event.data);
      if (allData.length == 10) {
        allData = allData.flat().sort((a, b) => a.rank - b.rank);
        postMessage([allData, e.data.id]);
      }
    };
    worker.postMessage({
      id: e.data.id,
      weapon: e.data.weapon,
      limit: 100,
      offset: i,
    });
  }
};
