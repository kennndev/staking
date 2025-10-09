'use client';

import { useState, useEffect, useRef } from 'react';
import { PublicKey } from '@solana/web3.js';

interface Wallet {
  name: string;
  icon: string;
  adapter: string;
  url: string;
}

const WALLETS: Wallet[] = [
  {
    name: 'Phantom',
    icon: '👻',
    adapter: 'phantom',
    url: 'https://phantom.app/'
  },
  {
    name: 'Solflare',
    icon: '☀️',
    adapter: 'solflare',
    url: 'https://solflare.com/'
  },
  {
    name: 'Backpack',
    icon: '🎒',
    adapter: 'backpack',
    url: 'https://backpack.app/'
  },
  {
    name: 'Glow',
    icon: '✨',
    adapter: 'glow',
    url: 'https://glow.app/'
  },
  {
    name: 'Coinbase Wallet',
    icon: '🔷',
    adapter: 'coinbase',
    url: 'https://www.coinbase.com/wallet'
  }
];

export default function WalletConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [showWalletOptions, setShowWalletOptions] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check if wallet is already connected on component mount
  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window !== 'undefined' && window.solana?.isPhantom) {
        try {
          const response = await window.solana.connect();
          if (response.publicKey) {
            setIsConnected(true);
            setWalletAddress(response.publicKey.toString());
            setSelectedWallet(WALLETS[0]); // Phantom
          }
        } catch {
          console.log('No wallet connected');
        }
      }
    };

    checkConnection();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowWalletOptions(false);
      }
    };

    if (showWalletOptions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showWalletOptions]);

  // Detect if user is on mobile
  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  // Get mobile wallet deep link
  const getMobileWalletUrl = (wallet: Wallet) => {
    const baseUrl = window.location.origin;
    const encodedUrl = encodeURIComponent(baseUrl);
    
    switch (wallet.adapter) {
      case 'phantom':
        return `https://phantom.app/ul/browse/${encodedUrl}?ref=phantom`;
      case 'solflare':
        return `https://solflare.com/ul/browse/${encodedUrl}`;
      case 'backpack':
        return `https://backpack.app/ul/browse/${encodedUrl}`;
      case 'glow':
        return `https://glow.app/ul/browse/${encodedUrl}`;
      case 'coinbase':
        return `https://go.cb-w.com/dapp?cb_url=${encodedUrl}`;
      default:
        return wallet.url;
    }
  };

  const connectWallet = async (wallet: Wallet) => {
    try {
      if (typeof window !== 'undefined') {
        let response;
        
        // Check if on mobile and wallet not detected
        if (isMobile()) {
          const walletDetected = 
            (wallet.adapter === 'phantom' && window.solana?.isPhantom) ||
            (wallet.adapter === 'solflare' && window.solflare) ||
            (wallet.adapter === 'backpack' && window.backpack) ||
            (wallet.adapter === 'glow' && window.glow) ||
            (wallet.adapter === 'coinbase' && window.coinbaseSolana);
            
          if (!walletDetected) {
            // Redirect to mobile wallet app
            const mobileUrl = getMobileWalletUrl(wallet);
            window.open(mobileUrl, '_blank');
            alert(`Please install ${wallet.name} wallet or open this link in your wallet app`);
            return;
          }
        }
        
        if (wallet.adapter === 'phantom' && window.solana?.isPhantom) {
          response = await window.solana.connect();
        } else if (wallet.adapter === 'solflare' && window.solflare) {
          response = await window.solflare.connect();
        } else if (wallet.adapter === 'backpack' && window.backpack) {
          response = await window.backpack.connect();
        } else if (wallet.adapter === 'glow' && window.glow) {
          response = await window.glow.connect();
        } else if (wallet.adapter === 'coinbase' && window.coinbaseSolana) {
          response = await window.coinbaseSolana.connect();
        } else {
          // If wallet not installed, open download page
          window.open(wallet.url, '_blank');
          return;
        }

        if (response?.publicKey) {
          setIsConnected(true);
          setWalletAddress(response.publicKey.toString());
          setSelectedWallet(wallet);
          setShowWalletOptions(false);
          
          // Trigger wallet change event for StakingContext
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('wallet-change'));
          }
        }
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      alert('Failed to connect wallet. Please try again.');
    }
  };

  const disconnectWallet = () => {
    setIsConnected(false);
    setWalletAddress('');
    setSelectedWallet(null);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (isConnected && selectedWallet) {
    return (
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-2 bg-white/10 rounded-lg px-2 md:px-3 py-2 min-w-0">
          <span className="text-base md:text-lg">{selectedWallet.icon}</span>
          <div className="flex flex-col min-w-0">
            <span className="text-white text-xs md:text-sm font-medium truncate">{selectedWallet.name}</span>
            <span className="text-gray-300 text-xs truncate">{formatAddress(walletAddress)}</span>
          </div>
        </div>
        <button
          onClick={disconnectWallet}
          className="p-2 text-gray-400 hover:text-white transition-colors touch-target"
          title="Disconnect Wallet"
        >
          <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowWalletOptions(!showWalletOptions)}
        className="flex items-center space-x-1 md:space-x-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-3 md:px-4 py-2 md:py-2 rounded-lg transition-all duration-200 font-medium text-sm md:text-base touch-target min-h-[44px]"
      >
        <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span className="hidden sm:inline">Connect Wallet</span>
        <span className="sm:hidden">Connect</span>
        <svg className={`h-3 w-3 md:h-4 md:w-4 transition-transform ${showWalletOptions ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showWalletOptions && (
        <div className="absolute right-0 top-full mt-2 w-72 md:w-64 bg-black/90 backdrop-blur-sm border border-white/20 rounded-lg shadow-xl z-[9999]">
          <div className="p-3 md:p-4">
            <h3 className="text-white font-medium mb-3 text-sm md:text-base">Connect Wallet</h3>
            {isMobile() && (
              <div className="mb-3 p-2 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                <p className="text-blue-300 text-xs">
                  📱 Mobile detected: Tap a wallet to open in your wallet app
                </p>
              </div>
            )}
            <div className="space-y-1 md:space-y-2">
              {WALLETS.map((wallet) => (
                <button
                  key={wallet.name}
                  onClick={() => connectWallet(wallet)}
                  className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-white/10 transition-colors text-left touch-target"
                >
                  <span className="text-xl md:text-2xl">{wallet.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-medium text-sm md:text-base truncate">{wallet.name}</div>
                    <div className="text-gray-400 text-xs md:text-sm">
                      {isMobile() ? 'Tap to open in app' : 'Click to connect'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      connect: () => Promise<{ publicKey: PublicKey }>;
    };
    solflare?: {
      connect: () => Promise<{ publicKey: PublicKey }>;
    };
    backpack?: {
      connect: () => Promise<{ publicKey: PublicKey }>;
    };
    glow?: {
      connect: () => Promise<{ publicKey: PublicKey }>;
    };
    coinbaseSolana?: {
      connect: () => Promise<{ publicKey: PublicKey }>;
    };
  }
}
