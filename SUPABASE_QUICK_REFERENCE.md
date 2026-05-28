# Supabase Quick Reference

## 🚀 Quick Setup (5 Minutes)

### Option 1: Automated Setup (Recommended)
```bash
# Run the setup wizard
setup-supabase.bat
```
Follow the on-screen instructions.

### Option 2: Manual Setup

#### 1. Create Project
- Go to https://supabase.com/dashboard
- Click "New Project"
- Name: `ESMS`
- Save your database password!

#### 2. Get API Keys
- Settings → API
- Copy:
  - Project URL
  - anon public key
  - service_role key (click Reveal)

#### 3. Update `.env.local`
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### 4. Run Migrations
In Supabase SQL Editor:
1. Copy `supabase/migrations/001_initial_schema.sql` → Run
2. Copy `supabase/migrations/002_rls_policies.sql` → Run

#### 5. Start App
```bash
start-app.bat
```

## 📍 Important URLs

### Supabase Dashboard
```
https://supabase.com/dashboard
```

### Your Project Dashboard
```
https://supabase.com/dashboard/project/YOUR_PROJECT_ID
```

### SQL Editor
```
https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql
```

### Table Editor
```
https://supabase.com/dashboard/project/YOUR_PROJECT_ID/editor
```

### API Settings
```
https://supabase.com/dashboard/project/YOUR_PROJECT_ID/settings/api
```

## 🗄️ Database Tables

After running migrations, you'll have:

| Table | Purpose |
|-------|---------|
| `staff` | Faculty members with scores |
| `rooms` | Exam halls with capacity |
| `exam_sessions` | Scheduled exams |
| `assignments` | Staff-to-exam mappings |
| `system_settings` | Configuration |
| `audit_log` | Change tracking |

## 🔑 Environment Variables Explained

| Variable | Purpose | Where to Find |
|----------|---------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your project URL | Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public API key | Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin API key | Settings → API → service_role (click Reveal) |
| `NEXT_PUBLIC_APP_URL` | Your app URL | `http://localhost:3000` for dev |

## 📝 Sample Data SQL

Run this in SQL Editor to add test data:

```sql
-- Add sample staff
INSERT INTO staff (name, email, job_title, employment_status, availability_status, current_score)
VALUES 
  ('Dr. John Smith', 'john@university.edu', 'D', 'Full-time', 'Available', 0),
  ('Prof. Sarah Johnson', 'sarah@university.edu', 'Ch', 'Full-time', 'Available', 0),
  ('Mr. Mike Wilson', 'mike@university.edu', 'TA', 'Part-time', 'Available', 0);

-- Add sample rooms
INSERT INTO rooms (room_name, max_capacity, building, floor, is_active)
VALUES 
  ('Hall A', 100, 'Main Building', 1, true),
  ('Hall B', 80, 'Main Building', 2, true),
  ('Room 301', 50, 'Science Building', 3, true);

-- Add sample exam session
INSERT INTO exam_sessions (
  subject_name, subject_code, exam_date, period, 
  start_time, duration_minutes, student_count, 
  room_id, academic_year, semester
)
VALUES (
  'Mathematics 101', 'MATH101', '2026-01-20', 1,
  '08:00', 120, 45,
  (SELECT id FROM rooms WHERE room_name = 'Hall A' LIMIT 1),
  '2025-2026', 'Fall'
);
```

## 🔧 Troubleshooting

### Error: "supabaseKey is required"
**Problem**: Environment variables not set
**Solution**: 
1. Check `.env.local` has real values (not placeholders)
2. Restart dev server: `Ctrl+C` then `start-app.bat`

### Error: "Failed to fetch"
**Problem**: Wrong URL or keys
**Solution**: 
1. Verify URL starts with `https://` and ends with `.supabase.co`
2. Verify keys start with `eyJ`
3. No extra spaces in `.env.local`

### Error: "relation does not exist"
**Problem**: Migrations not run
**Solution**: 
1. Go to SQL Editor in Supabase
2. Run both migration files

### Tables not visible
**Problem**: SQL errors during migration
**Solution**: 
1. Check SQL Editor for error messages
2. Make sure you copied the ENTIRE migration file
3. Run migrations in order (001 first, then 002)

## 🎯 Verification Checklist

After setup, verify:
- [ ] `.env.local` has real Supabase credentials
- [ ] 6 tables visible in Supabase Table Editor
- [ ] `system_settings` table has default values
- [ ] App starts without "supabaseKey" error
- [ ] Dashboard page loads
- [ ] Staff page loads

## 🔒 Security Best Practices

✅ **DO**:
- Keep `service_role` key secret
- Use `.env.local` for local development
- Use Vercel environment variables for production
- Enable RLS policies (already done in migrations)

❌ **DON'T**:
- Commit `.env.local` to Git
- Share `service_role` key publicly
- Use `service_role` key in frontend code
- Disable RLS in production

## 📚 Additional Resources

- **Full Setup Guide**: `SUPABASE_SETUP.md`
- **Supabase Docs**: https://supabase.com/docs
- **SQL Reference**: https://supabase.com/docs/guides/database
- **RLS Guide**: https://supabase.com/docs/guides/auth/row-level-security

---

**Need Help?** See `SUPABASE_SETUP.md` for detailed step-by-step instructions.

