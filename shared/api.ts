/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
    message: string;
  }

// Leaderboard types
export interface LeaderboardEntry {
  rank: number;
  walletAddress: string;
  score: number;
  gamesPlayed: number;
  gameType: 'cyber-defense' | 'pop-pop' | 'global';
  displayName: string;
}

export interface LeaderboardData {
  cyberDefense: LeaderboardEntry[];
  popPop: LeaderboardEntry[];
  global: LeaderboardEntry[];
}

export interface SubmitScoreRequest {
  walletAddress: string;
  score: number;
  gameType: 'cyber-defense' | 'pop-pop';
}

export interface SubmitScoreResponse {
  success: boolean;
  message: string;
  newRank?: number;
}
  