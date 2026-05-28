# Where to Find Your Supabase API Keys

## Visual Guide with Screenshots

### Step 1: Open Your Supabase Project

1. Go to https://supabase.com/dashboard
2. Click on your project (ESMS)

```
┌─────────────────────────────────────────┐
│  Supabase Dashboard                     │
├─────────────────────────────────────────┤
│                                         │
│  Your Projects:                         │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  ESMS                           │   │  ← Click here
│  │  Active • Free Plan             │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### Step 2: Navigate to API Settings

Look at the **left sidebar** and click on **Settings** (gear icon ⚙️)

```
┌──────────────────────┬──────────────────────────┐
│                      │                          │
│  🏠 Home            │  Project Dashboard       │
│  📊 Table Editor    │                          │
│  📝 SQL Editor      │                          │
│  🔐 Authentication  │                          │
│  📦 Storage         │                          │
│  ⚙️  Settings  ←────┼─ Click here             │
│                      │                          │
└──────────────────────┴──────────────────────────┘
```

Then click on **API** in the settings submenu:

```
Settings Menu:
├── General
├── Database
├── API  ← Click here
├── Auth
└── Storage
```

### Step 3: Copy Your Credentials

You'll see a page with your API credentials:

```
┌─────────────────────────────────────────────────────────┐
│  API Settings                                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Project URL                                            │
│  ┌───────────────────────────────────────────────────┐ │
│  │ https://abcdefghijklmnop.supabase.co             │ │ ← Copy this
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  API Keys                                               │
│                                                         │
│  anon public                                            │
│  ┌───────────────────────────────────────────────────┐ │
│  │ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M...  │ │ ← Copy this
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  service_role                                           │
│  ┌───────────────────────────────────────────────────┐ │
│  │ ••••••••••••••••••••••••••••••••  [Reveal]       │ │ ← Click Reveal
│  └───────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Step 4: What to Copy Where

#### 1. Project URL
**What it looks like:**
```
https://abcdefghijklmnop.supabase.co
```

**Where to paste in `.env.local`:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
```

#### 2. anon public key
**What it looks like:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzODM2NTQwMCwiZXhwIjoxOTUzOTQxNDAwfQ.abcdefghijklmnopqrstuvwxyz1234567890
```
(Very long string starting with `eyJ`)

**Where to paste in `.env.local`:**
```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M...
```

#### 3. service_role key
**First:** Click the **[Reveal]** button

**What it looks like:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjM4MzY1NDAwLCJleHAiOjE5NTM5NDE0MDB9.abcdefghijklmnopqrstuvwxyz1234567890
```
(Also very long, starts with `eyJ`)

**Where to paste in `.env.local`:**
```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M...
```

### Complete `.env.local` Example

After copying all three values, your `.env.local` should look like:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzODM2NTQwMCwiZXhwIjoxOTUzOTQxNDAwfQ.abcdefghijklmnopqrstuvwxyz1234567890
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjM4MzY1NDAwLCJleHAiOjE5NTM5NDE0MDB9.abcdefghijklmnopqrstuvwxyz1234567890

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Common Mistakes to Avoid

❌ **DON'T**:
- Leave placeholder text like `your-project-url`
- Add extra spaces before or after the values
- Forget to click "Reveal" for service_role key
- Copy only part of the key (they're very long!)
- Add quotes around the values

✅ **DO**:
- Copy the ENTIRE URL including `https://`
- Copy the ENTIRE key (starts with `eyJ` and is very long)
- Make sure there are no line breaks in the keys
- Save the file after pasting (Ctrl+S)
- Restart the dev server after updating

## Quick Test

After updating `.env.local`, test if it works:

1. **Stop the server** (Ctrl+C in terminal)
2. **Start again**: Run `start-app.bat`
3. **Check browser**: Should load without "supabaseKey is required" error

If you still see the error:
- Double-check you copied the complete keys
- Make sure you saved `.env.local`
- Make sure the file is named exactly `.env.local` (not `.env.local.txt`)

## Need Help?

Run the automated setup wizard:
```bash
setup-supabase.bat
```

It will guide you through the entire process step-by-step!

---

**Still stuck?** Check `SUPABASE_SETUP.md` for the complete detailed guide.

