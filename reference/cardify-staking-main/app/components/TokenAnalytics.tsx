'use client';

export default function TokenAnalytics() {


  return (
    <div className="h-screen flex flex-col">
      {/* Full Screen DEX Screener Embed */}
      <div className="flex-1 relative">
        <iframe 
          src="https://dexscreener.com/solana/6mpafrxmywfyojaunxdqgw9sq2mhpuh3d6daw3xipump?embed=1&loadChartSettings=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15"
          style={{
            width: '100%',
            height: '100%',
            border: 0
          }}
          title="DEX Screener Chart"
        />
      </div>
    </div>
  );
}
