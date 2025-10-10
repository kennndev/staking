import { RequestHandler } from "express";
import { LeaderboardData, LeaderboardEntry, SubmitScoreRequest, SubmitScoreResponse } from "@shared/api";
import { supabase } from "../lib/supabase";

// Test Supabase connection
const testSupabaseConnection = async () => {
  try {
    console.log('🔌 [SUPABASE] Testing connection...');
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) {
      console.log('❌ [SUPABASE] Connection failed:', error);
      return false;
    }
    console.log('✅ [SUPABASE] Connection successful');
    return true;
  } catch (error) {
    console.log('❌ [SUPABASE] Connection error:', error);
    return false;
  }
};

// Helper function to get leaderboard entries from Supabase
const getLeaderboardEntries = async (gameType: 'cyber-defense' | 'pop-pop' | 'global'): Promise<LeaderboardEntry[]> => {
  try {
    console.log(`🔍 [LEADERBOARD] Getting leaderboard entries for: ${gameType}`);
    let query;
    
    if (gameType === 'global') {
      // For global leaderboard, get the best score for each player across all games
      console.log('🌍 [LEADERBOARD] Fetching global leaderboard data...');
      query = supabase
        .from('game_sessions')
        .select(`
          user_id,
          users!inner(wallet_address, display_name),
          score,
          game_type,
          created_at
        `)
        .order('score', { ascending: false });
    } else {
      // For specific game leaderboards
      console.log(`🎮 [LEADERBOARD] Fetching ${gameType} leaderboard data...`);
      query = supabase
        .from('game_sessions')
        .select(`
          user_id,
          users!inner(wallet_address, display_name),
          score,
          game_type,
          created_at
        `)
        .eq('game_type', gameType)
        .order('score', { ascending: false });
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('❌ [LEADERBOARD] Error fetching leaderboard data:', error);
      return [];
    }

    if (!data) {
      console.log('📭 [LEADERBOARD] No data found for game type:', gameType);
      return [];
    }

    console.log(`📊 [LEADERBOARD] Found ${data.length} game sessions for ${gameType}`);

    // Process data to get best scores per player
    const playerBestScores = new Map<string, any>();
    
    data.forEach((session: any) => {
      const walletAddress = session.users.wallet_address;
      const existing = playerBestScores.get(walletAddress);
      
      if (!existing || session.score > existing.score) {
        playerBestScores.set(walletAddress, {
          ...session,
          displayName: session.users.display_name || `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
        });
      }
    });

    // Get games played count for each player
    const gamesPlayedPromises = Array.from(playerBestScores.keys()).map(async (walletAddress) => {
      const { count } = await supabase
        .from('game_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('users.wallet_address', walletAddress)
        .eq('game_type', gameType === 'global' ? undefined : gameType);
      
      return { walletAddress, gamesPlayed: count || 0 };
    });

    const gamesPlayedData = await Promise.all(gamesPlayedPromises);
    const gamesPlayedMap = new Map(gamesPlayedData.map(item => [item.walletAddress, item.gamesPlayed]));

    // Convert to leaderboard entries with ranks
    const entries: LeaderboardEntry[] = Array.from(playerBestScores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 100) // Top 100
      .map((entry, index) => ({
        rank: index + 1,
        walletAddress: entry.users.wallet_address,
        score: entry.score,
        gamesPlayed: gamesPlayedMap.get(entry.users.wallet_address) || 0,
        gameType: gameType,
        displayName: entry.displayName
      }));

    return entries;
  } catch (error) {
    console.error('Error in getLeaderboardEntries:', error);
    return [];
  }
};

// GET /api/leaderboard - Get all leaderboards
export const handleGetLeaderboard: RequestHandler = async (req, res) => {
  try {
    console.log('🎯 [LEADERBOARD] API endpoint hit! GET /api/leaderboard');
    console.log('📊 [LEADERBOARD] Fetching all leaderboard data...');
    
    // Test Supabase connection first
    const isConnected = await testSupabaseConnection();
    if (!isConnected) {
      console.log('❌ [LEADERBOARD] Supabase connection failed, returning empty data');
      return res.json({
        cyberDefense: [],
        popPop: [],
        global: []
      });
    }
    
    const [cyberDefense, popPop, global] = await Promise.all([
      getLeaderboardEntries('cyber-defense'),
      getLeaderboardEntries('pop-pop'),
      getLeaderboardEntries('global')
    ]);

    console.log('📈 [LEADERBOARD] Leaderboard data:', {
      cyberDefense: cyberDefense.length,
      popPop: popPop.length,
      global: global.length
    });

    const leaderboardData: LeaderboardData = {
      cyberDefense,
      popPop,
      global
    };

    console.log('✅ [LEADERBOARD] Sending leaderboard data to client');
    res.json(leaderboardData);
  } catch (error) {
    console.error('❌ [LEADERBOARD] Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard data' });
  }
};

// POST /api/leaderboard/submit - Submit a new score
export const handleSubmitScore: RequestHandler = async (req, res) => {
  try {
    console.log('🎯 [LEADERBOARD] API endpoint hit! POST /api/leaderboard/submit');
    console.log('🎯 [LEADERBOARD] Submit score request received:', req.body);
    const { walletAddress, score, gameType }: SubmitScoreRequest = req.body;

    // Validation
    if (!walletAddress || typeof score !== 'number' || !gameType) {
      console.log('❌ [LEADERBOARD] Validation failed:', { walletAddress, score, gameType });
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: walletAddress, score, gameType' 
      });
    }

    if (score < 0) {
      console.log('❌ [LEADERBOARD] Invalid score:', score);
      return res.status(400).json({ 
        success: false, 
        message: 'Score must be non-negative' 
      });
    }

    if (!['cyber-defense', 'pop-pop'].includes(gameType)) {
      console.log('❌ [LEADERBOARD] Invalid game type:', gameType);
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid game type. Must be cyber-defense or pop-pop' 
      });
    }

    console.log('✅ [LEADERBOARD] Validation passed, processing score submission...');

    // Get or create user
    console.log('🔍 [LEADERBOARD] Looking for user with wallet:', walletAddress);
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('wallet_address', walletAddress)
      .single();

    let userId: number;

    if (userError && userError.code === 'PGRST116') {
      console.log('👤 [LEADERBOARD] User not found, creating new user...');
      // User doesn't exist, create them
      const displayName = `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          wallet_address: walletAddress,
          display_name: displayName
        })
        .select('id')
        .single();

      if (createError) {
        console.log('❌ [LEADERBOARD] Error creating user:', createError);
        throw createError;
      }

      console.log('✅ [LEADERBOARD] User created with ID:', newUser.id);
      userId = newUser.id;
    } else if (userError) {
      console.log('❌ [LEADERBOARD] Error fetching user:', userError);
      throw userError;
    } else {
      console.log('✅ [LEADERBOARD] User found with ID:', userData.id);
      userId = userData.id;
    }

    // Insert game session
    console.log('💾 [LEADERBOARD] Inserting game session:', { userId, gameType, score });
    const { error: sessionError } = await supabase
      .from('game_sessions')
      .insert({
        user_id: userId,
        game_type: gameType,
        score: score
      });

    if (sessionError) {
      console.log('❌ [LEADERBOARD] Error inserting game session:', sessionError);
      throw sessionError;
    }

    console.log('✅ [LEADERBOARD] Game session inserted successfully');

    // Get new rank
    console.log('🏆 [LEADERBOARD] Getting new rank for game type:', gameType);
    const leaderboardEntries = await getLeaderboardEntries(gameType);
    const playerEntry = leaderboardEntries.find(entry => entry.walletAddress === walletAddress);
    const newRank = playerEntry?.rank || leaderboardEntries.length + 1;
    console.log('📊 [LEADERBOARD] New rank:', newRank);

    // Get games played count
    const { count: gamesPlayed } = await supabase
      .from('game_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('game_type', gameType);

    console.log('🎮 [LEADERBOARD] Games played count:', gamesPlayed);

    const response: SubmitScoreResponse = {
      success: true,
      message: 'Score submitted successfully',
      newRank
    };

    console.log('✅ [LEADERBOARD] Score submission completed:', response);
    res.json(response);
  } catch (error) {
    console.error('Error submitting score:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit score' 
    });
  }
};

// GET /api/leaderboard/:gameType - Get specific leaderboard
export const handleGetGameLeaderboard: RequestHandler = async (req, res) => {
  try {
    const { gameType } = req.params;
    
    if (!['cyber-defense', 'pop-pop', 'global'].includes(gameType)) {
      return res.status(400).json({ error: 'Invalid game type' });
    }

    const entries = await getLeaderboardEntries(gameType as 'cyber-defense' | 'pop-pop' | 'global');
    res.json(entries);
  } catch (error) {
    console.error('Error fetching game leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard data' });
  }
};