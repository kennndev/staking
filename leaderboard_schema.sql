-- Leaderboard Database Schema
-- This SQL schema is designed for PostgreSQL but can be adapted for other databases

-- Create database (run this separately if needed)
-- CREATE DATABASE staking_games;

-- Users table to store wallet addresses and basic info
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(44) UNIQUE NOT NULL, -- Solana wallet addresses are 44 characters
    display_name VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Game types enum
CREATE TYPE game_type AS ENUM ('cyber-defense', 'pop-pop');

-- Game sessions table to track individual game plays
CREATE TABLE game_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    game_type game_type NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 0),
    session_duration INTEGER, -- in seconds
    level_reached INTEGER,
    additional_data JSONB, -- for storing game-specific data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leaderboard views for easy querying
-- Cyber Defense leaderboard
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

-- Pop Pop leaderboard
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

-- Global leaderboard (best score across all games)
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

-- Indexes for better performance
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_game_sessions_user_id ON game_sessions(user_id);
CREATE INDEX idx_game_sessions_game_type ON game_sessions(game_type);
CREATE INDEX idx_game_sessions_score ON game_sessions(score DESC);
CREATE INDEX idx_game_sessions_created_at ON game_sessions(created_at);

-- Composite indexes for leaderboard queries
CREATE INDEX idx_game_sessions_user_game_score ON game_sessions(user_id, game_type, score DESC);

-- Functions for common operations

-- Function to get or create user
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

-- Function to submit a game score
CREATE OR REPLACE FUNCTION submit_game_score(
    wallet_addr VARCHAR(44),
    game_t game_type,
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

-- Function to get leaderboard data
CREATE OR REPLACE FUNCTION get_leaderboard_data(game_t VARCHAR(20), limit_count INTEGER DEFAULT 100)
RETURNS TABLE(
    rank INTEGER,
    wallet_address VARCHAR(44),
    display_name VARCHAR(50),
    score INTEGER,
    games_played BIGINT,
    last_played TIMESTAMP
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

-- Sample data insertion (for testing)
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

-- Queries to test the leaderboards:

-- Get Cyber Defense leaderboard
-- SELECT * FROM get_leaderboard_data('cyber-defense', 10);

-- Get Pop Pop leaderboard  
-- SELECT * FROM get_leaderboard_data('pop-pop', 10);

-- Get Global leaderboard
-- SELECT * FROM get_leaderboard_data('global', 10);

-- Submit a new score
-- SELECT * FROM submit_game_score('44444444444444444444444444444444444444444444', 'cyber-defense', 2200, 500, 8);

-- Get user statistics
-- SELECT 
--     u.wallet_address,
--     u.display_name,
--     COUNT(gs.id) as total_games,
--     MAX(gs.score) as best_score,
--     AVG(gs.score) as average_score,
--     COUNT(DISTINCT gs.game_type) as games_played_count
-- FROM users u
-- LEFT JOIN game_sessions gs ON u.id = gs.user_id
-- GROUP BY u.id, u.wallet_address, u.display_name
-- ORDER BY best_score DESC NULLS LAST;
