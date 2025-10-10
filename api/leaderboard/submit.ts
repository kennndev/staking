import { VercelRequest, VercelResponse } from '@vercel/node';
import { SubmitScoreRequest, SubmitScoreResponse } from '../../shared/api';

// Mock database for now - in production, use Supabase
let gameScores: Array<{
  walletAddress: string;
  score: number;
  gameType: 'cyber-defense' | 'pop-pop';
  timestamp: number;
  gamesPlayed: number;
}> = [];

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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🎯 [VERCEL] Submit score request received:', req.body);
    const { walletAddress, score, gameType }: SubmitScoreRequest = req.body;

    // Validation
    if (!walletAddress || typeof score !== 'number' || !gameType) {
      console.log('❌ [VERCEL] Validation failed:', { walletAddress, score, gameType });
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: walletAddress, score, gameType' 
      });
    }

    if (score < 0) {
      console.log('❌ [VERCEL] Invalid score:', score);
      return res.status(400).json({ 
        success: false, 
        message: 'Score must be non-negative' 
      });
    }

    if (!['cyber-defense', 'pop-pop'].includes(gameType)) {
      console.log('❌ [VERCEL] Invalid game type:', gameType);
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid game type. Must be cyber-defense or pop-pop' 
      });
    }

    console.log('✅ [VERCEL] Validation passed, processing score submission...');

    // Find existing score for this player and game type
    const existingScoreIndex = gameScores.findIndex(
      s => s.walletAddress === walletAddress && s.gameType === gameType
    );

    const gamesPlayed = existingScoreIndex >= 0 
      ? gameScores[existingScoreIndex].gamesPlayed + 1 
      : 1;

    const newScore = {
      walletAddress,
      score,
      gameType,
      timestamp: Date.now(),
      gamesPlayed
    };

    if (existingScoreIndex >= 0) {
      // Update existing score if new score is higher
      if (score > gameScores[existingScoreIndex].score) {
        gameScores[existingScoreIndex] = newScore;
      } else {
        // Still update games played count
        gameScores[existingScoreIndex].gamesPlayed = gamesPlayed;
      }
    } else {
      // Add new score
      gameScores.push(newScore);
    }

    console.log('✅ [VERCEL] Score processed successfully');

    // Get new rank (simplified for demo)
    const gameTypeScores = gameScores
      .filter(s => s.gameType === gameType)
      .sort((a, b) => b.score - a.score);
    
    const playerRank = gameTypeScores.findIndex(s => s.walletAddress === walletAddress) + 1;
    const newRank = playerRank || gameTypeScores.length + 1;

    const response: SubmitScoreResponse = {
      success: true,
      message: 'Score submitted successfully',
      newRank
    };

    console.log('✅ [VERCEL] Score submission completed:', response);
    res.status(200).json(response);
  } catch (error) {
    console.error('❌ [VERCEL] Error submitting score:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit score' 
    });
  }
}
