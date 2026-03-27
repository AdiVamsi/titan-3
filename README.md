# Titan-3 Review Console

An intelligent job hunt dashboard built with Next.js, Prisma, and BullMQ. Automates job ingestion, AI-powered scoring, review packet generation, and application tracking across multiple ATS platforms and job boards.

## Features

- **Automated Job Ingestion** - Ingest from Greenhouse, Lever, manual entry, or browser automation
- **AI-Powered Scoring** - Smart candidate-job fit analysis with detailed breakdowns
- **Intelligent Review Packets** - AI-generated application prep with resume emphasis, interview bullets, and company research
- **Application Tracking** - Track applications, follow-ups, and outcomes
- **Queue-Based Architecture** - Scalable job processing with BullMQ
- **Multi-Provider AI** - Support for Claude and OpenAI

## Tech Stack

- **Frontend** - Next.js 14, React 18, TailwindCSS
- **Backend** - Node.js, Prisma ORM
- **Database** - PostgreSQL
- **Job Queue** - BullMQ + Redis
- **AI** - Anthropic Claude / OpenAI API
- **Automation** - Playwright for browser automation
- **Type Safety** - TypeScript, Zod

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- PostgreSQL 12+ (local or remote)
- Redis 6+ (optional, required for queue features)

## Quick Start

### 1. Clone and Install

```bash
git clone <repo>
cd titan3-console
chmod +x scripts/setup.sh
./scripts/setup.sh
```

The setup script will:
- Check Node.js/npm versions
- Install dependencies
- Create `.env` from `.env.example`
- Generate Prisma client
- Create database schema
- Seed with sample data

### 2. Configure Environment

Edit `.env`:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/titan3"

# Redis (for job queues)
REDIS_URL="redis://localhost:6379"
# Or individual settings:
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# AI Provider (choose one)
ANTHROPIC_API_KEY="sk-ant-..."
# OR
OPENAI_API_KEY="sk-..."

# Application settings
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### 3. Start Development

```bash
# Start Next.js dev server (port 3000)
npm run dev

# In another terminal, start workers
npm run workers

# View database schema
npm run db:studio
```

Visit http://localhost:3000

## Project Structure

```
titan3-console/
├── src/
│   ├── app/              # Next.js app directory
│   ├── components/       # React components
│   ├── lib/
│   │   ├── db.ts        # Database helpers
│   │   ├── queue.ts     # BullMQ setup
│   │   ├── scoring.ts   # Fit scoring algorithm
│   │   ├── profile.ts   # Candidate profile
│   │   └── types.ts     # TypeScript interfaces
│   ├── adapters/         # Job source adapters
│   │   ├── base.ts      # Base adapter interface
│   │   ├── greenhouse.ts
│   │   ├── lever.ts
│   │   ├── manual.ts
│   │   ├── browser.ts
│   │   └── registry.ts
│   ├── providers/        # AI providers
│   │   ├── base.ts
│   │   ├── claude.ts
│   │   └── openai.ts
│   └── workers/          # BullMQ workers
│       ├── ingest.worker.ts
│       ├── score.worker.ts
│       ├── packet.worker.ts
│       └── apply.worker.ts
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── seed.ts          # Sample data
└── scripts/
    └── setup.sh         # Setup automation
```

## Database Schema

### Core Models

- **Job** - Job posting with metadata, score, and application status
- **JobContent** - Raw and parsed job description text
- **JobScore** - Detailed fit analysis and scoring breakdown
- **ReviewPacket** - AI-generated application preparation materials
- **Application** - Application status and outcome tracking

### Supporting Models

- **Company** - Company information and sponsorship history
- **RecruiterContact** - Recruiter contact information
- **ResumeProfile** - Candidate profile (skills, experience, preferences)
- **AdapterCapability** - Adapter metadata and capabilities
- **AuditLog** - Action history and audit trail
- **FollowUp** - Follow-up reminders and tasks

## Job Processing Pipeline

### 1. Ingestion (ingest-queue)

```
Input: Job posting (from adapter or manual entry)
  ↓
Normalize job data
  ↓
Deduplicate by canonical URL
  ↓
Create Job + JobContent records
  ↓
Output: Job record with INGESTED status
```

### 2. Scoring (score-queue)

```
Input: Job ID
  ↓
Fetch job + content
  ↓
Run scoring algorithm (title, skills, seniority, AI relevance, etc.)
  ↓
Upsert JobScore record
  ↓
Update job.fitScore and sponsorshipRisk
  ↓
Output: Job record with SCORED status
```

### 3. Packet Generation (packet-queue)

```
Input: Job ID
  ↓
Fetch job + content + score
  ↓
Call AI provider with job context
  ↓
Parse AI response (resume emphasis, bullets, outreach, etc.)
  ↓
Upsert ReviewPacket record
  ↓
Output: Job record with READY status
```

### 4. Application (apply-queue)

```
Input: Job ID + apply method
  ↓
Load adapter for job source
  ↓
Execute adapter.apply() or adapter.prefill()
  ↓
Create Application record
  ↓
Update job status to APPLIED or APPLY_FAILED
  ↓
Output: Application record with status
```

## Scoring Algorithm

The scoring engine evaluates jobs across 7 dimensions:

| Dimension | Weight | Description |
|-----------|--------|-------------|
| **Title Fit** | 15% | How well job title matches target roles |
| **Skills Fit** | 25% | Coverage of required and preferred skills |
| **Seniority Fit** | 15% | Experience level match (mid-level focus) |
| **AI Relevance** | 15% | Involvement of AI/ML/LLM work |
| **Backend Relevance** | 15% | Backend engineering and API work |
| **Location Fit** | 10% | Remote preference and US location |
| **Sponsorship Risk** | 10% | Work visa/sponsorship requirements |

**Overall Score** = weighted sum of all dimensions (0-100)

### Sponsorship Risk Levels

- **SAFE (80+)** - No sponsorship needed (open to STEM OPT)
- **LIKELY_SAFE (60-79)** - Favorable terms, can request sponsorship
- **UNCERTAIN (40-59)** - Unclear requirements, verify with recruiter
- **RISKY (20-39)** - Sponsorship barriers, possible but uncertain
- **BLOCKED (<20)** - Explicit barriers (citizenship, clearance requirements)

## Available API Endpoints

### Job Management

```bash
# List all jobs with filters
GET /api/jobs?status=READY&minScore=70&limit=20

# Get job details with score and packet
GET /api/jobs/:id

# Ingest jobs
POST /api/ingest
Body: { adapterId, config } | { manual: true, url, rawText, title, companyName }

# Update job status
PATCH /api/jobs/:id
Body: { status: "REVIEWED" | "APPLIED" | "SKIPPED" }
```

### Scoring & Review

```bash
# Get job score
GET /api/jobs/:id/score

# Get review packet
GET /api/jobs/:id/packet

# Request re-score
POST /api/jobs/:id/rescore
```

### Applications

```bash
# Apply to job
POST /api/jobs/:id/apply
Body: { method: "apply" | "prefill", resumePath?, answers? }

# Get application status
GET /api/jobs/:id/application
```

### Admin

```bash
# Queue stats
GET /api/admin/queues

# Audit logs
GET /api/admin/logs?jobId=...

# Candidate profile
GET /api/admin/profile
```

## Adapter System

Adapters integrate with job boards and ATS platforms. Each adapter implements:

- **ingest(config)** - Fetch jobs from source
- **apply(job, payload)** - Submit application
- **prefill(job)** - Pre-fill application form (optional)
- **capabilities** - Metadata about adapter features

### Built-in Adapters

| Adapter | Ingest | Apply | Prefill | Use Case |
|---------|--------|-------|---------|----------|
| **Greenhouse** | ✓ | ✓ | ✓ | Parse Greenhouse career pages |
| **Lever** | ✓ | ✓ | ✓ | Parse Lever application boards |
| **Manual** | ✓ | ✗ | ✗ | Paste job descriptions |
| **Browser** | ✓ | ✗ | ✓ | Automate with Playwright |

## Sample Data

The seed script creates:

- **Job 1: Applied AI Engineer @ BrightPlan** - Remote, $125k-$155k
  - Fit Score: 85% (High match for LLM + API skills)
  - Full review packet generated
  - Sponsors STEM OPT candidates

- **Job 2: AI ML Engineer @ Stanley David** - Remote
  - Fit Score: 82% (Strong AI/ML focus)
  - RAG and embedding requirements

- **Job 3: Senior Staff ML Engineer @ BigCorp** - NYC, On-site
  - Fit Score: 35% (Overleveled: 10+ yrs + PhD)
  - Research-focused, not ideal match

- **Job 4: Backend Engineer @ TechStartup** - Remote
  - Fit Score: 68% (Good backend fit, lower AI)
  - Node.js and PostgreSQL focused

- **Job 5: AI Engineer @ DefenseCo** - Arlington, VA
  - Fit Score: 25% (Blocked: requires US citizenship + TS/SCI clearance)
  - Cannot support STEM OPT

## Development Commands

```bash
# Development server
npm run dev

# Start queue workers
npm run workers

# Type checking
npm run lint

# Build for production
npm run build

# Start production server
npm run start

# Database commands
npm run db:push      # Apply schema changes
npm run db:seed      # Run seed script
npm run db:studio    # Open Prisma Studio
```

## Environment Variables Reference

### Database

- `DATABASE_URL` - PostgreSQL connection string (required)

### Redis / Queue

- `REDIS_URL` - Full Redis URL (optional, uses REDIS_HOST/PORT if not set)
- `REDIS_HOST` - Redis server hostname (default: localhost)
- `REDIS_PORT` - Redis server port (default: 6379)
- `REDIS_PASSWORD` - Redis password (optional)

### AI Providers

- `ANTHROPIC_API_KEY` - Claude API key (for scoring and packet generation)
- `OPENAI_API_KEY` - OpenAI API key (alternative to Anthropic)

### Application

- `NODE_ENV` - Environment (development/production)
- `NEXT_PUBLIC_API_URL` - API base URL for client

## Troubleshooting

### "Redis connection failed"

The app works without Redis (in-memory queues), but workers require Redis for persistence:

```bash
# Start Redis locally (macOS)
brew install redis
redis-server

# Or Docker
docker run -d -p 6379:6379 redis:latest
```

### "PostgreSQL connection failed"

Verify DATABASE_URL:

```bash
# Test connection
psql $DATABASE_URL -c "SELECT version();"

# Or create local database
createdb titan3
```

### "No AI provider available"

Configure ANTHROPIC_API_KEY or OPENAI_API_KEY:

```bash
echo 'ANTHROPIC_API_KEY="sk-ant-..."' >> .env
npm run dev
```

### Workers not processing jobs

Check Redis is running and REDIS_URL is correct:

```bash
# Verify Redis
redis-cli ping
# Should return: PONG

# Check queue status
npm run dev  # in another terminal
curl http://localhost:3000/api/admin/queues
```

## Architecture Overview

```
                    ┌─────────────┐
                    │  Next.js    │
                    │ Dashboard   │
                    └──────┬──────┘
                           │ HTTP
                    ┌──────▼──────────┐
                    │  API Routes     │
                    │  /api/jobs      │
                    │  /api/ingest    │
                    │  /api/apply     │
                    └──────┬──────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
    ┌────────┐         ┌──────────┐      ┌────────┐
    │ Prisma │         │  BullMQ  │      │ Redis  │
    │  ORM   │         │ Queues   │      │ Store  │
    └────┬───┘         └────┬─────┘      └────────┘
         │                  │
    ┌────▼─────────────────▼───────────┐
    │     PostgreSQL Database           │
    │  Jobs, Scores, Packets, Apps      │
    └───────────────────────────────────┘
         │
    ┌────▼──────────────────────────┐
    │   BullMQ Workers              │
    │  - ingest-queue               │
    │  - score-queue                │
    │  - packet-queue               │
    │  - apply-queue                │
    └────┬────────────────────┬──────┘
         │                    │
    ┌────▼───────┐     ┌─────▼──────────┐
    │  Adapters  │     │ AI Providers   │
    │  (ATS/Job  │     │  - Claude      │
    │   Boards)  │     │  - OpenAI      │
    └────────────┘     └────────────────┘
```

## Performance Tips

- **Scoring**: Runs async in background, jobs appear ready after scoring completes
- **Batch Ingestion**: Ingest multiple jobs in one request to reduce overhead
- **Index Strategy**: Database indexed on status, fitScore, companyId for fast queries
- **Queue Concurrency**: Adjust worker concurrency in worker files based on system resources

## Contributing

When adding features:

1. Update Prisma schema if needed
2. Run `npx prisma migrate dev --name <feature>`
3. Update types in `src/lib/types.ts`
4. Create tests in `__tests__` directory
5. Update this README

## License

MIT

## Support

For issues and questions:
- Check README troubleshooting section
- Review logs in Prisma Studio
- Check queue status at `/api/admin/queues`
- Review audit logs at `/api/admin/logs`

---

**Built with ❤️ for efficient job hunting**
