'use client';

import { useStaking } from '../contexts/StakingContext';

export default function RewardExplanation() {
  const { poolData, rewardDecimals } = useStaking();

  if (!poolData || !poolData.rewardRatePerSec) {
    return null;
  }

  const baseUnitsPerSec = poolData.rewardRatePerSec;
  const tokensPerSec = baseUnitsPerSec / Math.pow(10, rewardDecimals);
  const tokensPerDay = tokensPerSec * 86400;
  const tokensPerYear = tokensPerSec * 31536000;

  return (
    <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/50 rounded-lg p-4 mb-6">
      <div className="flex items-center mb-3">
        <span className="text-2xl mr-2">💡</span>
        <h3 className="text-lg font-semibold text-white">How Rewards Work</h3>
      </div>
      
      <div className="space-y-2 text-sm text-gray-300">
        <div>
          <strong className="text-white">Pool Rate:</strong> {tokensPerSec.toFixed(8)} tokens/sec
        </div>
        <div>
          <strong className="text-white">Daily Pool Total:</strong> {tokensPerDay.toFixed(6)} tokens/day
        </div>
        <div>
          <strong className="text-white">Yearly Pool Total:</strong> {tokensPerYear.toFixed(2)} tokens/year
        </div>
        <div className="text-yellow-300 mt-2">
          <strong>⚠️ Important:</strong> This is the TOTAL amount the pool generates for ALL stakers combined, not just for you!
        </div>
        <div className="text-green-300">
          <strong>✅ Your Share:</strong> Depends on how much you&apos;ve staked vs the total pool size
        </div>
      </div>
    </div>
  );
}
