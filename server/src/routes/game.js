const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');

const router = express.Router();

const PLAYERS_PER_GAME = 10;
const POINTS = { 1: 3, 2: 2, 3: 1 }; // attempt number → points
const playersPath = path.join(__dirname, '../../../data/players.json');

const playersByCountry = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
const countryLookup = new Map(Object.keys(playersByCountry).map(country => [country.toLowerCase(), country]));
const allPlayers = Object.entries(playersByCountry).flatMap(([country, players]) =>
  players.map(player => ({
    id: `${country}-${player.number}`,
    country,
    name: player.name,
    position: player.position || null,
    photo_url: player.photo_url || null,
  }))
);

const sessionStore = new Map();
let leaderboardTableReady = null;

function samplePlayers(players, count) {
  const copy = [...players];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function createGameSession(selectedPlayers) {
  const sessionId = uuidv4();
  const playerIds = selectedPlayers.map(player => player.id);
  sessionStore.set(sessionId, {
    id: sessionId,
    player_ids: playerIds,
    used_guesses: {},
    guesses: null,
    total_score: null,
    completed: false,
    created_at: new Date().toISOString(),
  });

  return {
    sessionId,
    players: selectedPlayers.map(({ id, name, photo_url, position }) => ({
      id,
      name,
      photo_url,
      position,
    })),
  };
}

function ensureLeaderboardTable() {
  if (!leaderboardTableReady) {
    leaderboardTableReady = pool.query(`
      CREATE TABLE IF NOT EXISTS leaderboard_entries (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(24) NOT NULL CHECK (char_length(name) BETWEEN 1 AND 24),
        score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 30),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }
  return leaderboardTableReady;
}

async function upsertBestLeaderboardScore(name, score) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingResult = await client.query(
      `SELECT id, name, score, created_at
       FROM leaderboard_entries
       WHERE lower(name) = lower($1)
       ORDER BY score DESC, created_at ASC
       LIMIT 1
       FOR UPDATE`,
      [name]
    );

    const existing = existingResult.rows[0];
    if (existing && existing.score >= score) {
      await client.query('COMMIT');
      return {
        saved: false,
        firstTime: false,
        bestScore: existing.score,
        entry: existing,
      };
    }

    await client.query(
      `DELETE FROM leaderboard_entries
       WHERE lower(name) = lower($1)`,
      [name]
    );

    const insertResult = await client.query(
      `INSERT INTO leaderboard_entries (name, score)
       VALUES ($1, $2)
       RETURNING id, name, score, created_at`,
      [name, score]
    );

    await client.query('COMMIT');
    return {
      saved: true,
      firstTime: !existing,
      bestScore: insertResult.rows[0].score,
      entry: insertResult.rows[0],
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// GET /api/game — start a new game, returns 10 random players (no country)
router.get('/game', async (req, res) => {
  try {
    if (allPlayers.length < PLAYERS_PER_GAME) {
      return res.status(503).json({ error: 'Not enough players in players file.' });
    }

    const selectedPlayers = samplePlayers(allPlayers, PLAYERS_PER_GAME);
    res.json(createGameSession(selectedPlayers));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start game.' });
  }
});

// POST /api/guess — { sessionId, playerId, guess, attemptNumber }
router.post('/guess', async (req, res) => {
  const { sessionId, playerId, guess, attemptNumber } = req.body;

  if (!sessionId || !playerId || !guess || !attemptNumber) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  if (attemptNumber < 1 || attemptNumber > 3) {
    return res.status(400).json({ error: 'attemptNumber must be 1, 2, or 3.' });
  }

  try {
    const session = sessionStore.get(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    if (!session.player_ids.includes(playerId)) {
      return res.status(400).json({ error: 'Player is not part of this session.' });
    }

    const player = allPlayers.find(p => p.id === playerId);
    if (!player) return res.status(404).json({ error: 'Player not found.' });

    const normalizedGuess = guess.trim().toLowerCase();
    const country = countryLookup.get(normalizedGuess);
    if (!country) {
      return res.status(400).json({ error: 'Please choose a country from the list.' });
    }

    const usedGuesses = session.used_guesses[playerId] || [];
    if (usedGuesses.includes(normalizedGuess)) {
      return res.status(409).json({ error: 'This country was already guessed for this player.' });
    }

    const correct = player.country.toLowerCase() === normalizedGuess;
    const points = correct ? POINTS[attemptNumber] : 0;
    // Reveal the country on correct guess or on the final (3rd) wrong attempt
    const revealCountry = correct || attemptNumber === 3;

    if (!correct) {
      session.used_guesses[playerId] = [...usedGuesses, normalizedGuess];
    }

    res.json({ correct, points, country: revealCountry ? player.country : null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process guess.' });
  }
});

// POST /api/game/complete — save finished game, returns shareable link id
// Body: { sessionId, guesses: [{playerId, attempts, points}], totalScore }
router.post('/game/complete', async (req, res) => {
  const { sessionId, guesses, totalScore } = req.body;

  if (!sessionId || !guesses || totalScore === undefined) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const session = sessionStore.get(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    session.guesses = guesses;
    session.total_score = totalScore;
    session.completed = true;
    res.json({ shareId: sessionId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save game.' });
  }
});

// GET /api/game/:id — load share metadata (without revealing answers)
router.get('/game/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const session = sessionStore.get(id);
    if (!session || !session.completed) {
      return res.status(404).json({ error: 'Game not found.' });
    }

    res.json({
      id: session.id,
      totalScore: session.total_score,
      questionsCount: session.player_ids.length,
      createdAt: session.created_at,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load game.' });
  }
});

// GET /api/countries — list all 48 WC2026 countries (for autocomplete)
router.get('/countries', async (req, res) => {
  try {
    const countries = Object.keys(playersByCountry).sort((a, b) => a.localeCompare(b));
    res.json(countries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch countries.' });
  }
});

// POST /api/game/:id/rematch — start the same quiz again from a shared game
router.post('/game/:id/rematch', async (req, res) => {
  const { id } = req.params;

  try {
    const session = sessionStore.get(id);
    if (!session || !session.completed) {
      return res.status(404).json({ error: 'Game not found.' });
    }

    const playerMap = Object.fromEntries(allPlayers.map(player => [player.id, player]));
    const selectedPlayers = session.player_ids
      .map(playerId => playerMap[playerId])
      .filter(Boolean);

    if (selectedPlayers.length !== session.player_ids.length) {
      return res.status(500).json({ error: 'Shared game is missing player data.' });
    }

    res.json(createGameSession(selectedPlayers));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start challenge.' });
  }
});

// GET /api/leaderboard — top scores
router.get('/leaderboard', async (req, res) => {
  const limitRaw = Number.parseInt(req.query.limit, 10);
  const limit = Number.isNaN(limitRaw) ? 10 : Math.max(1, Math.min(limitRaw, 50));

  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Leaderboard is not configured.' });
  }

  try {
    await ensureLeaderboardTable();
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (lower(name)) id, name, score, created_at
       FROM leaderboard_entries
       ORDER BY lower(name), score DESC, created_at ASC
       `,
      []
    );
    const sorted = rows
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(a.created_at) - new Date(b.created_at);
      })
      .slice(0, limit);
    res.json(sorted.map((row, index) => ({
      rank: index + 1,
      id: row.id,
      name: row.name,
      score: row.score,
      createdAt: row.created_at,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load leaderboard.' });
  }
});

// POST /api/leaderboard — save a score
router.post('/leaderboard', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const score = Number(req.body?.score);

  if (!name) {
    return res.status(400).json({ error: 'Name is required.' });
  }
  if (name.length > 24) {
    return res.status(400).json({ error: 'Name must be 24 characters or less.' });
  }
  if (!Number.isInteger(score) || score < 0 || score > 30) {
    return res.status(400).json({ error: 'Score must be an integer between 0 and 30.' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Leaderboard is not configured.' });
  }

  try {
    await ensureLeaderboardTable();
    const result = await upsertBestLeaderboardScore(name, score);
    res.status(result.saved ? 201 : 200).json({
      id: result.entry.id,
      name: result.entry.name,
      score: result.entry.score,
      createdAt: result.entry.created_at,
      saved: result.saved,
      firstTime: result.firstTime,
      bestScore: result.bestScore,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save leaderboard entry.' });
  }
});

module.exports = router;
