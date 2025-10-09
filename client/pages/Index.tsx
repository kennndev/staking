import { useState, useEffect, useRef } from "react";
import useScrollReveal from "@/hooks/useScrollReveal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowRight,
  Sparkles,
  ShieldCheck,
  LineChart,
  Zap,
  Timer,
  LogOut,
  RefreshCw,
  Unlock,
  TrendingUp,
} from "lucide-react";
import Typewriter from "@/components/Typewriter";
import { WalletIcon, MoneyIcon } from "@/components/icons";
import { useStaking } from "@/contexts/StakingContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { usePendingRewards } from "@/hooks/usePendingRewards";
import { formatToken } from "@/utils/format";

export default function Index() {
  useScrollReveal();

  // Handle hash navigation when coming from other pages
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const element = document.getElementById(hash.substring(1));
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, []);

  return (
    <div id="home" className="relative">
      <Hero />
      <Showcase />
      <HowItWorks />
      <Rewards />
      <StakeSimulator />
      <FAQ />
    </div>
  );
}

function GlowOrbs() {
  const ref = useRef<HTMLDivElement | null>(null);
  const raf = useRef<number | null>(null);
  const offset = useRef(0);

  useEffect(() => {
    const update = () => {
      const y = window.scrollY || window.pageYOffset;
      offset.current = y;
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const base = Math.min(
        Math.max(
          (window.innerHeight - r.top) / (window.innerHeight + r.height),
          -1,
        ),
        2,
      );

      const layers = Array.from(
        ref.current.querySelectorAll<HTMLElement>("[data-orb]"),
      );
      layers.forEach((el, i) => {
        const f = (i + 1) * 0.06;
        const tx = Math.sin((y + i * 100) / 200) * (10 + i * 6);
        const ty = -base * (40 + i * 20) * f;
        el.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${1 + i * 0.01})`;
      });
      raf.current = requestAnimationFrame(update);
    };
    raf.current = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div
        data-orb
        className="absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl opacity-40"
        style={{
          background:
            "radial-gradient(circle, hsl(var(--solana-mint)/0.6), transparent 60%)",
        }}
      />
      <div
        data-orb
        className="absolute -top-16 right-0 h-96 w-96 rounded-full blur-3xl opacity-40"
        style={{
          background:
            "radial-gradient(circle, hsl(var(--solana-purple)/0.55), transparent 60%)",
        }}
      />
      <div
        data-orb
        className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full blur-3xl opacity-40"
        style={{
          background:
            "radial-gradient(circle, hsl(var(--solana-pink)/0.5), transparent 60%)",
        }}
      />
    </div>
  );
}

function Hero() {
  return (
    <div className="hero-wrapper">
      <section className="hero-content">
        <GlowOrbs />
        <div className="container flex flex-col items-center text-center gap-6">
          <div className="relative">
            <span
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wider text-foreground/80 reveal"
              data-reveal
            >
              <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-solana-mint via-solana-purple to-solana-pink" />
              Built for Solana | Pump.fun origins
            </span>
          </div>
          <h1
            className="text-4xl md:text-6xl lg:text-7xl font-extrabold leading-[1.05] reveal"
            data-reveal
          >
            Stake{" "}
            <span className="text-gradient">
              <Typewriter words={["NPC", "N.P.C"]} />
            </span>
            .
            <br />
            Make your bags{" "}
            <span className="text-gradient">
              <Typewriter words={["work", "earn", "grow"]} />
            </span>
            .
          </h1>
          <p
            className="max-w-2xl text-foreground/80 text-balance reveal"
            data-reveal
          >
            A magical, interactive staking experience for the NPC token on
            Solana. Lock in your tokens, earn dynamic rewards, and enjoy the
            show.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3 reveal" data-reveal>
            <Button
              asChild
              size="lg"
              className="btn-gradient shadow-lg shadow-fuchsia-500/20 w-full sm:w-auto"
            >
              <a href="#stake" className="inline-flex items-center justify-center">
                Start staking <ArrowRight className="ml-2" />
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="backdrop-blur glass w-full sm:w-auto"
            >
              <a href="#how" className="inline-flex items-center justify-center">
                <Sparkles className="mr-2" />
                See how it works
              </a>
            </Button>
          </div>
          <div className="relative mt-8 w-full reveal" data-reveal>
            <div className="glass gradient-border mx-auto max-w-4xl p-4 md:p-6">
              <HeroOrbital />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function HeroOrbital() {
  return (
    <div className="relative overflow-hidden rounded-xl">
      <div
        className="absolute inset-0 opacity-40 mix-blend-screen"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, hsl(var(--solana-mint)/0.2), transparent 40%), radial-gradient(circle at 80% 20%, hsl(var(--solana-purple)/0.2), transparent 40%), radial-gradient(circle at 50% 80%, hsl(var(--solana-pink)/0.2), transparent 40%)",
        }}
      />
      <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          "Instant Unstake",
          "Auto-Compound",
          "No Lock Penalty",
          "Boosted Epochs",
        ].map((t, i) => {
          const icons: Record<string, any> = {
            "Instant Unstake": LogOut,
            "Auto-Compound": RefreshCw,
            "No Lock Penalty": Unlock,
            "Boosted Epochs": TrendingUp,
          };
          const Icon = icons[t] ?? Sparkles;
          return (
            <Card
              key={t}
              className="group glass gradient-border reveal"
              data-reveal
            >
              <CardContent className="p-4 md:p-5">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-transparent grid place-items-center">
                    <Icon className="h-8 w-8 text-gradient" style={{ color: 'hsl(var(--solana-mint))' }} />
                  </div>
                  <div className="font-semibold text-lg">{t}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="absolute -inset-x-10 -bottom-10 h-24 bg-gradient-to-t from-primary/20 to-transparent" />
    </div>
  );
}

function Showcase() {
  return (
    <section className="relative mt-20 reveal" data-reveal>
      <GlowOrbs />
      <div className="container">
        <div className="grid gap-8 md:grid-cols-2 items-center">
          <div>
            <div
              className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs border border-white/10 mb-4 reveal"
              data-reveal
            >
              <Zap className="h-3.5 w-3.5" /> Built for Solana | Pump.fun origins
            </div>
            <h2
              className="text-3xl md:text-5xl font-extrabold leading-tight reveal"
              data-reveal
            >
              Stake NPC tokens and unlock exclusive games
            </h2>
            <p className="mt-4 text-foreground/80 reveal" data-reveal>
              The more you stake, the more games you unlock. Start with Cyber Defense and Pop Pop, then unlock higher-tier games as your staking amount grows.
            </p>
            <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[
                {
                  icon: <ShieldCheck className="h-4 w-4" />,
                  text: "Secure Solana staking",
                },
                {
                  icon: <LineChart className="h-4 w-4" />,
                  text: "Dynamic rewards & APR",
                },
                {
                  icon: <Timer className="h-4 w-4" />,
                  text: "Auto-compound rewards",
                },
                {
                  icon: <Sparkles className="h-4 w-4" />,
                  text: "Unlock exclusive games",
                },
              ].map((f) => (
                <li
                  key={f.text}
                  className="glass gradient-border flex items-center gap-2 px-3 py-2 reveal"
                  data-reveal
                >
                  <span className="text-gradient">{f.icon}</span>
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative reveal" data-reveal>
            <Card className="glass gradient-border">
              <CardContent className="p-0">
                <Visualizer />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}

function Visualizer() {
  return (
    <div className="relative w-full h-full aspect-[4/3] overflow-hidden rounded-xl bg-black">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,.02),transparent_60%)]" />
      <div className="absolute inset-0 grid place-items-center">
        <video
          src="https://cdn.builder.io/o/assets%2Fc36ad3bb9b384c0aadf72235a9675e8a%2F9d6cad34db9b4e0d8ecb6a1123f4015d?alt=media&token=a7353fb4-daeb-47b8-a4bb-8e6e5e143291&apiKey=c36ad3bb9b384c0aadf72235a9675e8a"
          poster="https://cdn.builder.io/api/v1/image/assets%2Fc36ad3bb9b384c0aadf72235a9675e8a%2F714dc485ed014bea94b2b8a48ff73b33?format=webp&width=800"
          className="min-w-full min-h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          aria-hidden
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}

function Coin3D() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shards, setShards] = useState(false);
  const shardCount = 6;

  useEffect(() => {
    const handler = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      if (ref.current) {
        ref.current.style.transform = `translateY(${p * -24}px) rotate(${p * 12}deg)`;
      }
      // trigger shards when a certain scroll threshold is passed
      setShards(p > 0.18);
    };
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
    };
  }, []);

  return (
    <div className="relative">
      <div className="animate-float">
        <div className="relative h-44 w-44 md:h-56 md:w-56">
          <div
            ref={ref}
            className={`coin-base rounded-full ${shards ? "opacity-30 scale-95" : "opacity-100"}`}
            style={{
              background:
                "conic-gradient(from 0deg, hsl(var(--solana-mint)), hsl(var(--solana-purple)), hsl(var(--solana-pink)), hsl(var(--solana-mint)))",
              boxShadow: "0 30px 50px hsl(var(--solana-purple)/0.25)",
            }}
          >
            <div className="absolute inset-1 rounded-full bg-background/70 backdrop-blur-xl border border-white/20" />
            <div className="absolute inset-0 grid place-items-center">
              <span className="text-4xl font-extrabold tracking-tight text-gradient">
                NPC
              </span>
            </div>
          </div>

          {Array.from({ length: shardCount }).map((_, i) => {
            const angle = (i / shardCount) * Math.PI * 2;
            const distance = shards ? 72 : 0;
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance * 0.8;
            const delay = i * 60;
            return (
              <div
                key={i}
                className={`coin-shard ${shards ? "show" : ""}`}
                style={{
                  left: "50%",
                  top: "50%",
                  transform: `translate3d(${x}px, ${y}px, 0) rotate(${(angle * 180) / Math.PI}deg)`,
                  transitionDelay: `${delay}ms`,
                }}
              />
            );
          })}
        </div>
      </div>
      <div className="absolute inset-x-0 -bottom-6 h-8 blur-xl rounded-full bg-black/30 opacity-30" />
    </div>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="relative mt-24 reveal" data-reveal>
      <div className="container">
        <h2
          className="text-3xl md:text-5xl font-extrabold text-center reveal"
          data-reveal
        >
          How it works
        </h2>
        <p
          className="text-center text-foreground/80 mt-3 max-w-2xl mx-auto reveal"
          data-reveal
        >
          Stake NPC on Solana and earn rewards auto-compounded each epoch.
          Unstake anytime. Boost your yield with time-weighted multipliers.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Connect wallet",
              desc: "Works with popular Solana wallets.",
              icon: <ShieldCheck />,
            },
            {
              title: "Stake NPC",
              desc: "Choose amount and duration.",
              icon: <Zap />,
            },
            {
              title: "Earn rewards",
              desc: "Watch your NPC grow with every epoch.",
              icon: <LineChart />,
            },
          ].map((s) => (
            <Card
              key={s.title}
              className="group glass gradient-border hover:translate-y-[-2px] transition-transform reveal"
              data-reveal
            >
              <CardContent className="p-6">
                <div className="h-12 w-12 rounded-lg bg-transparent grid place-items-center">
                  <div className="text-2xl font-bold text-gradient">
                    {s.title === "Connect wallet" ? "🔗" : s.title === "Earn rewards" ? "💰" : "⚡"}
                  </div>
                </div>
                <div className="mt-4 font-semibold text-lg">{s.title}</div>
                <p className="text-sm text-foreground/80">{s.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function Rewards() {
  const { poolData, userData, stakingDecimals, rewardDecimals } = useStaking();
  const liveRewards = usePendingRewards(poolData, userData);

  const apyPercent = liveRewards?.apy ?? 0;
  const totalStakedUi = poolData
    ? `${formatToken(poolData.totalStaked ?? 0, stakingDecimals, 0, 2)} NPC`
    : "0 NPC";
  const pendingRewardsUi = liveRewards?.pendingUI ?? 0;
  const rewardRatePerSecUi = poolData
    ? poolData.rewardRatePerSec / Math.pow(10, rewardDecimals)
    : 0;

  const rewardRateDisplay =
    rewardRatePerSecUi >= 1
      ? `${rewardRatePerSecUi.toFixed(2)} NPC/sec`
      : `${rewardRatePerSecUi.toFixed(6)} NPC/sec`;

  return (
    <section id="rewards" className="relative mt-24 reveal" data-reveal>
      <GlowOrbs />
      <div className="container">
        <div className="glass gradient-border p-6 md:p-8 reveal" data-reveal>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-center">
            <div>
              <h3 className="text-2xl font-extrabold">Dynamic Rewards</h3>
              <p className="text-foreground/80 mt-2">
                APR adapts with epochs and community staking. The visuals
                reflect live motion.
              </p>
            </div>
            <Metric
              label="Current APY"
              value={`${apyPercent.toFixed(2)}%`}
              trend={apyPercent >= 0 ? "up" : "down"}
            />
            <Metric
              label="Total Staked"
              value={totalStakedUi}
              trend={poolData && poolData.totalStaked > 0 ? "up" : "down"}
            />
            <Metric
              label="Rewards / sec"
              value={rewardRateDisplay}
              trend={rewardRatePerSecUi > 0 ? "up" : "down"}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend: "up" | "down";
}) {
  return (
    <div className="glass gradient-border p-4 reveal" data-reveal>
      <div className="text-sm text-foreground/80">{label}</div>
      <div className="text-3xl font-extrabold mt-1">
        <span className="bg-[linear-gradient(90deg,hsl(var(--solana-mint)),hsl(var(--solana-purple)),hsl(var(--solana-pink)))] bg-clip-text text-transparent animate-shine bg-[length:200%_100%]">
          {value}
        </span>
      </div>
      <div className="text-xs mt-1 opacity-80">
        Trend: {trend === "up" ? "rising" : "steady"}
      </div>
    </div>
  );
}

function StakeSimulator() {
  const {
    walletAddress,
    connectWallet,
    poolData,
    userData,
    isLoading,
    error,
    stake,
    unstake,
    claim,
    stakingDecimals,
  } = useStaking();

  const { showSuccess, showError, showWarning } = useNotifications();
  const liveRewards = usePendingRewards(poolData, userData);
  const [amount, setAmount] = useState<number>(0);
  const [showUnstakeConfirm, setShowUnstakeConfirm] = useState(false);

  const stakedTokens =
    userData && stakingDecimals >= 0
      ? userData.staked / Math.pow(10, stakingDecimals)
      : 0;

  const sliderMax = Math.max(
    10000,
    Math.min(1_000_000, stakedTokens > 0 ? Math.ceil(stakedTokens * 2) : 0)
  );

  useEffect(() => {
    if (amount > sliderMax) {
      setAmount(sliderMax);
    }
  }, [amount, sliderMax]);

  const pendingRewardsValue = liveRewards?.pendingUI ?? 0;
  const aprDisplay = `${(liveRewards?.apy ?? 0).toFixed(2)}%`;
  const stakedDisplay = userData
    ? `${formatToken(userData.staked ?? 0, stakingDecimals, 0, 2)} NPC`
    : "0 NPC";
  const rewardsDisplay = `${pendingRewardsValue.toFixed(6)} NPC`;

  const hasValidAmount = Number.isFinite(amount) && amount > 0;

  const handleStake = async () => {
    console.log('🎯 HANDLE STAKE CLICKED!', { walletAddress, amount, poolData });
    if (!walletAddress) {
      showWarning("Wallet Required", "Please connect your wallet first");
      return;
    }

    if (!poolData) {
      showWarning("Pool Not Ready", "Pool is not initialized yet.");
      return;
    }

    if (poolData.paused) {
      showWarning(
        "Pool Paused",
        "Pool is paused - staking is temporarily disabled"
      );
      return;
    }

    if (isLoading) {
      console.log("Transaction already in progress, ignoring click");
      return;
    }

    if (!hasValidAmount) {
      showWarning("Invalid Amount", "Enter an amount greater than zero");
      return;
    }

    try {
      console.log('🔄 CALLING STAKE FUNCTION WITH AMOUNT:', amount);
      await stake(amount);
      console.log('✅ STAKE FUNCTION COMPLETED SUCCESSFULLY');
      showSuccess(
        "Staking Successful",
        `Your ${amount.toLocaleString()} NPC stake request was submitted.`
      );
      setAmount(0);
    } catch (err) {
      showError(
        "Staking Failed",
        err instanceof Error ? err.message : "Unknown error occurred"
      );
    }
  };

  const handleUnstake = async () => {
    if (!walletAddress) {
      showWarning("Wallet Required", "Please connect your wallet first");
      return;
    }

    if (isLoading) {
      console.log("Transaction already in progress, ignoring click");
      return;
    }

    if (!hasValidAmount) {
      showWarning("Invalid Amount", "Enter an amount greater than zero");
      return;
    }

    if (pendingRewardsValue > 0) {
      setShowUnstakeConfirm(true);
      return;
    }

    if (stakedTokens > 0 && amount > stakedTokens) {
      const available = formatToken(
        userData?.staked ?? 0,
        stakingDecimals,
        0,
        2
      );
      showWarning(
        "Insufficient Staked Balance",
        `You only have ${available} NPC available to unstake.`
      );
      return;
    }

    try {
      await unstake(amount);
      showSuccess(
        "Unstaking Successful",
        "Your tokens have been unstaked and rewards claimed!"
      );
      setAmount(0);
    } catch (err) {
      showError(
        "Operation Failed",
        err instanceof Error ? err.message : "Unknown error occurred"
      );
    }
  };

  const handleConfirmUnstake = async () => {
    setShowUnstakeConfirm(false);
    try {
      await unstake(amount);
      showSuccess(
        "Unstaking Successful",
        "Your tokens have been unstaked and rewards claimed!"
      );
      setAmount(0);
    } catch (err) {
      showError(
        "Operation Failed",
        err instanceof Error ? err.message : "Unknown error occurred"
      );
    }
  };

  const handleClaim = async () => {
    if (!walletAddress) {
      showWarning("Wallet Required", "Please connect your wallet first");
      return;
    }

    if (isLoading) {
      console.log("Transaction already in progress, ignoring click");
      return;
    }

    try {
      await claim();
      showSuccess(
        "Rewards Claimed",
        "Your rewards have been claimed successfully!"
      );
    } catch (err) {
      showError(
        "Operation Failed",
        err instanceof Error ? err.message : "Unknown error occurred"
      );
    }
  };

  const handleConnectWallet = async () => {
    try {
      await connectWallet();
      showSuccess(
        "Wallet Connected",
        "Your wallet has been connected successfully!"
      );
    } catch (err) {
      showError(
        "Connection Failed",
        err instanceof Error ? err.message : "Failed to connect wallet"
      );
    }
  };

  return (
    <section id="stake" className="relative mt-24 reveal" data-reveal>
      <div className="container max-w-5xl">
        <div className="glass gradient-border p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h3 className="text-2xl font-extrabold">Stake</h3>
              <p className="text-foreground/80">
                Stake your NPC tokens instantly. No duration lock â€” unstake
                anytime.
              </p>
            </div>
            {walletAddress ? (
              <div className="text-right">
                <div className="text-xs text-foreground/70">Wallet Connected</div>
                <div className="font-mono font-semibold text-green-400">
                  {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
                </div>
              </div>
            ) : (
              <div className="text-right">
                <div className="text-xs text-foreground/70">Connect wallet to start</div>
                <div className="font-mono font-semibold text-foreground/60">
                  Staking
                </div>
              </div>
            )}
          </div>

          {!walletAddress ? (
            <div className="mt-8 text-center py-8">
              <div className="text-foreground/60 mb-4">
                Connect your wallet to start staking
              </div>
              <Button className="btn-gradient" onClick={handleConnectWallet}>
                <WalletIcon className="mr-2" />
                Connect Wallet
              </Button>
            </div>
          ) : (
            <>
          <div className="mt-6 grid md:grid-cols-2 gap-6 items-center">
            <div>
              <Label>Amount (NPC)</Label>
              <div className="mt-2">
                <Slider
                  value={[amount]}
                  min={0}
                  max={sliderMax}
                  step={1}
                  onValueChange={(v) => setAmount(Math.max(0, v[0] ?? 0))}
                />
              </div>
              <div className="mt-1 text-sm opacity-80">
                {amount.toLocaleString()} NPC
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-end">
              <Button 
                className="btn-gradient w-full sm:w-auto" 
                onClick={() => {
                  console.log('🔘 STAKE BUTTON CLICKED!', { 
                    isLoading, 
                    poolPaused: poolData?.paused, 
                    hasValidAmount, 
                    amount,
                    disabled: isLoading || poolData?.paused || !hasValidAmount 
                  });
                  handleStake();
                }}
                disabled={isLoading || poolData?.paused || !hasValidAmount}
              >
                {isLoading ? 'Processing...' : poolData?.paused ? 'Pool Paused' : 'Stake'}
              </Button>
              <Button
                variant="outline"
                className="glass w-full sm:w-auto"
                onClick={handleUnstake}
                disabled={isLoading || !userData || userData.staked === 0 || !hasValidAmount}
              >
                Unstake
              </Button>
              <Button 
                variant="secondary" 
                className="w-full sm:w-auto"
                onClick={handleClaim}
                disabled={isLoading || !liveRewards || liveRewards.pendingUI === 0}
              >
                Claim Rewards
              </Button>
            </div>
          </div>

          <div className="mt-6 grid md:grid-cols-3 gap-4">
            <MiniStat k="APR" v={aprDisplay} />
            <MiniStat k="Staked" v={stakedDisplay} />
            <MiniStat k="Rewards" v={rewardsDisplay} />
          </div>
        
                    
          {poolData?.paused && (
            <div className="mt-4 text-sm text-yellow-400 text-center">
              Pool is paused - staking is temporarily disabled
            </div>
          )}
          {error && (
            <div className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}
            </>
          )}
        </div>
      </div>

      {/* Custom Unstake Confirmation Dialog */}
      <AlertDialog open={showUnstakeConfirm} onOpenChange={setShowUnstakeConfirm}>
        <AlertDialogContent className="glass gradient-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gradient">Confirm Unstaking</AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/80">
              You have {pendingRewardsValue.toFixed(6)} pending rewards.
              <br /><br />
              Unstaking will automatically claim these rewards first so you keep them.
              <br /><br />
              Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="glass"
              onClick={() => setShowUnstakeConfirm(false)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              className="btn-gradient"
              onClick={handleConfirmUnstake}
            >
              Continue Unstaking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs uppercase tracking-wider opacity-80">
      {children}
    </div>
  );
}

function MiniStat({ k, v }: { k: string; v: string }) {
  return (
    <div className="glass gradient-border p-4 text-center reveal" data-reveal>
      <div className="text-xs opacity-80">{k}</div>
      <div className="text-xl font-semibold text-gradient">{v}</div>
    </div>
  );
}

function FAQ() {
  return (
    <section id="faq" className="relative mt-24 mb-20 reveal" data-reveal>
      <div className="container max-w-4xl">
        <h3 className="text-2xl font-extrabold text-center reveal" data-reveal>
          FAQ
        </h3>
        <div className="mt-6 grid gap-4">
          <QA
            q="Is this the official NPC staking?"
            a="This is a next-generation landing and simulation experience for the NPC token on Solana."
          />
          <QA
            q="Can I unstake anytime?"
            a="Yes. There's no penalty. Longer durations may unlock boost multipliers."
          />
          <QA
            q="Where did NPC launch?"
            a="NPC was deployed on pump.fun and lives on the Solana blockchain."
          />
          <QA
            q="What is the NPC token?"
            a="NPC is a Solana-based token that originated on pump.fun. You can view its current price and trading data on DexScreener."
          />
          <QA
            q="How do I get NPC tokens?"
            a="You can purchase NPC tokens on Solana DEXs like Raydium, Jupiter, or directly on pump.fun. Always DYOR before investing."
          />
     
          <QA
            q="Is staking safe?"
            a="This is a simulation platform for educational purposes. Always research any staking protocol thoroughly and never invest more than you can afford to lose."
          />
      
          <QA
            q="What games can I play?"
            a="Games are unlocked based on your staking tier. Start with Cyber Defense and Pop Pop games. More games unlock with higher staking amounts."
          />
        </div>
      </div>
    </section>
  );
}

function QA({ q, a }: { q: string; a: string }) {
  return (
    <Card className="glass gradient-border reveal" data-reveal>
      <CardContent className="p-6">
        <div className="font-semibold">{q}</div>
        <p className="text-sm text-foreground/80">{a}</p>
      </CardContent>
    </Card>
  );
}
