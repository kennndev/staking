import BN from 'bn.js';

export const formatToken = (
  base: BN | number,
  decimals: number,
  minFrac = 0,
  maxFrac = 8          // show up to micro-tokens
) => {
  const num = typeof base === 'number' ? base : Number(base);
  const uiAmount = num / Math.pow(10, decimals);
  
  if (uiAmount === 0) return '0.000000';
  if (uiAmount < 0.000001) return uiAmount.toExponential(6);
  
  return uiAmount.toLocaleString(undefined, {
    minimumFractionDigits: minFrac,
    maximumFractionDigits: maxFrac,
  });
};

export const formatRewardAmount = (
  base: BN | number,
  decimals: number,
  minFrac = 0,
  maxFrac = 8
) => {
  return formatToken(base, decimals, minFrac, maxFrac);
};
