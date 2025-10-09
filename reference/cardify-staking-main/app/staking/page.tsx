'use client';

import { useState } from 'react';
import { useStaking } from '../contexts/StakingContext';
import RewardExplanation from '../components/RewardExplanation';

export default function StakingPage() {
  const { walletAddress, poolData, userData, isLoading, error, stake, unstake, claim, refreshData, stakingDecimals, rewardDecimals } = useStaking();
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');

  const handleStake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress) {
      alert('Please connect your wallet first');
      return;
    }
    
    try {
      await stake(parseFloat(stakeAmount));
      alert('Staked successfully!');
      setStakeAmount('');
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleUnstake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress) {
      alert('Please connect your wallet first');
      return;
    }
    
    try {
      await unstake(parseFloat(unstakeAmount));
      alert('Unstaked successfully!');
      setUnstakeAmount('');
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleClaim = async () => {
    if (!walletAddress) {
      alert('Please connect your wallet first');
      return;
    }
    
    try {
      await claim();
      alert('Rewards claimed successfully!');
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Constants for reward calculation
  const SCALAR_BI = BigInt(1_000_000_000_000);

  const computePending = ({
    pool,
    user,
    nowSecs
  }: {
    pool: { accScaled: string; lastUpdateTs: number; rewardRatePerSec: number; totalStaked: number };
    user: { staked: number; debt: string; unpaidRewards: string };
    nowSecs: number;
  }) => {
    if (!pool || !user || pool.totalStaked === 0) return BigInt(0);

    const accScaled = BigInt(pool.accScaled ?? "0");
    const debt = BigInt(user.debt ?? "0");
    const unpaid = BigInt(user.unpaidRewards ?? "0");
    const staked = BigInt(user.staked ?? 0);

    const dt = BigInt(Math.max(0, nowSecs - (pool.lastUpdateTs ?? nowSecs)));
    const rate = BigInt(pool.rewardRatePerSec ?? 0);
    const totalStaked = BigInt(pool.totalStaked ?? 0);

    // head-of-line accumulator: accScaled + (rate * dt / totalStaked) * SCALAR
    const accHead = accScaled + (rate * dt * SCALAR_BI) / (totalStaked === BigInt(0) ? BigInt(1) : totalStaked);

    // pending = unpaid + staked * (accHead - debt) / SCALAR
    const delta = accHead > debt ? accHead - debt : BigInt(0);
    const pending = unpaid + (staked * delta) / SCALAR_BI;

    return pending; // base units of reward mint
  };

  const calculatePendingRewards = () => {
    if (!userData || !poolData) return 0;
    
    const now = Math.floor(Date.now() / 1000);
    const rawPending = computePending({
      pool: {
        accScaled: poolData.accScaled,
        lastUpdateTs: poolData.lastUpdateTs,
        rewardRatePerSec: poolData.rewardRatePerSec,
        totalStaked: poolData.totalStaked,
      },
      user: {
        staked: userData.staked,
        debt: userData.debt,
        unpaidRewards: userData.unpaidRewards,
      },
      nowSecs: now,
    });

    // Convert to UI using the reward mint decimals
    return rewardDecimals > 0 
      ? Number(rawPending) / Math.pow(10, rewardDecimals)
      : Number(rawPending);
  };

  // Helper function to format token amounts using dynamic decimals
  const formatTokenAmount = (amount: number, decimals: number = stakingDecimals) => {
    return (amount / Math.pow(10, decimals)).toFixed(0);
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Staking Dashboard</h1>
          <p className="text-gray-300">Stake your tokens and earn rewards</p>
        </div>
        
        <RewardExplanation />

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Pool Stats */}
          <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Pool Statistics</h3>
            {poolData ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-300">Total Staked:</span>
                  <span className="text-white font-medium">{formatTokenAmount(poolData.totalStaked)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Reward Rate:</span>
                  <span className="text-white font-medium">{poolData.rewardRatePerSec}/sec</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Status:</span>
                  <span className="font-medium text-green-400">
                    Active
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-gray-400">Pool data not available</p>
            )}
          </div>

          {/* User Stats */}
          <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Your Staking</h3>
            {!walletAddress ? (
              <div className="text-center py-4">
                <p className="text-gray-400 mb-2">Connect your wallet to view your staking data</p>
                <p className="text-sm text-gray-500">Use the wallet connection button in the header</p>
              </div>
            ) : userData ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-300">Staked Amount:</span>
                  <span className="text-white font-medium">{formatTokenAmount(userData.staked)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Pending Rewards:</span>
                  <span className="text-green-400 font-medium">{formatTokenAmount(calculatePendingRewards())}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Reward Debt:</span>
                  <span className="text-white font-medium">{userData.debt}</span>
                </div>
              </div>
            ) : (
              <p className="text-gray-400">No staking data available</p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
            {!walletAddress ? (
              <div className="text-center py-4">
                <p className="text-gray-400 mb-2">Connect your wallet to access staking actions</p>
                <p className="text-sm text-gray-500">Use the wallet connection button in the header</p>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={handleClaim}
                  disabled={isLoading || !userData || calculatePendingRewards() === 0}
                  className="w-full bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50"
                >
                  {isLoading ? 'Processing...' : 'Claim Rewards'}
                </button>
                <button
                  onClick={refreshData}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50"
                >
                  {isLoading ? 'Refreshing...' : 'Refresh Data'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Stake Tokens */}
          <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Stake Tokens</h2>
            {!walletAddress ? (
              <div className="text-center py-4">
                <p className="text-gray-400 mb-2">Connect your wallet to stake tokens</p>
                <p className="text-sm text-gray-500">Use the wallet connection button in the header</p>
              </div>
            ) : (
              <form onSubmit={handleStake} className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-2">Amount to Stake</label>
                  <input
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter amount to stake"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading || !poolData}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50"
                >
                  {isLoading ? 'Staking...' : 'Stake Tokens'}
                </button>
              </form>
            )}
          </div>

          {/* Unstake Tokens */}
          <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Unstake Tokens</h2>
            {!walletAddress ? (
              <div className="text-center py-4">
                <p className="text-gray-400 mb-2">Connect your wallet to unstake tokens</p>
                <p className="text-sm text-gray-500">Use the wallet connection button in the header</p>
              </div>
            ) : (
              <form onSubmit={handleUnstake} className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-2">Amount to Unstake</label>
                  <input
                    type="number"
                    value={unstakeAmount}
                    onChange={(e) => setUnstakeAmount(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter amount to unstake"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading || !poolData || !userData || userData.staked === 0}
                  className="w-full bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50"
                >
                  {isLoading ? 'Unstaking...' : 'Unstake Tokens'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
