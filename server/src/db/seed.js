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
  { name: 'Lionel Messi', country: 'Argentina', photo_url: null, position: 'Forward' },
  { name: 'Kylian Mbappé', country: 'France', photo_url: null, position: 'Forward' },
  { name: 'Erling Haaland', country: 'Norway', photo_url: null, position: 'Forward' },
  { name: 'Vinicius Jr.', country: 'Brazil', photo_url: null, position: 'Forward' },
  { name: 'Jude Bellingham', country: 'England', photo_url: null, position: 'Midfielder' },
  { name: 'Pedri', country: 'Spain', photo_url: null, position: 'Midfielder' },
  { name: 'Rodri', country: 'Spain', photo_url: null, position: 'Midfielder' },
  { name: 'Kevin De Bruyne', country: 'Belgium', photo_url: null, position: 'Midfielder' },
  { name: 'Mohamed Salah', country: 'Egypt', photo_url: null, position: 'Forward' },
  { name: 'Robert Lewandowski', country: 'Poland', photo_url: null, position: 'Forward' },
  { name: 'Harry Kane', country: 'England', photo_url: null, position: 'Forward' },
  { name: 'Lamine Yamal', country: 'Spain', photo_url: null, position: 'Forward' },
  { name: 'Bukayo Saka', country: 'England', photo_url: null, position: 'Forward' },
  { name: 'Phil Foden', country: 'England', photo_url: null, position: 'Midfielder' },
  { name: 'Gianluigi Donnarumma', country: 'Italy', photo_url: null, position: 'Goalkeeper' },
  { name: 'Virgil van Dijk', country: 'Netherlands', photo_url: null, position: 'Defender' },
  { name: 'Rúben Dias', country: 'Portugal', photo_url: null, position: 'Defender' },
  { name: 'Bernardo Silva', country: 'Portugal', photo_url: null, position: 'Midfielder' },
  { name: 'Joshua Kimmich', country: 'Germany', photo_url: null, position: 'Midfielder' },
  { name: 'Florian Wirtz', country: 'Germany', photo_url: null, position: 'Midfielder' },
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
