# Titan-3 Review Console - Implementation Checklist

## ✓ Completed Files (12/12)

### Styling & Layout
- [x] 1. `/src/app/globals.css` - Tailwind + dark theme base styles
- [x] 2. `/src/app/layout.tsx` - Root layout with sidebar, Inter font

### Pages (4)
- [x] 3. `/src/app/page.tsx` - Dashboard (stats + jobs table)
- [x] 4. `/src/app/review/page.tsx` - Review Queue
- [x] 5. `/src/app/tracker/page.tsx` - Applications Tracker
- [x] 6. `/src/app/jobs/[id]/page.tsx` - Job Detail (two-column)

### Reusable Components (6)
- [x] 7. `/src/components/Sidebar.tsx` - Navigation sidebar (240px dark)
- [x] 8. `/src/components/ScoreBadge.tsx` - Score display (colored)
- [x] 9. `/src/components/StatusBadge.tsx` - Status indicator
- [x] 10. `/src/components/ApplyButton.tsx` - Apply with loading/result
- [x] 11. `/src/components/IngestModal.tsx` - Job ingestion modal
- [x] 12. `/src/components/ReviewPacketPanel.tsx` - Review packet display

## Features Implemented

### Dashboard
- [x] Stats row: 5 cards (New Today, High Fit, Ready, Applied, Follow-ups)
- [x] Jobs table: Score, Title, Company, Location, Source, Status, View action
- [x] Score color-coding: Green >=75, Yellow 50-74, Red <50
- [x] Loads from `/api/jobs?limit=50`
- [x] Loading/error states

### Review Queue
- [x] Filters jobs: SCORED, READY, REVIEWING (sorted by fitScore desc)
- [x] Compact list: Score | Title | Company | Sponsorship Risk | Status | Actions
- [x] Color-coded sponsorship risk (NONE/LOW/MEDIUM/HIGH)
- [x] Skip button removes from queue
- [x] View button links to job detail

### Tracker
- [x] Lists: APPLIED, FOLLOW_UP, REVIEW_OPENED
- [x] Editable notes (click to edit, blur/enter to save)
- [x] Shows: Title, Company, Applied Date, Method, Status, Follow-up Date, Notes
- [x] Archive action
- [x] Method badge colors (Manual/Prefill/Auto)

### Job Detail
- [x] Two-column layout (60% left, 40% right)
- [x] Left column:
  - [x] Job header (title, company)
  - [x] Job details (location, salary, workplace type, source)
  - [x] Source link (external)
  - [x] Status badge
  - [x] Score breakdown (bar charts)
  - [x] Sponsorship notes (if present)
  - [x] Job description (cleaned or raw)
  - [x] Requirements list
- [x] Right column:
  - [x] Review Packet panel (collapsible sections) OR Generate button
  - [x] Action buttons: Apply (primary green), Open Posting, Skip, Set Follow-up
- [x] Apply button:
  - [x] Loading state
  - [x] Result message (success/error)
  - [x] Manual Open opens sourceUrl in new tab
  - [x] Status validation (only READY/REVIEWING)
- [x] Back button to go back

### Components
- [x] ScoreBadge: Colored (green/yellow/red), sizes (sm/md/lg), null handling
- [x] StatusBadge: All statuses mapped with colors, sizes
- [x] ApplyButton: Disable logic, loading, result messages, URL handling
- [x] IngestModal: Two tabs (Source/Manual), form validation, result messages
- [x] ReviewPacketPanel: Expandable sections, regenerate button, empty state
- [x] Sidebar: Active link highlighting, Ingest button, nav items

## Dark Theme Implementation

### Color Scheme
- [x] Background: #0a0a0a (body), #111 (cards)
- [x] Borders: #222/#333 (subtle)
- [x] Text: gray-100 (primary), gray-400 (muted), gray-500 (subtle)
- [x] Status colors:
  - [x] NEW: gray-700
  - [x] SCORED: blue-900
  - [x] READY: green-900
  - [x] REVIEWING: purple-900
  - [x] APPLIED: indigo-900
  - [x] FOLLOW_UP: orange-900
  - [x] REVIEW_OPENED: cyan-900
  - [x] SKIPPED: gray-800
  - [x] ARCHIVED: gray-900
- [x] Score colors:
  - [x] Green >=75: green-900/green-100
  - [x] Yellow 50-74: yellow-900/yellow-100
  - [x] Red <50: red-900/red-100
- [x] Accent (primary button): green-600/700

### Styling Approach
- [x] Tailwind CSS only (no external UI library)
- [x] Custom `.card`, `.btn`, `.badge` classes in globals.css
- [x] Hover effects on cards and buttons
- [x] Smooth transitions (200ms)
- [x] Focus states on inputs
- [x] Loading spinners (animate-spin)
- [x] Scrollbar styling (dark gray)

## Component Patterns

### Client Components (use 'use client')
- [x] All pages (page.tsx) - useEffect for data fetching
- [x] Sidebar - useState for nav, IngestModal
- [x] ApplyButton - useState for loading/result
- [x] IngestModal - useState for form state
- [x] ReviewPacketPanel - useState for expanded sections
- [x] StatusBadge, ScoreBadge - pure presentational (no state needed but can be in client)

### Data Fetching
- [x] Use fetch() API
- [x] Handle loading states (spinner)
- [x] Handle error states (error message)
- [x] Show empty states when no data
- [x] POST/PATCH with JSON bodies

## API Contract

### Expected Endpoints
- [x] `GET /api/jobs` - query params: limit, status, sort, order
- [x] `GET /api/jobs/[id]` - full job with relations
- [x] `PATCH /api/jobs/[id]` - update status, notes, etc.
- [x] `POST /api/jobs/[id]/apply` - submit application
- [x] `POST /api/jobs/[id]/generate-packet` - AI packet generation
- [x] `POST /api/jobs/ingest` - ingest from source or manual

### Response Structure
All functions expect JSON responses with appropriate data structures.
See FRONTEND_BUILD.md for detailed interface definitions.

## Ready for Testing

- [x] All 12 files written with full implementations
- [x] No truncations or TODOs
- [x] TypeScript interfaces defined
- [x] Error handling in place
- [x] Loading states throughout
- [x] Dark theme complete
- [x] Component reusability optimized

## Integration Notes

1. Backend must implement API endpoints listed above
2. Response structures should match interfaces in component files
3. If response structure differs, update fetch calls accordingly
4. Add authentication (if needed) to layout.tsx or create auth wrapper
5. Consider adding toast notifications for better UX feedback
6. Test with real data volumes to optimize table rendering
7. May need to add virtualization if handling 1000+ jobs

## File Locations

All files in: `/sessions/serene-pensive-fermat/mnt/Job Hunt/titan3-console/src/`

```
src/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx (Dashboard)
│   ├── review/
│   │   └── page.tsx
│   ├── tracker/
│   │   └── page.tsx
│   └── jobs/
│       └── [id]/
│           └── page.tsx
└── components/
    ├── Sidebar.tsx
    ├── ScoreBadge.tsx
    ├── StatusBadge.tsx
    ├── ApplyButton.tsx
    ├── IngestModal.tsx
    └── ReviewPacketPanel.tsx
```
