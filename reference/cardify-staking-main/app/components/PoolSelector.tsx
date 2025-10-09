'use client';

import { useState } from 'react';
import { useStaking } from '../contexts/StakingContext';

export default function PoolSelector() {
  const { poolData, stakingMint, fetchPoolByMint, isLoading, error } = useStaking();
  const [mintInput, setMintInput] = useState('');

  const handleFetchPool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mintInput.trim()) return;
    
    try {
      await fetchPoolByMint(mintInput.trim());
    } catch (err) {
      console.error('Failed to fetch pool:', err);
    }
  };

  if (poolData) {
    return null; // Hide the green debugging box
  }

  return (
    <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-6">
      <h3 className="text-yellow-300 font-medium mb-3">Connect to Pool</h3>
      <p className="text-yellow-200 text-sm mb-4">
        Enter the staking token mint address to connect to an existing pool.
      </p>
      
      <form onSubmit={handleFetchPool} className="flex gap-2">
        <input
          type="text"
          value={mintInput}
          onChange={(e) => setMintInput(e.target.value)}
          className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500"
          placeholder="Enter staking token mint address"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !mintInput.trim()}
          className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Connect'}
        </button>
      </form>
      
      {error && (
        <p className="text-red-300 text-sm mt-2">{error}</p>
      )}
    </div>
  );
}
