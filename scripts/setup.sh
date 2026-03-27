#!/bin/bash

# Titan-3 Review Console - Setup Script
# Initializes development environment and database

set -e

echo "🚀 Setting up Titan-3 Review Console..."
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
  echo "❌ Node.js is required but not installed."
  echo "   Install from: https://nodejs.org/ (Node 18+)"
  exit 1
fi

if ! command -v npm &> /dev/null; then
  echo "❌ npm is required but not installed."
  exit 1
fi

NODE_VERSION=$(node -v)
echo "✓ Node.js version: $NODE_VERSION"
echo "✓ npm version: $(npm -v)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo "✓ Dependencies installed"
echo ""

# Copy environment variables if not exists
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "📝 Created .env from .env.example"
    echo "   ⚠️  Please update with your configuration:"
    echo "      - DATABASE_URL"
    echo "      - REDIS_URL (or set REDIS_HOST, REDIS_PORT)"
    echo "      - ANTHROPIC_API_KEY or OPENAI_API_KEY"
  else
    echo "⚠️  No .env.example found. Create .env with required variables:"
    echo "    - DATABASE_URL=postgresql://..."
    echo "    - REDIS_URL=redis://..."
    echo "    - ANTHROPIC_API_KEY=sk-ant-..."
  fi
else
  echo "✓ .env file already exists"
fi
echo ""

# Generate Prisma client
echo "⚙️  Generating Prisma client..."
npx prisma generate
echo "✓ Prisma client generated"
echo ""

# Setup database schema
echo "🗄️  Setting up database schema..."
npx prisma db push --skip-generate
echo "✓ Database schema applied"
echo ""

# Seed database
echo "🌱 Seeding database with sample data..."
npm run db:seed
echo "✓ Database seeded successfully"
echo ""

# Final summary
echo "✅ Setup complete!"
echo ""
echo "📚 Next steps:"
echo ""
echo "1. Review .env configuration:"
echo "   - Verify DATABASE_URL points to your PostgreSQL instance"
echo "   - Set REDIS_URL or configure Redis connection"
echo "   - Add ANTHROPIC_API_KEY or OPENAI_API_KEY for AI features"
echo ""
echo "2. Start development server:"
echo "   npm run dev"
echo ""
echo "3. View database:"
echo "   npm run db:studio"
echo ""
echo "📖 Documentation:"
echo "   - See README.md for project overview"
echo "   - Check src/README.md for code structure"
echo ""
echo "🎯 Sample data loaded:"
echo "   - 5 test jobs (various fit scores and statuses)"
echo "   - Job 1 (Applied AI Engineer at BrightPlan) has full review packet"
echo "   - Visit http://localhost:3000 to view in dashboard"
