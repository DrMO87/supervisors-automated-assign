# ESMS Setup Guide

Complete step-by-step guide to set up and run the Faculty Exam Supervision & Proctoring System.

## Prerequisites

Before you begin, ensure you have:
- **Node.js** 18.17.0 or higher ([Download](https://nodejs.org/))
- **npm** 9.0.0 or higher (comes with Node.js)
- **Supabase account** (free tier available at [supabase.com](https://supabase.com))
- **Modern web browser** (Chrome, Firefox, Edge, or Safari)

## Step 1: Verify Installation

Open your terminal and verify Node.js and npm are installed:

```bash
node --version
# Should show v18.17.0 or higher

npm --version
# Should show 9.0.0 or higher
```

## Step 2: Install Dependencies

Navigate to the project directory and install all required packages:

```bash
cd "d:\HUE\DEVELOPED SOFTWARE\Supervisors Automated Assign"
npm install
```

This will install all dependencies listed in `package.json`. The installation may take 2-3 minutes.

## Step 3: Set Up Supabase Database

### 3.1 Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign in or create a free account
3. Click "New Project"
4. Fill in the project details:
   - **Name**: ESMS (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Select the closest region to your location
5. Click "Create new project" and wait for setup to complete (1-2 minutes)

### 3.2 Run Database Migrations

1. In your Supabase project dashboard, click on the **SQL Editor** in the left sidebar
2. Click "New Query"
3. Open the file `supabase/migrations/001_initial_schema.sql` from this project
4. Copy the entire contents and paste into the Supabase SQL Editor
5. Click "Run" to execute the migration
6. Repeat steps 2-5 for `supabase/migrations/002_rls_policies.sql`

You should see success messages indicating tables were created.

### 3.3 Get Your Supabase Credentials

1. In your Supabase project dashboard, click on the **Settings** icon (gear) in the left sidebar
2. Click on **API** under Project Settings
3. You'll see two important values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")
   - **service_role** key (under "Project API keys" - click "Reveal" to see it)

**Important**: Keep the service_role key secret! Never commit it to version control.

## Step 4: Configure Environment Variables

1. In the project root, you'll find a file named `.env.local`
2. Open it in a text editor
3. Replace the placeholder values with your actual Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3010
```

4. Save the file

## Step 5: Run the Development Server

Start the Next.js development server:

```bash
npm run dev
```

You should see output similar to:
```
> esms-app@1.0.0 dev
> next dev

  ▲ Next.js 15.1.0
  - Local:        http://localhost:3010
  - Ready in 2.3s
```

## Step 6: Access the Application

1. Open your web browser
2. Navigate to [http://localhost:3010](http://localhost:3010)
3. You should see the ESMS home page with navigation cards

## Step 7: Add Sample Data (Optional)

To test the system, you can add sample data directly in Supabase:

### Add Sample Staff

1. Go to Supabase Dashboard → Table Editor → `staff` table
2. Click "Insert row" and add:
   - **name**: Dr. John Smith
   - **email**: john.smith@university.edu
   - **job_title**: D (Doctor)
   - **employment_status**: Full-time
   - **availability_status**: Available
   - **current_score**: 0

Repeat for a few more staff members with different job titles (Ch, D, TA).

### Add Sample Rooms

1. Go to Table Editor → `rooms` table
2. Click "Insert row" and add:
   - **room_name**: Hall A
   - **max_capacity**: 100
   - **building**: Main Building
   - **floor**: 1
   - **is_active**: true

Add a few more rooms.

### Add Sample Exam Sessions

1. Go to Table Editor → `exam_sessions` table
2. Click "Insert row" and add:
   - **subject_name**: Mathematics 101
   - **subject_code**: MATH101
   - **exam_date**: 2026-01-15 (or any future date)
   - **period**: 1 (Morning)
   - **start_time**: 08:00
   - **duration_minutes**: 120
   - **student_count**: 45
   - **room_id**: (select from dropdown - one of your created rooms)
   - **academic_year**: 2025-2026
   - **semester**: Fall

## Troubleshooting

### Port 3000 Already in Use

If you see an error that port 3000 is already in use:

```bash
# Use a different port
npm run dev -- -p 3011
```

Then access the app at `http://localhost:3011`

### Database Connection Errors

If you see "Failed to fetch" or connection errors:
1. Verify your `.env.local` file has the correct Supabase URL and keys
2. Check that you ran both migration files in Supabase
3. Ensure your Supabase project is active (not paused)

### TypeScript Errors

Run type checking to see detailed errors:

```bash
npm run type-check
```

## Next Steps

Now that your system is running:

1. **Add Staff Members**: Navigate to Staff Management and add your faculty
2. **Configure Rooms**: Set up your exam halls in Room Management
3. **Create Exam Sessions**: Add exam schedules in Exam Sessions
4. **Test Auto-Assignment**: Go to Dashboard and click "Auto-Assign Week"

## Production Deployment

For production deployment to Vercel:

1. Push your code to GitHub (excluding `.env.local`)
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Add environment variables in Vercel project settings
4. Deploy!

## Support

For issues or questions:
- Check the main README.md for architecture details
- Review the database schema in `supabase/migrations/`
- Examine the auto-assignment algorithm in `lib/algorithms/auto-assignment.ts`

