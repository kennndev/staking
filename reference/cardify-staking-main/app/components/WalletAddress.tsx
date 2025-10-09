'use client';

import { useState } from 'react';

interface WalletAddressProps {
  address: string;
  className?: string;
  showFull?: boolean;
}

const WalletAddress = ({ address, className = '', showFull = false }: WalletAddressProps) => {
  const [isExpanded, setIsExpanded] = useState(showFull);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const formatAddress = (addr: string) => {
    if (addr.length <= 20) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
  };

  return (
    <span 
      className={`cursor-pointer select-all ${className}`}
      onClick={toggleExpanded}
      title={isExpanded ? 'Click to shorten' : 'Click to expand'}
    >
      {isExpanded ? address : formatAddress(address)}
    </span>
  );
};

export default WalletAddress;
