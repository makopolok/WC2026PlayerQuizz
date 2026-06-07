const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');

const router = express.Router();

const UNIFORMS_PER_GAME = 5;
const POINTS = { 1: 3, 2: 2, 3: 1 };
const uniformsDir = path.join(__dirname, '../../../data/48_uniforms');

const COUNTRY_ALIASES = {
  bosnia: 'Bosnia and Herzegovina',
  caboverde: 'Cape Verde',
  curacau: 'Curaçao',
  danemark: 'Denmark',
  drcongo: 'DR Congo',
  ivorycoast: 'Ivory Coast',
  netherland: 'Netherlands',
  newzeland: 'New Zealand',
  saf: 'South Africa',
  saudiarabia: 'Saudi Arabia',
  skorea: 'South Korea',
  swiss: 'Switzerland',
  turkiye: 'Turkey',
  usa: 'United States',
};

function slugToCountry(slug) {
  if (COUNTRY_ALIASES[slug]) return COUNTRY_ALIASES[slug];
  return slug
    .split(/[-_]/g)
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

const uniformFiles = fs
  .readdirSync(uniformsDir)
  .filter(name => name.endsWith('_worldcup_card.png'))
  .sort((a, b) => a.localeCompare(b));

const uniforms = uniformFiles.map((fileName) => {
  const slug = fileName.replace('_worldcup_card.png', '');
  return {
    id: slug,
    country: slugToCountry(slug),
    imageUrl: `/uniforms/${fileName}`,
  };
});

const uniformById = new Map(uniforms.map(item => [item.id, item]));
const uniformCountries = [...new Set(uniforms.map(item => item.country))].sort((a, b) => a.localeCompare(b));

const countryLookup = new Map();
for (const country of uniformCountries) {
  countryLookup.set(country.toLowerCase(), country);
}
countryLookup.set('turkiye', 'Turkey');
countryLookup.set('usa', 'United States');
countryLookup.set('dr congo', 'DR Congo');
countryLookup.set('drcongo', 'DR Congo');
countryLookup.set('cabo verde', 'Cape Verde');
countryLookup.set('cape verde', 'Cape Verde');
countryLookup.set('curacao', 'Curaçao');
countryLookup.set('ivory coast', 'Ivory Coast');
countryLookup.set('south korea', 'South Korea');

let uniformSessionTableReady = null;
let uniformLeaderboardTableReady = null;

function ensureUniformSessionTable() {
  if (!uniformSessionTableReady) {
    uniformSessionTableReady = pool.query(`
      CREATE TABLE IF NOT EXISTS uniform_game_sessions (
        id UUID PRIMARY KEY,
        uniform_ids TEXT[] NOT NULL,
        used_guesses JSONB NOT NULL DEFAULT '{}',
        guesses JSONB,
        total_score INTEGER,
        completed BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }
  return uniformSessionTableReady;
}

function ensureUniformLeaderboardTable() {
  if (!uniformLeaderboardTableReady) {
    uniformLeaderboardTableReady = pool.query(`
      CREATE TABLE IF NOT EXISTS uniform_leaderboard_entries (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(24) NOT NULL CHECK (char_length(name) BETWEEN 1 AND 24),
        score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 15),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }
  return uniformLeaderboardTableReady;
}

function sample(items, count) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function getUniformsByIds(ids) {
  return ids
    .map(id => uniformById.get(id))
    .filter(Boolean)
    .map(({ id, country, imageUrl }) => ({ id, country, imageUrl }));
}

async function createUniformSession(selectedUniforms) {
  const sessionId = uuidv4();
  const uniformIds = selectedUniforms.map(item => item.id);
  await ensureUniformSessionTable();
  await pool.query(
    `INSERT INTO uniform_game_sessions (id, uniform_ids) VALUES ($1, $2)`,
    [sessionId, uniformIds]
  );
  return {
    sessionId,
    uniforms: selectedUniforms.map(({ id, imageUrl }) => ({ id, imageUrl })),
  };
}

async function upsertBestUniformLeaderboardScore(name, score) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existingResult = await client.query(
      `SELECT id, name, score, created_at
       FROM uniform_leaderboard_entries
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

    await client.query(`DELETE FROM uniform_leaderboard_entries WHERE lower(name) = lower($1)`, [name]);
    const insertResult = await client.query(
      `INSERT INTO uniform_leaderboard_entries (name, score)
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

router.get('/uniforms/countries', async (req, res) => {
  try {
    res.json(uniformCountries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch countries.' });
  }
});

router.get('/uniforms/game', async (req, res) => {
  try {
    if (uniforms.length < UNIFORMS_PER_GAME) {
      return res.status(503).json({ error: 'Not enough uniforms available.' });
    }
    const selected = sample(uniforms, UNIFORMS_PER_GAME);
    res.json(await createUniformSession(selected));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start uniforms game.' });
  }
});

router.post('/uniforms/guess', async (req, res) => {
  const { sessionId, uniformId, guess, attemptNumber } = req.body;
  if (!sessionId || !uniformId || !guess || !attemptNumber) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  if (attemptNumber < 1 || attemptNumber > 3) {
    return res.status(400).json({ error: 'attemptNumber must be 1, 2, or 3.' });
  }

  try {
    await ensureUniformSessionTable();
    const { rows } = await pool.query(`SELECT * FROM uniform_game_sessions WHERE id = $1`, [sessionId]);
    const session = rows[0];
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    if (!session.uniform_ids.includes(uniformId)) {
      return res.status(400).json({ error: 'Uniform is not part of this session.' });
    }

    const uniform = uniformById.get(uniformId);
    if (!uniform) return res.status(404).json({ error: 'Uniform not found.' });

    const normalizedGuess = guess.trim().toLowerCase();
    const guessedCountry = countryLookup.get(normalizedGuess);
    if (!guessedCountry) {
      return res.status(400).json({ error: 'Please choose a country from the list.' });
    }

    const usedGuesses = session.used_guesses[uniformId] || [];
    if (usedGuesses.includes(guessedCountry.toLowerCase())) {
      return res.status(409).json({ error: 'This country was already guessed for this uniform.' });
    }

    const correct = uniform.country.toLowerCase() === guessedCountry.toLowerCase();
    const points = correct ? POINTS[attemptNumber] : 0;
    const revealCountry = correct || attemptNumber === 3;

    if (!correct) {
      const updatedUsed = {
        ...session.used_guesses,
        [uniformId]: [...usedGuesses, guessedCountry.toLowerCase()],
      };
      await pool.query(`UPDATE uniform_game_sessions SET used_guesses = $1 WHERE id = $2`, [JSON.stringify(updatedUsed), sessionId]);
    }

    res.json({ correct, points, country: revealCountry ? uniform.country : null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process guess.' });
  }
});

router.post('/uniforms/game/complete', async (req, res) => {
  const { sessionId, guesses, totalScore } = req.body;
  if (!sessionId || !guesses || totalScore === undefined) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  try {
    await ensureUniformSessionTable();
    const { rows } = await pool.query(`SELECT * FROM uniform_game_sessions WHERE id = $1`, [sessionId]);
    const session = rows[0];
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    await pool.query(
      `UPDATE uniform_game_sessions SET guesses = $1, total_score = $2, completed = TRUE WHERE id = $3`,
      [JSON.stringify(guesses), totalScore, sessionId]
    );
    res.json({ shareId: sessionId, uniforms: getUniformsByIds(session.uniform_ids) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save uniforms game.' });
  }
});

router.post('/uniforms/game/:id/rematch', async (req, res) => {
  const { id } = req.params;
  try {
    await ensureUniformSessionTable();
    const { rows } = await pool.query(`SELECT * FROM uniform_game_sessions WHERE id = $1 AND completed = TRUE`, [id]);
    const session = rows[0];
    if (!session) return res.status(404).json({ error: 'Game not found.' });

    const selectedUniforms = getUniformsByIds(session.uniform_ids);
    if (selectedUniforms.length !== session.uniform_ids.length) {
      return res.status(500).json({ error: 'Shared game is missing uniform data.' });
    }
    res.json(await createUniformSession(selectedUniforms));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start challenge.' });
  }
});

router.get('/uniforms/leaderboard', async (req, res) => {
  const limitRaw = Number.parseInt(req.query.limit, 10);
  const limit = Number.isNaN(limitRaw) ? 10 : Math.max(1, Math.min(limitRaw, 50));
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Leaderboard is not configured.' });
  }
  try {
    await ensureUniformLeaderboardTable();
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (lower(name)) id, name, score, created_at
       FROM uniform_leaderboard_entries
       ORDER BY lower(name), score DESC, created_at ASC`,
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

router.post('/uniforms/leaderboard', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const score = Number(req.body?.score);
  if (!name) return res.status(400).json({ error: 'Name is required.' });
  if (name.length > 24) return res.status(400).json({ error: 'Name must be 24 characters or less.' });
  if (!Number.isInteger(score) || score < 0 || score > 15) {
    return res.status(400).json({ error: 'Score must be an integer between 0 and 15.' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Leaderboard is not configured.' });
  }
  try {
    await ensureUniformLeaderboardTable();
    const result = await upsertBestUniformLeaderboardScore(name, score);
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
