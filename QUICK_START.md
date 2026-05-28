# ESMS Quick Start Guide

Get the Faculty Exam Supervision & Proctoring System running in 5 minutes!

## Prerequisites Check

```bash
node --version  # Should be v18.17.0 or higher
npm --version   # Should be 9.0.0 or higher
```

## 1. Install Dependencies (2 minutes)

```bash
cd "d:\HUE\DEVELOPED SOFTWARE\Supervisors Automated Assign"
npm install
```

## 2. Set Up Supabase (3 minutes)

### Create Project
1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Name it "ESMS" and choose a password
4. Wait for project creation (~1 minute)

### Run Migrations
1. In Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/001_initial_schema.sql`
3. Paste and click "Run"
4. Repeat for `supabase/migrations/002_rls_policies.sql`

### Get Credentials
1. Settings → API
2. Copy:
   - Project URL
   - anon public key
   - service_role key (click "Reveal")

## 3. Configure Environment

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3010
```

## 4. Start Development Server

```bash
npm run dev
```

Open http://localhost:3010

## 5. Add Test Data (Optional)

In Supabase Dashboard → Table Editor:

### Add a Staff Member
Table: `staff`
- name: "Dr. John Smith"
- email: "john@university.edu"
- job_title: "D"
- employment_status: "Full-time"
- availability_status: "Available"
- current_score: 0

### Add a Room
Table: `rooms`
- room_name: "Hall A"
- max_capacity: 100
- building: "Main Building"
- floor: 1
- is_active: true

### Add an Exam Session
Table: `exam_sessions`
- subject_name: "Mathematics 101"
- subject_code: "MATH101"
- exam_date: "2026-01-20"
- period: 1
- start_time: "08:00"
- duration_minutes: 120
- student_count: 45
- room_id: (select from dropdown)
- academic_year: "2025-2026"
- semester: "Fall"

## Verify Everything Works

1. ✅ Home page loads at http://localhost:3010
2. ✅ Navigate to Dashboard - see weekly grid
3. ✅ Navigate to Staff - see staff table
4. ✅ All navigation links work

## Common Issues

### "Failed to fetch"
- Check `.env.local` has correct Supabase credentials
- Verify Supabase project is active (not paused)

### Port 3000 in use
```bash
npm run dev -- -p 3001
```

### Build errors
```bash
npm run build
```
Should complete successfully with no errors.

## What's Next?

- Read `PROJECT_SUMMARY.md` for complete feature list
- See `SETUP_GUIDE.md` for detailed documentation
- Check `README.md` for architecture overview

## Development Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Check TypeScript types
```

## Project Structure Overview

```
app/              → Pages (dashboard, staff, rooms, etc.)
components/       → Reusable UI components
lib/              → Business logic and utilities
  ├── algorithms/ → Auto-assignment algorithm
  ├── stores/     → State management
  └── supabase/   → Database client
types/            → TypeScript definitions
supabase/         → Database migrations
```

## Key Features Implemented

✅ Weekly schedule dashboard  
✅ Staff management interface  
✅ Auto-assignment algorithm  
✅ Database schema with RLS  
✅ Type-safe TypeScript  
✅ Responsive UI with Tailwind  

## Key Features To Implement

⏳ Staff CRUD operations  
⏳ Room management  
⏳ Exam session forms  
⏳ Auto-assignment API  
⏳ Drag-and-drop assignments  
⏳ PDF report generation  

---

**Ready to code!** Start with implementing staff CRUD in `app/staff/page.tsx`

