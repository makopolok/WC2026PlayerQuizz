const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');

const router = express.Router();

const PLAYERS_PER_GAME = 10;
const POINTS = { 1: 3, 2: 2, 3: 1 }; // attempt number → points

// GET /api/game — start a new game, returns 10 random players (no country)
router.get('/game', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, photo_url, position FROM players ORDER BY RANDOM() LIMIT $1',
      [PLAYERS_PER_GAME]
    );
    if (rows.length < PLAYERS_PER_GAME) {
      return res.status(503).json({ error: 'Not enough players in database.' });
    }

    const sessionId = uuidv4();
    const playerIds = rows.map(p => p.id);

    await pool.query(
      'INSERT INTO game_sessions (id, player_ids) VALUES ($1, $2)',
      [sessionId, playerIds]
    );

    res.json({ sessionId, players: rows });
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
    const { rows } = await pool.query(
      'SELECT country FROM players WHERE id = $1',
      [playerId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Player not found.' });

    const correct = rows[0].country.toLowerCase() === guess.trim().toLowerCase();
    const points = correct ? POINTS[attemptNumber] : 0;
    // Reveal the country on correct guess or on the final (3rd) wrong attempt
    const revealCountry = correct || attemptNumber === 3;

    res.json({ correct, points, country: revealCountry ? rows[0].country : null });
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
    await pool.query(
      'UPDATE game_sessions SET guesses = $1, total_score = $2, completed = TRUE WHERE id = $3',
      [JSON.stringify(guesses), totalScore, sessionId]
    );
    res.json({ shareId: sessionId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save game.' });
  }
});

// GET /api/game/:id — load a shared game result
router.get('/game/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const sessionResult = await pool.query(
      'SELECT id, player_ids, guesses, total_score, created_at FROM game_sessions WHERE id = $1 AND completed = TRUE',
      [id]
    );
    if (!sessionResult.rows.length) {
      return res.status(404).json({ error: 'Game not found.' });
    }

    const session = sessionResult.rows[0];
    const playerResult = await pool.query(
      'SELECT id, name, country, photo_url, position FROM players WHERE id = ANY($1)',
      [session.player_ids]
    );

    // Return players in original order
    const playerMap = Object.fromEntries(playerResult.rows.map(p => [p.id, p]));
    const players = session.player_ids.map(id => playerMap[id]);

    res.json({
      id: session.id,
      players,
      guesses: session.guesses,
      totalScore: session.total_score,
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
    const { rows } = await pool.query(
      'SELECT DISTINCT country FROM players ORDER BY country'
    );
    res.json(rows.map(r => r.country));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch countries.' });
  }
});

module.exports = router;
