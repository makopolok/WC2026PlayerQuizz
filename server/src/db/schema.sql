-- Players table
CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  country VARCHAR(100) NOT NULL,
  photo_url TEXT,
  position VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Game sessions table
CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY,
  player_ids INTEGER[] NOT NULL,         -- 7 player IDs in order
  guesses JSONB NOT NULL DEFAULT '[]',   -- [{player_id, attempts: [{guess, correct}], points}]
  total_score INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_players_country ON players(country);
