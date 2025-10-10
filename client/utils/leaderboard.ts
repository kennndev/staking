import { SubmitScoreRequest, SubmitScoreResponse } from '@shared/api';

/**
 * Submit a game score to the leaderboard
 * Now uses Supabase backend for persistent storage
 */
export async function submitScore(
  walletAddress: string,
  score: number,
  gameType: 'cyber-defense' | 'pop-pop'
): Promise<SubmitScoreResponse> {
  try {
    console.log('🎯 [CLIENT] Submitting score:', { walletAddress, score, gameType });
    const request: SubmitScoreRequest = {
      walletAddress,
      score,
      gameType
    };

    console.log('📤 [CLIENT] Sending request to API:', request);
    const response = await fetch('/api/leaderboard/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    console.log('📥 [CLIENT] API response status:', response.status);

    if (!response.ok) {
      console.log('❌ [CLIENT] API request failed with status:', response.status);
      const errorData = await response.json().catch(() => ({}));
      console.log('❌ [CLIENT] Error data:', errorData);
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const result: SubmitScoreResponse = await response.json();
    console.log('✅ [CLIENT] Score submission successful:', result);
    return result;
  } catch (error) {
    console.error('Failed to submit score:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to submit score. Please try again.',
    };
  }
}

/**
 * Get leaderboard data for all games
 */
export async function getLeaderboardData() {
  try {
    const response = await fetch('/api/leaderboard');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch leaderboard data:', error);
    return {
      cyberDefense: [],
      popPop: [],
      global: []
    };
  }
}

/**
 * Get leaderboard data for a specific game
 */
export async function getGameLeaderboard(gameType: 'cyber-defense' | 'pop-pop' | 'global') {
  try {
    const response = await fetch(`/api/leaderboard/${gameType}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch ${gameType} leaderboard:`, error);
    return [];
  }
}
