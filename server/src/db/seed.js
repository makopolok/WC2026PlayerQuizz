/**
 * Seed the players table with WC2026 players.
 * Run: node src/db/seed.js
 *
 * Replace the players array below with real data.
 * photo_url should point to a Cloudinary URL after uploading images.
 */
require('dotenv').config();
const pool = require('./pool');

const players = [
  // Example entries — replace with full 1,248-player dataset
  { name: 'Lionel Messi', country: 'Argentina', photo_url: 'https://res.cloudinary.com/YOUR_CLOUD/image/upload/messi.jpg', position: 'Forward' },
  { name: 'Kylian Mbappé', country: 'France', photo_url: 'https://res.cloudinary.com/YOUR_CLOUD/image/upload/mbappe.jpg', position: 'Forward' },
  { name: 'Erling Haaland', country: 'Norway', photo_url: 'https://res.cloudinary.com/YOUR_CLOUD/image/upload/haaland.jpg', position: 'Forward' },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const p of players) {
      await client.query(
        'INSERT INTO players (name, country, photo_url, position) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        [p.name, p.country, p.photo_url, p.position]
      );
    }
    await client.query('COMMIT');
    console.log(`Seeded ${players.length} players.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
