#!/bin/bash
# Runs automatically after Codespace creation

set -e

echo "📦 Installing dependencies..."
npm run install:all

echo "🔧 Creating server .env from Codespace secrets..."
cat > server/.env <<EOF
DATABASE_URL=${DATABASE_URL}
PORT=3001
NODE_ENV=development
CLIENT_URL=http://localhost:5173
EOF

if [ -z "${DATABASE_URL}" ]; then
  echo "⚠️  DATABASE_URL secret not set. Edit server/.env manually."
else
  echo "✅ .env created from secrets!"
  echo "📋 Applying schema..."
  node server/src/db/migrate.js
  echo "🌱 Seeding players..."
  node server/src/db/seed.js
fi

echo ""
echo "🚀 Ready! Open two terminals and run:"
echo "   npm run dev:server"
echo "   npm run dev:client"
