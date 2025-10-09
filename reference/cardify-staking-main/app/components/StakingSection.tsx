'use client';

import { useState, useEffect } from 'react';
import { useStaking } from '../contexts/StakingContext';
import { useNotifications } from '../contexts/NotificationContext';
import { usePendingRewards } from '../hooks/usePendingRewards';
import PoolSelector from './PoolSelector';
import { formatToken } from '../utils/format';

export default function StakingSection() {
  const { walletAddress, poolData, userData, isLoading, error, stake, unstake, claim, refreshData, stakingDecimals, rewardDecimals, connection, emergencyUnstake, closeUser } = useStaking();
  const { showSuccess, showError, showWarning, showInfo } = useNotifications();
  
  // Calculate live pending rewards
  const liveRewards = usePendingRewards(poolData, userData);
  
  // Helper function to format token amounts using dynamic decimals
  const formatTokenAmount = (amount: number, decimals: number = stakingDecimals) => {
    return formatToken(amount, decimals, 0, 0); // No decimals for staked amounts
  };
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [emergencyUnstakeAmount, setEmergencyUnstakeAmount] = useState('');
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));

  // Update time every second for real-time pending rewards
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);


  const handleStake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress) {
      showWarning('Wallet Required', 'Please connect your wallet first');
      return;
    }
    
    if (poolData?.paused) {
      showWarning('Pool Paused', 'Pool is paused - staking is temporarily disabled');
      return;
    }
    
    if (isLoading) {
      console.log('⚠️ Transaction already in progress, ignoring click');
      return;
    }
    
    try {
      await stake(parseFloat(stakeAmount));
      showSuccess('Staking Successful', 'Your tokens have been staked successfully!');
      setStakeAmount('');
    } catch (err) {
      showError(
        'Staking Failed',
        err instanceof Error ? err.message : 'Unknown error occurred'
      );
    }
  };

  const handleUnstake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress) {
      showWarning('Wallet Required', 'Please connect your wallet first');
      return;
    }
    
    if (isLoading) {
      console.log('⚠️ Transaction already in progress, ignoring click');
      return;
    }
    
    // Check if user has pending rewards and warn them
    const pendingRewards = liveRewards?.pendingUI || 0;
    if (pendingRewards > 0) {
      const confirmUnstake = confirm(
        `⚠️ You have ${pendingRewards.toFixed(6)} pending rewards.\n\n` +
        `Unstaking will automatically claim these rewards first to preserve them.\n\n` +
        `Do you want to continue?`
      );
      if (!confirmUnstake) {
        return;
      }
    }
    
    try {
      await unstake(parseFloat(unstakeAmount));
      showSuccess('Unstaking Successful', 'Your tokens have been unstaked and rewards claimed!');
      setUnstakeAmount('');
    } catch (err) {
      showError(
        'Operation Failed',
        err instanceof Error ? err.message : 'Unknown error occurred'
      );
    }
  };

  const handleClaim = async () => {
    if (!walletAddress) {
      showWarning('Wallet Required', 'Please connect your wallet first');
      return;
    }
    
    if (isLoading) {
      console.log('⚠️ Transaction already in progress, ignoring click');
      return;
    }
    
    try {
      await claim();
      showSuccess('Rewards Claimed', 'Your rewards have been claimed successfully!');
    } catch (err) {
      showError(
        'Operation Failed',
        err instanceof Error ? err.message : 'Unknown error occurred'
      );
    }
  };

  const handleEmergencyUnstake = async () => {
    if (!walletAddress) {
      showWarning('Wallet Required', 'Please connect your wallet first');
      return;
    }
    
    if (!emergencyUnstakeAmount) {
      showWarning('Invalid Input', 'Please enter an amount to emergency unstake');
      return;
    }
    
    if (isLoading) {
      console.log('⚠️ Transaction already in progress, ignoring click');
      return;
    }
    
    if (!confirm('⚠️ Emergency unstake will withdraw your principal but forfeit all pending rewards. Continue?')) {
      return;
    }
    
    try {
      await emergencyUnstake(parseFloat(emergencyUnstakeAmount));
      showSuccess('Emergency Unstake Successful', 'Your tokens have been unstaked. Note: Pending rewards were forfeited.');
      setEmergencyUnstakeAmount('');
    } catch (err) {
      showError(
        'Operation Failed',
        err instanceof Error ? err.message : 'Unknown error occurred'
      );
    }
  };

  const handleCloseUser = async () => {
    if (!walletAddress) {
      showWarning('Wallet Required', 'Please connect your wallet first');
      return;
    }
    
    if (isLoading) {
      console.log('⚠️ Transaction already in progress, ignoring click');
      return;
    }
    
    if (!confirm('Are you sure you want to close your user account? This can only be done when you have no stake and no pending rewards.')) {
      return;
    }
    
    try {
      await closeUser();
      showSuccess('Account Closed', 'Your user account has been closed successfully!');
    } catch (err) {
      showError(
        'Operation Failed',
        err instanceof Error ? err.message : 'Unknown error occurred'
      );
    }
  };

  const handleRefreshData = async () => {
    if (!walletAddress) {
      showWarning('Wallet Required', 'Please connect your wallet first');
      return;
    }
    
    try {
      console.log('🔄 Manually refreshing data...');
      await refreshData();
      console.log('✅ Data refreshed');
    } catch (err) {
      console.error('❌ Failed to refresh data:', err);
      showError(
        'Data Refresh Failed',
        err instanceof Error ? err.message : 'Unknown error occurred'
      );
    }
  };




  // Constants for reward calculation
  // !!! matches the existing on-chain state (1e12 precision) !!!
  const SCALAR_BI = BigInt(1_000_000_000_000);  // 1e12 - matches deployed contract
  
  // TODO: Future improvement - derive from IDL to prevent drift:
  // const accPrecisionFromIdl = BigInt(
  //   program.idl.constants?.find(c => c.name === 'ACC_PRECISION')?.value ?? '1000000000000'
  // );
  // const SCALAR_BI = accPrecisionFromIdl;

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

    // CORRECTED: reward part that belongs to the user, already in base units
    // Multiply first, then divide by SCALAR_BI
    const earned = (staked * accHead) / SCALAR_BI;

    // pending = unpaid + earned - debt (all in base units)
    // Safety guard: prevent underflow
    const pending = earned > debt ? unpaid + earned - debt : unpaid;


    return pending > BigInt(0) ? pending : BigInt(0); // base units of reward mint
  };

  const calculatePendingRewards = (): number => {
    if (!userData || !poolData) return 0;
    
    const now = currentTime;
    
    // Use the corrected BigInt calculation with proper SCALAR_BI
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
    const pendingUi = rewardDecimals > 0 
      ? Number(rawPending) / Math.pow(10, rewardDecimals)
      : Number(rawPending);
    
    
    return pendingUi;
  };

  if (!walletAddress) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Connect Your Wallet</h1>
          <p className="text-gray-300">Please connect your wallet to access the staking dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Staking Dashboard</h1>
        <p className="text-gray-300 text-sm md:text-base">Stake your tokens and earn rewards</p>
      </div>

      <PoolSelector />

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {poolData?.paused && (
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-center space-x-2">
            <span className="text-yellow-400 text-lg">⏸️</span>
            <div className="text-center">
              <p className="text-yellow-300 font-medium">Pool is Paused</p>
              <p className="text-yellow-200 text-sm">New stakes are disabled. Claims and unstakes are still available.</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
        {/* Pool Stats */}
        <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-4 md:p-6 mobile-card">
          <h3 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4">Pool Statistics</h3>
          {poolData ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-300">Total Staked:</span>
                <span className="text-white font-medium">{formatTokenAmount(poolData.totalStaked).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Reward Rate:</span>
                <span className="text-white font-medium">{poolData.rewardRatePerSec}/sec</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Reward Mint:</span>
                <span className="text-white font-medium">
                  {poolData.rewardMint === '11111111111111111111111111111111' ? 'Not Set' : 'Configured'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-gray-400">Pool data not available</p>
          )}
        </div>

        {/* User Stats */}
        <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-4 md:p-6 mobile-card">
          <h3 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4">Your Staking</h3>
          {userData ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-300">Staked Amount:</span>
                <span className="text-white font-medium">{formatTokenAmount(userData.staked)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Pending Rewards:</span>
                <span className="text-green-400 font-medium">
                  {liveRewards ? liveRewards.pendingUI.toFixed(6) : '0.000000'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300 flex items-center">
                  Rewards Already&nbsp;Counted
                  <span className="ml-1 cursor-help" title={
                    "Internal amount already credited to you. " +
                    "Used to calculate new rewards accurately."
                  }>ⓘ</span>
                </span>
                <span className="text-white font-medium">{formatTokenAmount(Number(userData.debt))}</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-400">No staking data available</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-4 md:p-6 mobile-card">
          <h3 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button
              onClick={handleClaim}
              disabled={isLoading || !userData || calculatePendingRewards() === 0}
              className="w-full bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 touch-target"
            >
              {isLoading ? 'Processing...' : 'Claim Rewards'}
            </button>
            <button
              onClick={handleRefreshData}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 touch-target"
            >
              {isLoading ? 'Refreshing...' : 'Refresh Data'}
            </button>
          </div>
        </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Stake Tokens */}
        <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-4 md:p-6 mobile-card">
          <h2 className="text-lg md:text-xl font-semibold text-white mb-3 md:mb-4">Stake Tokens</h2>
          <form onSubmit={handleStake} className="space-y-4">
            <div>
              <label className="block text-gray-300 text-sm mb-2">Amount to Stake</label>
              <input
                type="number"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 touch-target"
                placeholder="Enter amount to stake"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !poolData || poolData?.paused}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 touch-target"
            >
              {isLoading ? 'Staking...' : !poolData ? 'Pool not initialized' : poolData.paused ? '⏸️ Pool Paused' : 'Stake Tokens'}
            </button>
            {!poolData && (
              <p className="text-red-400 text-sm mt-2">
                Pool not initialized. Please initialize the pool first in the Admin section.
              </p>
            )}
            {poolData?.paused && (
              <p className="text-yellow-400 text-sm mt-2">
                ⚠️ Pool is paused - staking is temporarily disabled. You can still claim rewards and unstake.
              </p>
            )}
          </form>
        </div>

        {/* Unstake Tokens */}
        <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-4 md:p-6 mobile-card">
          <h2 className="text-lg md:text-xl font-semibold text-white mb-3 md:mb-4">Unstake Tokens</h2>
          <form onSubmit={handleUnstake} className="space-y-4">
            <div>
              <label className="block text-gray-300 text-sm mb-2">Amount to Unstake</label>
              <input
                type="number"
                value={unstakeAmount}
                onChange={(e) => setUnstakeAmount(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 touch-target"
                placeholder="Enter amount to unstake"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !poolData || !userData || userData.staked === 0}
              className="w-full bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 touch-target"
            >
              {isLoading ? 'Unstaking...' : 'Unstake Tokens'}
            </button>
            <p className="text-blue-300 text-xs mt-2 text-center">
              💡 Unstaking will automatically claim your pending rewards first
            </p>
          </form>
        </div>

        {/* Emergency Unstake */}
        <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-4 md:p-6 mobile-card">
          <h2 className="text-lg md:text-xl font-semibold text-white mb-3 md:mb-4">Emergency Unstake</h2>
          <form onSubmit={(e) => { e.preventDefault(); handleEmergencyUnstake(); }} className="space-y-4">
            <div>
              <label className="block text-gray-300 text-sm mb-2">Amount to Emergency Unstake</label>
              <input
                type="number"
                value={emergencyUnstakeAmount}
                onChange={(e) => setEmergencyUnstakeAmount(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 touch-target"
                placeholder="Enter amount to emergency unstake"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !poolData || !userData || userData.staked === 0}
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 touch-target"
            >
              {isLoading ? 'Emergency Unstaking...' : 'Emergency Unstake'}
            </button>
            <div className="bg-red-600/20 border border-red-500/50 rounded-lg p-3">
              <div className="text-sm text-red-300">
                <strong>⚠️ WARNING:</strong> Emergency unstake will forfeit all pending rewards. Only use in emergencies.
              </div>
            </div>
          </form>
        </div>

        {/* Close User Account */}
        <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-4 md:p-6 mobile-card">
          <h2 className="text-lg md:text-xl font-semibold text-white mb-3 md:mb-4">Close User Account</h2>
          <div className="space-y-4">
            <div className="bg-yellow-600/20 border border-yellow-500/50 rounded-lg p-3">
              <div className="text-sm text-yellow-300">
                <strong>ℹ️ INFO:</strong> This will close your user account. Only available when you have no stake and no pending rewards.
              </div>
            </div>
            <button
              onClick={handleCloseUser}
              disabled={isLoading || !userData || (userData.staked ?? 0) > 0 || calculatePendingRewards() > 0}
              className="w-full bg-gradient-to-r from-gray-500 to-gray-700 hover:from-gray-600 hover:to-gray-800 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 touch-target"
            >
              {isLoading ? 'Closing...' : 'Close User Account'}
            </button>
            {((userData?.staked ?? 0) > 0 || calculatePendingRewards() > 0) && (
              <p className="text-red-400 text-sm mt-2">
                Cannot close account: You have stake or pending rewards
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
