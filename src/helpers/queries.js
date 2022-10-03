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
    }
  }
}
`;
