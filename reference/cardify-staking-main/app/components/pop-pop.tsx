'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface Position {
  x: number;
  y: number;
}

interface Balloon {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  colorName: string;
  emoji: string;
  isPopped: boolean;
  isAnimating: boolean;
  animationTime: number;
  fallSpeed: number;
}

interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface PowerUp {
  id: string;
  x: number;
  y: number;
  type: 'multiplier' | 'freeze' | 'magnet' | 'explosion';
  life: number;
  isActive: boolean;
}

interface GameState {
  isPlaying: boolean;
  isPaused: boolean;
  score: number;
  highScore: number;
  gameOver: boolean;
  level: number;
  lives: number;
  target: number;
  timeLeft: number;
  combo: number;
  multiplier: number;
  currentPrompt: string;
  promptColor: string;
  streak: number;
}

const BALLOON_COLORS = [
  { name: 'Red', color: '#ff6b6b', emoji: '🔴' },
  { name: 'Blue', color: '#4ecdc4', emoji: '🔵' },
  { name: 'Green', color: '#96ceb4', emoji: '🟢' },
  { name: 'Yellow', color: '#feca57', emoji: '🟡' },
  { name: 'Purple', color: '#a55eea', emoji: '🟣' },
  { name: 'Orange', color: '#ff6348', emoji: '🟠' },
  { name: 'Pink', color: '#ff9ff3', emoji: '🩷' },
  { name: 'Cyan', color: '#45b7d1', emoji: '🔷' }
];


export function PopPop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const mouseRef = useRef<Position>({ x: 0, y: 0 });
  const isMobileView = typeof window !== 'undefined' && window.innerWidth <= 768;

  const [gameState, setGameState] = useState<GameState>({
    isPlaying: false,
    isPaused: false,
    score: 0,
    highScore: 0,
    gameOver: false,
    level: 1,
    lives: 3,
    target: 1000,
    timeLeft: 60,
    combo: 0,
    multiplier: 1,
    currentPrompt: "Pop only RED balloons!",
    promptColor: "Red",
    streak: 0,
  });

  const [balloons, setBalloons] = useState<Balloon[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [powerUps, setPowerUps] = useState<PowerUp[]>([]);
  const [selectedBalloon, setSelectedBalloon] = useState<Balloon | null>(null);
  const [isShooting, setIsShooting] = useState(false);
  const [shootAngle, setShootAngle] = useState(0);
  const [spawnTimer, setSpawnTimer] = useState(0);

  const CANVAS_WIDTH = 1000; // Increased width to fill more space
  const CANVAS_HEIGHT = 600;
  const BALLOON_RADIUS = isMobileView ? 40 : 30; // Larger balloons on mobile for easier tapping
  const SPAWN_RATE = isMobileView ? 1500 : 1000; // Slower spawn rate on mobile

  const createBalloon = useCallback((x: number, y: number): Balloon => {
    const colorData = BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)];
    const fallSpeed = 1 + Math.random() * 2; // Random fall speed
    
    return {
      id: `${x}-${y}-${Date.now()}`,
      x,
      y,
      vx: (Math.random() - 0.5) * 2, // Slight horizontal drift
      vy: fallSpeed,
      radius: BALLOON_RADIUS,
      color: colorData.color,
      colorName: colorData.name,
      emoji: colorData.emoji,
      isPopped: false,
      isAnimating: false,
      animationTime: 0,
      fallSpeed,
    };
  }, []);

  const createParticle = useCallback((x: number, y: number, color: string): Particle => {
    return {
      id: `${x}-${y}-${Date.now()}`,
      x,
      y,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10,
      life: 30,
      maxLife: 30,
      color,
      size: Math.random() * 4 + 2,
    };
  }, []);

  const createPowerUp = useCallback((x: number, y: number): PowerUp => {
    const types: Array<'multiplier' | 'freeze' | 'magnet' | 'explosion'> = 
      ['multiplier', 'freeze', 'magnet', 'explosion'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    return {
      id: `${x}-${y}-${Date.now()}`,
      x,
      y,
      type,
      life: 300,
      isActive: false,
    };
  }, []);

  const generateNewPrompt = useCallback(() => {
    const c = BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)];
    setGameState(prev => ({
      ...prev,
      currentPrompt: `Pop only ${c.name.toUpperCase()} balloons!`,
      promptColor: c.name, // Keep canonical cased name
    }));
  }, []);

  const initGame = useCallback(() => {
    setBalloons([]);
    generateNewPrompt();
  }, [generateNewPrompt]);

  const spawnBalloon = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const x = Math.random() * (canvas.width - BALLOON_RADIUS * 2) + BALLOON_RADIUS;

    const preferPrompt = Math.random() < 0.7;
    const colorData = preferPrompt
      ? (BALLOON_COLORS.find(c => c.name === gameState.promptColor) ?? BALLOON_COLORS[0])
      : BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)];

    const newBalloon: Balloon = {
      id: `${x}-${-BALLOON_RADIUS}-${Date.now()}`,
      x,
      y: -BALLOON_RADIUS,
      vx: (Math.random() - 0.5) * 2,
      vy: 1 + Math.random() * 2,
      radius: BALLOON_RADIUS,
      color: colorData.color,
      colorName: colorData.name,
      emoji: colorData.emoji,
      isPopped: false,
      isAnimating: false,
      animationTime: 0,
      fallSpeed: 1 + Math.random() * 2,
    };

    setBalloons(prev => [...prev, newBalloon]);
  }, [gameState.promptColor]);

  const popBalloon = useCallback((balloon: Balloon, isCorrect: boolean) => {
    // Create particles for popped balloon
    const newParticles: Particle[] = [];
    for (let i = 0; i < 12; i++) {
      newParticles.push(createParticle(balloon.x, balloon.y, balloon.color));
    }
    setParticles(prev => [...prev, ...newParticles]);
    
    // Remove popped balloon
    setBalloons(prev => prev.filter(b => b.id !== balloon.id));
    
    // Calculate score based on correctness
    let scoreChange = 0;
    let streakChange = 0;
    
    if (isCorrect) {
      scoreChange = 10 + (gameState.streak * 5); // Bonus for streak
      streakChange = 1;
      
      // Check for new prompt after correct pop
      if (Math.random() < 0.3) {
        generateNewPrompt();
      }
    } else {
      scoreChange = -5; // Penalty for wrong color
      streakChange = -gameState.streak; // Reset streak
      
      // Lose a life for wrong pop
      setGameState(prev => ({
        ...prev,
        lives: prev.lives - 1,
        streak: 0,
      }));
    }
    
    setGameState(prev => {
      const nextScore = Math.max(0, prev.score + scoreChange);
      const nextStreak = Math.max(0, prev.streak + streakChange);
      return {
        ...prev,
        score: nextScore,
        streak: nextStreak,
        highScore: Math.max(prev.highScore, nextScore),
      };
    });
  }, [gameState.streak, createParticle, generateNewPrompt]);


  const startGame = () => {
    initGame();
    setGameState(prev => ({
      ...prev,
      isPlaying: true,
      isPaused: false,
      score: 0,
      gameOver: false,
      level: 1,
      lives: 3,
      target: 1000,
      timeLeft: 60,
      combo: 0,
      multiplier: 1,
      streak: 0,
    }));
    setSpawnTimer(0);
  };

  const pauseGame = () => {
    setGameState(prev => ({ ...prev, isPaused: !prev.isPaused }));
  };

  const gameLoop = useCallback((currentTime: number) => {
    if (!gameState.isPlaying || gameState.isPaused) {
      requestRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const deltaTime = currentTime - lastTimeRef.current;
    lastTimeRef.current = currentTime;

    // Update timer
    if (gameState.timeLeft > 0) {
      setGameState(prev => ({ ...prev, timeLeft: prev.timeLeft - deltaTime / 1000 }));
    } else {
      setGameState(prev => ({ ...prev, isPlaying: false, gameOver: true }));
    }

    // Check for game over conditions
    if (gameState.lives <= 0) {
      setGameState(prev => ({ ...prev, isPlaying: false, gameOver: true }));
    }

    // Spawn new balloons
    setSpawnTimer(prev => {
      const newTimer = prev + deltaTime;
      if (newTimer >= SPAWN_RATE) {
        spawnBalloon();
        return 0;
      }
      return newTimer;
    });

    // Update balloons physics
    setBalloons(prev => prev.map(balloon => {
      if (balloon.isPopped) return balloon;
      
      let newX = balloon.x + balloon.vx;
      const newY = balloon.y + balloon.vy;
      
      // Get current canvas dimensions
      const canvas = canvasRef.current;
      if (!canvas) return balloon;
      
      // Keep balloons within canvas boundaries
      newX = Math.max(BALLOON_RADIUS, Math.min(canvas.width - BALLOON_RADIUS, newX));
      
      // Remove balloons that fall off screen
      if (newY > canvas.height + BALLOON_RADIUS) {
        return { ...balloon, isPopped: true };
      }
      
      // Slight horizontal drift (but keep within bounds)
      const drift = (Math.random() - 0.5) * 0.5;
      newX = Math.max(BALLOON_RADIUS, Math.min(canvas.width - BALLOON_RADIUS, newX + drift));
      
      return {
        ...balloon,
        x: newX,
        y: newY,
      };
    }).filter(balloon => !balloon.isPopped));

    // Update particles
    setParticles(prev => prev
      .map(particle => ({
        ...particle,
        x: particle.x + particle.vx,
        y: particle.y + particle.vy,
        vy: particle.vy + 0.1, // gravity
        life: particle.life - 1,
      }))
      .filter(particle => particle.life > 0)
    );

    // Update power-ups
    setPowerUps(prev => prev
      .map(powerUp => ({ ...powerUp, life: powerUp.life - 1 }))
      .filter(powerUp => powerUp.life > 0)
    );

    // Render the game
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Set clipping region to prevent drawing outside canvas
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height);
      ctx.clip();
      
      // Clear canvas with gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#1a1a2e');
      gradient.addColorStop(1, '#16213e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw stars background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      for (let i = 0; i < 50; i++) {
        const x = (i * 7) % canvas.width;
        const y = (i * 11) % canvas.height;
        ctx.fillRect(x, y, 1, 1);
      }

      // Draw balloons
      balloons.forEach(balloon => {
        if (balloon.isPopped) return;
        
        const x = balloon.x;
        const y = balloon.y;
        const radius = balloon.radius;
        
        // Skip drawing if balloon is outside canvas bounds
        if (x < -radius || x > canvas.width + radius || y < -radius || y > canvas.height + radius) {
          return;
        }

        // Balloon shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(x + 3, y + 3, radius, 0, Math.PI * 2);
        ctx.fill();

        // Balloon body with gradient
        const balloonGradient = ctx.createRadialGradient(x - radius/3, y - radius/3, 0, x, y, radius);
        balloonGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        balloonGradient.addColorStop(0.6, balloon.color);
        balloonGradient.addColorStop(1, balloon.color + 'CC');
        
        ctx.fillStyle = balloonGradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Balloon highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(x - radius/3, y - radius/3, radius/3, 0, Math.PI * 2);
        ctx.fill();

        // Balloon string
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y + radius);
        ctx.lineTo(x + 5, y + radius + 15);
        ctx.stroke();

        // Color emoji
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(balloon.emoji, x, y + 7);
      });

      // Draw particles
      particles.forEach(particle => {
        const alpha = particle.life / particle.maxLife;
        ctx.fillStyle = particle.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw power-ups
      powerUps.forEach(powerUp => {
        const x = powerUp.x;
        const y = powerUp.y;
        
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#000000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('⚡', x, y + 4);
      });

      // Draw prompt
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, 10, canvas.width - 20, 60);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(gameState.currentPrompt, canvas.width / 2, 40);
      
      // Draw streak indicator
      if (gameState.streak > 0) {
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`STREAK: ${gameState.streak}`, 20, canvas.height - 20);
      }
      
      // Restore canvas context
      ctx.restore();
    }

    requestRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, balloons, particles, powerUps, spawnBalloon]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      const container = canvas.parentElement;
      if (container) {
        const containerRect = container.getBoundingClientRect();
        let availableWidth = containerRect.width;
        let availableHeight = containerRect.height;
        
        const maxWidth = Math.min(containerRect.width * 0.95, isMobileView ? 400 : 1200); // Smaller max width on mobile
        const maxHeight = Math.min(containerRect.height * 0.84, isMobileView ? 600 : 720);
        availableWidth = Math.min(availableWidth, maxWidth);
        availableHeight = Math.min(availableHeight, maxHeight);
        
        const isMobileCanvas = availableWidth <= 400;
        if (isMobileCanvas) {
          availableWidth = Math.max(availableWidth, 350); // Smaller minimum width for mobile
          availableHeight = Math.max(availableHeight, 500);
        }
        
        // Use the full available width for better coverage
        canvas.width = Math.floor(availableWidth);
        canvas.height = Math.floor(availableHeight);
        
        const pixelRatio = window.devicePixelRatio || 1;
        if (pixelRatio > 1 && !isMobileCanvas) {
          canvas.width *= pixelRatio;
          canvas.height *= pixelRatio;
          canvas.style.width = availableWidth + 'px';
          canvas.style.height = availableHeight + 'px';
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.scale(pixelRatio, pixelRatio);
          }
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const pixelRatio = window.devicePixelRatio || 1;
      const scale = canvas.width <= 400 ? 1 : pixelRatio;
      
      mouseRef.current = {
        x: (e.clientX - rect.left) * (canvas.width / rect.width / scale),
        y: (e.clientY - rect.top) * (canvas.height / rect.height / scale),
      };
    };

    const handleClick = (e: MouseEvent) => {
      if (!gameState.isPlaying || gameState.isPaused) return;
      
      const rect = canvas.getBoundingClientRect();
      const pixelRatio = window.devicePixelRatio || 1;
      const scale = canvas.width <= 400 ? 1 : pixelRatio;
      
      const x = (e.clientX - rect.left) * (canvas.width / rect.width / scale);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height / scale);
      
      setBalloons(current => {
        for (const b of current) {
          if (b.isPopped) continue;
          const dx = x - b.x, dy = y - b.y;
          if (Math.hypot(dx, dy) <= b.radius) {
            const isCorrect = b.colorName === gameState.promptColor;
            popBalloon(b, isCorrect); // use centralized logic
            b.isPopped = true;
            break; // prevent popping multiple with one click
          }
        }
        return current.filter(b => !b.isPopped);
      });
    };

    const handleTouch = (e: TouchEvent) => {
      if (!gameState.isPlaying || gameState.isPaused) return;
      
      e.preventDefault(); // Prevent scrolling
      
      const rect = canvas.getBoundingClientRect();
      const pixelRatio = window.devicePixelRatio || 1;
      const scale = canvas.width <= 400 ? 1 : pixelRatio;
      
      // Use the first touch point
      const touch = e.touches[0];
      const x = (touch.clientX - rect.left) * (canvas.width / rect.width / scale);
      const y = (touch.clientY - rect.top) * (canvas.height / rect.height / scale);
      
      setBalloons(current => {
        for (const b of current) {
          if (b.isPopped) continue;
          const dx = x - b.x, dy = y - b.y;
          if (Math.hypot(dx, dy) <= b.radius) {
            const isCorrect = b.colorName === gameState.promptColor;
            popBalloon(b, isCorrect); // use centralized logic
            b.isPopped = true;
            break; // prevent popping multiple with one touch
          }
        }
        return current.filter(b => !b.isPopped);
      });
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    
    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('touchstart', handleTouch);
    };
  }, [gameState.isPlaying, gameState.isPaused, balloons, createParticle, generateNewPrompt]);

  useEffect(() => {
    if (gameState.isPlaying && !gameState.isPaused) {
      requestRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [gameLoop, gameState.isPlaying, gameState.isPaused]);

  return (
    <div className="w-full h-full max-w-7xl mx-auto">
      <div className="h-full flex flex-col bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 backdrop-blur-sm rounded-lg border border-blue-500/20 p-2 sm:p-4 max-h-[96vh]">
        <div className={`flex justify-center items-center mb-2 gap-1 sm:gap-2 md:gap-4 ${isMobileView ? 'flex-wrap' : ''}`}>
          <div className="flex items-center gap-1">
            <span className="text-[8px] sm:text-[10px] md:text-xs text-blue-400/60 font-mono uppercase tracking-wider">SCORE</span>
            <span className="text-xs sm:text-sm md:text-base font-bold font-mono text-blue-400">{gameState.score.toString().padStart(6, '0')}</span>
          </div>
          <div className="text-blue-400/30">|</div>
          <div className="flex items-center gap-1">
            <span className="text-[8px] sm:text-[10px] md:text-xs text-purple-400/60 font-mono uppercase tracking-wider">LEVEL</span>
            <span className="text-xs sm:text-sm md:text-base font-bold font-mono text-purple-400">{gameState.level.toString().padStart(2, '0')}</span>
          </div>
          <div className="text-blue-400/30">|</div>
          <div className="flex items-center gap-1">
            <span className="text-[8px] sm:text-[10px] md:text-xs text-pink-400/60 font-mono uppercase tracking-wider">LIVES</span>
            <span className="text-xs sm:text-sm md:text-base font-bold font-mono text-pink-400">{gameState.lives}</span>
          </div>
          <div className="text-blue-400/30">|</div>
          <div className="flex items-center gap-1">
            <span className="text-[8px] sm:text-[10px] md:text-xs text-green-400/60 font-mono uppercase tracking-wider">TARGET</span>
            <span className="text-xs sm:text-sm md:text-base font-bold font-mono text-green-400">{gameState.target}</span>
          </div>
          <div className="text-blue-400/30">|</div>
          <div className="flex items-center gap-1">
            <span className="text-[8px] sm:text-[10px] md:text-xs text-yellow-400/60 font-mono uppercase tracking-wider">TIME</span>
            <span className="text-xs sm:text-sm md:text-base font-bold font-mono text-yellow-400">{Math.ceil(gameState.timeLeft)}</span>
          </div>
        </div>

        <div className="relative flex-1 flex items-center justify-center max-h-[72vh]">
          <canvas
            ref={canvasRef}
            className={`bg-black rounded touch-none select-none w-full h-full ${
              gameState.isPlaying && !gameState.isPaused 
                ? (isMobileView ? 'cursor-none' : 'cursor-crosshair')
                : 'cursor-default'
            }`}
            style={{ 
              imageRendering: 'pixelated',
              maxWidth: '100%',
              maxHeight: '100%',
              touchAction: 'none', // Prevent default touch behaviors
              userSelect: 'none', // Prevent text selection
            }}
          />
          
          {!gameState.isPlaying && !gameState.gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm rounded">
              <h1 className={`font-bold text-white mb-4 text-center ${isMobileView ? 'text-3xl' : 'text-4xl md:text-6xl'}`}>
                🫧 POP POP
              </h1>
              <p className={`text-gray-300 mb-2 text-center ${isMobileView ? 'text-base' : 'text-lg md:text-xl'}`}>
                {isMobileView ? 'Tap balloons to pop them!' : 'Click on balloons to pop them!'}
              </p>
              <p className={`text-gray-300 mb-8 text-center ${isMobileView ? 'text-sm' : 'text-lg md:text-xl'}`}>
                Only pop the color shown in the prompt - wrong colors cost lives!
              </p>
              <button
                onClick={startGame}
                className={`bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors duration-200 border-2 border-blue-400 ${
                  isMobileView ? 'px-6 py-3 text-lg' : 'px-8 py-4 text-xl'
                }`}
              >
                START POPPING
              </button>
            </div>
          )}

          {gameState.gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/50 backdrop-blur-sm rounded">
              <h1 className="text-4xl md:text-6xl font-bold text-red-400 mb-4 text-center">
                💥 GAME OVER
              </h1>
              <p className="text-2xl md:text-3xl text-white mb-2">
                Final Score: {gameState.score}
              </p>
              <p className="text-lg md:text-xl text-gray-300 mb-8">
                High Score: {gameState.highScore}
              </p>
              <button
                onClick={startGame}
                className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-bold text-xl rounded-lg transition-colors duration-200 border-2 border-red-400"
              >
                PLAY AGAIN
              </button>
            </div>
          )}

          {gameState.isPaused && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-900/50 backdrop-blur-sm rounded">
              <h1 className="text-4xl md:text-6xl font-bold text-blue-400 mb-8 text-center">
                ⏸️ PAUSED
              </h1>
              <button
                onClick={pauseGame}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xl rounded-lg transition-colors duration-200 border-2 border-blue-400"
              >
                RESUME GAME
              </button>
            </div>
          )}

          {gameState.isPlaying && !gameState.isPaused && (
            <div className={`absolute bottom-4 left-4 right-4 flex justify-between items-center text-white ${
              isMobileView ? 'text-xs' : 'text-sm'
            }`}>
              <div className="flex items-center gap-2">
                <span>{isMobileView ? 'Tap balloons to pop' : 'Click balloons to pop'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>Follow the prompt!</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
