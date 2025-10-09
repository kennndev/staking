import React from "react";

export const WalletIcon = ({
  className = "",
  width = 28,
  height = 28,
}: {
  className?: string;
  width?: number;
  height?: number;
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect
      x="1"
      y="5"
      width="22"
      height="14"
      rx="2.5"
      stroke="white"
      strokeOpacity="0.95"
      strokeWidth="1.2"
      fill="none"
    />
    <rect
      x="3"
      y="7"
      width="6"
      height="6"
      rx="1"
      fill="rgba(255,255,255,0.06)"
    />
    <circle cx="19" cy="12" r="1.6" fill="white" />
    <path d="M3 13h14" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
  </svg>
);

export const MoneyIcon = ({
  className = "",
  width = 36,
  height = 36,
}: {
  className?: string;
  width?: number;
  height?: number;
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <linearGradient id="mgrad2" x1="0" x2="1">
        <stop offset="0%" stopColor="hsl(var(--solana-mint))" />
        <stop offset="50%" stopColor="hsl(var(--solana-purple))" />
        <stop offset="100%" stopColor="hsl(var(--solana-pink))" />
      </linearGradient>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    {/* Back coin */}
    <ellipse cx="32" cy="34" rx="18" ry="6" fill="rgba(255,255,255,0.03)" />

    {/* Coin stack */}
    <g filter="url(#glow)">
      <ellipse
        cx="32"
        cy="26"
        rx="18"
        ry="6"
        fill="url(#mgrad2)"
        opacity="0.95"
      />
      <ellipse cx="32" cy="22" rx="16" ry="5" fill="rgba(0,0,0,0.18)" />
      <ellipse cx="32" cy="20" rx="14" ry="4" fill="url(#mgrad2)" />
      <rect
        x="18"
        y="20"
        width="28"
        height="12"
        rx="6"
        fill="none"
        stroke="rgba(255,255,255,0.06)"
      />
      <text
        x="32"
        y="24.5"
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fill="rgba(0,0,0,0.8)"
        style={{ fontFamily: "Space Grotesk, Inter, system-ui" }}
      >
        NPC
      </text>
    </g>

    {/* small coin above */}
    <g>
      <ellipse cx="34" cy="12" rx="10" ry="3.2" fill="url(#mgrad2)" />
      <rect
        x="25"
        y="12"
        width="18"
        height="6"
        rx="3"
        fill="none"
        stroke="rgba(255,255,255,0.06)"
      />
      <text
        x="34"
        y="15"
        textAnchor="middle"
        fontSize="7"
        fontWeight="700"
        fill="#fff"
        style={{ fontFamily: "Space Grotesk, Inter, system-ui" }}
      >
        $
      </text>
    </g>
  </svg>
);
