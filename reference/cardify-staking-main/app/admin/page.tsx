'use client';

import { useState } from 'react';
import { useStaking } from '../contexts/StakingContext';

export default function AdminPage() {
  const { isAdmin, poolData, isLoading, error, initializePool, addRewardTokens, setRewardRate, setRewardConfig } = useStaking();
  const [stakingMint, setStakingMint] = useState('');
  const [rewardMint, setRewardMint] = useState('');
  const [rewardRate, setRewardRateInput] = useState('');
  const [fundAmount, setFundAmount] = useState('');
  const [newRewardRate, setNewRewardRate] = useState('');

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
          <p className="text-gray-300">Only admin wallets can access this page.</p>
        </div>
      </div>
    );
  }

  const handleInitialize = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await initializePool(stakingMint);
      // If reward mint and rate are provided, set reward config
      if (rewardMint && rewardRate) {
        await setRewardConfig(rewardMint, parseFloat(rewardRate));
      }
      alert('Pool initialized successfully!');
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleFundRewards = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addRewardTokens(parseFloat(fundAmount));
      alert('Rewards funded successfully!');
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleSetRewardRate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setRewardRate(parseFloat(newRewardRate));
      alert('Reward rate updated successfully!');
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-gray-300">Manage your staking pool</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pool Status */}
          <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Pool Status</h2>
            {poolData ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-300">Total Staked:</span>
                  <span className="text-white font-medium">{poolData.totalStaked.toLocaleString()}</span>
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
                <div className="flex justify-between">
                  <span className="text-gray-300">Last Update:</span>
                  <span className="text-white font-medium">
                    {new Date(poolData.lastUpdateTs * 1000).toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-gray-400">Pool not initialized</p>
            )}
          </div>

          {/* Initialize Pool */}
          <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Initialize Pool</h2>
            <form onSubmit={handleInitialize} className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-2">Staking Mint Address</label>
                <input
                  type="text"
                  value={stakingMint}
                  onChange={(e) => setStakingMint(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter staking token mint address"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-2">Reward Mint Address</label>
                <input
                  type="text"
                  value={rewardMint}
                  onChange={(e) => setRewardMint(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter reward token mint address"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-2">Reward Rate (per second)</label>
                <input
                  type="number"
                  value={rewardRate}
                  onChange={(e) => setRewardRateInput(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter reward rate"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50"
              >
                {isLoading ? 'Initializing...' : 'Initialize Pool'}
              </button>
            </form>
          </div>

          {/* Fund Rewards */}
          <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Fund Rewards</h2>
            <form onSubmit={handleFundRewards} className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-2">Amount to Fund</label>
                <input
                  type="number"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter amount to fund"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50"
              >
                {isLoading ? 'Funding...' : 'Fund Rewards'}
              </button>
            </form>
          </div>

          {/* Set Reward Rate */}
          <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Update Reward Rate</h2>
            <form onSubmit={handleSetRewardRate} className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-2">New Reward Rate (per second)</label>
                <input
                  type="number"
                  value={newRewardRate}
                  onChange={(e) => setNewRewardRate(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter new reward rate"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50"
              >
                {isLoading ? 'Updating...' : 'Update Reward Rate'}
              </button>
            </form>
          </div>

          {/* Pool Controls */}
          <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6 lg:col-span-2">
            <h2 className="text-xl font-semibold text-white mb-4">Pool Controls</h2>
            <div className="flex flex-wrap gap-4">
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
