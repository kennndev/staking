'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import { useStaking } from '../contexts/StakingContext';
import { useNotifications } from '../contexts/NotificationContext';
import { TicketService, Ticket, TicketMessage } from '../lib/supabase';
import TicketList from './TicketList';
import WalletAddress from './WalletAddress';

export default function AdminSection() {
  const { isAdmin, poolData, isLoading, error, stakingMint, stakingDecimals, initializePool, fetchPoolByMint, setStakingMint, setRewardConfig, addRewardTokens, setRewardRate, setPaused, withdrawRewards, setAdmin, ensureVaults, closePool } = useStaking();
  const { showSuccess, showError, showWarning, showInfo } = useNotifications();
  const [stakingMintInput, setStakingMintInput] = useState('');
  const [rewardMint, setRewardMint] = useState('');
  const [ratePerSec, setRatePerSec] = useState('');
  const [rewardAmount, setRewardAmount] = useState('');
  const [newRewardRate, setNewRewardRate] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [newAdminAddress, setNewAdminAddress] = useState('');
  
  // Helper function to format token amounts using dynamic decimals
  const formatTokenAmount = (amount: number, decimals: number = stakingDecimals) => {
    return (amount / Math.pow(10, decimals)).toFixed(0);
  };

  const handlePauseToggle = async () => {
    if (!poolData) return;
    
    try {
      await setPaused(!poolData.paused);
      showSuccess(
        'Pool Status Updated',
        `Pool has been ${poolData.paused ? 'unpaused' : 'paused'} successfully!`
      );
    } catch (err) {
      showError(
        'Failed to Update Pool Status',
        err instanceof Error ? err.message : 'Unknown error occurred'
      );
    }
  };

  const handleWithdrawRewards = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawAmount) {
      showWarning('Invalid Input', 'Please enter an amount to withdraw');
      return;
    }
    
    try {
      await withdrawRewards(parseFloat(withdrawAmount));
      showSuccess('Rewards Withdrawn', 'Rewards have been withdrawn successfully!');
      setWithdrawAmount('');
    } catch (err) {
      showError(
        'Withdrawal Failed',
        err instanceof Error ? err.message : 'Unknown error occurred'
      );
    }
  };

  const handleSetAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminAddress) {
      showWarning('Invalid Input', 'Please enter a new admin address');
      return;
    }
    
    try {
      await setAdmin(newAdminAddress);
      showSuccess('Admin Updated', 'Admin privileges have been transferred successfully!');
      setNewAdminAddress('');
    } catch (err) {
      showError(
        'Admin Update Failed',
        err instanceof Error ? err.message : 'Unknown error occurred'
      );
    }
  };

  const handleEnsureVaults = async () => {
    try {
      await ensureVaults();
      showSuccess('Vaults Ensured', 'All vaults have been created/verified successfully!');
    } catch (err) {
      showError(
        'Vault Operation Failed',
        err instanceof Error ? err.message : 'Unknown error occurred'
      );
    }
  };

  const handleClosePool = async () => {
    if (!confirm('Are you sure you want to close the pool? This action cannot be undone!')) {
      return;
    }
    
    try {
      await closePool();
      showSuccess('Pool Closed', 'Pool has been permanently closed successfully!');
    } catch (err) {
      showError(
        'Pool Closure Failed',
        err instanceof Error ? err.message : 'Unknown error occurred'
      );
    }
  };
  
  // Ticket management state
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [adminReply, setAdminReply] = useState('');
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);

  // Load all tickets on component mount
  useEffect(() => {
    if (isAdmin) {
      loadAllTickets();
    }
  }, [isAdmin]);

  const loadAllTickets = async () => {
    setTicketsLoading(true);
    setTicketsError(null);
    
    try {
      const tickets = await TicketService.getAllTickets();
      setAllTickets(tickets);
    } catch (err) {
      console.error('Error loading tickets:', err);
      setTicketsError('Failed to load tickets. Please try again.');
    } finally {
      setTicketsLoading(false);
    }
  };

  const loadTicketMessages = async (ticketId: string) => {
    try {
      const messages = await TicketService.getTicketMessages(ticketId);
      setTicketMessages(messages);
    } catch (err) {
      console.error('Error loading ticket messages:', err);
      setTicketsError('Failed to load ticket messages.');
    }
  };

  const handleTicketSelect = useCallback(async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    await loadTicketMessages(ticket.id);
  }, []);

  const handleAdminReply = async () => {
    if (!selectedTicket || !adminReply.trim()) return;

    setTicketsLoading(true);
    setTicketsError(null);

    try {
      await TicketService.addAdminResponse(
        selectedTicket.id,
        adminReply,
        'Admin' // You can use the actual admin wallet address here
      );

      // Reload messages
      await loadTicketMessages(selectedTicket.id);
      setAdminReply('');
    } catch (err) {
      console.error('Error sending admin reply:', err);
      setTicketsError('Failed to send reply. Please try again.');
    } finally {
      setTicketsLoading(false);
    }
  };

  const handleUpdateTicketStatus = async (ticketId: string, status: 'open' | 'in-progress' | 'resolved' | 'closed') => {
    try {
      await TicketService.updateTicketStatus(ticketId, status);
      await loadAllTickets(); // Refresh the tickets list
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status });
      }
    } catch (err) {
      console.error('Error updating ticket status:', err);
      setTicketsError('Failed to update ticket status.');
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
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
      await initializePool(stakingMintInput);
      showSuccess('Pool Initialized', 'Pool has been initialized successfully!');
      setStakingMintInput('');
    } catch (err) {
      showError(
        'Pool Initialization Failed',
        err instanceof Error ? err.message : 'Unknown error occurred'
      );
    }
  };

  const handleSetRewardConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setRewardConfig(rewardMint, parseFloat(ratePerSec));
      showSuccess('Reward Configuration Set', 'Reward configuration has been set successfully!');
      setRewardMint('');
      setRatePerSec('');
    } catch (err) {
      showError(
        'Pool Initialization Failed',
        err instanceof Error ? err.message : 'Unknown error occurred'
      );
    }
  };

  const handleAddRewardTokens = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log('🔄 Adding reward tokens...');
      await addRewardTokens(parseFloat(rewardAmount));
      console.log('✅ Reward tokens added successfully!');
      showSuccess('Reward Tokens Added', 'Reward tokens have been added successfully!');
      setRewardAmount('');
    } catch (err) {
      console.error('❌ Failed to add reward tokens:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      if (errorMessage.includes('already been processed')) {
        showInfo('Transaction Processed', 'Transaction was already processed. Please refresh the page and check if tokens were added.');
      } else if (errorMessage.includes('wait a few seconds')) {
        showWarning('Please Wait', 'Please wait a few seconds before submitting another transaction.');
      } else {
        showError('Transaction Failed', errorMessage);
      }
    }
  };


  const handleFetchPool = async () => {
    if (!stakingMintInput) {
      showWarning('Invalid Input', 'Please enter a staking mint address first');
      return;
    }
    try {
      await fetchPoolByMint(stakingMintInput);
      showSuccess('Pool Data Fetched', 'Pool data has been fetched successfully!');
    } catch (err) {
      showError(
        'Pool Initialization Failed',
        err instanceof Error ? err.message : 'Unknown error occurred'
      );
    }
  };

  const handleSetStakingMint = async () => {
    if (!stakingMintInput) {
      showWarning('Invalid Input', 'Please enter a staking mint address first');
      return;
    }
    try {
      setStakingMint(stakingMintInput);
      showSuccess('Staking Mint Set', 'Staking mint has been set successfully!');
    } catch (err) {
      showError(
        'Pool Initialization Failed',
        err instanceof Error ? err.message : 'Unknown error occurred'
      );
    }
  };

  const handleSetRewardRate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setRewardRate(parseFloat(newRewardRate));
      showSuccess('Reward Rate Updated', 'Reward rate has been updated successfully!');
      setNewRewardRate('');
    } catch (err) {
      showError(
        'Pool Initialization Failed',
        err instanceof Error ? err.message : 'Unknown error occurred'
      );
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
        <p className="text-gray-300">Manage your staking pool</p>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {/* Current Staking Mint */}
      <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">Current Staking Mint</h2>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Current Mint:</span>
            <span className="text-white font-medium">
              {stakingMint ? `${stakingMint.slice(0, 8)}...${stakingMint.slice(-8)}` : 'Not Set'}
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={stakingMintInput}
              onChange={(e) => setStakingMintInput(e.target.value)}
              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter new staking mint address"
            />
            <button
              onClick={handleSetStakingMint}
              disabled={isLoading || !stakingMintInput}
              className="bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50"
            >
              Set Mint
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pool Status */}
        <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Pool Status</h2>
          {poolData ? (
            <>
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
                    {poolData.rewardMint === '11111111111111111111111111111111' ? 'Not Set' : poolData.rewardMint.slice(0, 8) + '...'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Last Update:</span>
                  <span className="text-white font-medium">
                    {new Date(poolData.lastUpdateTs * 1000).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Status:</span>
                  <span className={`font-medium ${poolData.paused ? 'text-yellow-400' : 'text-green-400'}`}>
                    {poolData.paused ? '⏸️ Paused' : '▶️ Active'}
                  </span>
                </div>
              </div>
              
              {/* Pause/Unpause Controls */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <button
                  onClick={handlePauseToggle}
                  disabled={isLoading}
                  className={`w-full font-medium py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 ${
                    poolData.paused 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'
                      : 'bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white'
                  }`}
                >
                  {isLoading ? 'Processing...' : poolData.paused ? '▶️ Unpause Pool' : '⏸️ Pause Pool'}
                </button>
                {poolData.paused && (
                  <p className="text-yellow-300 text-xs mt-2 text-center">
                    Pool is paused - new stakes blocked, claims & unstakes allowed
                  </p>
                )}
              </div>
            </>
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
                value={stakingMintInput}
                onChange={(e) => setStakingMintInput(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter staking token mint address"
                required
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50"
              >
                {isLoading ? 'Initializing...' : 'Initialize Pool'}
              </button>
              <button
                type="button"
                onClick={handleFetchPool}
                disabled={isLoading || !stakingMintInput}
                className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50"
              >
                {isLoading ? 'Loading...' : 'Fetch Pool'}
              </button>
            </div>
          </form>
        </div>

            {/* Set Reward Configuration */}
            <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Set Reward Configuration</h2>
              <form onSubmit={handleSetRewardConfig} className="space-y-4">
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
                  <label className="block text-gray-300 text-sm mb-2">Rate Per Second</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={ratePerSec}
                    onChange={(e) => setRatePerSec(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter rate per second (e.g., 0.000001)"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Example: 0.000001 = 1 token per 1,000,000 seconds ≈ 0.0864 tokens/day
                  </p>
                </div>
                <div className="bg-blue-600/20 border border-blue-500/50 rounded-lg p-3">
                  <div className="text-sm text-white">
                    <strong>APY Calculation:</strong> {ratePerSec ? `${(parseFloat(ratePerSec) * 31536000).toFixed(6)}%` : '0%'} annual rate
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50"
                >
                  {isLoading ? 'Setting...' : 'Set Reward Config'}
                </button>
              </form>
            </div>

            {/* Update Rate */}
            <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">⚡ Update Reward Rate</h2>
              <div className="space-y-4">
                <div className="bg-blue-600/20 border border-blue-500/50 rounded-lg p-3">
                  <div className="text-sm text-white">
                    <strong>Current Rate:</strong> {poolData?.rewardRatePerSec || 0} base units/sec = {(poolData?.rewardRatePerSec || 0) / Math.pow(10, 6)} tokens/sec
                  </div>
                  <div className="text-sm text-white">
                    <strong>Pool Generates:</strong> {(poolData?.rewardRatePerSec || 0) / Math.pow(10, 6)} tokens/sec for ALL stakers (not just you)
                  </div>
                  <div className="text-sm text-white">
                    <strong>Daily Pool Rewards:</strong> {((poolData?.rewardRatePerSec || 0) / Math.pow(10, 6) * 86400).toFixed(6)} tokens/day total
                  </div>
                  <div className="text-sm text-white">
                    <strong>Your Share Depends On:</strong> Your staked amount vs total pool size
                  </div>
                  <div className="text-sm text-white">
                    <strong>Current APY:</strong> {poolData?.rewardRatePerSec && poolData.rewardRatePerSec > 0 ? 
                      `${((poolData.rewardRatePerSec * 31536000) / (poolData.totalStaked || 1) * 100).toFixed(6)}%` : 
                      '0% (rate is 0)'
                    }
                  </div>
                </div>
                <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3">
                  <div className="text-sm text-yellow-300">
                    <strong>💡 Quick Rate Suggestions:</strong>
                  </div>
                  <div className="text-sm text-yellow-300 mt-1">
                    • <strong>0.5 tokens/sec</strong> = Good for testing (high rewards)
                  </div>
                  <div className="text-sm text-yellow-300">
                    • <strong>0.01 tokens/sec</strong> = Moderate rewards
                  </div>
                  <div className="text-sm text-yellow-300">
                    • <strong>0.001 tokens/sec</strong> = Low rewards (current: 0.0001)
                  </div>
                </div>
                <form onSubmit={handleSetRewardRate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      New Reward Rate (per second)
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      value={newRewardRate}
                      onChange={(e) => setNewRewardRate(e.target.value)}
                      className="w-full bg-gradient-to-r from-white/5 to-white/10 border-2 border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-white/30 shadow-lg"
                      placeholder="Enter new reward rate per second"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none disabled:hover:scale-100"
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Updating...</span>
                      </div>
                    ) : (
                      'Update Reward Rate'
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* Add Reward Tokens */}
            <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Add Reward Tokens</h2>
              <form onSubmit={handleAddRewardTokens} className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-2">Amount to Add</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={rewardAmount}
                    onChange={(e) => setRewardAmount(e.target.value)}
                    className="w-full bg-gradient-to-r from-white/5 to-white/10 border-2 border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 hover:border-white/30 shadow-lg"
                    placeholder="Enter amount of reward tokens to add"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    This will transfer tokens from your wallet to the reward vault
                  </p>
                </div>
                <div className="bg-blue-600/20 border border-blue-500/50 rounded-lg p-3">
                  <div className="text-sm text-white">
                    <strong>Current Reward Mint:</strong> {poolData?.rewardMint ?
                      `${poolData.rewardMint.slice(0, 8)}...${poolData.rewardMint.slice(-8)}` :
                      'Not set'
                    }
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading || !poolData?.rewardMint || poolData.rewardMint === '11111111111111111111111111111111'}
                  className="w-full bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none disabled:hover:scale-100"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Adding...</span>
                    </div>
                  ) : (
                    'Add Reward Tokens'
                  )}
                </button>
                {(!poolData?.rewardMint || poolData.rewardMint === '11111111111111111111111111111111') && (
                  <p className="text-red-400 text-sm mt-2">
                    Please set reward configuration first
                  </p>
                )}
              </form>
            </div>

            {/* Withdraw Rewards */}
            <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Withdraw Rewards</h2>
              <form onSubmit={handleWithdrawRewards} className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-2">Amount to Withdraw</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full bg-gradient-to-r from-white/5 to-white/10 border-2 border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 hover:border-white/30 shadow-lg"
                    placeholder="Enter amount of reward tokens to withdraw"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Only works when pool is paused. Withdraws tokens from reward vault to your wallet.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={isLoading || !poolData?.paused}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none disabled:hover:scale-100"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Withdrawing...</span>
                    </div>
                  ) : (
                    'Withdraw Rewards'
                  )}
                </button>
                {!poolData?.paused && (
                  <p className="text-red-400 text-sm mt-2">
                    Pool must be paused to withdraw rewards
                  </p>
                )}
              </form>
            </div>

            {/* Set Admin */}
            <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Set New Admin</h2>
              <form onSubmit={handleSetAdmin} className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-2">New Admin Address</label>
                  <input
                    type="text"
                    value={newAdminAddress}
                    onChange={(e) => setNewAdminAddress(e.target.value)}
                    className="w-full bg-gradient-to-r from-white/5 to-white/10 border-2 border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 hover:border-white/30 shadow-lg"
                    placeholder="Enter new admin wallet address"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    This will transfer admin privileges to the new address
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none disabled:hover:scale-100"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Updating...</span>
                    </div>
                  ) : (
                    'Set New Admin'
                  )}
                </button>
              </form>
            </div>

            {/* Ensure Vaults */}
            <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Ensure Vaults</h2>
              <div className="space-y-4">
                <p className="text-gray-300 text-sm">
                  Recreate any missing Associated Token Accounts (ATAs) for the pool vaults.
                </p>
                <button
                  onClick={handleEnsureVaults}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none disabled:hover:scale-100"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Ensuring...</span>
                    </div>
                  ) : (
                    'Ensure Vaults'
                  )}
                </button>
              </div>
            </div>

            {/* Close Pool */}
            <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Close Pool</h2>
              <div className="space-y-4">
                <div className="bg-red-600/20 border border-red-500/50 rounded-lg p-3">
                  <div className="text-sm text-red-300">
                    <strong>⚠️ DANGER:</strong> This will permanently close the pool and close all vaults.
                    Only use when pool is paused and all stakes are withdrawn.
                  </div>
                </div>
                <button
                  onClick={handleClosePool}
                  disabled={isLoading || !poolData?.paused}
                  className="w-full bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none disabled:hover:scale-100"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Closing...</span>
                    </div>
                  ) : (
                    'Close Pool'
                  )}
                </button>
                {!poolData?.paused && (
                  <p className="text-red-400 text-sm mt-2">
                    Pool must be paused to close
                  </p>
                )}
              </div>
            </div>
          </div>

      {/* Support Tickets Management */}
      <div className="mt-8">
        <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-white">Support Tickets Management</h2>
            <button
              onClick={loadAllTickets}
              disabled={ticketsLoading}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-all duration-200"
            >
              {ticketsLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {ticketsError && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
              <p className="text-red-300 text-sm">{ticketsError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {/* Tickets List */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-3 sm:p-4">
              <h3 className="text-lg font-semibold text-white mb-4">All Tickets ({allTickets.length})</h3>
              <TicketList
                tickets={allTickets}
                onTicketSelect={handleTicketSelect}
                selectedTicket={selectedTicket}
                isLoading={ticketsLoading}
              />
            </div>

            {/* Ticket Details */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-3 sm:p-4">
              {selectedTicket ? (
                <div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 space-y-2 sm:space-y-0">
                    <h3 className="text-lg font-semibold text-white">Ticket Details</h3>
                    <div className="flex space-x-2">
                      <select
                        value={selectedTicket.status}
                        onChange={(e) => handleUpdateTicketStatus(selectedTicket.id, e.target.value as any)}
                        className="bg-black/50 border border-white/20 rounded px-2 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
                      >
                        <option value="open">Open</option>
                        <option value="in-progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="text-white font-medium">{selectedTicket.subject}</h4>
                    <p className="text-sm text-gray-300 mt-1">{selectedTicket.description}</p>
                    <div className="text-xs text-gray-400 mt-2 break-long-text overflow-hidden">
                      <span className="text-gray-400">From: </span>
                      <WalletAddress address={selectedTicket.wallet_address} className="text-blue-400 hover:text-blue-300" />
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="mb-4">
                    <h5 className="text-white font-medium mb-2">Messages</h5>
                    <div className="bg-black/20 rounded-lg p-3 max-h-48 overflow-y-auto">
                      <div className="space-y-3">
                        {ticketMessages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${message.is_user ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg px-3 py-2 rounded-lg break-words ${
                                message.is_user
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-white/10 text-gray-100'
                              }`}
                            >
                              <p className="text-sm break-words">{message.message_text}</p>
                              <p className="text-xs opacity-70 mt-1 break-words">
                                {message.sender.length > 20 ? `${message.sender.slice(0, 8)}...${message.sender.slice(-8)}` : message.sender} • {new Date(message.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Admin Reply */}
                  <div>
                    <h5 className="text-white font-medium mb-2">Admin Reply</h5>
                    {selectedTicket.status === 'closed' ? (
                      <div className="bg-gray-600/20 border border-gray-500/50 rounded-lg p-4 text-center">
                        <p className="text-gray-400 text-sm">
                          This ticket is closed. Admin replies are disabled.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                        <input
                          type="text"
                          value={adminReply}
                          onChange={(e) => setAdminReply(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAdminReply()}
                          placeholder="Type your response..."
                          className="flex-1 bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={handleAdminReply}
                          disabled={!adminReply.trim() || ticketsLoading}
                          className="bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-all duration-200 w-full sm:w-auto"
                        >
                          {ticketsLoading ? 'Sending...' : 'Send'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400">Select a ticket to view details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
