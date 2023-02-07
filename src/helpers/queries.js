import axios from "axios";

export const API_ENDPOINT = "https://api.aimlab.gg/graphql";
export const GET_USER_INFO = `
  query GetProfile($username: String) {
    aimlabProfile(username: $username) {
      username
      user {
        id
      }
      ranking {
        rank {
          displayName
        }
        skill
      }
    }
  }
`;
export const GET_USER_PLAYS_AGG = `
  query GetAimlabProfileAgg($where: AimlabPlayWhere!) {
    aimlab {
      plays_agg(where: $where) {
          group_by {
              user_id
              steam_id
              weapon_id
              task_id
              task_name
              ended_at(period: week )
                  }
          aggregate {
              count
              avg {
                  score
                  task_duration
                  targets
                  kills
                  shots_fired
                  shots_hit
                  shots_hit_head
                  shots_hit_body
                  reaction_time
                  accuracy
                  shots_per_kill
                  shots_missed
                  kills_per_sec
                  time_off_avg
                  time_on_avg
                  time_on_ratio
                  settings_fov
                  settings_sensitivity_x
                  settings_sensitivity_y
                  adv_crosshair_placement
                  adv_movement_accuracy
                  }
              min {
                  score
                  task_duration
                  targets
                  kills
                  shots_fired
                  shots_hit
                  shots_hit_head
                  shots_hit_body
                  reaction_time
                  shots_missed
                  created_at
                  ended_at
                  accuracy
                  shots_per_kill
                  kills_per_sec
                  time_off_avg
                  time_on_avg
                  time_on_ratio
                  adv_crosshair_placement
                  adv_movement_accuracy     
                  }
              max{
                  score
                  task_duration
                  targets
                  kills
                  shots_fired
                  shots_hit
                  shots_hit_head
                  shots_hit_body
                  reaction_time
                  shots_missed
                        ended_at
                  accuracy
                  shots_per_kill
                  kills_per_sec
                  time_off_avg
                  time_on_avg
                  time_on_ratio
                  adv_crosshair_placement
                  adv_movement_accuracy
                  }
              sum{
                  score
                  task_duration
                  targets
                  kills
                  shots_fired
                  shots_hit
                  shots_hit_head
                  shots_hit_body
                  reaction_time
                  shots_missed
              }
               stddev{
                  score
                  task_duration
                  targets
                  kills
                  shots_fired
                  shots_hit
                  shots_hit_head
                  shots_hit_body
                  reaction_time
                  accuracy
                  shots_per_kill
                  shots_missed
                  kills_per_sec
                  time_off_avg
                  time_on_avg
                  time_on_ratio
               }
               uniq{
                  id
                  play_id
                  task
                  weapon_id
               }
              }
          }
      }
  }
`;
//$slug = String! variable for task id
export const GET_TASK_BY_ID = `
  query getTasksById($slug: String!) {
    aimlab {
      task(slug: $slug) {
        id
        name
        weapon_id
        description
        image_url
        author_id
        author{
            username
        }
        created_at
        workshop_id
    }
    }
  }
`;
export const GET_TASKS_BY_NAME = `
  query getTasksByName($name:String!) {
    aimlab {
      tasks(name:$name) {
        name 
        id 
        weapon_id
        description 
        image_url 
          author{
              id
              username
          }
      }
    }
  }
`;
// leaderboardInput => {
//     "leaderboardInput":{
//       "clientId": "aimlab",
//       "limit":200,
//       "offset":0,
//       "taskId":"id",
//       "taskMode": 0,
//       "weaponId":"weapon"
//   },
//   "window":
//   {
//       "period":"month/week/year",
//       "value":"yr-mo-day"
//   }
// }
export const GET_TASK_LEADERBOARD = `
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

export async function APIFetch(query, variables) {
  try {
    const response = await axios({
      method: "POST",
      url: API_ENDPOINT,
      headers: {
        "Content-Type": "application/json",
      },
      data: {
        query: query,
        variables: variables,
      },
    });
    return response.data.data;
  } catch (error) {
    console.error(error);
  }
}
