import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sparkles, Wallet, Menu, X } from "lucide-react";
import { useStaking } from "@/contexts/StakingContext";
import { useNavigate, useLocation } from "react-router-dom";

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { walletAddress, connectWallet, disconnectWallet, isAdmin } = useStaking();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      setProgress(p);
      const bar = document.getElementById("scroll-progress");
      if (bar) bar.style.transform = `scaleX(${p})`;
      document.documentElement.style.setProperty("--scroll-progress", `${p}`);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const onToggleTheme = () => {
    const root = document.documentElement;
    root.classList.toggle("dark");
  };

  const handleConnectWallet = async () => {
    try {
      await connectWallet();
    } catch (err) {
      console.error('Failed to connect wallet:', err);
      alert(err instanceof Error ? err.message : 'Failed to connect wallet');
    }
  };

  const handleDisconnectWallet = () => {
    disconnectWallet();
  };

  const handleNavigation = (section: string) => {
    setMobileMenuOpen(false); // Close mobile menu
    if (location.pathname === '/') {
      // If on main page, scroll to section
      const element = document.getElementById(section);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      // If on other pages, navigate to main page with hash
      navigate(`/#${section}`);
    }
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all",
        scrolled
          ? "backdrop-blur-md bg-background/70 border-b border-white/6"
          : "bg-transparent",
      )}
    >
      <div id="scroll-progress" />
      <div className="container relative flex h-20 items-center justify-between">
        <a href="#home" className="inline-flex items-center gap-3">
          <span
            className="inline-block h-6 w-6 rounded-md"
            style={{
              background:
                "linear-gradient(135deg, hsl(var(--solana-mint)), hsl(var(--solana-purple)))",
            }}
          />
          <span className="font-medium tracking-tight text-sm">NPC Stake</span>
        </a>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex gap-10 items-center text-sm font-medium opacity-90">
          <button onClick={() => handleNavigation('how')} className="nav-link">
            How it works
          </button>
          <button onClick={() => handleNavigation('rewards')} className="nav-link">
            Rewards
          </button>
          <button onClick={() => handleNavigation('stake')} className="nav-link">
            Stake
          </button>
          <a href="/games" className="nav-link">
            Games
          </a>
          <button onClick={() => handleNavigation('faq')} className="nav-link">
            FAQ
          </button>
          {isAdmin && (
            <a href="/admin" className="nav-link text-accent">
              Admin
            </a>
          )}
        </nav>

        {/* Mobile Menu Button - Centered */}
        <div className="md:hidden absolute left-1/2 transform -translate-x-1/2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleMobileMenu}
            className="p-2"
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Desktop Wallet Section */}
        <div className="hidden md:flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
          >
            <Sparkles />
          </Button>
          {walletAddress ? (
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-xs text-foreground/70">Connected</div>
                <div className="font-mono text-sm text-green-400">
                  {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
                </div>
              </div>
              <Button size="sm" className="btn-gradient" onClick={() => handleNavigation('stake')}>
                <Wallet className="mr-2" />
                Stake
              </Button>
              <Button size="sm" variant="outline" className="glass" onClick={handleDisconnectWallet}>
                Disconnect
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="glass" onClick={handleConnectWallet}>
              <Wallet className="mr-2" />
              Connect Wallet
            </Button>
          )}
        </div>

        {/* Mobile Wallet Section */}
        <div className="md:hidden">
          {walletAddress ? (
            <Button size="sm" className="btn-gradient" onClick={() => handleNavigation('stake')}>
              <Wallet className="mr-2" />
              Stake
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="glass" onClick={handleConnectWallet}>
              <Wallet className="mr-2" />
              Connect
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-background/95 backdrop-blur-md border-b border-white/10">
          <div className="container py-4 space-y-4">
            <nav className="flex flex-col space-y-3">
              <button 
                onClick={() => handleNavigation('how')} 
                className="text-left py-2 px-3 rounded-lg hover:bg-white/5 transition-colors"
              >
                How it works
              </button>
              <button 
                onClick={() => handleNavigation('rewards')} 
                className="text-left py-2 px-3 rounded-lg hover:bg-white/5 transition-colors"
              >
                Rewards
              </button>
              <button 
                onClick={() => handleNavigation('stake')} 
                className="text-left py-2 px-3 rounded-lg hover:bg-white/5 transition-colors"
              >
                Stake
              </button>
              <a 
                href="/games" 
                className="text-left py-2 px-3 rounded-lg hover:bg-white/5 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Games
              </a>
              <button 
                onClick={() => handleNavigation('faq')} 
                className="text-left py-2 px-3 rounded-lg hover:bg-white/5 transition-colors"
              >
                FAQ
              </button>
              {isAdmin && (
                <a 
                  href="/admin" 
                  className="text-left py-2 px-3 rounded-lg hover:bg-white/5 transition-colors text-accent"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Admin
                </a>
              )}
            </nav>
            
            {/* Mobile Wallet Info */}
            {walletAddress && (
              <div className="pt-4 border-t border-white/10">
                <div className="text-xs text-foreground/70 mb-2">Connected</div>
                <div className="font-mono text-sm text-green-400 mb-3">
                  {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="glass w-full" 
                  onClick={handleDisconnectWallet}
                >
                  Disconnect
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
