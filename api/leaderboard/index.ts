import { VercelRequest, VercelResponse } from '@vercel/node';
import { LeaderboardData, LeaderboardEntry } from '../../shared/api';

// Mock database for now - in production, use Supabase
let gameScores: Array<{
  walletAddress: string;
  score: number;
  gameType: 'cyber-defense' | 'pop-pop';
  timestamp: number;
  gamesPlayed: number;
}> = [];

// Helper function to get leaderboard entries
const getLeaderboardEntries = (gameType: 'cyber-defense' | 'pop-pop' | 'global'): LeaderboardEntry[] => {
  let filteredScores: typeof gameScores = [];

  if (gameType === 'global') {
    // For global leaderboard, get the best score for each player across all games
    const playerBestScores = new Map<string, typeof gameScores[0]>();
    
    gameScores.forEach(score => {
      const existing = playerBestScores.get(score.walletAddress);
      if (!existing || score.score > existing.score) {
        playerBestScores.set(score.walletAddress, score);
      }
    });
    
    filteredScores = Array.from(playerBestScores.values());
  } else {
    // For specific game leaderboards
    filteredScores = gameScores.filter(score => score.gameType === gameType);
  }

  // Sort by score (descending) and add ranks
  const sortedScores = filteredScores
    .sort((a, b) => b.score - a.score)
    .slice(0, 100); // Top 100

  return sortedScores.map((score, index) => ({
    rank: index + 1,
    walletAddress: score.walletAddress,
    score: score.score,
    gamesPlayed: score.gamesPlayed,
    gameType: gameType,
    displayName: `${score.walletAddress.slice(0, 4)}...${score.walletAddress.slice(-4)}`
  }));
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📊 [VERCEL] Fetching leaderboard data...');
    
    const [cyberDefense, popPop, global] = await Promise.all([
      getLeaderboardEntries('cyber-defense'),
      getLeaderboardEntries('pop-pop'),
      getLeaderboardEntries('global')
    ]);

    console.log('📈 [VERCEL] Leaderboard data:', {
      cyberDefense: cyberDefense.length,
      popPop: popPop.length,
      global: global.length
    });

    const leaderboardData: LeaderboardData = {
      cyberDefense,
      popPop,
      global
    };

    console.log('✅ [VERCEL] Sending leaderboard data to client');
    res.status(200).json(leaderboardData);
  } catch (error) {
    console.error('❌ [VERCEL] Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard data' });
  }
}
