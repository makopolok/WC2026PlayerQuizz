# WC2026 Player Quiz

Guess the nationality of 10 World Cup 2026 players. 3 tries per player — faster guesses earn more points. Share your result with friends!

## Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: PostgreSQL (Heroku Postgres)
- **Images**: Cloudinary

---

## Local Setup

### Prerequisites
- Node.js 20+
- PostgreSQL running locally

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Set up environment variables

```bash
cp server/.env.example server/.env
# Edit server/.env with your local DB connection string
```

### 3. Create database & schema

```bash
createdb wc2026
psql wc2026 < server/src/db/schema.sql
```

### 4. Seed player data

Edit `server/src/db/seed.js` to add your players, then:

```bash
cd server && node src/db/seed.js
```

### 5. Run dev servers

```bash
# Terminal 1 — API server (port 3001)
npm run dev:server

# Terminal 2 — React dev server (port 5173)
npm run dev:client
```

Open http://localhost:5173

---

## Deploying to Heroku

```bash
heroku create wc2026-player-quizz
heroku addons:create heroku-postgresql:essential-0
heroku config:set NODE_ENV=production
git push heroku main

# Run schema migration
heroku pg:psql < server/src/db/schema.sql
```

---

## Adding Players

Players are stored in the `players` table:

| Column | Type | Description |
|--------|------|-------------|
| name | VARCHAR | Player full name |
| country | VARCHAR | Country name (must match exactly for guesses) |
| photo_url | TEXT | Cloudinary URL |
| position | VARCHAR | Optional: Forward, Midfielder, etc. |

Upload photos to Cloudinary, then bulk-insert players via `seed.js` or a CSV import script.
