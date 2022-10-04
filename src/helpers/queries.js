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
        task_id
        task_name
      }
      aggregate {
        count
        avg {
          score
          accuracy
        }
        max {
          score
          accuracy
        }
      }
    }
  }
}
`;

export async function APIFetch(query, variables) {
  try {
    const response = await axios({
      method: "POST",
      url: "https://api.aimlab.gg/graphql",
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
    console.log(error);
  }
}
