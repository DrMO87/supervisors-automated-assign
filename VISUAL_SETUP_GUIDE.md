# Visual Step-by-Step Setup Guide

Complete visual guide with detailed descriptions of what you'll see at each step.

---

## 🎯 Part 1: Create Supabase Account

### Step 1: Go to Supabase Website

**What to do:**
- Open browser
- Go to: https://supabase.com

**What you'll see:**
```
┌─────────────────────────────────────────────────────┐
│  Supabase Logo                                      │
│                                                     │
│  Build in a weekend                                 │
│  Scale to millions                                  │
│                                                     │
│  [Start your project]  [Documentation]             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Action:** Click **"Start your project"** button (green button, top right)

---

### Step 2: Sign Up

**What you'll see:**
```
┌─────────────────────────────────────────────────────┐
│  Sign in to Supabase                                │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  [GitHub icon] Continue with GitHub         │   │ ← Recommended
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  [Google icon] Continue with Google         │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  [Email icon] Continue with Email           │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Action:** Click your preferred sign-in method (GitHub is fastest)

---

### Step 3: Authorize (if using GitHub/Google)

**What you'll see (GitHub example):**
```
┌─────────────────────────────────────────────────────┐
│  Authorize Supabase                                 │
│                                                     │
│  Supabase by Supabase would like permission to:    │
│  • Verify your GitHub identity                     │
│  • Read your email address                         │
│                                                     │
│  [Cancel]  [Authorize Supabase]                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Action:** Click **"Authorize Supabase"**

---

## 🎯 Part 2: Create Your First Project

### Step 4: Create Organization (First Time Only)

**What you'll see:**
```
┌─────────────────────────────────────────────────────┐
│  Create an organization                             │
│                                                     │
│  Organization name                                  │
│  ┌─────────────────────────────────────────────┐   │
│  │ My University                               │   │ ← Type here
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [Cancel]  [Create organization]                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Action:** 
1. Type organization name (e.g., "My University")
2. Click **"Create organization"**

---

### Step 5: New Project Form

**What you'll see:**
```
┌─────────────────────────────────────────────────────┐
│  Create a new project                               │
│                                                     │
│  Organization: My University                        │
│                                                     │
│  Name *                                             │
│  ┌─────────────────────────────────────────────┐   │
│  │ ESMS                                        │   │ ← Type "ESMS"
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Database Password *                                │
│  ┌─────────────────────────────────────────────┐   │
│  │ ••••••••••••••••  [Generate]  [👁 Show]    │   │ ← Click Generate
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Region *                                           │
│  ┌─────────────────────────────────────────────┐   │
│  │ East US (North Virginia) ▼                  │   │ ← Choose closest
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Pricing Plan                                       │
│  ○ Free  ● Pro  ○ Team  ○ Enterprise               │ ← Select Free
│                                                     │
│  [Cancel]  [Create new project]                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Actions:**
1. **Name**: Type `ESMS`
2. **Password**: Click **"Generate a password"**
3. **IMPORTANT**: Click the eye icon 👁 to show password
4. **COPY THE PASSWORD** and save it somewhere safe!
5. **Region**: Select closest to you
6. **Pricing**: Make sure **"Free"** is selected
7. Click **"Create new project"**

---

### Step 6: Wait for Project Creation

**What you'll see:**
```
┌─────────────────────────────────────────────────────┐
│  Setting up your project                            │
│                                                     │
│  ⏳ Initializing project...                         │
│  ⏳ Setting up database...                          │
│  ⏳ Configuring API...                              │
│                                                     │
│  This usually takes 1-2 minutes                     │
│                                                     │
│  [████████████░░░░░░░░] 60%                        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Action:** Wait patiently (1-2 minutes). Don't close the page!

---

### Step 7: Project Ready!

**What you'll see:**
```
┌─────────────────────────────────────────────────────┐
│  ✅ Project is ready!                               │
│                                                     │
│  Welcome to your ESMS project                       │
│                                                     │
│  [Go to project]                                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Action:** Click **"Go to project"** or wait for auto-redirect

---

## 🎯 Part 3: Get API Keys

### Step 8: Navigate to Settings

**What you'll see (Project Dashboard):**
```
┌──────────────┬──────────────────────────────────────┐
│ 🏠 Home      │  ESMS Project                        │
│ 📊 Table Ed. │                                      │
│ 📝 SQL Ed.   │  Quick Stats:                        │
│ 🔐 Auth      │  • Database: Active                  │
│ 📦 Storage   │  • API: Running                      │
│ 📈 Reports   │                                      │
│              │                                      │
│ ⚙️ Settings  │ ← Click here                         │
│   General    │                                      │
│   Database   │                                      │
│   API        │ ← Then click here                    │
│   Auth       │                                      │
└──────────────┴──────────────────────────────────────┘
```

**Actions:**
1. Click **⚙️ Settings** in left sidebar (scroll down if needed)
2. Click **"API"** in the settings submenu

---

### Step 9: Copy Project URL

**What you'll see:**
```
┌─────────────────────────────────────────────────────┐
│  API Settings                                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Configuration                                      │
│                                                     │
│  Project URL                                        │
│  ┌──────────────────────────────────────────────┐  │
│  │ https://abcdefghijklmnop.supabase.co    [📋] │  │ ← Click copy icon
│  └──────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Actions:**
1. Click the **📋 copy icon** next to the URL
2. Open Notepad
3. Paste the URL (Ctrl+V)
4. Label it: `URL: https://abcdefghijklmnop.supabase.co`

---

### Step 10: Copy anon public Key

**What you'll see (scroll down on same page):**
```
┌─────────────────────────────────────────────────────┐
│  Project API keys                                   │
│                                                     │
│  anon public                                        │
│  This key is safe to use in a browser if you have  │
│  enabled Row Level Security for your tables.       │
│  ┌──────────────────────────────────────────────┐  │
│  │ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ... │  │
│  │ ...very long string...                  [📋] │  │ ← Click copy
│  └──────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Actions:**
1. Click the **📋 copy icon**
2. Go to Notepad
3. Paste (Ctrl+V)
4. Label it: `ANON: eyJhbGci...`

---

### Step 11: Copy service_role Key

**What you'll see (scroll down more):**
```
┌─────────────────────────────────────────────────────┐
│  service_role secret                                │
│  This key has the ability to bypass Row Level      │
│  Security. Never share it publicly.                │
│  ┌──────────────────────────────────────────────┐  │
│  │ ••••••••••••••••••••••••••••••  [Reveal] [📋]│  │ ← Click Reveal first!
│  └──────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Actions:**
1. Click **"Reveal"** button
2. The key will appear: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
3. Click the **📋 copy icon**
4. Go to Notepad
5. Paste (Ctrl+V)
6. Label it: `SERVICE: eyJhbGci...`

**Your Notepad should now have:**
```
URL: https://abcdefghijklmnop.supabase.co
ANON: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS...
SERVICE: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS...
```

---

## 🎯 Part 4: Update .env.local

### Step 12: Open .env.local File

**In File Explorer:**
1. Navigate to: `D:\HUE\DEVELOPED SOFTWARE\Supervisors Automated Assign`
2. Find file: `.env.local`
3. Right-click → **Open with** → **Notepad**

**What you'll see:**
```
# Supabase Configuration
# Replace these with your actual Supabase project credentials
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

### Step 13: Replace with Real Values

**Edit the file:**

1. Select `https://your-project.supabase.co`
2. Delete it
3. Paste your real URL from Notepad
4. Select `your-anon-key-here`
5. Delete it
6. Paste your real ANON key from Notepad
7. Select `your-service-role-key-here`
8. Delete it
9. Paste your real SERVICE key from Notepad

**After editing, it should look like:**
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzODM2NTQwMCwiZXhwIjoxOTUzOTQxNDAwfQ.abcdefghijklmnopqrstuvwxyz1234567890
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjM4MzY1NDAwLCJleHAiOjE5NTM5NDE0MDB9.abcdefghijklmnopqrstuvwxyz1234567890

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Save the file:**
- Press **Ctrl+S**
- Close Notepad

---

## 🎯 Part 5: Set Up Database Tables

### Step 14: Open SQL Editor

**In Supabase Dashboard:**
```
┌──────────────┬──────────────────────────────────────┐
│ 🏠 Home      │                                      │
│ 📊 Table Ed. │                                      │
│ 📝 SQL Ed.   │ ← Click here                         │
│ 🔐 Auth      │                                      │
│ 📦 Storage   │                                      │
└──────────────┴──────────────────────────────────────┘
```

**What you'll see:**
```
┌─────────────────────────────────────────────────────┐
│  SQL Editor                                         │
│                                                     │
│  [+ New query]  [Templates ▼]                      │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ -- Write your SQL here                        │ │
│  │                                               │ │
│  │                                               │ │
│  │                                               │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  [Run] [Format] [Clear]                            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Action:** Click **"+ New query"**

---

### Step 15: Run First Migration

**Open migration file:**
1. In File Explorer, go to project folder
2. Open folder: `supabase\migrations`
3. Right-click `001_initial_schema.sql`
4. Open with Notepad

**What you'll see in Notepad:**
```sql
-- ESMS Database Schema
-- Initial schema for Faculty Exam Supervision System

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Staff table
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ...
```

**Actions:**
1. Press **Ctrl+A** (select all)
2. Press **Ctrl+C** (copy)
3. Go back to Supabase SQL Editor
4. Click in the query box
5. Press **Ctrl+V** (paste)
6. Click **"Run"** button (or press Ctrl+Enter)

**What you'll see after running:**
```
┌─────────────────────────────────────────────────────┐
│  Results                                            │
│                                                     │
│  ✅ Success. No rows returned                       │
│                                                     │
│  Execution time: 234ms                              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**If you see errors:** Make sure you copied the ENTIRE file!

---

### Step 16: Run Second Migration

**Actions:**
1. In Supabase, click **"+ New query"** again
2. In File Explorer, open `002_rls_policies.sql` with Notepad
3. Select all (Ctrl+A) and copy (Ctrl+C)
4. Paste in Supabase SQL Editor (Ctrl+V)
5. Click **"Run"**

**What you'll see:**
```
┌─────────────────────────────────────────────────────┐
│  Results                                            │
│                                                     │
│  ✅ Success. No rows returned                       │
│                                                     │
│  Execution time: 156ms                              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

### Step 17: Verify Tables Created

**In Supabase, click Table Editor:**
```
┌──────────────┬──────────────────────────────────────┐
│ 🏠 Home      │                                      │
│ 📊 Table Ed. │ ← Click here                         │
│ 📝 SQL Ed.   │                                      │
└──────────────┴──────────────────────────────────────┘
```

**What you'll see:**
```
┌──────────────┬──────────────────────────────────────┐
│ Tables       │  staff                               │
│              │                                      │
│ ✅ staff     │  Columns: id, name, email, ...       │
│ ✅ rooms     │                                      │
│ ✅ exam_...  │  [Insert] [Filter] [Sort]            │
│ ✅ assign... │                                      │
│ ✅ system... │  No rows yet                         │
│ ✅ audit_... │                                      │
│              │                                      │
└──────────────┴──────────────────────────────────────┘
```

**Verify:** You should see **6 tables** in the left sidebar!

---

## 🎯 Part 6: Start the Application

### Step 18: Clear Cache

**In project folder:**
1. Find `clear-cache.bat`
2. Double-click it

**What you'll see:**
```
========================================
  ESMS - Clear Cache
========================================

[INFO] Clearing Next.js cache...

[INFO] Removing .next folder...
[SUCCESS] .next folder removed

[SUCCESS] Cache cleared successfully!
========================================

You can now run start-app.bat

Press any key to continue . . .
```

**Action:** Press any key to close

---

### Step 19: Start Development Server

**In project folder:**
1. Find `start-app.bat`
2. Double-click it

**What you'll see in terminal:**
```
========================================
  ESMS - Exam Supervision System
========================================

[INFO] Node.js version:
v22.16.0

[INFO] Starting development server...
[INFO] Opening browser automatically...

Press Ctrl+C to stop the server
========================================

> esms-app@1.0.0 dev
> next dev

▲ Next.js 15.5.9
- Local:        http://localhost:3000
- Network:      http://192.168.1.23:3000

✓ Starting...
✓ Ready in 2.1s
```

**Browser will open automatically!**

---

### Step 20: Verify App Works

**What you'll see in browser:**
```
┌─────────────────────────────────────────────────────┐
│  ESMS - Faculty Exam Supervision System             │
│                                                     │
│  Welcome to ESMS                                    │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ 📊       │  │ 👥       │  │ 🏢       │         │
│  │Dashboard │  │  Staff   │  │  Rooms   │         │
│  └──────────┘  └──────────┘  └──────────┘         │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ 📝       │  │ 📄       │  │ ⚙️       │         │
│  │  Exams   │  │ Reports  │  │ Settings │         │
│  └──────────┘  └──────────┘  └──────────┘         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**✅ SUCCESS!** If you see this, setup is complete!

---

## 🎉 Setup Complete!

### What You've Accomplished:
- ✅ Created Supabase account
- ✅ Created ESMS project
- ✅ Got API keys
- ✅ Configured environment variables
- ✅ Set up database with 6 tables
- ✅ Started the application
- ✅ App is running without errors!

### Next Steps:
1. **Explore the app** - Click through all the pages
2. **Add sample data** - See `COMPLETE_SETUP_GUIDE.md` Part 7
3. **Test features** - Try the dashboard and staff pages

### Need Help?
- See `COMPLETE_SETUP_GUIDE.md` for troubleshooting
- See `SUPABASE_QUICK_REFERENCE.md` for quick commands
- Run `setup-supabase.bat` for automated setup

---

**Congratulations!** 🎊 Your ESMS application is now fully set up and connected to Supabase!

