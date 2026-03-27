# Titan-3 Review Console Frontend Build

## Overview
Dark-theme operational dashboard for Titan-3 job hunting engine using Next.js 14 App Router + Tailwind CSS.

## Files Created

### Core Styling
- **src/app/globals.css** - Tailwind directives + dark theme base styles (#0a0a0a bg, gray-100 text, custom components)

### Layout & Navigation
- **src/app/layout.tsx** - Root layout with sidebar, Inter font from next/font
- **src/components/Sidebar.tsx** - 240px dark sidebar with app name, nav links, Ingest Job button

### Pages
- **src/app/page.tsx** - Dashboard with stats cards and jobs table
- **src/app/review/page.tsx** - Review queue with compact list view, score/status/sponsorship risk
- **src/app/tracker/page.tsx** - Applications tracker with editable notes, archive functionality
- **src/app/jobs/[id]/page.tsx** - Job detail page with two-column layout (job info + review packet)

### Components
- **src/components/ScoreBadge.tsx** - Colored score badge (green >=75, yellow 50-74, red <50)
- **src/components/StatusBadge.tsx** - Status badge with color mapping
- **src/components/ApplyButton.tsx** - Apply button with loading/result states, method detection
- **src/components/IngestModal.tsx** - Modal for ingesting jobs (from source or manual import)
- **src/components/ReviewPacketPanel.tsx** - Collapsible panel showing AI-generated review packet

## Design System

### Colors
- Background: #0a0a0a (primary), #111 (cards)
- Borders: #333, #222 (dark subtle)
- Text: gray-100 (primary), gray-400 (muted)
- Accents:
  - Score: green (#059669) >=75, yellow (#f59e0b) 50-74, red (#dc2626) <50
  - Status: blue (SCORED), green (READY), purple (REVIEWING), indigo (APPLIED), orange (FOLLOW_UP), cyan (REVIEW_OPENED)

### Components
- `.card` - bg-[#111], border-gray-800, rounded-lg, hover effects
- `.btn` / `.btn-primary` / `.btn-secondary` / `.btn-ghost` - Tailwind classes
- `.badge` / color variants - Pill-shaped indicators
- `.input` - Form field styling with dark theme

## Key Features

### Dashboard
- 5 stat cards: New Today, High Fit, Ready to Review, Applied, Follow-ups Due
- Jobs table with Score, Title, Company, Location, Source, Status, Actions
- Fetches from `/api/jobs?limit=50` on mount

### Review Queue
- Filters jobs by status (SCORED, READY, REVIEWING)
- Compact list with Score | Title | Company | Sponsorship Risk | Status | Actions
- Skip button removes from queue
- Color-coded sponsorship risk (green/yellow/orange/red)

### Tracker
- Lists APPLIED, FOLLOW_UP, REVIEW_OPENED jobs
- Editable notes field (click to edit, blur/enter to save)
- Archive action
- Shows applied date, method, follow-up date

### Job Detail
- Two-column layout (60% left, 40% right)
- Left: title, company, location, salary, workplace, source link, score breakdown, sponsorship notes, JD, requirements
- Right: Review Packet panel (expandable sections) or "Generate Packet" button
- Bottom actions: Apply (primary green), Open Posting, Skip, Set Follow-up
- Apply button shows loading state + result message
- Manual Open method opens sourceUrl in new tab

### Review Packet
- Sections: Resume Emphasis, Key Bullets, Why Apply, Risks, Interview Prep, Outreach Draft, Sponsor Notes
- Collapsible/expandable
- Regenerate button

## API Endpoints Expected

- `GET /api/jobs` - List jobs with optional filters/sorting
- `GET /api/jobs/[id]` - Get job detail with all relations
- `PATCH /api/jobs/[id]` - Update job (status, notes, etc.)
- `POST /api/jobs/[id]/apply` - Submit application
- `POST /api/jobs/[id]/generate-packet` - Generate review packet
- `POST /api/jobs/ingest` - Ingest jobs from source or manual import

## Component Props

**ScoreBadge**
- `score?: number` - Fit score (0-100)
- `size?: 'sm' | 'md' | 'lg'` - Badge size

**StatusBadge**
- `status: JobStatus` - Job status enum
- `size?: 'sm' | 'md'` - Badge size

**ApplyButton**
- `jobId: string`
- `status: string`
- `sourceUrl?: string`
- `adapterId?: string | null`
- `canApply?: boolean`
- `canPrefill?: boolean`

**ReviewPacketPanel**
- `packet?: ReviewPacket | null`
- `loading?: boolean`

**IngestModal**
- `open: boolean`
- `onClose: () => void`

## Styling Notes

- All components use Tailwind CSS only (no external UI library)
- Dark theme throughout with #0a0a0a background
- Subtle borders (#222/#333) for depth without harshness
- White/gray-100 text for readability
- Color-coded status/score system for quick scanning
- Hover effects on cards and buttons
- Smooth transitions (200ms)
- Mobile-responsive grid layouts

## State Management

All pages are client components using:
- `useState` for local state
- `useEffect` for data fetching
- `fetch()` API for HTTP calls
- Loading and error states shown to user
- Result messages after actions

## Next Steps

1. Implement backend API endpoints matching expected signatures
2. Update API calls if response structure differs
3. Add authentication/session management if needed
4. Test form submissions and data flow
5. Refine styling based on actual data sizes/content
