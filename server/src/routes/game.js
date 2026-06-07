const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');

const router = express.Router();

const PLAYERS_PER_GAME = 7;
const POINTS = { 1: 3, 2: 2, 3: 1 }; // attempt number → points
const playersPath = path.join(__dirname, '../../../data/players.json');
const triviaPath = path.join(__dirname, '../../../data/world_cup_2026_country_guess_pub_quiz_answers_are_countries.json');

const playersByCountry = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
const triviaData = JSON.parse(fs.readFileSync(triviaPath, 'utf8'));
// Map country name (lowercase) → array of question strings
const triviaByCountry = new Map(
  triviaData.countries.map(c => [c.country.toLowerCase(), c.questions.map(q => q.question)])
);
const countryLookup = new Map(Object.keys(playersByCountry).map(country => [country.toLowerCase(), country]));

const CONFEDERATION_MAP = {
  // UEFA
  UEFA: ['Albania','Austria','Belgium','Croatia','Czechia','Denmark','England','France','Germany','Hungary','Italy','Netherlands','Poland','Portugal','Romania','Scotland','Serbia','Slovakia','Slovenia','Spain','Switzerland','Turkey','Ukraine','Wales'],
  // CONMEBOL
  CONMEBOL: ['Argentina','Bolivia','Brazil','Chile','Colombia','Ecuador','Paraguay','Peru','Uruguay','Venezuela'],
  // CONCACAF
  CONCACAF: ['Canada','Costa Rica','Honduras','Jamaica','Mexico','Panama','Trinidad and Tobago','United States'],
  // CAF
  CAF: ['Algeria','Cameroon','DR Congo','Egypt','Ghana','Guinea','Kenya','Mali','Morocco','Nigeria','Senegal','South Africa','Tanzania','Tunisia'],
  // AFC
  AFC: ['Australia','China','Indonesia','Iran','Iraq','Japan','Jordan','Qatar','Saudi Arabia','South Korea','Uzbekistan'],
  // OFC
  OFC: ['New Zealand'],
};
// Build reverse lookup: country → confederation
const countryConfederation = new Map();
for (const [conf, countries] of Object.entries(CONFEDERATION_MAP)) {
  for (const country of countries) {
    countryConfederation.set(country.toLowerCase(), conf);
  }
}
const allPlayers = Object.entries(playersByCountry).flatMap(([country, players]) =>
  players.map(player => ({
    id: `${country}-${player.number}`,
    country,
    name: player.name,
    club: player.club || null,
    position: player.position || null,
    photo_url: player.photo_url || null,
  }))
);

let sessionTableReady = null;
let leaderboardTableReady = null;

function ensureSessionTable() {
  if (!sessionTableReady) {
    sessionTableReady = pool.query(`
      CREATE TABLE IF NOT EXISTS game_sessions (
        id UUID PRIMARY KEY,
        player_ids TEXT[] NOT NULL,
        used_guesses JSONB NOT NULL DEFAULT '{}',
        guesses JSONB,
        total_score INTEGER,
        completed BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }
  return sessionTableReady;
}

function samplePlayers(players, count) {
  const copy = [...players];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

async function createGameSession(selectedPlayers) {
  const sessionId = uuidv4();
  const playerIds = selectedPlayers.map(player => player.id);
  await ensureSessionTable();
  await pool.query(
    `INSERT INTO game_sessions (id, player_ids) VALUES ($1, $2)`,
    [sessionId, playerIds]
  );
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

function getSessionPlayersWithDetails(session) {
  const playerMap = Object.fromEntries(allPlayers.map(player => [player.id, player]));
  return session.player_ids
    .map(playerId => playerMap[playerId])
    .filter(Boolean)
    .map(({ id, name, country, club, position, photo_url }) => ({
      id,
      name,
      country,
      club,
      position,
      photo_url,
    }));
}
function ensureLeaderboardTable() {
  if (!leaderboardTableReady) {
    leaderboardTableReady = pool.query(`
      CREATE TABLE IF NOT EXISTS leaderboard_entries (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(24) NOT NULL CHECK (char_length(name) BETWEEN 1 AND 24),
        score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 21),
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

// GET /api/game — start a new game, returns 7 random players (no country)
router.get('/game', async (req, res) => {
  try {
    if (allPlayers.length < PLAYERS_PER_GAME) {
      return res.status(503).json({ error: 'Not enough players in players file.' });
    }

    const selectedPlayers = samplePlayers(allPlayers, PLAYERS_PER_GAME);
    res.json(await createGameSession(selectedPlayers));
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
    await ensureSessionTable();
    const { rows } = await pool.query(`SELECT * FROM game_sessions WHERE id = $1`, [sessionId]);
    const session = rows[0];
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

    const usedGuesses = (session.used_guesses[playerId] || []);
    if (usedGuesses.includes(normalizedGuess)) {
      return res.status(409).json({ error: 'This country was already guessed for this player.' });
    }

    const correct = player.country.toLowerCase() === normalizedGuess;
    const points = correct ? POINTS[attemptNumber] : 0;
    const revealCountry = correct || attemptNumber === 3;

    let hint = null;
    let hintType = null;
    if (!correct && attemptNumber === 1) {
      const conf = countryConfederation.get(player.country.toLowerCase());
      if (conf) { hint = conf; hintType = 'confederation'; }
    } else if (!correct && attemptNumber === 2) {
      const questions = triviaByCountry.get(player.country.toLowerCase()) || [];
      if (questions.length) {
        hint = questions[Math.floor(Math.random() * questions.length)];
        hintType = 'trivia';
      }
    }

    if (!correct) {
      const updatedUsed = { ...session.used_guesses, [playerId]: [...usedGuesses, normalizedGuess] };
      await pool.query(`UPDATE game_sessions SET used_guesses = $1 WHERE id = $2`, [JSON.stringify(updatedUsed), sessionId]);
    }

    res.json({ correct, points, country: revealCountry ? player.country : null, hint, hintType });
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
    await ensureSessionTable();
    const { rows } = await pool.query(`SELECT * FROM game_sessions WHERE id = $1`, [sessionId]);
    const session = rows[0];
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    await pool.query(
      `UPDATE game_sessions SET guesses = $1, total_score = $2, completed = TRUE WHERE id = $3`,
      [JSON.stringify(guesses), totalScore, sessionId]
    );
    const players = getSessionPlayersWithDetails(session);
    res.json({ shareId: sessionId, players });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save game.' });
  }
});

// GET /api/game/:id — load share metadata (without revealing answers)
router.get('/game/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await ensureSessionTable();
    const { rows } = await pool.query(`SELECT * FROM game_sessions WHERE id = $1 AND completed = TRUE`, [id]);
    const session = rows[0];
    if (!session) {
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
    await ensureSessionTable();
    const { rows } = await pool.query(`SELECT * FROM game_sessions WHERE id = $1 AND completed = TRUE`, [id]);
    const session = rows[0];
    if (!session) {
      return res.status(404).json({ error: 'Game not found.' });
    }

    const selectedPlayers = getSessionPlayersWithDetails(session);

    if (selectedPlayers.length !== session.player_ids.length) {
      return res.status(500).json({ error: 'Shared game is missing player data.' });
    }

    res.json(await createGameSession(selectedPlayers));
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
