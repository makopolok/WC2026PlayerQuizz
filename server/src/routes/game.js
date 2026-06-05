const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

const PLAYERS_PER_GAME = 10;
const POINTS = { 1: 3, 2: 2, 3: 1 }; // attempt number → points
const playersPath = path.join(__dirname, '../../../data/players.json');

const playersByCountry = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
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

function samplePlayers(players, count) {
  const copy = [...players];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

// GET /api/game — start a new game, returns 10 random players (no country)
router.get('/game', async (req, res) => {
  try {
    if (allPlayers.length < PLAYERS_PER_GAME) {
      return res.status(503).json({ error: 'Not enough players in players file.' });
    }

    const selectedPlayers = samplePlayers(allPlayers, PLAYERS_PER_GAME);
    const sessionId = uuidv4();
    const playerIds = selectedPlayers.map(p => p.id);
    sessionStore.set(sessionId, {
      id: sessionId,
      player_ids: playerIds,
      guesses: null,
      total_score: null,
      completed: false,
      created_at: new Date().toISOString(),
    });

    const responsePlayers = selectedPlayers.map(({ id, name, photo_url, position }) => ({
      id,
      name,
      photo_url,
      position,
    }));

    res.json({ sessionId, players: responsePlayers });
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

    const correct = player.country.toLowerCase() === guess.trim().toLowerCase();
    const points = correct ? POINTS[attemptNumber] : 0;
    // Reveal the country on correct guess or on the final (3rd) wrong attempt
    const revealCountry = correct || attemptNumber === 3;

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

// GET /api/game/:id — load a shared game result
router.get('/game/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const session = sessionStore.get(id);
    if (!session || !session.completed) {
      return res.status(404).json({ error: 'Game not found.' });
    }

    // Return players in original order
    const playerMap = Object.fromEntries(allPlayers.map(p => [p.id, p]));
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
    const countries = Object.keys(playersByCountry).sort((a, b) => a.localeCompare(b));
    res.json(countries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch countries.' });
  }
});

module.exports = router;
