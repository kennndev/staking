import { useEffect } from "react";
import useScrollReveal from "@/hooks/useScrollReveal";
import GamesSection from "@/components/GamesSection";

export default function Games() {
  useScrollReveal();

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
  }, []);

  return (
    <div id="games" className="relative min-h-screen">
      <div className="container py-12">
        <header className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-extrabold mb-4">
            <span className="text-gradient">Games</span>
          </h1>
          <p className="text-foreground/80 max-w-2xl mx-auto text-lg">
            Play interactive games and earn rewards based on your staking tier. 
            The more you stake, the more games you unlock!
          </p>
        </header>
        
        <GamesSection />
      </div>
    </div>
  );
}
