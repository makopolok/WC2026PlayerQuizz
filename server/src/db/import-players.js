/**
 * Import players from WC2026 squad JSON file.
 * Format: { "CONFEDERATION": { "Country": [ { number, name, age, position, club } ] } }
 *
 * Usage (from project root):
 *   cd server && node src/db/import-players.js ../data/players.json
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node import-players.js <path-to-json>');
  process.exit(1);
}

const raw = fs.readFileSync(path.resolve(filePath), 'utf8');
const data = JSON.parse(raw);

// Flatten confederation → country → players into a single array
const players = [];
for (const confederation of Object.values(data)) {
  for (const [country, squad] of Object.entries(confederation)) {
    for (const player of squad) {
      players.push({
        name: player.name,
        country,
        position: player.position || null,
        club: player.club || null,
        number: player.number || null,
        age: player.age || null,
        photo_url: null,
      });
    }
  }
}

async function importPlayers() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add club, number, age columns if they don't exist yet
    await client.query(`
      ALTER TABLE players
        ADD COLUMN IF NOT EXISTS club VARCHAR(100),
        ADD COLUMN IF NOT EXISTS number INTEGER,
        ADD COLUMN IF NOT EXISTS age INTEGER
    `);

    let inserted = 0;
    let skipped = 0;
    for (const p of players) {
      const result = await client.query(
        `INSERT INTO players (name, country, position, club, number, age, photo_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (name) DO UPDATE SET
           country = EXCLUDED.country,
           position = EXCLUDED.position,
           club = EXCLUDED.club,
           number = EXCLUDED.number,
           age = EXCLUDED.age
         RETURNING id`,
        [p.name, p.country, p.position, p.club, p.number, p.age, p.photo_url]
      );
      if (result.rows.length) inserted++;
      else skipped++;
    }

    await client.query('COMMIT');
    console.log(`✅ Done! ${inserted} players imported, ${skipped} skipped.`);
    console.log(`   Total in DB: ${players.length} players across ${Object.values(data).flatMap(c => Object.keys(c)).length} countries.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Import failed:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

importPlayers();
