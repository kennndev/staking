'use client';

import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardCards from './components/DashboardCards';
import Navigation from './components/Navigation';
import TokenAnalytics from './components/TokenAnalytics';
import StakingSection from './components/StakingSection';
import AdminSection from './components/AdminSection';
import GamesSection from './components/GamesSection';
import MessagesSection from './components/MessagesSection';
import SupportSection from './components/SupportSection';
import { useStaking } from './contexts/StakingContext';

export default function Home() {
  const [activeSection, setActiveSection] = useState('DASHBOARD');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { poolData, userData, stakingDecimals, rewardDecimals } = useStaking();

  // Helper function to format token amounts using dynamic decimals
  const formatTokenAmount = (amount: number, decimals: number = stakingDecimals) => {
    return (amount / Math.pow(10, decimals)).toFixed(0);
  };

  // Log APY calculation details
  if (poolData) {
    const ratePerSec = poolData.rewardRatePerSec || 0;
    const totalStakedRaw = poolData.totalStaked || 0;
    const totalStakedFormatted = formatTokenAmount(totalStakedRaw);
    const secondsPerYear = 31536000;
    const apy = totalStakedRaw > 0 ? (ratePerSec * secondsPerYear / totalStakedRaw * 100) : 0;
    
    console.log('Dashboard APY Calculation:', {
      ratePerSec,
      totalStaked: totalStakedRaw,
      totalStakedFormatted,
      secondsPerYear,
      apy: apy.toFixed(6) + '%',
      formula: `(${ratePerSec} * ${secondsPerYear} / ${totalStakedRaw}) * 100 = ${apy.toFixed(6)}%`,
      poolData: {
        poolAddress: poolData.poolAddress,
        rewardMint: poolData.rewardMint,
        stakingMint: poolData.stakingMint
      }
    });
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'TOKEN ANALYTICS':
        return <TokenAnalytics />;
      case 'STAKING':
        return <StakingSection />;
      case 'GAMES':
        return <GamesSection />;
      case 'ADMIN':
        return <AdminSection />;
      case 'MESSAGES':
        return <MessagesSection />;
      case 'SUPPORT':
        return <SupportSection />;
      default:
        return (
          <>
            {/* Navigation */}
            <Navigation />
            
            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
              <DashboardCards />
            </div>
            
            {/* APY Rate Display */}
            <div className="mb-6 md:mb-8">
              <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 backdrop-blur-sm border border-yellow-500/30 rounded-xl p-4 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-white mb-2">Current APY Rate</h2>
                    <p className="text-gray-300 text-sm md:text-base">Annual Percentage Yield for staking rewards</p>
                  </div>
                  <div className="text-left md:text-right">
                    <div className="text-3xl md:text-4xl font-bold text-yellow-400">
                      {poolData && poolData.totalStaked > 0 ? 
                        `${((poolData.rewardRatePerSec || 0) * 31536000 / poolData.totalStaked * 100).toFixed(2)}%` : 
                        '0%'}
                    </div>
                    <div className="text-sm text-gray-300">
                      Rate: {poolData ? `${poolData.rewardRatePerSec || 0}/sec` : '0/sec'}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Total Staked: {poolData ? formatTokenAmount(poolData.totalStaked) : '0'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Staking Analytics Charts */}
            <div className="space-y-4 md:space-y-6">
              {/* First Row - Two Large Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                {/* Staking Performance Chart */}
                <div className="card-gradient rounded-xl p-4 md:p-6 border border-white/10">
                  <div className="flex items-center justify-between mb-4 md:mb-6">
                    <h3 className="text-lg md:text-xl font-bold text-white">STAKING PERFORMANCE</h3>
                    <div className="flex space-x-2">
                      <button className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center">
                        <span className="text-white text-xs">+</span>
                      </button>
                      <button className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center">
                        <span className="text-white text-xs">×</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Horizontal Bar Chart */}
                  <div className="space-y-4">
                    {(() => {
                      // Calculate real performance metrics
                      const totalStaked = poolData ? formatTokenAmount(poolData.totalStaked || 0) : '0';
                      const userStaked = userData ? formatTokenAmount(userData.staked || 0) : '0';
                      const rewardRate = poolData ? poolData.rewardRatePerSec || 0 : 0;
                      const apy = poolData && poolData.totalStaked > 0 ? 
                        ((poolData.rewardRatePerSec || 0) * 31536000 / poolData.totalStaked * 100) : 0;
                      
                      // Calculate percentages (normalize to 0-100 scale)
                      const totalStakedPercent = Math.min(100, Math.max(0, (parseInt(totalStaked) / 1000) * 10)); // Scale based on 1000 tokens = 100%
                      const rewardRatePercent = Math.min(100, Math.max(0, (rewardRate / 1000) * 100)); // Scale based on 1000/sec = 100%
                      const poolHealthPercent = 95; // Assume healthy pool
                      const activeUsersPercent = 78; // Placeholder - would need user count data
                      const apyPercent = Math.min(100, Math.max(0, apy / 50 * 100)); // Scale based on 50% APY = 100%
                      
                      return [
                        { label: 'TOTAL STAKED', value: Math.round(totalStakedPercent), color: 'bg-pink-500', display: `${totalStaked} tokens` },
                        { label: 'REWARD RATE', value: Math.round(rewardRatePercent), color: 'bg-purple-500', display: `${rewardRate}/sec` },
                        { label: 'POOL HEALTH', value: poolHealthPercent, color: 'bg-teal-500', display: 'Healthy' },
                        { label: 'ACTIVE USERS', value: activeUsersPercent, color: 'bg-blue-500', display: 'Active' },
                        { label: 'APY ESTIMATE', value: Math.round(apyPercent), color: 'bg-green-500', display: `${apy.toFixed(2)}%` }
                      ].map((item, index) => (
                        <div key={index} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-300">{item.label}</span>
                            <span className="text-white font-medium">{item.display}</span>
                          </div>
                          <div className="w-full bg-white/10 rounded-full h-3">
                            <div 
                              className={`h-3 rounded-full ${item.color}`}
                              style={{ width: `${item.value}%` }}
                            ></div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Staking Overview Chart */}
                <div className="card-gradient rounded-xl p-4 md:p-6 border border-white/10">
                  <div className="flex items-center justify-between mb-4 md:mb-6">
                    <h3 className="text-lg md:text-xl font-bold text-white">STAKING OVERVIEW</h3>
                    <div className="flex space-x-2">
                      <button className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center">
                        <span className="text-white text-xs">+</span>
                      </button>
                      <button className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center">
                        <span className="text-white text-xs">×</span>
                      </button>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-6xl font-bold text-white mb-4">
                      {userData ? formatTokenAmount(userData.staked || 0) : '0'}
                    </div>
                    <div className="text-sm text-gray-300 mb-6">TOKENS STAKED</div>
                    
                    {/* Waveform Chart */}
                    <div className="flex items-end justify-center space-x-1 h-16">
                      {[2, 4, 6, 8, 5, 3, 7, 9, 6, 4, 8, 5, 3, 6, 4, 2, 5, 7, 9, 6].map((height, index) => (
                        <div
                          key={index}
                          className="bg-blue-500 rounded-t"
                          style={{ height: `${height * 4}px`, width: '4px' }}
                        ></div>
                      ))}
                    </div>
                    
                    <div className="flex justify-between text-xs text-gray-400 mt-4">
                      <span>Total Pool</span>
                      <span>Your Stake</span>
                      <span>Rate/sec</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Second Row - Four Medium Charts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {/* Portfolio Distribution */}
                <div className="card-gradient rounded-xl p-6 border border-white/10">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">PORTFOLIO</h3>
                    <div className="flex space-x-2">
                      <button className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center">
                        <span className="text-white text-xs">+</span>
                      </button>
                      <button className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center">
                        <span className="text-white text-xs">×</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Donut Chart */}
                  <div className="relative w-24 h-24 mx-auto mb-4">
                    <div className="absolute inset-0 rounded-full border-8 border-teal-500"></div>
                    <div className="absolute inset-0 rounded-full border-8 border-pink-500 border-t-0"></div>
                    <div className="absolute inset-0 rounded-full border-8 border-orange-500 border-t-0 border-r-0"></div>
                    <div className="absolute inset-0 rounded-full border-8 border-purple-500 border-t-0 border-r-0 border-b-0"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">
                        {userData ? formatTokenAmount(userData.staked || 0) : '0'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-300">{poolData ? formatTokenAmount(poolData.totalStaked || 0) : '0'} total</span>
                      <span className="text-teal-400">●</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">{userData ? formatTokenAmount(userData.staked || 0) : '0'} your stake</span>
                      <span className="text-pink-400">●</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">{poolData ? poolData.rewardRatePerSec || 0 : 0}/sec rate</span>
                      <span className="text-orange-400">●</span>
                    </div>
                  </div>
                </div>

                {/* Staking Performance */}
                <div className="card-gradient rounded-xl p-6 border border-white/10">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white">STAKING</h3>
                    <div className="flex space-x-2">
                      <button className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center">
                        <span className="text-white text-xs">+</span>
                      </button>
                      <button className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center">
                        <span className="text-white text-xs">×</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Vertical Bar Chart */}
                  <div className="flex items-end justify-between h-16 space-x-2">
                    {(() => {
                      // Calculate real metrics for bar heights
                      const totalStaked = poolData ? parseInt(formatTokenAmount(poolData.totalStaked || 0)) : 0;
                      const userStaked = userData ? parseInt(formatTokenAmount(userData.staked || 0)) : 0;
                      const rewardRate = poolData ? poolData.rewardRatePerSec || 0 : 0;
                      const poolHealth = 95; // Assume healthy pool
                      
                      // Normalize to 0-60 scale for bar heights (reduced from 100)
                      const poolHeight = Math.min(60, Math.max(8, (totalStaked / 1000) * 60));
                      const stakeHeight = Math.min(60, Math.max(8, (userStaked / 100) * 60));
                      const rateHeight = Math.min(60, Math.max(8, (rewardRate / 100) * 60));
                      const healthHeight = Math.min(60, Math.max(8, (poolHealth / 100) * 60));
                      
                      return [
                        { height: poolHeight, color: 'bg-teal-500', label: 'POOL', value: totalStaked },
                        { height: stakeHeight, color: 'bg-yellow-500', label: 'STAKE', value: userStaked },
                        { height: rateHeight, color: 'bg-pink-500', label: 'RATE', value: rewardRate },
                        { height: healthHeight, color: 'bg-purple-500', label: 'HEALTH', value: poolHealth }
                      ].map((bar, index) => (
                        <div key={index} className="flex flex-col items-center">
                          <div
                            className={`w-6 rounded-t ${bar.color}`}
                            style={{ height: `${bar.height}px` }}
                          ></div>
                          <span className="text-xs text-gray-300 mt-1">{bar.label}</span>
                        </div>
                      ));
                    })()}
                  </div>
                  
                  <div className="flex justify-between text-xs text-gray-400 mt-4">
                    <span>POOL</span>
                    <span>STAKE</span>
                    <span>RATE</span>
                  </div>
                </div>

                {/* Pool Health */}
                <div className="card-gradient rounded-xl p-6 border border-white/10">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">POOL HEALTH</h3>
                    <div className="flex space-x-2">
                      <button className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center">
                        <span className="text-white text-xs">+</span>
                      </button>
                      <button className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center">
                        <span className="text-white text-xs">×</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Concentric Circles */}
                  <div className="relative w-20 h-20 mx-auto mb-4">
                    <div className="absolute inset-0 rounded-full border-4 border-pink-500"></div>
                    <div className="absolute inset-2 rounded-full border-4 border-yellow-500"></div>
                    <div className="absolute inset-4 rounded-full border-4 border-teal-500"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">
                        {poolData ? formatTokenAmount(poolData.totalStaked || 0) : '0'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-xs text-gray-300">Pool Health</div>
                    <div className="text-xs text-green-400">
                      {poolData && poolData.totalStaked > 0 ? 
                        `${((poolData.rewardRatePerSec || 0) * 31536000 / poolData.totalStaked * 100).toFixed(2)}%` : 
                        '0.00%'
                      }
                    </div>
                  </div>
                </div>

                {/* Token Chart */}
                <div className="card-gradient rounded-xl p-6 border border-white/10">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">TOKEN</h3>
                    <div className="flex space-x-2">
                      <button className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center">
                        <span className="text-white text-xs">+</span>
                      </button>
                      <button className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center">
                        <span className="text-white text-xs">×</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Token Info Display */}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white mb-2">
                      {poolData && poolData.stakingMint ? 
                        poolData.stakingMint.slice(0, 4) : 'N/A'}
                    </div>
                    <div className="text-sm text-gray-300 mb-4">
                      {poolData && poolData.stakingMint ? 
                        `${poolData.stakingMint.slice(0, 4)}...${poolData.stakingMint.slice(-4)}` : 'N/A'}
                    </div>
                    
                    {/* Token Stats */}
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-300">Total Supply:</span>
                        <span className="text-white">{poolData ? formatTokenAmount(poolData.totalStaked || 0) : '0'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Your Stake:</span>
                        <span className="text-white">{userData ? formatTokenAmount(userData.staked || 0) : '0'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Rate:</span>
                        <span className="text-white">{poolData ? poolData.rewardRatePerSec || 0 : 0}/sec</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
          </>
        );
    }
  };

  return (
    <div className="min-h-screen dashboard-gradient">
      <div className="flex">
        {/* Sidebar - Hidden on mobile, shown on desktop */}
        <Sidebar 
          activeSection={activeSection} 
          setActiveSection={setActiveSection}
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col lg:ml-0">
          {/* Header */}
          <Header 
            onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            isMobileMenuOpen={isMobileMenuOpen}
          />
          
          {/* Dashboard Content */}
          <main className="flex-1 p-4 md:p-6">
            {renderContent()}
          </main>
        </div>
      </div>
    </div>
  );
}
