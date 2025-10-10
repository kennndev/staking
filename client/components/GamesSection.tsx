'use client';

import { useState } from 'react';
import { useStaking } from '../contexts/StakingContext';
import { CyberDefense } from './cyber-defense';
import { PopPop } from './pop-pop';

interface Game {
  id: string;
  name: string;
  description: string;
  icon: string;
  component: React.ComponentType;
  isAvailable: boolean;
  stakingRequirement: number; // Required staked tokens (in base units)
  tier: number; // 1 = Cyber Defense only, 2 = Cyber Defense + Puzzle, 3 = All games
}

const games: Game[] = [
  {
    id: 'cyber-defense',
    name: 'Cyber Defence',
    description: 'Defend your base from incoming cyber attacks in this tower defense game',
    icon: '🛡️',
    component: CyberDefense,
    isAvailable: true,
    stakingRequirement: 145_000_000_000, // 145,000 tokens (base units for 6-decimal token)
    tier: 1,
  },
  {
    id: 'pop-pop',
    name: 'Pop Pop',
    description: 'Click the right colored balloons as they fall! Follow the prompts and avoid wrong colors to build your streak',
    icon: '🫧',
    component: PopPop,
    isAvailable: true,
    stakingRequirement: 145_000_000_000, // 145,000 tokens (base units for 6-decimal token)
    tier: 1,
  },
];

export default function GamesSection() {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const { userData, stakingDecimals } = useStaking();

  const handleGameSelect = (gameId: string) => {
    setSelectedGame(gameId);
  };

  const handleBackToGames = () => {
    setSelectedGame(null);
  };

  // Calculate user's staked amount in base units
  const userStakedAmount = userData?.staked || 0;

  // Debug logging
  console.log('🎮 Games Section Debug:', {
    userStakedAmount,
    stakingDecimals,
    userStakedFormatted: userStakedAmount / Math.pow(10, stakingDecimals),
    games: games.map(g => ({
      name: g.name,
      requirement: g.stakingRequirement,
      requirementFormatted: g.stakingRequirement / Math.pow(10, stakingDecimals),
      canAccess: userStakedAmount >= g.stakingRequirement
    }))
  });

  // Helper function to check if user can access a game
  const canAccessGame = (game: Game): boolean => {
    if (!game.isAvailable) return false;
    // Temporarily commented out staking requirement
    // return userStakedAmount >= game.stakingRequirement;
    return true; // Allow access to all available games
  };

  // Helper function to get user's current tier
  const getUserTier = (): number => {
    if (userStakedAmount >= 145_000_000_000) return 1; // All games (145,000 tokens)
    return 0; // No access
  };

  // Helper function to format staking requirement for display
  const formatStakingRequirement = (requirement: number): string => {
    if (stakingDecimals > 0) {
      return (requirement / Math.pow(10, stakingDecimals)).toLocaleString();
    }
    return requirement.toLocaleString();
  };

  // If a game is selected, render that game
  if (selectedGame) {
    const game = games.find(g => g.id === selectedGame);
    if (game && canAccessGame(game)) {
      const GameComponent = game.component;
      return (
        <div>
          {/* Game Header */}
          <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleBackToGames}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-2xl">{game.icon}</span>
                <h1 className="text-2xl font-bold text-white">{game.name}</h1>
              </div>
            </div>
          </div>

          {/* Game Content */}
          <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6">
            <GameComponent />
          </div>
        </div>
      );
    } 
    // Temporarily commented out access denied logic
    // else if (game && !canAccessGame(game)) {
    //   // Show access denied message
    //   return (
    //     <div>
    //       <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-4 mb-6">
    //         <div className="flex items-center space-x-3">
    //           <button
    //             onClick={handleBackToGames}
    //             className="p-2 text-gray-400 hover:text-white transition-colors"
    //           >
    //             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    //               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    //             </svg>
    //           </button>
    //           <span className="text-2xl">{game.icon}</span>
    //           <h1 className="text-2xl font-bold text-white">{game.name}</h1>
    //         </div>
    //       </div>

    //       <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6 text-center">
    //         <div className="text-6xl mb-4">🔒</div>
    //         <h2 className="text-2xl font-bold text-white mb-4">Access Restricted</h2>
    //         <p className="text-gray-300 mb-6">
    //           You need to stake at least <span className="font-bold text-yellow-400">
    //             {formatStakingRequirement(game.stakingRequirement)} tokens
    //           </span> to access this game.
    //         </p>
    //         <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
    //           <p className="text-yellow-400 text-sm">
    //             Current staked: <span className="font-bold">
    //               {stakingDecimals > 0 
    //                 ? (userStakedAmount / Math.pow(10, stakingDecimals)).toLocaleString()
    //                 : userStakedAmount.toLocaleString()
    //               } tokens
    //             </span>
    //           </p>
    //         </div>
    //       </div>
    //     </div>
    //   );
    // }
  }

  // Games selection screen
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">🎮 Games Hub</h1>
        <p className="text-gray-300 text-sm md:text-base">Choose your adventure and earn rewards while playing!</p>
      </div>

      {/* Staking Tier Info */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-bold text-white mb-3">🎯 Game Access</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl mb-2">🔒</div>
            <h3 className="font-semibold text-white mb-1">Locked</h3>
            <p className="text-sm text-gray-300">Less than 145,000 tokens</p>
            <p className="text-xs text-red-400">No game access</p>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-2">🎮</div>
            <h3 className="font-semibold text-white mb-1">Unlocked</h3>
            <p className="text-sm text-gray-300">145,000+ tokens</p>
            <p className="text-xs text-green-400">All Games Available</p>
          </div>
        </div>
      </div>

      {/* Games Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6">
        {games.map((game) => {
          const hasAccess = canAccessGame(game);
          const userTier = getUserTier();
          
          return (
            <div
              key={game.id}
              className={`bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-4 md:p-6 transition-all duration-200 ${
                hasAccess
                  ? 'hover:bg-white/5 hover:border-white/20 cursor-pointer'
                  : 'opacity-50 cursor-not-allowed'
              }`}
              onClick={() => hasAccess && handleGameSelect(game.id)}
            >
              <div className="text-center">
                <div className="text-4xl md:text-6xl mb-3 md:mb-4">{game.icon}</div>
                <h3 className="text-lg md:text-xl font-bold text-white mb-2">{game.name}</h3>
                <p className="text-gray-300 text-sm mb-4">{game.description}</p>
                
                {/* Staking Requirement */}
                <div className="mb-3">
                  <div className="text-xs text-gray-400 mb-1">Staking Required</div>
                  <div className="text-sm font-semibold text-yellow-400">
                    {formatStakingRequirement(game.stakingRequirement)} tokens
                  </div>
                </div>
                
                {/* Access Status */}
                {!game.isAvailable ? (
                  <div className="flex items-center justify-center space-x-2 text-yellow-400">
                    <span className="text-xs md:text-sm">🚧 Coming Soon</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2 text-green-400">
                    <span className="text-xs md:text-sm">✅ Available</span>
                  </div>
                )}
                
                {/* Progress indicator - temporarily commented out */}
                {/* {game.isAvailable && !hasAccess && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-yellow-500 to-orange-500 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${Math.min(100, (userStakedAmount / game.stakingRequirement) * 100)}%` 
                        }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {Math.round((userStakedAmount / game.stakingRequirement) * 100)}% to unlock
                    </div>
                  </div>
                )} */}
              </div>
            </div>
          );
        })}
      </div>

      {/* Additional Info */}
      <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-4 md:p-6">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-4">🎯 How Games Work</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <div className="text-center">
            <div className="text-3xl md:text-4xl mb-3">🎮</div>
            <h3 className="text-base md:text-lg font-semibold text-white mb-2">Play & Earn</h3>
            <p className="text-gray-300 text-xs md:text-sm">Complete games and earn tokens based on your performance</p>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl mb-3">🏆</div>
            <h3 className="text-base md:text-lg font-semibold text-white mb-2">Leaderboards</h3>
            <p className="text-gray-300 text-xs md:text-sm">Compete with other players and climb the rankings</p>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl mb-3">🎁</div>
            <h3 className="text-base md:text-lg font-semibold text-white mb-2">Rewards</h3>
            <p className="text-gray-300 text-xs md:text-sm">Unlock special rewards and achievements</p>
          </div>
        </div>
      </div>
    </div>
  );
}