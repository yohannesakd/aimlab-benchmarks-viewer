const API_ENDPOINT = "https://api.aimlab.gg/graphql";
const GET_TASK_LEADERBOARD = `
  query getAimlabLeaderboard($leaderboardInput:LeaderboardInput!){
    aimlab{
        leaderboard(input: $leaderboardInput){
            id
            source
            metadata{
                offset
                rows
                totalRows
            }
            schema{
                id
                fields
            }
            data
        }
    }
  }
`;

self.onmessage = async (e) => {
  const res = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: GET_TASK_LEADERBOARD,
      variables: {
        leaderboardInput: {
          clientId: "aimlab",
          limit: e.data.limit,
          offset: e.data.limit * e.data.offset,
          taskId: e.data.id,
          taskMode: 0,
          weaponId: e.data.weapon,
        },
      },
    }),
  });

  res.json().then((response) => {
    let data = response?.data.aimlab.leaderboard.data;
    postMessage(data);
  });
};
