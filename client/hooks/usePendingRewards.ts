import { useMemo } from 'react';

const SCALAR = BigInt('1000000000000');          // 1e12 (same as program)
const SECS_PER_YEAR = 31_536_000;

interface PoolData {
  accScaled: string;
  rewardRatePerSec: number;
  totalStaked: number;
  lastUpdateTs: number;
  rewardDecimals?: number;
  stakeDecimals?: number;
}

interface UserData {
  staked: number;
  debt: string;
  unpaidRewards: string;
}

export function usePendingRewards(pool: any, user: any, now = Math.floor(Date.now() / 1000)) {
  return useMemo(() => {
    if (!pool || !user || user.staked === 0) return null;

    // 1. extend accumulator
    const dt = BigInt(Math.max(0, now - pool.lastUpdateTs));
    const acc = BigInt(pool.accScaled) +
                dt * BigInt(pool.rewardRatePerSec) * SCALAR / BigInt(pool.totalStaked);

    // 2. pending = (staked * acc / SCALAR) − debt + carry
    const due = (BigInt(user.staked) * acc / SCALAR)
                - BigInt(user.debt) + BigInt(user.unpaidRewards);

    // 3. friendly numbers
    const decimals = pool.rewardDecimals ?? 6;
    const pendingUI = Number(due) / 10 ** decimals;
    const yearlyRewards = Number(BigInt(pool.rewardRatePerSec) * BigInt(SECS_PER_YEAR))
                          / 10 ** decimals;
    const apy = pool.totalStaked > 0
                ? (yearlyRewards / (pool.totalStaked / 10 ** (pool.stakeDecimals ?? 6))) * 100
                : 0;

    return { pendingUI, apy };
  }, [pool, user, now]);
}
