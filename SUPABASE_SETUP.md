# Supabase Setup Guide for ESMS

Complete step-by-step guide to set up Supabase for the ESMS application.

## Prerequisites

- A Supabase account (free tier is sufficient)
- Internet connection

## Step 1: Create Supabase Project (5 minutes)

### 1.1 Sign Up / Sign In
1. Go to https://supabase.com
2. Click "Start your project" or "Sign In"
3. Sign in with GitHub, Google, or email

### 1.2 Create New Project
1. Click "New Project" button
2. Fill in the details:
   - **Name**: `ESMS` (or any name you prefer)
   - **Database Password**: Choose a strong password (save it somewhere safe!)
   - **Region**: Choose closest to your location
   - **Pricing Plan**: Free (sufficient for development)
3. Click "Create new project"
4. **Wait 1-2 minutes** for project to be created

## Step 2: Get Your API Keys (2 minutes)

### 2.1 Navigate to API Settings
1. In your Supabase project dashboard
2. Click on the **Settings** icon (⚙️) in the left sidebar
3. Click on **API** in the settings menu

### 2.2 Copy Your Credentials
You'll see three important values:

**Project URL:**
```
https://xxxxxxxxxxxxx.supabase.co
```
Copy this entire URL.

**anon public key:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS...
```
This is a long string starting with `eyJ`. Copy the entire key.

**service_role key:**
1. Click "Reveal" button next to `service_role`
2. Copy the entire key (also starts with `eyJ`)
3. ⚠️ **IMPORTANT**: Keep this secret! Never commit to Git!

## Step 3: Update Environment Variables (1 minute)

### 3.1 Open `.env.local` file
Located in the root of your project.

### 3.2 Replace the placeholder values:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS...

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3.3 Save the file
Press `Ctrl+S` to save.

## Step 4: Run Database Migrations (3 minutes)

### 4.1 Open SQL Editor
1. In Supabase dashboard, click **SQL Editor** in left sidebar
2. Click "New query" button

### 4.2 Run First Migration (Initial Schema)
1. Open the file: `supabase/migrations/001_initial_schema.sql`
2. Copy **ALL** the content (Ctrl+A, Ctrl+C)
3. Paste into Supabase SQL Editor
4. Click **"Run"** button (or press Ctrl+Enter)
5. Wait for "Success. No rows returned" message

### 4.3 Run Second Migration (RLS Policies)
1. Click "New query" again
2. Open the file: `supabase/migrations/002_rls_policies.sql`
3. Copy **ALL** the content
4. Paste into Supabase SQL Editor
5. Click **"Run"** button
6. Wait for success message

## Step 5: Verify Database Setup (2 minutes)

### 5.1 Check Tables
1. Click **Table Editor** in left sidebar
2. You should see these tables:
   - ✅ `staff`
   - ✅ `rooms`
   - ✅ `exam_sessions`
   - ✅ `assignments`
   - ✅ `system_settings`
   - ✅ `audit_log`

### 5.2 Check System Settings
1. Click on `system_settings` table
2. You should see default settings already populated

## Step 6: Add Sample Data (Optional - 5 minutes)

### 6.1 Add Sample Staff
1. In Table Editor, click `staff` table
2. Click "Insert" → "Insert row"
3. Fill in:
   - **name**: Dr. John Smith
   - **email**: john.smith@university.edu
   - **job_title**: D (Doctor)
   - **employment_status**: Full-time
   - **availability_status**: Available
   - **current_score**: 0
4. Click "Save"

### 6.2 Add Sample Room
1. Click `rooms` table
2. Click "Insert" → "Insert row"
3. Fill in:
   - **room_name**: Hall A
   - **max_capacity**: 100
   - **building**: Main Building
   - **floor**: 1
   - **is_active**: true
4. Click "Save"

### 6.3 Add Sample Exam Session
1. Click `exam_sessions` table
2. Click "Insert" → "Insert row"
3. Fill in:
   - **subject_name**: Mathematics 101
   - **subject_code**: MATH101
   - **exam_date**: 2026-01-20 (or any future date)
   - **period**: 1
   - **start_time**: 08:00
   - **duration_minutes**: 120
   - **student_count**: 45
   - **room_id**: (select from dropdown - the room you just created)
   - **academic_year**: 2025-2026
   - **semester**: Fall
4. Click "Save"

## Step 7: Test Connection (1 minute)

### 7.1 Restart Development Server
1. Stop the current server (Ctrl+C in terminal)
2. Run `start-app.bat` again
3. Browser should open automatically

### 7.2 Verify App Loads
1. Home page should load without errors
2. Navigate to **Dashboard** - should show weekly grid
3. Navigate to **Staff** - should show the staff member you added
4. No "supabaseKey is required" error!

## Troubleshooting

### Error: "supabaseKey is required"
- ❌ `.env.local` not updated with real keys
- ✅ Copy keys from Supabase dashboard → API settings
- ✅ Restart the development server after updating

### Error: "Failed to fetch"
- ❌ Wrong Supabase URL or keys
- ✅ Double-check you copied the complete URL and keys
- ✅ Make sure there are no extra spaces

### Error: "relation does not exist"
- ❌ Migrations not run
- ✅ Run both SQL migration files in Supabase SQL Editor

### Tables not showing in Table Editor
- ❌ SQL migrations had errors
- ✅ Check SQL Editor for error messages
- ✅ Make sure you ran both migration files

## Security Notes

⚠️ **IMPORTANT**:
- Never commit `.env.local` to Git (it's already in `.gitignore`)
- Never share your `service_role` key publicly
- The `anon` key is safe to use in frontend code
- Use Row Level Security (RLS) policies for production

## Next Steps

After successful setup:
1. ✅ Add more staff members
2. ✅ Add more rooms
3. ✅ Add exam sessions
4. ✅ Test the auto-assignment feature
5. ✅ Explore the dashboard

---

**Setup Complete!** 🎉 Your ESMS app is now connected to Supabase!

