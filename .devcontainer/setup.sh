#!/bin/bash
# Run once after Codespace creation to initialize the database

set -e

echo "🐘 Starting PostgreSQL..."
sudo service postgresql start

echo "🗄️  Creating database..."
sudo -u postgres createdb wc2026 2>/dev/null || echo "Database already exists"
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';" 2>/dev/null

echo "📋 Applying schema..."
sudo -u postgres psql wc2026 < server/src/db/schema.sql

echo "🔧 Creating server .env..."
if [ ! -f server/.env ]; then
  echo "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wc2026" > server/.env
  echo "PORT=3001" >> server/.env
  echo "NODE_ENV=development" >> server/.env
  echo "CLIENT_URL=http://localhost:5173" >> server/.env
fi

echo "✅ Done! Run 'npm run dev:server' and 'npm run dev:client' to start."
