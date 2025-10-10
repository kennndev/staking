# Leaderboard System

This document describes the leaderboard system implementation for the staking games platform.

## Overview

The leaderboard system tracks player scores across different games and provides three types of leaderboards:

1. **Cyber Defense Leaderboard** - Tracks scores from the Cyber Defense tower defense game
2. **Pop Pop Leaderboard** - Tracks scores from the Pop Pop balloon clicking game  
3. **Global Leaderboard** - Shows the best score from each player across all games

## Features

- Real-time score tracking
- Game session counting
- Wallet address-based user identification
- Responsive leaderboard UI with tabs
- Rank-based display with special icons for top 3
- User highlighting for current player

## Database Schema

The system uses PostgreSQL with the following key tables:

### Users Table
- Stores wallet addresses and display names
- Auto-creates users when they first play

### Game Sessions Table  
- Tracks individual game plays
- Stores score, duration, level reached
- Supports JSONB for game-specific data

### Views
- `cyber_defense_leaderboard` - Cyber Defense rankings
- `pop_pop_leaderboard` - Pop Pop rankings  
- `global_leaderboard` - Cross-game rankings

## API Endpoints

### GET /api/leaderboard
Returns all leaderboard data:
```json
{
  "cyberDefense": [...],
  "popPop": [...], 
  "global": [...]
}
```

### POST /api/leaderboard/submit
Submit a new score:
```json
{
  "walletAddress": "string",
  "score": number,
  "gameType": "cyber-defense" | "pop-pop"
}
```

### GET /api/leaderboard/:gameType
Get specific game leaderboard (cyber-defense, pop-pop, or global)

## Frontend Components

### Leaderboard Page (`/leaderboard`)
- Tabbed interface for different leaderboards
- Real-time data fetching
- Responsive design with Tailwind CSS
- Special rank icons (crown, medals)
- Current user highlighting

### Utility Functions (`client/utils/leaderboard.ts`)
- `submitScore()` - Submit game scores
- `getLeaderboardData()` - Fetch all leaderboards
- `getGameLeaderboard()` - Fetch specific game leaderboard

## Integration with Games

To integrate score submission in your games:

```typescript
import { submitScore } from '@/utils/leaderboard';

// In your game component
const handleGameEnd = async (finalScore: number) => {
  if (walletAddress) {
    const result = await submitScore(walletAddress, finalScore, 'cyber-defense');
    if (result.success) {
      console.log(`New rank: ${result.newRank}`);
    }
  }
};
```

## Database Setup

1. Run the SQL schema from `leaderboard_schema.sql`
2. The schema includes:
   - Tables for users and game sessions
   - Views for easy leaderboard queries
   - Indexes for performance
   - Helper functions for common operations

## Production Considerations

### Database Migration
Replace the in-memory storage in `server/routes/leaderboard.ts` with actual database calls:

```typescript
// Example with PostgreSQL
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export const handleSubmitScore: RequestHandler = async (req, res) => {
  const { walletAddress, score, gameType } = req.body;
  
  const result = await pool.query(
    'SELECT * FROM submit_game_score($1, $2, $3)',
    [walletAddress, gameType, score]
  );
  
  res.json(result.rows[0]);
};
```

### Performance Optimizations
- Use database indexes (already included in schema)
- Implement caching for leaderboard data
- Consider pagination for large leaderboards
- Use database views for complex queries

### Security
- Validate wallet addresses
- Rate limit score submissions
- Sanitize user inputs
- Use prepared statements for SQL queries

## Testing

Test the leaderboard system:

1. **Submit Scores**: Use the API to submit test scores
2. **View Leaderboards**: Navigate to `/leaderboard` to see rankings
3. **Database Queries**: Run the sample queries in the SQL schema

## Future Enhancements

- **Achievements System**: Track special milestones
- **Seasonal Leaderboards**: Reset rankings periodically  
- **Team Leaderboards**: Group players by staking pools
- **Real-time Updates**: WebSocket integration for live updates
- **Analytics**: Player statistics and trends
- **Rewards**: Token rewards for top performers

## File Structure

```
client/
├── pages/Leaderboard.tsx          # Main leaderboard page
├── utils/leaderboard.ts          # API utility functions
└── components/                    # UI components

server/
├── routes/leaderboard.ts         # API route handlers
└── index.ts                      # Route registration

shared/
└── api.ts                        # Shared TypeScript types

leaderboard_schema.sql             # Database schema
LEADERBOARD_README.md              # This documentation
```

## Usage Examples

### Basic Score Submission
```typescript
// Submit a Cyber Defense score
const result = await submitScore(
  '11111111111111111111111111111111111111111111',
  1500,
  'cyber-defense'
);

if (result.success) {
  console.log(`Ranked #${result.newRank}`);
}
```

### Fetching Leaderboard Data
```typescript
// Get all leaderboards
const data = await getLeaderboardData();
console.log('Top Cyber Defense player:', data.cyberDefense[0]);

// Get specific game leaderboard
const cyberDefense = await getGameLeaderboard('cyber-defense');
console.log('Cyber Defense top 10:', cyberDefense.slice(0, 10));
```

This leaderboard system provides a complete solution for tracking and displaying player achievements across your gaming platform.
