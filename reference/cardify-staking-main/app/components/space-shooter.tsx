'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface Position {
  x: number;
  y: number;
}

interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'player' | 'enemy';
}

interface Enemy {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  health: number;
  maxHealth: number;
  type: 'basic' | 'fast' | 'heavy' | 'boss';
  lastShot: number;
  shootCooldown: number;
}

interface Explosion {
  id: number;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  size: number;
}

interface PowerUp {
  id: number;
  x: number;
  y: number;
  type: 'health' | 'rapid' | 'shield' | 'multi';
  life: number;
}

interface GameState {
  isPlaying: boolean;
  isPaused: boolean;
  score: number;
  highScore: number;
  gameOver: boolean;
  level: number;
  lives: number;
  health: number;
  maxHealth: number;
  powerUps: {
    rapid: number;
    shield: number;
    multi: number;
  };
}

export function SpaceShooter() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const mouseRef = useRef<Position>({ x: 0, y: 0 });
  const keysRef = useRef<Set<string>>(new Set());
  const isMobileView = typeof window !== 'undefined' && window.innerWidth <= 768;

  const [gameState, setGameState] = useState<GameState>({
    isPlaying: false,
    isPaused: false,
    score: 0,
    highScore: 0,
    gameOver: false,
    level: 1,
    lives: 3,
    health: 100,
    maxHealth: 100,
    powerUps: {
      rapid: 0,
      shield: 0,
      multi: 0,
    },
  });

  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  const [powerUps, setPowerUps] = useState<PowerUp[]>([]);
  const [player, setPlayer] = useState<Position>({ x: 0, y: 0 });
  const [isGenerating, setIsGenerating] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [progressPercentage, setProgressPercentage] = useState(0);

  const bulletIdRef = useRef(0);
  const enemyIdRef = useRef(0);
  const explosionIdRef = useRef(0);
  const powerUpIdRef = useRef(0);

  const createBullet = useCallback((x: number, y: number, vx: number, vy: number, type: 'player' | 'enemy' = 'player') => {
    const newBullet: Bullet = {
      id: bulletIdRef.current++,
      x,
      y,
      vx,
      vy,
      type,
    };
    setBullets(prev => [...prev, newBullet]);
  }, []);

  const createEnemy = useCallback((x: number, y: number, type: 'basic' | 'fast' | 'heavy' | 'boss' = 'basic') => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let health = 1;
    let vx = 0;
    let vy = 1;
    let shootCooldown = 2000;

    switch (type) {
      case 'basic':
        health = 1;
        vx = (Math.random() - 0.5) * 2;
        vy = 1;
        shootCooldown = 2000;
        break;
      case 'fast':
        health = 1;
        vx = (Math.random() - 0.5) * 4;
        vy = 2;
        shootCooldown = 1500;
        break;
      case 'heavy':
        health = 3;
        vx = (Math.random() - 0.5) * 1;
        vy = 0.5;
        shootCooldown = 3000;
        break;
      case 'boss':
        health = 20;
        vx = (Math.random() - 0.5) * 0.5;
        vy = 0.2;
        shootCooldown = 1000;
        break;
    }

    const newEnemy: Enemy = {
      id: enemyIdRef.current++,
      x,
      y,
      vx,
      vy,
      health,
      maxHealth: health,
      type,
      lastShot: 0,
      shootCooldown,
    };
    setEnemies(prev => [...prev, newEnemy]);
  }, []);

  const createExplosion = useCallback((x: number, y: number, size: number = 1) => {
    const newExplosion: Explosion = {
      id: explosionIdRef.current++,
      x,
      y,
      life: 30,
      maxLife: 30,
      size,
    };
    setExplosions(prev => [...prev, newExplosion]);
  }, []);

  const createPowerUp = useCallback((x: number, y: number) => {
    const types: Array<'health' | 'rapid' | 'shield' | 'multi'> = ['health', 'rapid', 'shield', 'multi'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    const newPowerUp: PowerUp = {
      id: powerUpIdRef.current++,
      x,
      y,
      type,
      life: 300, // 5 seconds at 60fps
    };
    setPowerUps(prev => [...prev, newPowerUp]);
  }, []);

  const initGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setPlayer({
      x: canvas.width / 2,
      y: canvas.height - 60,
    });
    setBullets([]);
    setEnemies([]);
    setExplosions([]);
    setPowerUps([]);
  }, []);

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
      health: 100,
      powerUps: {
        rapid: 0,
        shield: 0,
        multi: 0,
      },
    }));
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

    // Update player position based on mouse/keyboard
    const newPlayer = { ...player };
    newPlayer.x = mouseRef.current.x;
    newPlayer.y = Math.max(50, Math.min(canvas.height - 50, mouseRef.current.y));

    // Keep player in bounds
    newPlayer.x = Math.max(25, Math.min(canvas.width - 25, newPlayer.x));
    newPlayer.y = Math.max(50, Math.min(canvas.height - 50, newPlayer.y));

    setPlayer(newPlayer);

    // Handle shooting
    if (keysRef.current.has(' ') || keysRef.current.has('Space')) {
      const now = Date.now();
      const shootCooldown = gameState.powerUps.rapid > 0 ? 100 : 200;
      
      if (now - (lastTimeRef.current || 0) > shootCooldown) {
        if (gameState.powerUps.multi > 0) {
          // Multi-shot
          createBullet(newPlayer.x - 15, newPlayer.y, -2, -8);
          createBullet(newPlayer.x, newPlayer.y, 0, -8);
          createBullet(newPlayer.x + 15, newPlayer.y, 2, -8);
        } else {
          createBullet(newPlayer.x, newPlayer.y, 0, -8);
        }
        lastTimeRef.current = now;
      }
    }

    // Update bullets
    setBullets(prev => prev
      .map(bullet => ({
        ...bullet,
        x: bullet.x + bullet.vx,
        y: bullet.y + bullet.vy,
      }))
      .filter(bullet => 
        bullet.x > -10 && bullet.x < canvas.width + 10 &&
        bullet.y > -10 && bullet.y < canvas.height + 10
      )
    );

    // Update enemies
    setEnemies(prev => prev
      .map(enemy => {
        const newEnemy = { ...enemy };
        newEnemy.x += newEnemy.vx;
        newEnemy.y += newEnemy.vy;

        // Enemy shooting
        const now = Date.now();
        if (now - newEnemy.lastShot > newEnemy.shootCooldown) {
          createBullet(newEnemy.x, newEnemy.y + 20, 0, 3, 'enemy');
          newEnemy.lastShot = now;
        }

        return newEnemy;
      })
      .filter(enemy => enemy.y < canvas.height + 50)
    );

    // Spawn enemies
    if (Math.random() < 0.02 + (gameState.level * 0.005)) {
      const types: Array<'basic' | 'fast' | 'heavy' | 'boss'> = ['basic', 'basic', 'fast'];
      if (gameState.level > 3) types.push('heavy');
      if (gameState.level > 5) types.push('boss');
      
      const type = types[Math.floor(Math.random() * types.length)];
      createEnemy(Math.random() * canvas.width, -30, type);
    }

    // Spawn power-ups
    if (Math.random() < 0.001) {
      createPowerUp(Math.random() * canvas.width, -30);
    }

    // Update power-ups
    setPowerUps(prev => prev
      .map(powerUp => ({ ...powerUp, life: powerUp.life - 1 }))
      .filter(powerUp => powerUp.life > 0)
    );

    // Update explosions
    setExplosions(prev => prev
      .map(explosion => ({ ...explosion, life: explosion.life - 1 }))
      .filter(explosion => explosion.life > 0)
    );

    // Collision detection
    const newBullets = [...bullets];
    const newEnemies = [...enemies];
    const newPowerUps = [...powerUps];
    let newScore = gameState.score;
    let newHealth = gameState.health;
    let newLives = gameState.lives;
    const newPowerUpsState = { ...gameState.powerUps };

    // Player bullets vs enemies
    for (let i = newBullets.length - 1; i >= 0; i--) {
      const bullet = newBullets[i];
      if (bullet.type !== 'player') continue;

      for (let j = newEnemies.length - 1; j >= 0; j--) {
        const enemy = newEnemies[j];
        const dx = bullet.x - enemy.x;
        const dy = bullet.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 20) {
          newBullets.splice(i, 1);
          enemy.health--;
          newScore += enemy.type === 'boss' ? 50 : enemy.type === 'heavy' ? 20 : 10;
          
          if (enemy.health <= 0) {
            createExplosion(enemy.x, enemy.y, enemy.type === 'boss' ? 3 : 1);
            newEnemies.splice(j, 1);
          }
          break;
        }
      }
    }

    // Enemy bullets vs player
    for (let i = newBullets.length - 1; i >= 0; i--) {
      const bullet = newBullets[i];
      if (bullet.type !== 'enemy') continue;

      const dx = bullet.x - newPlayer.x;
      const dy = bullet.y - newPlayer.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 25) {
        newBullets.splice(i, 1);
        if (newPowerUpsState.shield <= 0) {
          newHealth -= 20;
          createExplosion(bullet.x, bullet.y, 1);
        }
      }
    }

    // Player vs enemies
    for (let i = newEnemies.length - 1; i >= 0; i--) {
      const enemy = newEnemies[i];
      const dx = enemy.x - newPlayer.x;
      const dy = enemy.y - newPlayer.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 30) {
        createExplosion(enemy.x, enemy.y, 2);
        newEnemies.splice(i, 1);
        if (newPowerUpsState.shield <= 0) {
          newHealth -= 30;
        }
      }
    }

    // Player vs power-ups
    for (let i = newPowerUps.length - 1; i >= 0; i--) {
      const powerUp = newPowerUps[i];
      const dx = powerUp.x - newPlayer.x;
      const dy = powerUp.y - newPlayer.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 25) {
        newPowerUps.splice(i, 1);
        
        switch (powerUp.type) {
          case 'health':
            newHealth = Math.min(100, newHealth + 30);
            break;
          case 'rapid':
            newPowerUpsState.rapid = Math.max(newPowerUpsState.rapid, 300);
            break;
          case 'shield':
            newPowerUpsState.shield = Math.max(newPowerUpsState.shield, 600);
            break;
          case 'multi':
            newPowerUpsState.multi = Math.max(newPowerUpsState.multi, 300);
            break;
        }
      }
    }

    // Update power-up timers
    if (newPowerUpsState.rapid > 0) newPowerUpsState.rapid--;
    if (newPowerUpsState.shield > 0) newPowerUpsState.shield--;
    if (newPowerUpsState.multi > 0) newPowerUpsState.multi--;

    // Check game over
    if (newHealth <= 0) {
      newLives--;
      if (newLives <= 0) {
        setGameState(prev => ({
          ...prev,
          isPlaying: false,
          gameOver: true,
          highScore: Math.max(prev.highScore, newScore),
        }));
      } else {
        newHealth = 100;
        newPlayer.x = canvas.width / 2;
        newPlayer.y = canvas.height - 60;
      }
    }

    // Level progression
    const newLevel = Math.floor(newScore / 1000) + 1;
    if (newLevel > gameState.level) {
      setGameState(prev => ({ ...prev, level: newLevel }));
    }

    setBullets(newBullets);
    setEnemies(newEnemies);
    setPowerUps(newPowerUps);
    setGameState(prev => ({
      ...prev,
      score: newScore,
      health: newHealth,
      lives: newLives,
      powerUps: newPowerUpsState,
    }));

    // Render the game
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Clear canvas
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw stars background
      ctx.fillStyle = 'white';
      for (let i = 0; i < 100; i++) {
        const x = (i * 7) % canvas.width;
        const y = (i * 11) % canvas.height;
        ctx.fillRect(x, y, 1, 1);
      }

      // Draw player
      ctx.fillStyle = gameState.powerUps.shield > 0 ? '#00ffff' : '#ffffff';
      ctx.beginPath();
      ctx.moveTo(newPlayer.x, newPlayer.y - 20);
      ctx.lineTo(newPlayer.x - 15, newPlayer.y + 10);
      ctx.lineTo(newPlayer.x + 15, newPlayer.y + 10);
      ctx.closePath();
      ctx.fill();

      // Draw bullets
      ctx.fillStyle = '#ffff00';
      bullets.forEach(bullet => {
        ctx.fillRect(bullet.x - 2, bullet.y - 2, 4, 4);
      });

      // Draw enemies
      enemies.forEach(enemy => {
        let color = '#ff0000';
        let size = 15;
        
        switch (enemy.type) {
          case 'fast':
            color = '#ff8800';
            size = 12;
            break;
          case 'heavy':
            color = '#8800ff';
            size = 20;
            break;
          case 'boss':
            color = '#ff0088';
            size = 30;
            break;
        }

        ctx.fillStyle = color;
        ctx.fillRect(enemy.x - size/2, enemy.y - size/2, size, size);
      });

      // Draw power-ups
      powerUps.forEach(powerUp => {
        let color = '#00ff00';
        switch (powerUp.type) {
          case 'health':
            color = '#ff0000';
            break;
          case 'rapid':
            color = '#ffff00';
            break;
          case 'shield':
            color = '#00ffff';
            break;
          case 'multi':
            color = '#ff00ff';
            break;
        }
        ctx.fillStyle = color;
        ctx.fillRect(powerUp.x - 8, powerUp.y - 8, 16, 16);
      });

      // Draw explosions
      explosions.forEach(explosion => {
        const alpha = explosion.life / explosion.maxLife;
        ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, explosion.size * alpha * 20, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    requestRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, player, bullets, enemies, powerUps, createBullet, createEnemy, createExplosion, createPowerUp]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      const container = canvas.parentElement;
      if (container) {
        const containerRect = container.getBoundingClientRect();
        let availableWidth = containerRect.width;
        let availableHeight = containerRect.height;
        
        // Responsive game screen size
        const maxWidth = Math.min(containerRect.width * 0.9, 1000);
        const maxHeight = Math.min(containerRect.height * 0.84, 720);
        availableWidth = Math.min(availableWidth, maxWidth);
        availableHeight = Math.min(availableHeight, maxHeight);
        
        const isMobileCanvas = availableWidth <= 400;
        if (isMobileCanvas) {
          availableWidth = Math.max(availableWidth, 400);
          availableHeight = Math.max(availableHeight, 500);
        }
        
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
        
        setPlayer({
          x: canvas.width / (pixelRatio > 1 && !isMobileCanvas ? pixelRatio : 1) / 2,
          y: canvas.height / (pixelRatio > 1 && !isMobileCanvas ? pixelRatio : 1) - 60,
        });
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

    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);
      if (e.code === 'Space') {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const pixelRatio = window.devicePixelRatio || 1;
      const scale = canvas.width <= 400 ? 1 : pixelRatio;
      
      mouseRef.current = {
        x: (touch.clientX - rect.left) * (canvas.width / rect.width / scale),
        y: (touch.clientY - rect.top) * (canvas.height / rect.height / scale),
      };
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      keysRef.current.add('Space');
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      keysRef.current.delete('Space');
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

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
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 backdrop-blur-sm rounded-lg border border-purple-500/20 p-2 sm:p-4 max-h-[96vh]">
        <div className="flex justify-center items-center mb-2 gap-2 sm:gap-4 md:gap-6">
          <div className="flex items-center gap-1">
            <span className="text-[10px] sm:text-xs text-purple-400/60 font-mono uppercase tracking-wider">SCORE</span>
            <span className="text-sm sm:text-base md:text-lg font-bold font-mono text-purple-400">{gameState.score.toString().padStart(6, '0')}</span>
          </div>
          <div className="text-purple-400/30">|</div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] sm:text-xs text-blue-400/60 font-mono uppercase tracking-wider">LEVEL</span>
            <span className="text-sm sm:text-base md:text-lg font-bold font-mono text-blue-400">{gameState.level.toString().padStart(2, '0')}</span>
          </div>
          <div className="text-purple-400/30">|</div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] sm:text-xs text-green-400/60 font-mono uppercase tracking-wider">LIVES</span>
            <span className="text-sm sm:text-base md:text-lg font-bold font-mono text-green-400">{'🚀'.repeat(gameState.lives)}</span>
          </div>
          <div className="text-purple-400/30">|</div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] sm:text-xs text-red-400/60 font-mono uppercase tracking-wider">HEALTH</span>
            <span className="text-sm sm:text-base md:text-lg font-bold font-mono text-red-400">{gameState.health}</span>
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
            }}
          />
          
          {!gameState.isPlaying && !gameState.gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm rounded">
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 text-center">
                🚀 SPACE SHOOTER
              </h1>
              <p className="text-lg md:text-xl text-gray-300 mb-2 text-center">
                Move mouse to control ship
              </p>
              <p className="text-lg md:text-xl text-gray-300 mb-8 text-center">
                Press SPACE or click to shoot
              </p>
              <button
                onClick={startGame}
                className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xl rounded-lg transition-colors duration-200 border-2 border-purple-400"
              >
                START MISSION
              </button>
            </div>
          )}

          {gameState.gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/50 backdrop-blur-sm rounded">
              <h1 className="text-4xl md:text-6xl font-bold text-red-400 mb-4 text-center">
                💥 MISSION FAILED
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
                RETRY MISSION
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
                RESUME MISSION
              </button>
            </div>
          )}

          {gameState.isPlaying && !gameState.isPaused && (
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center text-white text-sm">
              <div className="flex items-center gap-2">
                <span>Move: Mouse</span>
              </div>
              <div className="flex items-center gap-2">
                <span>Shoot: Space/Click</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
