#!/bin/bash
# Runs automatically after Codespace creation

set -e

echo "📦 Installing dependencies..."
npm run install:all

echo ""
echo "✅ Dependencies installed!"
echo ""
echo "⚠️  Next step: set up your database connection"
echo "   1. Go to https://neon.tech and create a free PostgreSQL database"
echo "   2. Copy your connection string"
echo "   3. Run: cp server/.env.example server/.env"
echo "   4. Edit server/.env and set DATABASE_URL=<your neon connection string>"
echo "   5. Run: node server/src/db/migrate.js   (applies schema)"
echo ""
echo "Then start the app:"
echo "   Terminal 1: npm run dev:server"
echo "   Terminal 2: npm run dev:client"
