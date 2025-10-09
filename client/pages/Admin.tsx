"use client"
import { useEffect, useMemo, useState } from "react";
import { useStaking } from "@/contexts/StakingContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const numberFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const formatTimestamp = (ts?: number | null) => {
  if (!ts) return "—";
  try {
    return new Date(ts * 1000).toLocaleString();
  } catch {
    return String(ts);
  }
};

export default function Admin() {
  const {
    isAdmin,
    isLoading,
    error,
    poolData,
    stakingMint,
    stakingDecimals,
    rewardDecimals,
    initializePool,
    fetchPoolByMint,
    setStakingMint,
    setRewardConfig,
    addRewardTokens,
    setRewardRate,
    setPaused,
    withdrawRewards,
    setAdmin,
    fetchAdmin,
    ensureVaults,
    closePool,
    refreshData,
    checkRewardVaultBalance,
  } = useStaking();

  const {
    showSuccess,
    showError,
    showWarning,
    showInfo,
  } = useNotifications();

  const [stakingMintInput, setStakingMintInput] = useState(stakingMint ?? "");
  const [rewardMintInput, setRewardMintInput] = useState("");
  const [initialRewardRate, setInitialRewardRate] = useState("");
  const [fundAmount, setFundAmount] = useState("");
  const [updateRewardRate, setUpdateRewardRate] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [nextAdmin, setNextAdmin] = useState("");
  const [currentAdmin, setCurrentAdmin] = useState<string | null>(null);
  const [rewardVaultBalance, setRewardVaultBalance] = useState<
    number | null
  >(null);
  const [checkingBalance, setCheckingBalance] = useState(false);

  useEffect(() => {
    setStakingMintInput(stakingMint ?? "");
  }, [stakingMint]);

  useEffect(() => {
    let cancelled = false;
    const loadBalance = async () => {
      if (!poolData) {
        setRewardVaultBalance(null);
        return;
      }
      setCheckingBalance(true);
      try {
        const balance = await checkRewardVaultBalance();
        if (!cancelled) {
          setRewardVaultBalance(balance);
        }
      } catch (err) {
        console.error("Failed to fetch reward vault balance:", err);
      } finally {
        if (!cancelled) {
          setCheckingBalance(false);
        }
      }
    };
    loadBalance();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolData]);

  const poolStatusLabel = useMemo(() => {
    if (!poolData) return { label: "Not initialised", tone: "outline" as const };
    if (poolData.paused) return { label: "Paused", tone: "secondary" as const };
    return { label: "Active", tone: "default" as const };
  }, [poolData]);

  const totalStakedUI = useMemo(() => {
    if (!poolData) return "—";
    return numberFormatter.format(
      poolData.totalStaked / Math.pow(10, stakingDecimals || 0),
    );
  }, [poolData, stakingDecimals]);

  const rewardRateUi = useMemo(() => {
    if (!poolData) return 0;
    const decimals = rewardDecimals ?? 0;
    return poolData.rewardRatePerSec / Math.pow(10, decimals);
  }, [poolData, rewardDecimals]);

  const currentApyPercent = useMemo(() => {
    if (!poolData || poolData.totalStaked <= 0) return 0;
    return (poolData.rewardRatePerSec * 31_536_000) / poolData.totalStaked * 100;
  }, [poolData]);

  const dailyPoolRewards = rewardRateUi * 86_400;
  const apyDisplay =
    currentApyPercent > 0
      ? `${numberFormatter.format(currentApyPercent)}%`
      : "—";

  const quickRatePresets = [
    { label: "0.5 tokens/sec (testing)", value: 0.5 },
    { label: "0.01 tokens/sec (moderate)", value: 0.01 },
    { label: "0.001 tokens/sec (low)", value: 0.001 },
  ];

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-6">
        <Card className="max-w-md bg-black/40 border-white/10 text-center">
          <CardHeader>
            <CardTitle className="text-2xl text-white">
              Access restricted
            </CardTitle>
            <CardDescription className="text-gray-300">
              Connect with the configured admin wallet to manage the pool.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleFetchPool = async () => {
    if (!stakingMintInput.trim()) {
      showWarning("Missing mint", "Enter a staking mint address to fetch.");
      return;
    }
    try {
      setStakingMint(stakingMintInput.trim());
      await fetchPoolByMint(stakingMintInput.trim());
      showSuccess("Pool loaded", "Fetched on-chain pool information.");
    } catch (err) {
      showError(
        "Fetch failed",
        err instanceof Error ? err.message : "Unable to fetch pool data.",
      );
    }
  };

  const handleSetMintOnly = () => {
    if (!stakingMintInput.trim()) {
      showWarning("Missing mint", "Enter a staking mint address to set.");
      return;
    }
    const nextMint = stakingMintInput.trim();
    setStakingMint(nextMint);
    showInfo(
      "Staking mint updated",
      "Context updated. Fetch the pool to load on-chain data.",
    );
  };

  const handleInitialisePool = async () => {
    if (!stakingMintInput.trim()) {
      showWarning(
        "Missing staking mint",
        "Provide the staking mint address before initialising.",
      );
      return;
    }
    try {
      await initializePool(stakingMintInput.trim());
      showSuccess("Pool initialised", "Pool PDA and vault were created.");
      await refreshData();
    } catch (err) {
      showError(
        "Initialisation failed",
        err instanceof Error ? err.message : "Unable to initialise pool.",
      );
    }
  };

  const handleConfigureRewards = async () => {
    if (!poolData) {
      showWarning("Pool required", "Initialise or fetch a pool first.");
      return;
    }
    if (!rewardMintInput.trim() || !initialRewardRate.trim()) {
      showWarning(
        "Missing data",
        "Provide both reward mint and reward rate to configure rewards.",
      );
      return;
    }
    const parsed = Number(initialRewardRate);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      showWarning(
        "Invalid reward rate",
        "Reward rate must be a positive number.",
      );
      return;
    }
    try {
      await setRewardConfig(rewardMintInput.trim(), parsed);
      showSuccess(
        "Rewards configured",
        "Reward mint and base rate saved on-chain.",
      );
      setRewardMintInput("");
      setInitialRewardRate("");
      await refreshData();
    } catch (err) {
      showError(
        "Configuration failed",
        err instanceof Error ? err.message : "Unable to configure rewards.",
      );
    }
  };

  const handleFundRewards = async () => {
    if (!poolData) {
      showWarning("Pool required", "Initialise or fetch a pool first.");
      return;
    }
    const parsed = Number(fundAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      showWarning("Invalid amount", "Enter a positive amount to deposit.");
      return;
    }
    try {
      await addRewardTokens(parsed);
      showSuccess(
        "Vault funded",
        "Tokens transferred into the reward vault successfully.",
      );
      setFundAmount("");
      await refreshData();
    } catch (err) {
      showError(
        "Funding failed",
        err instanceof Error ? err.message : "Unable to add reward tokens.",
      );
    }
  };

  const handleUpdateRewardRate = async () => {
    if (!poolData) {
      showWarning("Pool required", "Initialise or fetch a pool first.");
      return;
    }
    const parsed = Number(updateRewardRate);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      showWarning("Invalid rate", "Enter a positive reward rate.");
      return;
    }
    try {
      await setRewardRate(parsed);
      showSuccess("Reward rate updated", "New reward emission rate is live.");
      setUpdateRewardRate("");
      await refreshData();
    } catch (err) {
      showError(
        "Update failed",
        err instanceof Error ? err.message : "Unable to update reward rate.",
      );
    }
  };

  const handleTogglePause = async () => {
    if (!poolData) {
      showWarning("Pool required", "Initialise or fetch a pool first.");
      return;
    }
    try {
      await setPaused(!poolData.paused);
      showSuccess(
        poolData.paused ? "Pool resumed" : "Pool paused",
        poolData.paused
          ? "Stakers can interact with the pool again."
          : "Pool is paused; staking operations are disabled.",
      );
      await refreshData();
    } catch (err) {
      showError(
        "Status change failed",
        err instanceof Error ? err.message : "Unable to toggle pool status.",
      );
    }
  };

  const handleWithdrawRewards = async () => {
    if (!poolData) {
      showWarning("Pool required", "Initialise or fetch a pool first.");
      return;
    }
    const parsed = Number(withdrawAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      showWarning("Invalid amount", "Enter a positive amount to withdraw.");
      return;
    }
    try {
      await withdrawRewards(parsed);
      showSuccess(
        "Rewards withdrawn",
        "Tokens moved from the reward vault to the admin.",
      );
      setWithdrawAmount("");
      await refreshData();
    } catch (err) {
      showError(
        "Withdrawal failed",
        err instanceof Error ? err.message : "Unable to withdraw rewards.",
      );
    }
  };

  const handleFetchAdmin = async () => {
    try {
      const admin = await fetchAdmin();
      setCurrentAdmin(admin);
      if (admin) {
        showSuccess(
          "Admin fetched",
          `Current admin: ${admin.slice(0, 4)}...${admin.slice(-4)}`,
        );
      } else {
        showWarning("No admin found", "Could not fetch admin from pool.");
      }
    } catch (err) {
      showError(
        "Fetch failed",
        err instanceof Error ? err.message : "Unable to fetch admin.",
      );
    }
  };

  const handleTransferAdmin = async () => {
    if (!nextAdmin.trim()) {
      showWarning("Missing address", "Enter a wallet to transfer admin to.");
      return;
    }
    try {
      await setAdmin(nextAdmin.trim());
      showSuccess(
        "Admin updated",
        "Ownership transferred. Reload with the new wallet to continue.",
      );
      setNextAdmin("");
      await refreshData();
    } catch (err) {
      showError(
        "Transfer failed",
        err instanceof Error ? err.message : "Unable to set new admin.",
      );
    }
  };

  const handleEnsureVaults = async () => {
    try {
      await ensureVaults();
      showSuccess(
        "Vaults ensured",
        "Required token accounts exist and are owned by the pool signer.",
      );
      await refreshData();
    } catch (err) {
      showError(
        "Vault operation failed",
        err instanceof Error ? err.message : "Unable to ensure vaults.",
      );
    }
  };

  const handleClosePool = async () => {
    if (
      !window.confirm(
        "Closing the pool is irreversible. This requires the pool to be empty and paused. Continue?",
      )
    ) {
      return;
    }
    try {
      await closePool();
      showSuccess(
        "Pool closed",
        "Pool, signer PDA, and vaults were closed. Recreate to continue.",
      );
      await refreshData();
    } catch (err) {
      showError(
        "Close failed",
        err instanceof Error ? err.message : "Unable to close the pool.",
      );
    }
  };

  const handleRefresh = async () => {
    try {
      await refreshData();
      showInfo("Refreshed", "Fetched the latest on-chain state.");
    } catch (err) {
      console.error("Refresh failed:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-purple-900/5">
    <div className="container py-12 space-y-10">
        {/* Enhanced Header with Gradient Background */}
        <header className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-blue-500/10 rounded-2xl blur-3xl" />
          <div className="relative glass gradient-border p-8 rounded-2xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <span className="text-2xl">⚡</span>
              </div>
              <div>
                <h1 className="text-4xl font-extrabold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                  Admin Dashboard
                </h1>
                <p className="text-foreground/80 text-lg">
                  Manage the staking pool directly from the admin wallet
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30">
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm font-medium text-green-300">{poolStatusLabel.label}</span>
              </div>
          {stakingMint && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30">
                  <span className="text-sm font-mono text-blue-300">
              Mint: {stakingMint.slice(0, 4)}…{stakingMint.slice(-4)}
                  </span>
                </div>
          )}
          {poolData?.poolAddress && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30">
                  <span className="text-sm font-mono text-purple-300">
                    Pool: {poolData.poolAddress.slice(0, 4)}…{poolData.poolAddress.slice(-4)}
                  </span>
                </div>
              )}
            </div>
        </div>
      </header>

      {error && (
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-xl blur-sm" />
            <Card className="relative border-red-500/40 bg-red-500/10 backdrop-blur-sm">
          <CardHeader>
                <CardTitle className="text-red-100 flex items-center gap-2">
                  <span className="text-xl">⚠️</span>
                  On-chain error
                </CardTitle>
            <CardDescription className="text-red-200">
              {error}
            </CardDescription>
          </CardHeader>
        </Card>
          </div>
      )}

        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="group hover:scale-[1.02] transition-all duration-300 glass gradient-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="text-2xl">🪙</span>
                Current staking mint
              </CardTitle>
              <CardDescription>
                Update the mint tracked in the UI and perform mint-related actions.
              </CardDescription>
            </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-foreground/70">Mint in context</span>
                <span className="font-mono">
                  {stakingMint
                    ? `${stakingMint.slice(0, 4)}…${stakingMint.slice(-4)}`
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground/70">Pool PDA</span>
                <span className="font-mono">
                  {poolData?.poolAddress
                    ? `${poolData.poolAddress.slice(0, 4)}…${poolData.poolAddress.slice(-4)}`
                    : "—"}
                </span>
              </div>
            </div>
            <div className="space-y-3">
              <Input
                value={stakingMintInput}
                onChange={(event) => setStakingMintInput(event.target.value)}
                placeholder="Enter staking mint address"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={handleSetMintOnly}
                  disabled={isLoading}
                >
                  Set mint
                </Button>
                <Button
                  variant="outline"
                  onClick={handleFetchPool}
                  disabled={isLoading}
                >
                  Fetch pool
                </Button>
                <Button onClick={handleInitialisePool} disabled={isLoading}>
                  Initialise pool
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

          <Card className="lg:col-span-2 group hover:scale-[1.02] transition-all duration-300 glass gradient-border">
          <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="text-2xl">📊</span>
                Pool overview
              </CardTitle>
            <CardDescription>
              Snapshot of the active pool (values shown in UI units).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
              <span className="text-foreground/70">Total staked</span>
              <span className="font-medium">{totalStakedUI}</span>
            </div>
              <div className="flex justify-between">
                <span className="text-foreground/70">Reward rate</span>
                <span className="font-medium">
                  {poolData
                    ? `${numberFormatter.format(rewardRateUi)} tokens/sec`
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground/70">Reward mint</span>
                <span className="font-mono">
                  {poolData?.rewardMint
                    ? `${poolData.rewardMint.slice(0, 4)}…${poolData.rewardMint.slice(-4)}`
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground/70">Daily pool rewards</span>
              <span className="font-medium">
                  {poolData
                    ? `${numberFormatter.format(dailyPoolRewards)} tokens/day`
                    : "—"}
              </span>
            </div>
              <div className="flex justify-between">
                <span className="text-foreground/70">Current APY</span>
                <span className="font-medium">{apyDisplay}</span>
              </div>
              <div className="flex justify-between">
              <span className="text-foreground/70">Reward vault balance</span>
              <span className="font-medium">
                {checkingBalance
                  ? "Checking…"
                  : rewardVaultBalance !== null
                    ? `${numberFormatter.format(rewardVaultBalance)}`
                    : "—"}
              </span>
            </div>
              <div className="flex justify-between">
              <span className="text-foreground/70">Last update</span>
              <span className="font-medium">
                {poolData ? formatTimestamp(poolData.lastUpdateTs) : "—"}
              </span>
            </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      <section className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 group hover:scale-[1.02] transition-all duration-300 glass gradient-border">
          <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="text-2xl">⚙️</span>
                Configure rewards
              </CardTitle>
            <CardDescription>
              Set up the reward mint and base emission rate. This should be done
              once per pool.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">
                  Reward mint address
                </label>
                <Input
                  value={rewardMintInput}
                  onChange={(event) => setRewardMintInput(event.target.value)}
                  placeholder="Enter reward mint"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">
                  Reward rate (per second)
                </label>
                <Input
                  type="number"
                  value={initialRewardRate}
                  onChange={(event) =>
                    setInitialRewardRate(event.target.value)
                  }
                  placeholder="e.g. 1000"
                />
              </div>
            </div>
            <Button
              onClick={handleConfigureRewards}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              Save reward configuration
            </Button>
          </CardContent>
        </Card>

          <Card className="group hover:scale-[1.02] transition-all duration-300 glass gradient-border">
          <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="text-2xl">💰</span>
                Fund rewards
              </CardTitle>
            <CardDescription>
              Deposit reward tokens into the pool signer vault.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="number"
              value={fundAmount}
              onChange={(event) => setFundAmount(event.target.value)}
              placeholder="Amount in tokens"
            />
            <Button
              onClick={handleFundRewards}
              disabled={isLoading}
              className="w-full"
            >
              Fund reward vault
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
          <Card className="group hover:scale-[1.02] transition-all duration-300 glass gradient-border">
          <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="text-2xl">📈</span>
                Update reward rate
              </CardTitle>
            <CardDescription>
              Apply a new emission rate without changing the reward mint.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="number"
              value={updateRewardRate}
              onChange={(event) => setUpdateRewardRate(event.target.value)}
              placeholder="New reward rate per second"
            />
            <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-4 text-xs text-foreground/80">
              <div>
                <strong>Current rate:</strong>{" "}
                {numberFormatter.format(rewardRateUi)} tokens/sec (
                {poolData ? poolData.rewardRatePerSec : 0} base units/sec)
              </div>
              <div>
                <strong>Pool generates:</strong>{" "}
                {numberFormatter.format(rewardRateUi)} tokens each second for all
                stakers.
              </div>
              <div>
                <strong>Daily emissions:</strong>{" "}
                {numberFormatter.format(dailyPoolRewards)} tokens/day total
              </div>
              <div>
                <strong>Current APY:</strong> {apyDisplay}
              </div>
              <div>
                Your effective yield still depends on your share of the pool. A
                higher rate increases rewards for every staker.
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-foreground/70">Quick rate suggestions</p>
              <div className="flex flex-wrap gap-2">
                {quickRatePresets.map((preset) => (
                  <Button
                    key={preset.value}
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => setUpdateRewardRate(preset.value.toString())}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={handleUpdateRewardRate}
              disabled={isLoading}
            >
              Update reward rate
            </Button>
          </CardContent>
        </Card>

          <Card className="group hover:scale-[1.02] transition-all duration-300 glass gradient-border">
          <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="text-2xl">💸</span>
                Withdraw rewards
              </CardTitle>
            <CardDescription>
              Move tokens from the reward vault back to the admin wallet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="number"
              value={withdrawAmount}
              onChange={(event) => setWithdrawAmount(event.target.value)}
              placeholder="Amount in tokens"
            />
            <Button
              variant="outline"
              onClick={handleWithdrawRewards}
              disabled={isLoading}
            >
              Withdraw rewards
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
          <Card className="group hover:scale-[1.02] transition-all duration-300 glass gradient-border">
          <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="text-2xl">🎛️</span>
                Pool controls
              </CardTitle>
            <CardDescription>
              Pause or resume staking operations and perform maintenance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 space-x-3">
            <Button 
              onClick={handleTogglePause} 
              disabled={isLoading}
              className={poolData?.paused ? "btn-gradient" : "bg-orange-500 hover:bg-orange-600"}
            >
              {poolData?.paused ? "Resume pool" : "Pause pool"}
            </Button>
            <Button
              variant="destructive"
              onClick={handleClosePool}
              disabled={isLoading}
              className="mt-4"
            >
              Close pool
            </Button>
          </CardContent>
        </Card>

          <Card className="group hover:scale-[1.02] transition-all duration-300 glass gradient-border">
          <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="text-2xl">👑</span>
                Transfer admin
              </CardTitle>
            <CardDescription>
              Assign pool administration privileges to another wallet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-foreground/70">Current Admin</span>
                <span className="font-mono text-sm">
                  {currentAdmin 
                    ? `${currentAdmin.slice(0, 4)}...${currentAdmin.slice(-4)}`
                    : "Not fetched"
                  }
                </span>
              </div>
              <Button
                variant="outline"
                onClick={handleFetchAdmin}
                disabled={isLoading}
                className="w-full"
              >
                Fetch Current Admin
              </Button>
            </div>
            <Input
              value={nextAdmin}
              onChange={(event) => setNextAdmin(event.target.value)}
              placeholder="New admin wallet address"
            />
            <Button
              variant="secondary"
              onClick={handleTransferAdmin}
              disabled={isLoading}
            >
              Set new admin
            </Button>
          </CardContent>
        </Card>
      </section>
      </div>
    </div>
  );
}
