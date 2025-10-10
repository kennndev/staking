-- Supabase SQL Schema for Leaderboard System
-- Run this in your Supabase SQL editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(44) UNIQUE NOT NULL,
    display_name VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create game_sessions table
CREATE TABLE game_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    game_type TEXT NOT NULL CHECK (game_type IN ('cyber-defense', 'pop-pop')),
    score INTEGER NOT NULL CHECK (score >= 0),
    session_duration INTEGER, -- in seconds
    level_reached INTEGER,
    additional_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_game_sessions_user_id ON game_sessions(user_id);
CREATE INDEX idx_game_sessions_game_type ON game_sessions(game_type);
CREATE INDEX idx_game_sessions_score ON game_sessions(score DESC);
CREATE INDEX idx_game_sessions_created_at ON game_sessions(created_at);
CREATE INDEX idx_game_sessions_user_game_score ON game_sessions(user_id, game_type, score DESC);

-- Create views for leaderboards
CREATE VIEW cyber_defense_leaderboard AS
SELECT 
    ROW_NUMBER() OVER (ORDER BY MAX(gs.score) DESC) as rank,
    u.wallet_address,
    u.display_name,
    MAX(gs.score) as best_score,
    COUNT(gs.id) as games_played,
    MAX(gs.created_at) as last_played
FROM users u
JOIN game_sessions gs ON u.id = gs.user_id
WHERE gs.game_type = 'cyber-defense'
GROUP BY u.id, u.wallet_address, u.display_name
ORDER BY best_score DESC;

CREATE VIEW pop_pop_leaderboard AS
SELECT 
    ROW_NUMBER() OVER (ORDER BY MAX(gs.score) DESC) as rank,
    u.wallet_address,
    u.display_name,
    MAX(gs.score) as best_score,
    COUNT(gs.id) as games_played,
    MAX(gs.created_at) as last_played
FROM users u
JOIN game_sessions gs ON u.id = gs.user_id
WHERE gs.game_type = 'pop-pop'
GROUP BY u.id, u.wallet_address, u.display_name
ORDER BY best_score DESC;

CREATE VIEW global_leaderboard AS
SELECT 
    ROW_NUMBER() OVER (ORDER BY MAX(gs.score) DESC) as rank,
    u.wallet_address,
    u.display_name,
    MAX(gs.score) as best_score,
    COUNT(gs.id) as total_games_played,
    COUNT(DISTINCT gs.game_type) as games_played_count,
    MAX(gs.created_at) as last_played
FROM users u
JOIN game_sessions gs ON u.id = gs.user_id
GROUP BY u.id, u.wallet_address, u.display_name
ORDER BY best_score DESC;

-- Create function to get or create user
CREATE OR REPLACE FUNCTION get_or_create_user(wallet_addr VARCHAR(44))
RETURNS INTEGER AS $$
DECLARE
    user_id INTEGER;
BEGIN
    -- Try to get existing user
    SELECT id INTO user_id FROM users WHERE wallet_address = wallet_addr;
    
    -- Create user if doesn't exist
    IF user_id IS NULL THEN
        INSERT INTO users (wallet_address, display_name) 
        VALUES (wallet_addr, SUBSTRING(wallet_addr, 1, 4) || '...' || SUBSTRING(wallet_addr, -4))
        RETURNING id INTO user_id;
    END IF;
    
    RETURN user_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to submit game score
CREATE OR REPLACE FUNCTION submit_game_score(
    wallet_addr VARCHAR(44),
    game_t TEXT,
    score_val INTEGER,
    session_duration INTEGER DEFAULT NULL,
    level_reached INTEGER DEFAULT NULL,
    additional_data JSONB DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    new_rank INTEGER,
    games_played INTEGER
) AS $$
DECLARE
    user_id INTEGER;
    current_rank INTEGER;
    total_games INTEGER;
BEGIN
    -- Get or create user
    user_id := get_or_create_user(wallet_addr);
    
    -- Insert game session
    INSERT INTO game_sessions (user_id, game_type, score, session_duration, level_reached, additional_data)
    VALUES (user_id, game_t, score_val, session_duration, level_reached, additional_data);
    
    -- Get current rank for this game type
    IF game_t = 'cyber-defense' THEN
        SELECT rank INTO current_rank 
        FROM cyber_defense_leaderboard 
        WHERE wallet_address = wallet_addr;
    ELSIF game_t = 'pop-pop' THEN
        SELECT rank INTO current_rank 
        FROM pop_pop_leaderboard 
        WHERE wallet_address = wallet_addr;
    END IF;
    
    -- Get total games played for this user and game type
    SELECT COUNT(*) INTO total_games 
    FROM game_sessions 
    WHERE user_id = user_id AND game_type = game_t;
    
    RETURN QUERY SELECT 
        TRUE as success,
        'Score submitted successfully' as message,
        COALESCE(current_rank, 0) as new_rank,
        total_games as games_played;
END;
$$ LANGUAGE plpgsql;

-- Create function to get leaderboard data
CREATE OR REPLACE FUNCTION get_leaderboard_data(game_t TEXT, limit_count INTEGER DEFAULT 100)
RETURNS TABLE(
    rank INTEGER,
    wallet_address VARCHAR(44),
    display_name VARCHAR(50),
    score INTEGER,
    games_played BIGINT,
    last_played TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    IF game_t = 'cyber-defense' THEN
        RETURN QUERY 
        SELECT * FROM cyber_defense_leaderboard 
        LIMIT limit_count;
    ELSIF game_t = 'pop-pop' THEN
        RETURN QUERY 
        SELECT * FROM pop_pop_leaderboard 
        LIMIT limit_count;
    ELSIF game_t = 'global' THEN
        RETURN QUERY 
        SELECT * FROM global_leaderboard 
        LIMIT limit_count;
    ELSE
        RAISE EXCEPTION 'Invalid game type: %', game_t;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Allow anyone to read users (for leaderboards)
CREATE POLICY "Allow public read access on users" ON users
    FOR SELECT USING (true);

-- Allow anyone to read game_sessions (for leaderboards)
CREATE POLICY "Allow public read access on game_sessions" ON game_sessions
    FOR SELECT USING (true);

-- Allow anyone to insert game_sessions (for score submission)
CREATE POLICY "Allow public insert on game_sessions" ON game_sessions
    FOR INSERT WITH CHECK (true);

-- Allow anyone to insert users (for new player registration)
CREATE POLICY "Allow public insert on users" ON users
    FOR INSERT WITH CHECK (true);

-- Sample data for testing (optional)
-- INSERT INTO users (wallet_address, display_name) VALUES 
-- ('11111111111111111111111111111111111111111111', 'Player1'),
-- ('22222222222222222222222222222222222222222222', 'Player2'),
-- ('33333333333333333333333333333333333333333333', 'Player3');

-- INSERT INTO game_sessions (user_id, game_type, score, session_duration, level_reached) VALUES
-- (1, 'cyber-defense', 1500, 300, 5),
-- (1, 'cyber-defense', 2000, 450, 7),
-- (2, 'cyber-defense', 1800, 380, 6),
-- (1, 'pop-pop', 250, 120, 3),
-- (2, 'pop-pop', 300, 150, 4),
-- (3, 'pop-pop', 280, 140, 3);
