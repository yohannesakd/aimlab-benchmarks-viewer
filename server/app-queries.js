export const GET_USER_INFO = `
  query GetProfile($username: String) {
    Trainer {
      aimlabProfile(username: $username) {
        username user { id } ranking { rank { displayName } skill }
      }
    }
  }
`;

export const GET_USER_PLAYS_AGG = `
  query GetProfileAggregates($where: Trainer_AimlabPlayWhere!) {
    Trainer {
      aimlab {
        plays_agg(where: $where) {
          group_by { task_id task_name task_mode_mod weapon_id }
          aggregate { count avg { score accuracy } max { score accuracy } }
        }
      }
    }
  }
`;

export const publicTaskSummaryLimit = 100;
export const GET_PUBLIC_TASK_SUMMARIES = `
  query GetPublicTaskSummaries($username: String, $limit: Int!) {
    Trainer {
      aimlabProfile(username: $username) {
        username
        taskStats(app: AIMLAB, limit: $limit) {
          topScore playCount playId
          task { id name }
          play { id score taskSlug convertedMode manifest { taskName weaponId } }
        }
      }
    }
  }
`;

export const GET_TASK_BY_ID = `
  query GetTask($slug: String!) {
    Trainer {
      aimlab {
        task(slug: $slug) {
          id name weapon_id description image_url author { username } workshop_id
        }
      }
    }
  }
`;

export const GET_TASKS_BY_NAME = `
  query SearchTasks($name: String!) {
    Trainer {
      aimlab {
        tasks(name: $name) { name id image_url author { username } }
      }
    }
  }
`;

export const GET_TASK_LEADERBOARD = `
  query GetTaskLeaderboard($leaderboardInput: Trainer_LeaderboardInput!) {
    Trainer {
      aimlab {
        leaderboard(input: $leaderboardInput) {
          metadata { offset rows totalRows }
          data
        }
      }
    }
  }
`;
