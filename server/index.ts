import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleGetLeaderboard, handleSubmitScore, handleGetGameLeaderboard } from "./routes/leaderboard";

export function createServer() {
  console.log('🚀 [SERVER] Creating Express server...');
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  console.log('✅ [SERVER] Middleware configured');

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    console.log('🏓 [SERVER] Ping endpoint hit');
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);
  
  // Test endpoint for debugging
  app.get("/api/test", (_req, res) => {
    console.log('🧪 [SERVER] Test endpoint hit');
    res.json({ 
      message: "Server is working!", 
      timestamp: new Date().toISOString(),
      routes: [
        "GET /api/ping",
        "GET /api/demo", 
        "GET /api/test",
        "GET /api/leaderboard",
        "POST /api/leaderboard/submit"
      ]
    });
  });

  // Leaderboard routes
  console.log('📊 [SERVER] Setting up leaderboard routes...');
  app.get("/api/leaderboard", handleGetLeaderboard);
  app.post("/api/leaderboard/submit", handleSubmitScore);
  app.get("/api/leaderboard/:gameType", handleGetGameLeaderboard);
  
  console.log('✅ [SERVER] All routes configured');
  console.log('🎯 [SERVER] Available routes:');
  console.log('  - GET /api/ping');
  console.log('  - GET /api/demo');
  console.log('  - GET /api/leaderboard');
  console.log('  - POST /api/leaderboard/submit');
  console.log('  - GET /api/leaderboard/:gameType');

  return app;
}
