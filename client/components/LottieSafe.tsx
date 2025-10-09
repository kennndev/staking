import React, { useEffect, useState } from "react";

export default function LottieSafe({
  src,
  width = 48,
  height = 48,
  alt = "animation",
  style,
}: {
  src: string;
  width?: number;
  height?: number;
  alt?: string;
  style?: React.CSSProperties;
}) {
  // Always declare hooks at the top in a stable order
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch the lottie JSON as a blob and create an object URL
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(false);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    (async () => {
      try {
        const res = await fetch(src, { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to fetch lottie");
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setBlobUrl(objectUrl);
      } catch (e) {
        console.warn("LottieSafe: could not load", src, e);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
        clearTimeout(timeoutId);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [src]);

  // Ensure lottie-player script is loaded and custom element registered
  useEffect(() => {
    if (!blobUrl) return;
    let canceled = false;

    // If already available, mark ready
    try {
      if (
        (window as any).customElements &&
        (window as any).customElements.get("lottie-player")
      ) {
        setPlayerReady(true);
        return;
      }
    } catch (err) {
      // ignore
    }

    const scriptId = "lottie-player-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    let timeoutId: number | null = null;

    const onLoaded = () => {
      if (canceled) return;
      setPlayerReady(true);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
    const onError = () => {
      if (canceled) return;
      setError(true);
      if (timeoutId) window.clearTimeout(timeoutId);
    };

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src =
        "https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js";
      script.async = true;
      script.onload = onLoaded;
      script.onerror = onError;
      document.body.appendChild(script);
    } else {
      // some browsers may have it but customElements not yet defined
      if (
        (window as any).customElements &&
        (window as any).customElements.get("lottie-player")
      ) {
        onLoaded();
      } else {
        script.onload = onLoaded;
        script.onerror = onError;
      }
    }

    // safety timeout
    timeoutId = window.setTimeout(() => {
      if (!canceled) setError(true);
    }, 8000);

    return () => {
      canceled = true;
      if (script && script.onload === onLoaded) script.onload = null as any;
      if (script && script.onerror === onError) script.onerror = null as any;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [blobUrl]);

  // All hooks are declared before any conditional render

  // Render paths
  if (error) {
    return (
      <div
        role="img"
        aria-label={alt}
        style={{
          width,
          height,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          ...style,
        }}
      >
        <svg
          width={width}
          height={height}
          viewBox="0 0 48 48"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <defs>
            <linearGradient id="g1" x1="0" x2="1">
              <stop offset="0%" stopColor="hsl(var(--solana-mint))" />
              <stop offset="50%" stopColor="hsl(var(--solana-purple))" />
              <stop offset="100%" stopColor="hsl(var(--solana-pink))" />
            </linearGradient>
          </defs>
          <g transform="translate(24,24)">
            <g>
              <circle
                cx="0"
                cy="0"
                r="18"
                fill="none"
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="6"
              />
              <path
                d="M18 0 A18 18 0 0 1 0 -18"
                fill="none"
                stroke="url(#g1)"
                strokeWidth="6"
                strokeLinecap="round"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0"
                  to="360"
                  dur="1.8s"
                  repeatCount="indefinite"
                />
              </path>
            </g>
          </g>
        </svg>
      </div>
    );
  }

  if (loading || !blobUrl) {
    return (
      <div
        style={{
          width,
          height,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          ...style,
        }}
      >
        <div className="w-4 h-4 rounded-full bg-white/30 animate-pulse" />
      </div>
    );
  }

  if (!playerReady) {
    // show neutral fallback while player registers
    return (
      <div
        style={{
          width,
          height,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          ...style,
        }}
      >
        <svg
          width={width}
          height={height}
          viewBox="0 0 48 48"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <defs>
            <linearGradient id="g2" x1="0" x2="1">
              <stop offset="0%" stopColor="hsl(var(--solana-mint))" />
              <stop offset="50%" stopColor="hsl(var(--solana-purple))" />
              <stop offset="100%" stopColor="hsl(var(--solana-pink))" />
            </linearGradient>
          </defs>
          <g transform="translate(24,24)">
            <circle
              cx="0"
              cy="0"
              r="16"
              fill="none"
              stroke="rgba(255,255,255,0.03)"
              strokeWidth="6"
            />
            <path
              d="M16 0 A16 16 0 0 1 0 -16"
              fill="none"
              stroke="url(#g2)"
              strokeWidth="6"
              strokeLinecap="round"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0"
                to="360"
                dur="2s"
                repeatCount="indefinite"
              />
            </path>
          </g>
        </svg>
      </div>
    );
  }

  // Render the lottie-player element only when ready
  return (
    // @ts-ignore - custom element
    <lottie-player
      src={blobUrl}
      background="transparent"
      speed="1"
      loop
      autoplay
      style={{ width, height, ...style }}
    />
  );
}
