# Titan-3 Review Console API Routes

Complete API route implementation for the Titan-3 Review Console with Next.js 14 App Router.

## Files Created

### Supporting Libraries

#### `/src/lib/scoring.ts`
- Job scoring engine that evaluates job fit based on candidate profile
- Metrics: titleFit, skillsFit, seniorityFit, aiRelevance, backendRelevance, locationFit, sponsorshipRisk, overallScore
- Returns ScoreBreakdown with rationale, matched skills, missing skills, and keyword gaps
- Weights configured for balanced evaluation

#### `/src/adapters/registry.ts`
- Centralized registry of all job source adapters
- Provides adapter lookup by ID or source type
- Initializes adapters on import (Greenhouse, Lever)
- Exports utility functions for adapter management

### API Routes

#### `GET /api/health`
**File**: `/src/app/api/health/route.ts`
- Returns health status with timestamp and version
- Response: `{ status: 'ok', timestamp: ISO8601, version: '0.1.0' }`

#### `GET /api/jobs`
**File**: `/src/app/api/jobs/route.ts`
- List jobs with pagination and filtering
- Query params: status, minScore, source, search, page (default: 1), limit (default: 20)
- Includes relations: content, score, packet, application
- Default sort: fitScore DESC, createdAt DESC
- Returns paginated results with total count

#### `POST /api/jobs`
**File**: `/src/app/api/jobs/route.ts`
- Create a new job manually
- Body: { title, companyName, sourceUrl, sourceType?, location?, workplaceType?, salaryText?, rawText? }
- Creates Job + JobContent records
- Returns created job with relations

#### `GET /api/jobs/[id]`
**File**: `/src/app/api/jobs/[id]/route.ts`
- Get single job with ALL relations
- Includes: content, score, packet, application, followUps, auditLogs
- Returns 404 if job not found

#### `PATCH /api/jobs/[id]`
**File**: `/src/app/api/jobs/[id]/route.ts`
- Update job fields
- Supported fields: status, notes, sponsorshipRisk, location
- Returns updated job with relations

#### `DELETE /api/jobs/[id]`
**File**: `/src/app/api/jobs/[id]/route.ts`
- Soft-delete by setting status to ARCHIVED
- Returns archived job

#### `POST /api/jobs/[id]/score`
**File**: `/src/app/api/jobs/[id]/score/route.ts`
- Score a job using the scoring engine
- Requires job content to exist
- Creates/updates JobScore record
- Updates job.fitScore and status to SCORED
- Creates audit log entry
- Returns score breakdown with job details

#### `POST /api/jobs/[id]/packet`
**File**: `/src/app/api/jobs/[id]/packet/route.ts`
- Generate AI-powered review packet
- Calls Claude API with job description and score breakdown
- Parses JSON response into ReviewPacket fields:
  - resumeEmphasis (string[])
  - summaryRewrite (string)
  - bulletsToHighlight (string[])
  - outreachDraft (string)
  - interviewPrepBullets (string[])
  - risks (string[])
  - whyApply (string)
  - sponsorNotes (string - includes STEM OPT work auth)
- Updates job status to READY
- Creates audit log entry

#### `POST /api/jobs/[id]/apply`
**File**: `/src/app/api/jobs/[id]/apply/route.ts`
- Execute apply action
- Checks job status is READY or REVIEWING
- Determines apply method based on adapter capabilities:
  - canApply=true → ADAPTER_SUBMIT
  - canPrefill=true → BROWSER_PREFILL
  - else → MANUAL_OPEN
- Creates Application record
- Updates job status (APPLIED, REVIEW_OPENED, or APPLY_FAILED)
- Creates audit log entry
- Returns result with method used and source URL

#### `POST /api/jobs/ingest`
**File**: `/src/app/api/jobs/ingest/route.ts`
- Ingest jobs from a source
- Two modes:
  1. Adapter mode: { adapterId, config: { query?, location?, maxResults?, boardUrl? } }
  2. Manual mode: { manual: true, url, rawText, title, companyName, sourceType? }
- Deduplicates by canonicalUrl
- Creates Job + JobContent records for each
- Returns: { ingested: number, duplicates: number, errors: string[] }

#### `GET /api/adapters`
**File**: `/src/app/api/adapters/route.ts`
- List all registered adapters with capabilities
- Returns array of adapters with: id, name, sourceType, capabilities
- Capabilities include: canIngest, canApply, canPrefill, requiresHumanReview, supportsResumeUpload, supportsQuestionHandling

#### `POST /api/jobs/[id]/followup`
**File**: `/src/app/api/jobs/[id]/followup/route.ts`
- Create a follow-up task
- Body: { dueDate (ISO8601), action, notes? }
- Creates FollowUp record
- Updates job status to FOLLOW_UP
- Creates audit log entry
- Returns follow-up and updated job

#### `PATCH /api/jobs/[id]/followup`
**File**: `/src/app/api/jobs/[id]/followup/route.ts`
- Update follow-up (mark complete)
- Body: { followUpId, completed: boolean }
- Sets completedAt timestamp when completed
- Creates audit log entry
- Returns updated follow-up

## Key Features

### Error Handling
- All routes use try/catch with proper error responses
- Zod validation for request bodies with detailed error messages
- NextResponse.json() with appropriate HTTP status codes
- Console error logging for debugging

### Database Integration
- Uses Prisma client singleton from @/lib/db
- Proper relation loading with include()
- Transaction-like operations where multiple records are created
- Index optimization for common queries

### AI Integration
- Claude provider for review packet generation
- Structured JSON response parsing
- Includes STEM OPT work authorization text
- Comprehensive job analysis with candidate profile matching

### Audit Trail
- All state-changing operations create AuditLog entries
- Logs: action, actor (system), details, timestamp
- Enables job history tracking and compliance

### Type Safety
- TypeScript strict mode
- Zod schemas for request validation
- Prisma-generated types for database operations

## Configuration

All routes expect these environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `ANTHROPIC_API_KEY` - For Claude API calls (packet generation)

## Testing

Example requests:

```bash
# Health check
curl http://localhost:3000/api/health

# List jobs
curl "http://localhost:3000/api/jobs?status=SCORED&minScore=70&page=1&limit=20"

# Create job
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "title": "AI Engineer",
    "companyName": "Acme Corp",
    "sourceUrl": "https://example.com/job/123",
    "sourceType": "MANUAL",
    "location": "Remote",
    "workplaceType": "REMOTE",
    "rawText": "Job description here..."
  }'

# Score job
curl -X POST http://localhost:3000/api/jobs/[JOB_ID]/score

# Generate packet
curl -X POST http://localhost:3000/api/jobs/[JOB_ID]/packet

# Apply
curl -X POST http://localhost:3000/api/jobs/[JOB_ID]/apply \
  -H "Content-Type: application/json" \
  -d '{"resumePath": "/path/to/resume.pdf"}'

# Create follow-up
curl -X POST http://localhost:3000/api/jobs/[JOB_ID]/followup \
  -H "Content-Type: application/json" \
  -d '{
    "dueDate": "2026-04-01T10:00:00Z",
    "action": "Follow up via email",
    "notes": "Check application status"
  }'
```

## Database Schema

All routes use these Prisma models:
- `Job` - Main job record with metadata and status
- `JobContent` - Raw and parsed job description
- `JobScore` - Scoring breakdown
- `ReviewPacket` - AI-generated review material
- `Application` - Application submission record
- `FollowUp` - Follow-up reminders and tasks
- `AuditLog` - Activity and change tracking

See `prisma/schema.prisma` for complete schema definition.
