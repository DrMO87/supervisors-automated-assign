# Complete Setup Guide - ESMS Application

## 🚨 Troubleshooting Current Error

### Error: "ENOENT: no such file or directory, open app-paths-manifest.json"

**This is a Next.js cache issue. Here's how to fix it:**

#### Solution 1: Clear Cache (Quick Fix)
```bash
# Run this batch file
clear-cache.bat
```

#### Solution 2: Manual Clear
1. Close the development server (Ctrl+C)
2. Delete the `.next` folder
3. Restart: `start-app.bat`

---

## 📋 Complete Setup - Step by Step

### Part 1: Prerequisites (5 minutes)

#### Step 1.1: Verify Node.js Installation
1. Open Command Prompt or PowerShell
2. Run: `node --version`
3. Should show: `v18.17.0` or higher
4. If not installed: Download from https://nodejs.org/

#### Step 1.2: Verify Project Files
1. Navigate to project folder
2. Confirm these files exist:
   - `package.json`
   - `.env.local`
   - `start-app.bat`

---

### Part 2: Create Supabase Account & Project (10 minutes)

#### Step 2.1: Create Supabase Account
1. **Open browser** and go to: https://supabase.com
2. Click **"Start your project"** button (top right)
3. Choose sign-up method:
   - **GitHub** (recommended - fastest)
   - **Google**
   - **Email** (requires verification)
4. Complete the sign-up process
5. You'll be redirected to the Supabase Dashboard

#### Step 2.2: Create New Project
1. On the dashboard, click **"New Project"** button
2. Fill in the project details:

   **Organization:**
   - If first time: Create new organization
   - Name it: "My University" or your organization name
   - Click "Create organization"

   **Project Details:**
   - **Name**: `ESMS` (or "Exam Supervision System")
   - **Database Password**: 
     - Click "Generate a password" OR
     - Create your own strong password
     - ⚠️ **IMPORTANT**: Copy and save this password somewhere safe!
   - **Region**: Choose closest to your location:
     - `East US` (for USA East Coast)
     - `West US` (for USA West Coast)
     - `Central EU` (for Europe)
     - `Southeast Asia` (for Asia)
   - **Pricing Plan**: Select **"Free"** (sufficient for development)

3. Click **"Create new project"**
4. ⏳ **Wait 1-2 minutes** for project creation
5. You'll see a progress indicator - don't close the page!

#### Step 2.3: Project Created Successfully
When done, you'll see:
- Green checkmark ✅
- "Project is ready" message
- Your project dashboard

---

### Part 3: Get Your API Keys (5 minutes)

#### Step 3.1: Navigate to API Settings
1. Look at the **left sidebar** of your Supabase project
2. Scroll down and click the **⚙️ Settings** icon (gear icon)
3. In the Settings menu, click **"API"**

#### Step 3.2: Find Your Credentials
You'll see a page titled "API Settings" with three important values:

**1. Project URL**
- Label: "Project URL" or "URL"
- Looks like: `https://abcdefghijklmnop.supabase.co`
- Click the **copy icon** 📋 next to it
- Paste it somewhere temporarily (Notepad)

**2. anon public key**
- Label: "anon public" under "Project API keys"
- Very long string starting with: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- Click the **copy icon** 📋
- Paste it in Notepad

**3. service_role key**
- Label: "service_role" under "Project API keys"
- Initially shows: `••••••••••••••••••••`
- Click **"Reveal"** button first
- Then click the **copy icon** 📋
- Paste it in Notepad
- ⚠️ **Keep this secret!** Never share publicly

#### Step 3.3: Verify You Have All Three
Check your Notepad has:
```
URL: https://xxxxx.supabase.co
ANON: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M...
SERVICE: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M...
```

---

### Part 4: Configure Environment Variables (3 minutes)

#### Step 4.1: Open .env.local File
1. In your project folder, find `.env.local`
2. Right-click → Open with → Notepad (or VS Code)

#### Step 4.2: Replace Placeholder Values
You'll see:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Replace with your actual values:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzODM2NTQwMCwiZXhwIjoxOTUzOTQxNDAwfQ.abcdefghijklmnopqrstuvwxyz1234567890
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjM4MzY1NDAwLCJleHAiOjE5NTM5NDE0MDB9.abcdefghijklmnopqrstuvwxyz1234567890
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### Step 4.3: Important Notes
- ✅ Copy the **ENTIRE** key (they're very long!)
- ✅ No spaces before or after the `=` sign
- ✅ No quotes around the values
- ✅ Keep `NEXT_PUBLIC_APP_URL=http://localhost:3000` as is

#### Step 4.4: Save the File
1. Press **Ctrl+S** to save
2. Close Notepad

---

### Part 5: Set Up Database (10 minutes)

#### Step 5.1: Open SQL Editor
1. Go back to your Supabase project dashboard
2. In the left sidebar, click **"SQL Editor"**
3. Click **"New query"** button

#### Step 5.2: Run First Migration (Create Tables)
1. In your project folder, open: `supabase/migrations/001_initial_schema.sql`
2. Open with Notepad
3. Press **Ctrl+A** to select all
4. Press **Ctrl+C** to copy
5. Go back to Supabase SQL Editor
6. Click in the query box
7. Press **Ctrl+V** to paste
8. Click **"Run"** button (or press Ctrl+Enter)
9. Wait for completion
10. You should see: **"Success. No rows returned"** ✅

#### Step 5.3: Run Second Migration (Security Policies)
1. Click **"New query"** again in Supabase
2. In your project folder, open: `supabase/migrations/002_rls_policies.sql`
3. Select all (Ctrl+A) and copy (Ctrl+C)
4. Paste in Supabase SQL Editor (Ctrl+V)
5. Click **"Run"**
6. Wait for: **"Success"** message ✅

#### Step 5.4: Verify Tables Created
1. In Supabase left sidebar, click **"Table Editor"**
2. You should see **6 tables**:
   - ✅ `staff`
   - ✅ `rooms`
   - ✅ `exam_sessions`
   - ✅ `assignments`
   - ✅ `system_settings`
   - ✅ `audit_log`

3. Click on `system_settings` table
4. You should see default settings already there

---

### Part 6: Start the Application (2 minutes)

#### Step 6.1: Clear Cache
1. Double-click `clear-cache.bat`
2. Wait for "Cache cleared" message

#### Step 6.2: Start Development Server
1. Double-click `start-app.bat`
2. Wait for server to start (10-15 seconds)
3. Browser should open automatically to http://localhost:3000

#### Step 6.3: Verify App Works
You should see:
- ✅ ESMS home page loads
- ✅ No error messages
- ✅ Navigation cards visible

---

### Part 7: Add Sample Data (Optional - 5 minutes)

#### Step 7.1: Add Sample Staff Member
1. In Supabase, go to **Table Editor**
2. Click on **`staff`** table
3. Click **"Insert"** button → **"Insert row"**
4. Fill in the form:
   - **name**: `Dr. John Smith`
   - **email**: `john.smith@university.edu`
   - **job_title**: Select `D` (Doctor)
   - **employment_status**: Select `Full-time`
   - **availability_status**: Select `Available`
   - **current_score**: `0`
   - Leave other fields as default
5. Click **"Save"**
6. You should see the new row in the table ✅

#### Step 7.2: Add Sample Room
1. Click on **`rooms`** table
2. Click **"Insert"** → **"Insert row"**
3. Fill in:
   - **room_name**: `Hall A`
   - **max_capacity**: `100`
   - **building**: `Main Building`
   - **floor**: `1`
   - **is_active**: Check the box (true)
4. Click **"Save"**

#### Step 7.3: Add Sample Exam Session
1. Click on **`exam_sessions`** table
2. Click **"Insert"** → **"Insert row"**
3. Fill in:
   - **subject_name**: `Mathematics 101`
   - **subject_code**: `MATH101`
   - **exam_date**: `2026-01-20` (or any future date)
   - **period**: `1`
   - **start_time**: `08:00`
   - **duration_minutes**: `120`
   - **student_count**: `45`
   - **room_id**: Select from dropdown (Hall A)
   - **academic_year**: `2025-2026`
   - **semester**: `Fall`
4. Click **"Save"**

#### Step 7.4: Verify in App
1. Go to your browser (http://localhost:3000)
2. Click **"Dashboard"**
3. You should see the exam session in the weekly grid ✅
4. Click **"Staff"**
5. You should see Dr. John Smith in the table ✅

---

## ✅ Setup Complete Checklist

Before you start using the app, verify:

- [ ] Node.js installed (v18.17.0+)
- [ ] Supabase account created
- [ ] Supabase project created (ESMS)
- [ ] API keys copied (URL, anon, service_role)
- [ ] `.env.local` updated with real keys
- [ ] Both SQL migrations run successfully
- [ ] 6 tables visible in Supabase Table Editor
- [ ] Cache cleared (`clear-cache.bat`)
- [ ] App starts without errors (`start-app.bat`)
- [ ] Home page loads in browser
- [ ] Dashboard page loads
- [ ] Staff page loads
- [ ] (Optional) Sample data added

---

## 🔧 Common Issues & Solutions

### Issue 1: "supabaseKey is required"
**Cause**: Environment variables not set correctly

**Solution**:
1. Open `.env.local`
2. Verify all three keys are real values (not placeholders)
3. No extra spaces or quotes
4. Save file
5. Restart server: Close terminal (Ctrl+C) → Run `start-app.bat`

### Issue 2: "ENOENT: app-paths-manifest.json"
**Cause**: Next.js cache corruption

**Solution**:
1. Run `clear-cache.bat`
2. Restart server

### Issue 3: "Failed to fetch" or "Network error"
**Cause**: Wrong Supabase URL or keys

**Solution**:
1. Go to Supabase → Settings → API
2. Copy keys again (make sure you copy the ENTIRE key)
3. Update `.env.local`
4. Restart server

### Issue 4: "relation does not exist"
**Cause**: Database migrations not run

**Solution**:
1. Go to Supabase SQL Editor
2. Run `001_initial_schema.sql` (copy entire file)
3. Run `002_rls_policies.sql` (copy entire file)
4. Check Table Editor - should see 6 tables

### Issue 5: Tables not showing in Supabase
**Cause**: SQL migration had errors

**Solution**:
1. In SQL Editor, check for error messages
2. Make sure you copied the ENTIRE SQL file
3. Run migrations in order (001 first, then 002)
4. If still failing, create new Supabase project and try again

### Issue 6: Port 3000 already in use
**Cause**: Another app using port 3000

**Solution**:
1. Close other apps using port 3000
2. OR edit `package.json` → change `"dev": "next dev -p 3001"`
3. Update `.env.local` → `NEXT_PUBLIC_APP_URL=http://localhost:3001`

---

## 🎯 Next Steps After Setup

### 1. Explore the Application
- Navigate through all pages
- Understand the layout
- Check the dashboard weekly view

### 2. Add More Data
- Add more staff members
- Add more rooms
- Add more exam sessions

### 3. Test Auto-Assignment
- Add several exam sessions for the same week
- Add multiple staff members
- Click "Auto-Assign" button on dashboard
- See how staff are assigned based on scores

### 4. Customize Settings
- Go to Settings page
- View system configuration
- (Future: Edit settings)

---

## 📚 Additional Resources

### Documentation Files
- `README.md` - Project overview
- `QUICK_START.md` - 5-minute quick start
- `PROJECT_SUMMARY.md` - Feature list
- `DEVELOPER_GUIDE.md` - Development guidelines
- `SUPABASE_SETUP.md` - Detailed Supabase guide
- `WHERE_TO_FIND_KEYS.md` - Visual guide for API keys

### Batch Files
- `start-app.bat` - Start development server
- `build-app.bat` - Build for production
- `clear-cache.bat` - Clear Next.js cache
- `setup-supabase.bat` - Automated setup wizard
- `open-supabase.bat` - Quick access to Supabase

### Online Resources
- Supabase Docs: https://supabase.com/docs
- Next.js Docs: https://nextjs.org/docs
- React Docs: https://react.dev

---

## 🆘 Still Need Help?

### Option 1: Run Automated Setup
```bash
setup-supabase.bat
```
This wizard will guide you through the entire process.

### Option 2: Check Detailed Guides
- `SUPABASE_SETUP.md` - Step-by-step with screenshots
- `WHERE_TO_FIND_KEYS.md` - Visual guide for finding keys

### Option 3: Verify Each Step
Go through this checklist:
1. ✅ Supabase project exists and is active
2. ✅ Can log in to Supabase dashboard
3. ✅ API keys are visible in Settings → API
4. ✅ `.env.local` has real keys (not placeholders)
5. ✅ SQL migrations ran without errors
6. ✅ 6 tables visible in Table Editor
7. ✅ Cache cleared
8. ✅ Server starts without errors

---

**Setup Complete!** 🎉

Your ESMS application is now connected to Supabase and ready to use!


