# Supabase Setup Guide

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up/Login and create a new project
3. Choose a region close to your users
4. Wait for the project to be set up

## 2. Get Your Credentials

In your Supabase dashboard:
1. Go to **Settings** → **API**
2. Copy your **Project URL** and **anon public** key

## 3. Set Environment Variables

Create a `.env` file in your project root:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: Ping message for health check
PING_MESSAGE=leaderboard-api
```

## 4. Set Up Database Schema

1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase_schema.sql`
4. Click **Run** to execute the schema

## 5. Configure Row Level Security (RLS)

The schema includes RLS policies, but you can verify them in:
- **Authentication** → **Policies** in your Supabase dashboard

## 6. Test the Setup

1. Start your development server: `npm run dev`
2. Test the API endpoints:
   - `GET /api/leaderboard` - Should return empty leaderboards initially
   - `POST /api/leaderboard/submit` - Submit a test score

## 7. Optional: Add Sample Data

You can add sample data by running this in the SQL Editor:

```sql
-- Insert sample users
INSERT INTO users (wallet_address, display_name) VALUES 
('11111111111111111111111111111111111111111111', 'Player1'),
('22222222222222222222222222222222222222222222', 'Player2'),
('33333333333333333333333333333333333333333333', 'Player3');

-- Insert sample game sessions
INSERT INTO game_sessions (user_id, game_type, score, session_duration, level_reached) VALUES
(1, 'cyber-defense', 1500, 300, 5),
(1, 'cyber-defense', 2000, 450, 7),
(2, 'cyber-defense', 1800, 380, 6),
(1, 'pop-pop', 250, 120, 3),
(2, 'pop-pop', 300, 150, 4),
(3, 'pop-pop', 280, 140, 3);
```

## 8. Production Considerations

### Security
- The current setup allows public read/write access
- For production, consider implementing authentication
- Use service role key for server-side operations

### Performance
- The schema includes optimized indexes
- Consider implementing caching for frequently accessed data
- Monitor query performance in Supabase dashboard

### Monitoring
- Use Supabase dashboard to monitor:
  - Database performance
  - API usage
  - Error logs

## 9. API Endpoints

Once set up, your leaderboard API will have:

- `GET /api/leaderboard` - Get all leaderboards
- `POST /api/leaderboard/submit` - Submit a score
- `GET /api/leaderboard/:gameType` - Get specific leaderboard

## 10. Frontend Integration

The leaderboard page at `/leaderboard` will automatically work with your Supabase backend once the environment variables are set.

## Troubleshooting

### Common Issues

1. **"Missing Supabase environment variables"**
   - Make sure your `.env` file is in the project root
   - Check that `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set correctly

2. **Database connection errors**
   - Verify your Supabase project is active
   - Check that the schema was applied correctly
   - Ensure RLS policies are enabled

3. **CORS errors**
   - Make sure your domain is added to Supabase CORS settings
   - Check that the API endpoints are accessible

### Getting Help

- Check Supabase documentation: [docs.supabase.com](https://docs.supabase.com)
- Join the Supabase Discord community
- Review the error logs in your Supabase dashboard
