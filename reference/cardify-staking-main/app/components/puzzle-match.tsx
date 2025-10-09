'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface Position {
  x: number;
  y: number;
}

interface Gem {
  id: string;
  x: number;
  y: number;
  type: number;
  color: string;
  isSelected: boolean;
  isMatched: boolean;
  isAnimating: boolean;
}

interface GameState {
  isPlaying: boolean;
  isPaused: boolean;
  score: number;
  highScore: number;
  gameOver: boolean;
  level: number;
  moves: number;
  target: number;
  timeLeft: number;
  combo: number;
}

const GEM_TYPES = [
  { color: '#ff6b6b', emoji: '💎' },
  { color: '#4ecdc4', emoji: '🔵' },
  { color: '#45b7d1', emoji: '🔷' },
  { color: '#96ceb4', emoji: '🟢' },
  { color: '#feca57', emoji: '🟡' },
  { color: '#ff9ff3', emoji: '🟣' },
  { color: '#ff6348', emoji: '🟠' },
  { color: '#a55eea', emoji: '🟣' },
];

// Pure helper functions
type Board = Gem[];

function getGemAtFrom(board: Board, x: number, y: number) {
  return board.find(g => g.x === x && g.y === y);
}

function cloneBoard(board: Board): Board {
  return board.map(g => ({ ...g }));
}

function findMatchesOn(board: Board, W: number, H: number): Gem[] {
  const matches: Gem[] = [];

  // horizontal
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W - 2; x++) {
      const a = getGemAtFrom(board, x, y);
      const b = getGemAtFrom(board, x + 1, y);
      const c = getGemAtFrom(board, x + 2, y);
      if (a && b && c && a.type === b.type && b.type === c.type) {
        if (!matches.some(m => m.id === a.id)) matches.push(a);
        if (!matches.some(m => m.id === b.id)) matches.push(b);
        if (!matches.some(m => m.id === c.id)) matches.push(c);
      }
    }
  }

  // vertical
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H - 2; y++) {
      const a = getGemAtFrom(board, x, y);
      const b = getGemAtFrom(board, x, y + 1);
      const c = getGemAtFrom(board, x, y + 2);
      if (a && b && c && a.type === b.type && b.type === c.type) {
        if (!matches.some(m => m.id === a.id)) matches.push(a);
        if (!matches.some(m => m.id === b.id)) matches.push(b);
        if (!matches.some(m => m.id === c.id)) matches.push(c);
      }
    }
  }

  return matches;
}

function markMatchesOn(board: Board, matches: Gem[]): Board {
  const ids = new Set(matches.map(m => m.id));
  return board.map(g => (ids.has(g.id) ? { ...g, isMatched: true } : g));
}

function dropOn(board: Board, W: number, H: number, createGem: (x: number, y: number) => Gem): Board {
  const next: Gem[] = [];
  for (let x = 0; x < W; x++) {
    const column = board
      .filter(g => g.x === x && !g.isMatched)
      .sort((a, b) => b.y - a.y);

    column.forEach((g, i) => next.push({ ...g, x, y: H - 1 - i }));

    const missing = H - column.length;
    for (let i = 0; i < missing; i++) {
      next.push(createGem(x, i));
    }
  }
  return next;
}

/** Resolve cascades until no matches remain. Returns {board, totalCleared} */
function resolveBoard(board: Board, W: number, H: number, createGem: (x: number, y: number) => Gem) {
  let working = cloneBoard(board);
  let totalCleared = 0;

  while (true) {
    const matches = findMatchesOn(working, W, H);
    if (matches.length === 0) break;

    totalCleared += matches.length;
    working = markMatchesOn(working, matches);
    working = dropOn(working, W, H, createGem);
  }

  return { board: working, totalCleared };
}

export function PuzzleMatch() {
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
    moves: 30,
    target: 1000,
    timeLeft: 60,
    combo: 0,
  });

  const [showShuffleButton, setShowShuffleButton] = useState(false);

  const [gems, setGems] = useState<Gem[]>([]);
  const [selectedGem, setSelectedGem] = useState<Gem | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [progressPercentage, setProgressPercentage] = useState(0);
  
  // Animation states
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'blasting' | 'falling' | 'filling'>('idle');
  const [matchedGems, setMatchedGems] = useState<Gem[]>([]);
  const [fallingGems, setFallingGems] = useState<Gem[]>([]);

  const BOARD_WIDTH = 8;
  const BOARD_HEIGHT = 8;
  const GEM_SIZE = isMobileView ? 60 : 50; // Larger gems on mobile for easier tapping
  const BOARD_PADDING = 20;

  const createGem = useCallback((x: number, y: number, type?: number): Gem => {
    const gemType = type !== undefined ? type : Math.floor(Math.random() * GEM_TYPES.length);
    return {
      id: `${x}-${y}-${Date.now()}`,
      x,
      y,
      type: gemType,
      color: GEM_TYPES[gemType].color,
      isSelected: false,
      isMatched: false,
      isAnimating: false,
    };
  }, []);

  const initBoard = useCallback(() => {
    const newGems: Gem[] = [];
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        newGems.push(createGem(x, y));
      }
    }
    setGems(newGems);
  }, [createGem]);

  const getGemAt = useCallback((x: number, y: number) => {
    return gems.find(gem => gem.x === x && gem.y === y);
  }, [gems]);

  // Old functions removed - now using pure helper functions

  const checkPossibleMoves = useCallback(() => {
    // Check all possible swaps using pure functions
    for (let x = 0; x < BOARD_WIDTH; x++) {
      for (let y = 0; y < BOARD_HEIGHT; y++) {
        const gem = getGemAtFrom(gems, x, y);
        if (!gem) continue;

        // Check right neighbor
        if (x < BOARD_WIDTH - 1) {
          const rightGem = getGemAtFrom(gems, x + 1, y);
          if (rightGem) {
            // Try swapping with right neighbor
            const tempGems = gems.map(g => {
              if (g.id === gem.id) return { ...g, x: x + 1, y };
              if (g.id === rightGem.id) return { ...g, x, y };
              return g;
            });

            const matches = findMatchesOn(tempGems, BOARD_WIDTH, BOARD_HEIGHT);
            if (matches.length > 0) return true;
          }
        }

        // Check bottom neighbor
        if (y < BOARD_HEIGHT - 1) {
          const bottomGem = getGemAtFrom(gems, x, y + 1);
          if (bottomGem) {
            // Try swapping with bottom neighbor
            const tempGems = gems.map(g => {
              if (g.id === gem.id) return { ...g, x, y: y + 1 };
              if (g.id === bottomGem.id) return { ...g, x, y };
              return g;
            });

            const matches = findMatchesOn(tempGems, BOARD_WIDTH, BOARD_HEIGHT);
            if (matches.length > 0) return true;
          }
        }
      }
    }
    return false;
  }, [gems]);

  const shuffleBoard = useCallback(() => {
    setGems(prevGems => {
      const newGems = [...prevGems];
      const gemTypes = [...newGems];
      
      // Shuffle the types
      for (let i = gemTypes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [gemTypes[i].type, gemTypes[j].type] = [gemTypes[j].type, gemTypes[i].type];
      }
      
      // Assign new types
      const shuffled = newGems.map((gem, index) => ({
        ...gem,
        type: gemTypes[index].type,
        color: GEM_TYPES[gemTypes[index].type].color,
      }));

      // Resolve any matches created by shuffling
      const { board: resolved, totalCleared } = resolveBoard(shuffled, BOARD_WIDTH, BOARD_HEIGHT, (x, y) => createGem(x, y));
      
      if (totalCleared > 0) {
        const base = totalCleared * 10;
        const comboMult = Math.floor(totalCleared / 3) + 1;
        const add = base * comboMult;

        setGameState(p => ({
          ...p,
          score: p.score + add,
          combo: totalCleared >= 5 ? p.combo + 1 : 0,
        }));
      }

      return resolved;
    });
    setShowShuffleButton(false);
  }, [createGem]);

  const handleGemClick = useCallback((clickedGem: Gem) => {
    if (!gameState.isPlaying || gameState.isPaused) return;

    if (selectedGem) {
      if (selectedGem.id === clickedGem.id) {
        setSelectedGem(null);
        return;
      }

      // Check if gems are adjacent
      const dx = Math.abs(clickedGem.x - selectedGem.x);
      const dy = Math.abs(clickedGem.y - selectedGem.y);
      
      if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
        // Perform the swap immediately
        setGems(prev => {
          const temp = prev.map(g => {
            if (g.id === selectedGem.id) return { ...g, x: clickedGem.x, y: clickedGem.y };
            if (g.id === clickedGem.id) return { ...g, x: selectedGem.x, y: selectedGem.y };
            return g;
          });
          return temp;
        });

        // Check for matches after a brief delay
        setTimeout(() => {
          setGems(currentGems => {
            const matches = findMatchesOn(currentGems, BOARD_WIDTH, BOARD_HEIGHT);

            if (matches.length === 0) {
              // No match - revert the swap and don't count the move
              setGems(prev => {
                const reverted = prev.map(g => {
                  if (g.id === selectedGem.id) return { ...g, x: clickedGem.x, y: clickedGem.y };
                  if (g.id === clickedGem.id) return { ...g, x: selectedGem.x, y: selectedGem.y };
                  return g;
                });
                return reverted;
              });
              return currentGems;
            }

            // Start animation sequence
            setMatchedGems(matches);
            setAnimationPhase('blasting');
            
            // After blasting animation, start falling
            setTimeout(() => {
              setAnimationPhase('falling');
              
              // After falling animation, resolve the board
              setTimeout(() => {
                const { board: resolved, totalCleared } = resolveBoard(currentGems, BOARD_WIDTH, BOARD_HEIGHT, (x, y) => createGem(x, y));
                
                // Score the matches
                const base = totalCleared * 10;
                const comboMult = Math.floor(totalCleared / 3) + 1;
                const add = base * comboMult;

                setGameState(p => ({
                  ...p,
                  score: p.score + add,
                  combo: totalCleared >= 5 ? p.combo + 1 : 0,
                  moves: p.moves - 1,
                }));

                setGems(resolved);
                setAnimationPhase('idle');
                setMatchedGems([]);
                setFallingGems([]);
              }, 800); // Falling animation duration
            }, 600); // Blasting animation duration

            return currentGems;
          });
        }, 200); // Swap animation duration
      }

      setSelectedGem(null);
    } else {
      setSelectedGem(clickedGem);
    }
  }, [gameState.isPlaying, gameState.isPaused, selectedGem, createGem]);

  const startGame = () => {
    initBoard();
    setGameState(prev => ({
      ...prev,
      isPlaying: true,
      isPaused: false,
      score: 0,
      gameOver: false,
      level: 1,
      moves: 30,
      target: 1000,
      timeLeft: 60,
      combo: 0,
    }));
    
    // Remove any initial matches after board is created
    setTimeout(() => {
      setGems(prevGems => {
        const { board: resolved, totalCleared } = resolveBoard(prevGems, BOARD_WIDTH, BOARD_HEIGHT, (x, y) => createGem(x, y));
        
        if (totalCleared > 0) {
          const base = totalCleared * 10;
          const comboMult = Math.floor(totalCleared / 3) + 1;
          const add = base * comboMult;

          setGameState(p => ({
            ...p,
            score: p.score + add,
            combo: totalCleared >= 5 ? p.combo + 1 : 0,
          }));
        }

        return resolved;
      });
    }, 200);
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

    // Check win condition
    if (gameState.score >= gameState.target) {
      setGameState(prev => ({ ...prev, level: prev.level + 1, target: prev.target + 500, moves: 30, timeLeft: 60 }));
    }

    // Check lose condition
    if (gameState.moves <= 0) {
      setGameState(prev => ({ ...prev, isPlaying: false, gameOver: true }));
    }

    // Check for possible moves
    if (gameState.isPlaying && !gameState.isPaused) {
      const hasPossibleMoves = checkPossibleMoves();
      setShowShuffleButton(!hasPossibleMoves);
    }

    // Render the game
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Clear canvas
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw board background
      const boardX = (canvas.width - (BOARD_WIDTH * GEM_SIZE)) / 2;
      const boardY = (canvas.height - (BOARD_HEIGHT * GEM_SIZE)) / 2;
      
      ctx.fillStyle = '#16213e';
      ctx.fillRect(boardX - BOARD_PADDING, boardY - BOARD_PADDING, 
                  BOARD_WIDTH * GEM_SIZE + BOARD_PADDING * 2, 
                  BOARD_HEIGHT * GEM_SIZE + BOARD_PADDING * 2);

      // Draw gems with animation effects
      gems.forEach(gem => {
        const x = boardX + gem.x * GEM_SIZE;
        const y = boardY + gem.y * GEM_SIZE;

        // Check if this gem is being blasted
        const isBlasting = matchedGems.some(m => m.id === gem.id);
        
        if (isBlasting && animationPhase === 'blasting') {
          // Draw blasting effect - pulsing and fading
          const pulse = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;
          const alpha = Math.max(0, 1 - (Date.now() % 600) / 600);
          
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
          ctx.fillRect(x - 4, y - 4, GEM_SIZE + 8, GEM_SIZE + 8);
          
          ctx.fillStyle = gem.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
          ctx.fillRect(x, y, GEM_SIZE - 4, GEM_SIZE - 4);
          
          // Draw explosion effect
          ctx.fillStyle = `rgba(255, 255, 0, ${alpha * 0.6})`;
          ctx.beginPath();
          ctx.arc(x + GEM_SIZE/2, y + GEM_SIZE/2, pulse * 15, 0, Math.PI * 2);
          ctx.fill();
          
          return;
        }

        // Skip matched gems during falling phase
        if (gem.isMatched && animationPhase === 'falling') return;

        // Draw gem shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(x + 2, y + 2, GEM_SIZE - 4, GEM_SIZE - 4);

        // Draw gem
        if (gem.isSelected) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x - 2, y - 2, GEM_SIZE + 4, GEM_SIZE + 4);
        }

        ctx.fillStyle = gem.color;
        ctx.fillRect(x, y, GEM_SIZE - 4, GEM_SIZE - 4);

        // Draw gem highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(x, y, GEM_SIZE - 4, 8);

        // Draw gem emoji
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(GEM_TYPES[gem.type].emoji, x + (GEM_SIZE - 4) / 2, y + (GEM_SIZE - 4) / 2 + 8);
      });

      // Draw selection indicator
      if (selectedGem) {
        const x = boardX + selectedGem.x * GEM_SIZE;
        const y = boardY + selectedGem.y * GEM_SIZE;
        
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 3;
        ctx.strokeRect(x - 2, y - 2, GEM_SIZE + 4, GEM_SIZE + 4);
      }
    }

    requestRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, gems, selectedGem]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      const container = canvas.parentElement;
      if (container) {
        const containerRect = container.getBoundingClientRect();
        let availableWidth = containerRect.width;
        let availableHeight = containerRect.height;
        
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
      const rect = canvas.getBoundingClientRect();
      const pixelRatio = window.devicePixelRatio || 1;
      const scale = canvas.width <= 400 ? 1 : pixelRatio;
      
      const x = (e.clientX - rect.left) * (canvas.width / rect.width / scale);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height / scale);

      const boardX = (canvas.width - (BOARD_WIDTH * GEM_SIZE)) / 2;
      const boardY = (canvas.height - (BOARD_HEIGHT * GEM_SIZE)) / 2;

      const gemX = Math.floor((x - boardX) / GEM_SIZE);
      const gemY = Math.floor((y - boardY) / GEM_SIZE);

      if (gemX >= 0 && gemX < BOARD_WIDTH && gemY >= 0 && gemY < BOARD_HEIGHT) {
        const clickedGem = getGemAt(gemX, gemY);
        if (clickedGem) {
          handleGemClick(clickedGem);
        }
      }
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

      const boardX = (canvas.width - (BOARD_WIDTH * GEM_SIZE)) / 2;
      const boardY = (canvas.height - (BOARD_HEIGHT * GEM_SIZE)) / 2;

      const gemX = Math.floor((x - boardX) / GEM_SIZE);
      const gemY = Math.floor((y - boardY) / GEM_SIZE);

      if (gemX >= 0 && gemX < BOARD_WIDTH && gemY >= 0 && gemY < BOARD_HEIGHT) {
        const clickedGem = getGemAt(gemX, gemY);
        if (clickedGem) {
          handleGemClick(clickedGem);
        }
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    
    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('touchstart', handleTouch);
    };
  }, [getGemAt, handleGemClick]);

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
      <div className="h-full flex flex-col bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900 backdrop-blur-sm rounded-lg border border-pink-500/20 p-2 sm:p-4 max-h-[96vh]">
        <div className={`flex justify-center items-center mb-2 gap-1 sm:gap-2 md:gap-4 ${isMobileView ? 'flex-wrap' : ''}`}>
          <div className="flex items-center gap-1">
            <span className="text-[8px] sm:text-[10px] md:text-xs text-pink-400/60 font-mono uppercase tracking-wider">SCORE</span>
            <span className="text-xs sm:text-sm md:text-base font-bold font-mono text-pink-400">{gameState.score.toString().padStart(6, '0')}</span>
          </div>
          <div className="text-pink-400/30">|</div>
          <div className="flex items-center gap-1">
            <span className="text-[8px] sm:text-[10px] md:text-xs text-purple-400/60 font-mono uppercase tracking-wider">LEVEL</span>
            <span className="text-xs sm:text-sm md:text-base font-bold font-mono text-purple-400">{gameState.level.toString().padStart(2, '0')}</span>
          </div>
          <div className="text-pink-400/30">|</div>
          <div className="flex items-center gap-1">
            <span className="text-[8px] sm:text-[10px] md:text-xs text-blue-400/60 font-mono uppercase tracking-wider">MOVES</span>
            <span className="text-xs sm:text-sm md:text-base font-bold font-mono text-blue-400">{gameState.moves}</span>
          </div>
          <div className="text-pink-400/30">|</div>
          <div className="flex items-center gap-1">
            <span className="text-[8px] sm:text-[10px] md:text-xs text-green-400/60 font-mono uppercase tracking-wider">TARGET</span>
            <span className="text-xs sm:text-sm md:text-base font-bold font-mono text-green-400">{gameState.target}</span>
          </div>
          <div className="text-pink-400/30">|</div>
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
                ? (isMobileView ? 'cursor-none' : 'cursor-pointer')
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
                💎 PUZZLE MATCH
              </h1>
              <p className={`text-gray-300 mb-2 text-center ${isMobileView ? 'text-base' : 'text-lg md:text-xl'}`}>
                {isMobileView ? 'Tap gems to match 3+' : 'Match 3 or more gems to score points'}
              </p>
              <p className={`text-gray-300 mb-8 text-center ${isMobileView ? 'text-sm' : 'text-lg md:text-xl'}`}>
                {isMobileView ? 'Tap adjacent gems to swap' : 'Click gems to swap and create matches'}
              </p>
              <button
                onClick={startGame}
                className={`bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-lg transition-colors duration-200 border-2 border-pink-400 ${
                  isMobileView ? 'px-6 py-3 text-lg' : 'px-8 py-4 text-xl'
                }`}
              >
                START PUZZLE
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
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center text-white text-sm">
              <div className="flex items-center gap-2">
                <span>Click gems to swap</span>
              </div>
              <div className="flex items-center gap-2">
                <span>Match 3+ to score</span>
              </div>
            </div>
          )}

          {showShuffleButton && gameState.isPlaying && !gameState.isPaused && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded">
              <div className="bg-purple-900/90 border border-pink-500/50 rounded-lg p-6 text-center">
                <h2 className="text-2xl font-bold text-white mb-4">No More Moves!</h2>
                <p className="text-gray-300 mb-6">Shuffle the board to continue playing</p>
                <button
                  onClick={shuffleBoard}
                  className="px-6 py-3 bg-pink-600 hover:bg-pink-700 text-white font-bold text-lg rounded-lg transition-colors duration-200 border-2 border-pink-400"
                >
                  🔀 SHUFFLE BOARD
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
