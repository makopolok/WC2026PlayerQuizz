#!/bin/bash
# Runs automatically after Codespace creation

set -e

echo "📦 Installing dependencies..."
npm run install:all

echo "🐘 Installing PostgreSQL..."
sudo apt-get update -qq && sudo apt-get install -y -qq postgresql postgresql-contrib

echo "🐘 Starting PostgreSQL..."
sudo service postgresql start

echo "🗄️  Creating database..."
sudo -u postgres createdb wc2026 2>/dev/null || echo "Database already exists"
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';" 2>/dev/null

echo "📋 Applying schema..."
sudo -u postgres psql wc2026 < server/src/db/schema.sql

echo "🔧 Creating server .env..."
if [ ! -f server/.env ]; then
  cat > server/.env <<EOF
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wc2026
PORT=3001
NODE_ENV=development
CLIENT_URL=http://localhost:5173
EOF
fi

echo "✅ Ready! Run: npm run dev:server  (terminal 1)"
echo "           Run: npm run dev:client  (terminal 2)"
